"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Film, Sparkles, FolderOpen, Search, Send, Upload, X, Play, Loader2, Cloud, CloudOff, Scissors, Trash2, Wand2, Check, AlertCircle } from "lucide-react"
import { useEditor, MediaFile } from "./editor-context"
import { useVideoAgent, type ToolCallInfo } from "@/lib/agent/use-agent"

export function MediaPanel() {
  const [activeTab, setActiveTab] = useState("media")
  const { mediaFiles, addMediaFiles, removeMediaFile } = useEditor()

  return (
    <div className="flex h-full flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
        <div className="border-b border-border px-3 py-2">
          <TabsList className="grid w-full grid-cols-3 bg-secondary">
            <TabsTrigger value="media" className="text-xs">
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
              Media
            </TabsTrigger>
            <TabsTrigger value="clips" className="text-xs">
              <Film className="mr-1.5 h-3.5 w-3.5" />
              Clips
            </TabsTrigger>
            <TabsTrigger value="agent" className="text-xs">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Agent
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="media" className="m-0 h-full">
            <MediaTab 
              mediaFiles={mediaFiles} 
              onFilesAdded={addMediaFiles} 
              onRemoveFile={removeMediaFile}
            />
          </TabsContent>
          <TabsContent value="clips" className="m-0 h-full">
            <ClipsTab />
          </TabsContent>
          <TabsContent value="agent" className="m-0 h-full">
            <AgentTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

interface MediaTabProps {
  mediaFiles: MediaFile[]
  onFilesAdded: (files: MediaFile[]) => void
  onRemoveFile: (id: string) => void
}

function MediaTab({ mediaFiles, onFilesAdded, onRemoveFile }: MediaTabProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const generateThumbnail = useCallback((file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const video = document.createElement("video")
      video.preload = "metadata"
      video.muted = true
      video.playsInline = true

      video.onloadeddata = () => {
        video.currentTime = 1 // Seek to 1 second for thumbnail
      }

      video.onseeked = () => {
        const canvas = document.createElement("canvas")
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL("image/jpeg", 0.7))
        } else {
          resolve(null)
        }
        URL.revokeObjectURL(video.src)
      }

      video.onerror = () => {
        resolve(null)
        URL.revokeObjectURL(video.src)
      }

      video.src = URL.createObjectURL(file)
    })
  }, [])

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const getVideoDuration = useCallback((file: File): Promise<{ formatted: string; seconds: number }> => {
    return new Promise((resolve) => {
      const video = document.createElement("video")
      video.preload = "metadata"

      video.onloadedmetadata = () => {
        resolve({ formatted: formatDuration(video.duration), seconds: video.duration })
        URL.revokeObjectURL(video.src)
      }

      video.onerror = () => {
        resolve({ formatted: "00:00", seconds: 0 })
        URL.revokeObjectURL(video.src)
      }

      video.src = URL.createObjectURL(file)
    })
  }, [])

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const videoFiles = Array.from(files).filter((file) =>
        file.type.startsWith("video/")
      )

      const processedFiles: MediaFile[] = await Promise.all(
        videoFiles.map(async (file) => {
          const [thumbnail, durationData] = await Promise.all([
            generateThumbnail(file),
            getVideoDuration(file),
          ])

          return {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            name: file.name,
            duration: durationData.formatted,
            durationSeconds: durationData.seconds,
            thumbnail,
            type: file.type,
            objectUrl: URL.createObjectURL(file),
          }
        })
      )

      if (processedFiles.length > 0) {
        onFilesAdded(processedFiles)
      }
    },
    [generateThumbnail, getVideoDuration, onFilesAdded]
  )

  const handleMediaDragStart = useCallback((e: React.DragEvent, media: MediaFile) => {
    e.dataTransfer.setData("application/x-media-id", media.id)
    e.dataTransfer.effectAllowed = "copy"
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files = e.dataTransfer.files
      if (files.length > 0) {
        processFiles(files)
      }
    },
    [processFiles]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        processFiles(files)
      }
      // Reset input so same file can be selected again
      e.target.value = ""
    },
    [processFiles]
  )

  const filteredFiles = mediaFiles.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      {/* 
        Search Media - TODO: Implement NLP search via 12 Labs Video RAG
        Priority: clip name match > NLP search (if no name match found)
        Should stream response for NLP results
      */}
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search media..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Drop zone & media grid */}
      <div
        className={`flex-1 overflow-y-auto p-3 scrollbar-thin transition-colors ${
          isDragOver ? "bg-primary/10" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {mediaFiles.length === 0 ? (
          /* Empty state - drop zone */
          <div
            className={`flex h-full flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload
              className={`h-10 w-10 mb-3 transition-colors ${
                isDragOver ? "text-primary" : "text-muted-foreground"
              }`}
            />
            <p className="text-sm font-medium text-foreground mb-1">
              Drop videos here
            </p>
            <p className="text-xs text-muted-foreground">
              or click to browse
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-2">
              MP4, MOV, WebM, AVI
            </p>
          </div>
        ) : (
          /* Media grid */
        <div className="space-y-2">
            {/* Add more button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Add more videos
            </button>

            {/* Media items */}
            {filteredFiles.map((media) => (
            <div
                key={media.id}
              className={`group relative aspect-video overflow-hidden rounded border bg-muted ${
                media.isUploading 
                  ? "border-primary/50 opacity-70" 
                  : "border-border hover:border-primary cursor-grab active:cursor-grabbing"
              }`}
                draggable={!media.isUploading}
                onDragStart={(e) => !media.isUploading && handleMediaDragStart(e, media)}
              >
                {media.thumbnail ? (
                  <img
                    src={media.thumbnail}
                    alt={media.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
              <div className="flex h-full items-center justify-center">
                <Film className="h-8 w-8 text-muted-foreground" />
              </div>
                )}
                
                {/* Upload progress overlay */}
                {media.isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="flex flex-col items-center gap-1">
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                      <span className="text-[10px] text-white">Uploading...</span>
                    </div>
                  </div>
                )}
                
                {/* Play icon overlay */}
                {!media.isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="rounded-full bg-black/60 p-2">
                      <Play className="h-4 w-4 text-white fill-white" />
                    </div>
                  </div>
                )}

                {/* Cloud status indicator */}
                <div className="absolute top-1.5 left-1.5">
                  {media.storageUrl ? (
                    <div className="rounded-full bg-emerald-500/80 p-1" title="Saved to cloud">
                      <Cloud className="h-2.5 w-2.5 text-white" />
                    </div>
                  ) : !media.isUploading && (
                    <div className="rounded-full bg-amber-500/80 p-1" title="Not saved">
                      <CloudOff className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </div>

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveFile(media.id)
                  }}
                  className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                >
                  <X className="h-3 w-3 text-white" />
                </button>

                {/* Info overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <div className="text-xs font-medium text-white truncate">
                    {media.name}
                  </div>
                  <div className="text-[10px] text-white/60">{media.duration}</div>
                </div>
              </div>
            ))}

            {filteredFiles.length === 0 && searchQuery && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No media matching "{searchQuery}"
            </div>
            )}
        </div>
        )}
      </div>
    </div>
  )
}

function ClipsTab() {
  return (
    <div className="h-full overflow-y-auto p-3 scrollbar-thin">
      <div className="text-xs text-muted-foreground">Clips will appear here as you cut and organize your footage</div>
    </div>
  )
}

function AgentTab() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, sendQuickAction, status } = useVideoAgent()
  const { selectedClipId, currentTime } = useEditor()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change or during streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, status])

  const handleQuickAction = (action: string) => {
    sendQuickAction(action)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Quick Actions */}
      <div className="border-b border-border p-3">
        <div className="mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Quick Actions</div>
        <div className="flex gap-1.5">
          <button
            onClick={() => handleQuickAction(`Split the selected clip at the current playhead position (${currentTime.toFixed(1)} seconds)`)}
            disabled={!selectedClipId || isLoading}
            className="flex-1 flex items-center justify-center gap-1 rounded bg-primary/10 px-2 py-1.5 text-[10px] font-medium text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Scissors className="h-3 w-3" />
            Split
          </button>
          <button
            onClick={() => handleQuickAction("Delete the selected clip from the timeline")}
            disabled={!selectedClipId || isLoading}
            className="flex-1 flex items-center justify-center gap-1 rounded bg-secondary px-2 py-1.5 text-[10px] font-medium text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
          <button
            onClick={() => handleQuickAction("Apply a noir cinematic effect to the selected clip")}
            disabled={!selectedClipId || isLoading}
            className="flex-1 flex items-center justify-center gap-1 rounded bg-secondary px-2 py-1.5 text-[10px] font-medium text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Wand2 className="h-3 w-3" />
            Effect
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {/* Initial greeting if no messages */}
        {messages.length === 0 && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs bg-muted text-foreground border border-border">
              Hi! I&apos;m your AI editing assistant. I can split, trim, delete, move clips, and apply effects. Just tell me what you&apos;d like to do!
            </div>
          </div>
        )}

        {messages.map((message, i) => {
          const isLastMessage = i === messages.length - 1
          const isStreaming = isLastMessage && message.role === "assistant" && status === "streaming"
          const hasContent = message.content.trim().length > 0
          const hasToolCalls = message.toolCalls && message.toolCalls.length > 0

          // Skip empty assistant messages with no tool calls
          if (message.role === "assistant" && !hasContent && !hasToolCalls && !isStreaming) {
            return null
          }

          return (
            <div key={i} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground border border-border"
                }`}
              >
                {/* Show tool calls */}
                {hasToolCalls && (
                  <div className="flex flex-col items-center space-y-1.5 mb-2">
                    {message.toolCalls!.map((tc) => (
                      <div
                        key={tc.id}
                        className={`flex items-center justify-center gap-1.5 rounded px-2 py-1 text-[10px] ${
                          tc.status === "success"
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : tc.status === "error"
                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {tc.status === "running" && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {tc.status === "success" && (
                          <Check className="h-3 w-3" />
                        )}
                        {tc.status === "error" && (
                          <AlertCircle className="h-3 w-3" />
                        )}
                        <span>{tc.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Show text content */}
                {hasContent && (
                  <>
                    {message.content}
                    {isStreaming && (
                      <span className="inline-block w-1.5 h-3 ml-0.5 bg-foreground/70 animate-pulse" />
                    )}
                  </>
                )}

                {/* Show streaming cursor even if no content yet */}
                {!hasContent && isStreaming && (
                  <span className="inline-block w-1.5 h-3 bg-foreground/70 animate-pulse" />
                )}
              </div>
            </div>
          )
        })}

        {/* Loading indicator - only show when submitted but no streaming yet */}
        {status === "submitted" && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs bg-muted text-foreground border border-border flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ask AI to edit your video..."
            value={input}
            onChange={handleInputChange}
            disabled={isLoading}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-3 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  )
}
