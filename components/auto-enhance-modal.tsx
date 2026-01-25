"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Search, Sparkles, Zap } from "lucide-react"
import { useEditor } from "./editor-context"

interface AutoEnhanceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEnhance: (prompt: string, ragResults?: Array<{ start: number; end: number; score: number }>) => void
}

export function AutoEnhanceModal({ open, onOpenChange, onEnhance }: AutoEnhanceModalProps) {
  const [prompt, setPrompt] = useState("")
  const [useRAG, setUseRAG] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [ragResults, setRagResults] = useState<Array<{ start: number; end: number; score: number }> | null>(null)
  const { mediaFiles, projectId } = useEditor()

  const handleSearch = async () => {
    if (!prompt.trim() || !projectId) return

    // Find indexed videos (videos with twelveLabsIndexId and status ready)
    const indexedVideos = mediaFiles.filter(
      m => m.type === "video" && m.twelveLabsIndexId && m.twelveLabsStatus === "ready"
    )
    
    if (indexedVideos.length === 0) {
      alert("No indexed videos found. Please index your videos first using Video RAG search in the Media Panel.")
      return
    }

    setIsSearching(true)
    try {
      // Search all indexed videos
      const searchPromises = indexedVideos.map(async (media) => {
        const response = await fetch("/api/twelvelabs/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            indexId: media.twelveLabsIndexId,
            query: prompt,
            options: {
              conversation_option: "semantic",
            },
          }),
        })

        if (!response.ok) {
          console.error(`Search failed for ${media.name}`)
          return []
        }

        const result = await response.json()
        return (result.data || []).map((clip: any) => ({
          start: clip.start,
          end: clip.end,
          score: clip.score || 0,
          mediaId: media.id,
          mediaName: media.name,
        }))
      })

      const allResults = (await Promise.all(searchPromises)).flat()
      
      // Sort by score and take top 5 results
      const topResults = allResults
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

      setRagResults(topResults)
    } catch (error) {
      console.error("RAG search error:", error)
      alert("Failed to search videos. Please try again.")
    } finally {
      setIsSearching(false)
    }
  }

  const handleEnhance = () => {
    if (!prompt.trim()) {
      // No prompt - do generic auto enhance
      onEnhance("Analyze my video timeline and automatically apply smart improvements. Look at all clips and suggest enhancements like: trimming dead air at the start/end, applying cinematic effects, removing green screens if present, improving pacing with strategic splits, and any other optimizations. Apply all suggested improvements automatically.")
    } else if (useRAG && ragResults && ragResults.length > 0) {
      // Use prompt + RAG results
      const ragContext = ragResults.map((r, i) => 
        `${i + 1}. "${r.mediaName}" from ${r.start}s to ${r.end}s (relevance: ${(r.score * 100).toFixed(0)}%)`
      ).join("\n")
      
      const enhancedPrompt = `${prompt}\n\nVideo RAG found these relevant sections:\n${ragContext}\n\nBased on my request and these relevant sections, automatically apply appropriate edits and enhancements to the timeline. Focus on the identified sections but feel free to enhance other parts too.`
      
      onEnhance(enhancedPrompt, ragResults)
    } else {
      // Just use the prompt
      onEnhance(`${prompt}\n\nBased on my request, automatically apply appropriate edits and enhancements to the timeline.`)
    }
    
    // Reset and close
    setPrompt("")
    setUseRAG(false)
    setRagResults(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Auto Enhance Video
          </DialogTitle>
          <DialogDescription>
            Describe what you want or leave blank for general improvements. Optionally use Video RAG to find specific sections.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Prompt Input */}
          <div className="space-y-2">
            <Label htmlFor="enhance-prompt">
              What would you like to enhance? (optional)
            </Label>
            <Input
              id="enhance-prompt"
              placeholder="e.g., Make it more cinematic, highlight action scenes, remove green screens..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="h-10"
            />
          </div>

          {/* Video RAG Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="use-rag"
              checked={useRAG}
              onChange={(e) => setUseRAG(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="use-rag" className="text-sm font-normal cursor-pointer">
              Use Video RAG to find relevant sections (requires indexed videos)
            </Label>
          </div>

          {/* RAG Search Button */}
          {useRAG && prompt.trim() && (
            <Button
              onClick={handleSearch}
              disabled={isSearching}
              variant="outline"
              className="w-full"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching videos...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search for relevant sections
                </>
              )}
            </Button>
          )}

          {/* RAG Results */}
          {ragResults && ragResults.length > 0 && (
            <div className="rounded-md bg-muted/50 p-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Found {ragResults.length} relevant sections:</div>
              <div className="space-y-1.5">
                {ragResults.map((result, i) => (
                  <div key={i} className="text-xs bg-background rounded px-2 py-1.5">
                    <div className="font-medium">{result.mediaName}</div>
                    <div className="text-muted-foreground">
                      {result.start.toFixed(1)}s - {result.end.toFixed(1)}s 
                      <span className="ml-2 text-primary">({(result.score * 100).toFixed(0)}% match)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ragResults && ragResults.length === 0 && (
            <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3 text-xs text-yellow-600 dark:text-yellow-400">
              No relevant sections found. Try a different search or proceed without RAG.
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleEnhance}
            className="flex-1 bg-gradient-to-r from-primary to-primary/80"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Enhance Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
