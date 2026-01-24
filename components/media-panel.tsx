"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Film, FolderOpen, Search, Upload, X, Play, Loader2, Cloud, CloudOff, Wand2, Eye, EyeOff, Captions, AlertCircle, Clock, Zap, GripVertical } from "lucide-react"
import { useEditor, MediaFile, DEFAULT_CLIP_TRANSFORM, DEFAULT_CLIP_EFFECTS } from "./editor-context"
import type { EffectPreset, ClipEffects, ClipTransform } from "@/lib/projects"
import type { TimelineClip } from "./editor-context"
import { ColorPicker } from "./ui/color-picker"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"


export function MediaPanel() {
  const [activeTab, setActiveTab] = useState("media")
  const { mediaFiles, addMediaFiles, removeMediaFile, projectId, reindexMedia } = useEditor()

  const tabs = [
    { id: "media", label: "Media", icon: FolderOpen },
    { id: "effects", label: "Effects", icon: Wand2 },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Custom Animated Tabs */}
      <div className="border-b border-border px-3 py-2">
        <div className="relative grid w-full grid-cols-2 rounded-md bg-secondary p-1">
          {/* Animated background indicator */}
          <motion.div
            className="absolute inset-y-1 rounded-sm bg-background shadow-sm"
            initial={false}
            animate={{
              x: activeTab === "media" ? "0%" : "100%",
              width: "calc(50% - 2px)",
            }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
            }}
            style={{ left: 2 }}
          />

          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative z-10 flex items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div
                  animate={isActive ? {
                    scale: [1, 1.2, 1],
                    rotate: tab.id === "agent" ? [0, 15, -15, 0] : 0,
                  } : { scale: 1, rotate: 0 }}
                  transition={{
                    duration: 0.4,
                    ease: "easeInOut",
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </motion.div>
                <span>{tab.label}</span>
                {isActive && tab.id === "agent" && (
                  <motion.div
                    className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  />
                )}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Animated Tab Content */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === "media" && (
            <motion.div
              key="media"
              className="h-full"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <MediaTab
                mediaFiles={mediaFiles}
                onFilesAdded={addMediaFiles}
                onRemoveFile={removeMediaFile}
                projectId={projectId}
                onReindexMedia={reindexMedia}
              />
            </motion.div>
          )}
          {activeTab === "effects" && (
            <motion.div
              key="effects"
              className="h-full"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <EffectsTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// TwelveLabs search result type
interface NLPSearchResult {
  videoId: string // TwelveLabs video ID
  mediaId?: string // Our local media ID (mapped)
  start: number
  end: number
  rank: number
  media?: MediaFile // Reference to the matched media
}

interface MediaTabProps {
  mediaFiles: MediaFile[]
  onFilesAdded: (files: MediaFile[]) => void
  onRemoveFile: (id: string) => void
  projectId: string | null
  onReindexMedia: (mediaId: string) => Promise<void>
}

function MediaTab({ mediaFiles, onFilesAdded, onRemoveFile, projectId, onReindexMedia }: MediaTabProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // NLP Search state
  const [nlpResults, setNlpResults] = useState<NLPSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showNlpResults, setShowNlpResults] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Preview state for NLP results
  const [previewResult, setPreviewResult] = useState<NLPSearchResult | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  
  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }
  
  // Perform NLP search
  const performNlpSearch = useCallback(async (query: string) => {
    if (!projectId || !query.trim()) {
      setNlpResults([])
      setShowNlpResults(false)
      return
    }
    
    // Check if any media is indexed
    const indexedMedia = mediaFiles.filter(m => m.twelveLabsStatus === "ready")
    if (indexedMedia.length === 0) {
      setNlpResults([])
      setShowNlpResults(false)
      return
    }
    
    setIsSearching(true)
    
    try {
      const response = await fetch("/api/twelvelabs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          query: query.trim(),
          videoIds: indexedMedia.map(m => m.twelveLabsVideoId).filter(Boolean),
        }),
      })
      
      if (!response.ok) {
        console.error("NLP search failed")
        setNlpResults([])
        setShowNlpResults(false)
        return
      }
      
      const data = await response.json()
      
      // Map results to include local media reference
      const mappedResults: NLPSearchResult[] = data.results.map((r: { videoId: string; start: number; end: number; rank: number }) => {
        const media = mediaFiles.find(m => m.twelveLabsVideoId === r.videoId)
        return {
          ...r,
          mediaId: media?.id,
          media,
        }
      }).filter((r: NLPSearchResult) => r.media) // Only show results we can display
      
      setNlpResults(mappedResults)
      setShowNlpResults(mappedResults.length > 0)
    } catch (error) {
      console.error("NLP search error:", error)
      setNlpResults([])
      setShowNlpResults(false)
    } finally {
      setIsSearching(false)
    }
  }, [projectId, mediaFiles])
  
  // Debounced search effect
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // If query is empty or too short, clear results
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setNlpResults([])
      setShowNlpResults(false)
      return
    }
    
    // First check name matches
    const nameMatches = mediaFiles.filter(file =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    
    // If we have name matches, don't do NLP search
    if (nameMatches.length > 0) {
      setNlpResults([])
      setShowNlpResults(false)
      return
    }
    
    // Debounce NLP search (wait 500ms after typing stops)
    searchTimeoutRef.current = setTimeout(() => {
      performNlpSearch(searchQuery)
    }, 500)
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, mediaFiles, performNlpSearch])

  const generateThumbnail = useCallback((file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const video = document.createElement("video")
      video.preload = "metadata"
      video.muted = true
      video.playsInline = true

      // Timeout after 10 seconds
      const timeout = setTimeout(() => {
        console.warn("Thumbnail generation timeout for:", file.name)
        URL.revokeObjectURL(video.src)
        resolve(null)
      }, 10000)

      video.onloadeddata = () => {
        video.currentTime = 1 // Seek to 1 second for thumbnail
      }

      video.onseeked = () => {
        clearTimeout(timeout)
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
        clearTimeout(timeout)
        console.error("Error loading video for thumbnail:", file.name)
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

      // Timeout after 10 seconds
      const timeout = setTimeout(() => {
        console.warn("Duration loading timeout for:", file.name)
        URL.revokeObjectURL(video.src)
        resolve({ formatted: "00:00", seconds: 0 })
      }, 10000)

      video.onloadedmetadata = () => {
        clearTimeout(timeout)
        resolve({ formatted: formatDuration(video.duration), seconds: video.duration })
        URL.revokeObjectURL(video.src)
      }

      video.onerror = () => {
        clearTimeout(timeout)
        console.error("Error loading video metadata:", file.name)
        resolve({ formatted: "00:00", seconds: 0 })
        URL.revokeObjectURL(video.src)
      }

      video.src = URL.createObjectURL(file)
    })
  }, [])

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const videoFiles = Array.from(files).filter((file) => {
        // Accept video files or mp4/mov/webm/avi by extension if MIME type is missing
        const isVideoType = file.type.startsWith("video/")
        const hasVideoExt = /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(file.name)
        return isVideoType || hasVideoExt
      })

      if (videoFiles.length === 0) {
        console.warn("No video files found in selection")
        return
      }

      const processedFiles: MediaFile[] = []

      for (const file of videoFiles) {
        try {
          const [thumbnail, durationData] = await Promise.all([
            generateThumbnail(file).catch(() => null),
            getVideoDuration(file).catch(() => ({ formatted: "00:00", seconds: 0 })),
          ])

          processedFiles.push({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            name: file.name,
            duration: durationData.formatted,
            durationSeconds: durationData.seconds,
            thumbnail,
            type: file.type || "video/mp4", // Default to mp4 if type is missing
            objectUrl: URL.createObjectURL(file),
          })
        } catch (err) {
          console.error("Error processing file:", file.name, err)
          // Still add the file even if thumbnail/duration fails
          processedFiles.push({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            name: file.name,
            duration: "00:00",
            durationSeconds: 0,
            thumbnail: null,
            type: file.type || "video/mp4",
            objectUrl: URL.createObjectURL(file),
          })
        }
      }

      if (processedFiles.length > 0) {
        console.log("Adding", processedFiles.length, "files to media pool")
        onFilesAdded(processedFiles)
      }
    },
    [generateThumbnail, getVideoDuration, onFilesAdded]
  )

  const handleMediaDragStart = useCallback((e: React.DragEvent, media: MediaFile) => {
    e.dataTransfer.setData("application/x-media-id", media.id)
    e.dataTransfer.effectAllowed = "copy"
  }, [])

  // Handle drag start for NLP search results (with specific time range)
  const handleNlpResultDragStart = useCallback((e: React.DragEvent, result: NLPSearchResult) => {
    if (!result.media) return
    
    e.dataTransfer.setData("application/x-media-id", result.media.id)
    e.dataTransfer.setData("application/x-clip-start", result.start.toString())
    e.dataTransfer.setData("application/x-clip-end", result.end.toString())
    e.dataTransfer.effectAllowed = "copy"
  }, [])

  // Handle preview of NLP search result
  const handlePreviewResult = useCallback((result: NLPSearchResult) => {
    setPreviewResult(result)
  }, [])

  // Handle video time update during preview - pause at end time
  const handlePreviewTimeUpdate = useCallback(() => {
    if (!previewVideoRef.current || !previewResult) return
    
    if (previewVideoRef.current.currentTime >= previewResult.end) {
      previewVideoRef.current.pause()
      previewVideoRef.current.currentTime = previewResult.start
    }
  }, [previewResult])

  // Set video to start time when preview opens
  useEffect(() => {
    if (previewResult && previewVideoRef.current) {
      previewVideoRef.current.currentTime = previewResult.start
      previewVideoRef.current.play().catch(() => {
        // Autoplay may be blocked, user can click to play
      })
    }
  }, [previewResult])

  // Close preview on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && previewResult) {
        setPreviewResult(null)
      }
    }
    
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [previewResult])

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

  // Check if NLP search is available (any indexed media)
  const hasIndexedMedia = mediaFiles.some(m => m.twelveLabsStatus === "ready")
  const indexingCount = mediaFiles.filter(m => m.twelveLabsStatus === "indexing" || m.twelveLabsStatus === "pending").length

  return (
    <div className="flex h-full flex-col">
      {/* Search with NLP support */}
      <div className="border-b border-border p-3">
        <div className="relative">
          {isSearching ? (
            <Loader2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-primary animate-spin" />
          ) : (
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          )}
          <input
            type="text"
            placeholder={hasIndexedMedia ? "Search by name or describe what you're looking for..." : "Search media..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
        {/* NLP Search hint */}
        {hasIndexedMedia && searchQuery.length > 0 && filteredFiles.length === 0 && !isSearching && !showNlpResults && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Zap className="h-3 w-3" />
            <span>Try natural language: "person walking", "sunset scene", etc.</span>
          </div>
        )}
        {indexingCount > 0 && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Indexing {indexingCount} video{indexingCount > 1 ? 's' : ''} for AI search...</span>
          </div>
        )}
      </div>

      {/* Drop zone & media grid */}
      <div
        className={`flex-1 overflow-y-auto p-3 scrollbar-thin transition-colors ${isDragOver ? "bg-primary/10" : ""
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
            className={`flex h-full flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors cursor-pointer ${isDragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground"
              }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload
              className={`h-10 w-10 mb-3 transition-colors ${isDragOver ? "text-primary" : "text-muted-foreground"
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
            <motion.button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
              whileHover={{ scale: 1.02, borderColor: "hsl(var(--primary))" }}
              whileTap={{ scale: 0.98 }}
            >
              <Upload className="h-3.5 w-3.5" />
              Add more videos
            </motion.button>

            {/* Media items */}
            <AnimatePresence mode="popLayout">
              {filteredFiles.map((media, index) => (
                <motion.div
                  key={media.id}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                  transition={{
                    duration: 0.2,
                    delay: index * 0.05,
                    layout: { duration: 0.2 }
                  }}
                  whileHover={{ scale: media.isUploading ? 1 : 1.02, y: media.isUploading ? 0 : -2 }}
                  className={`group relative aspect-video overflow-hidden rounded border bg-muted ${
                    media.isUploading
                      ? "border-primary/50 opacity-70"
                      : "border-border hover:border-primary cursor-grab active:cursor-grabbing"
                  }`}
                  draggable={!media.isUploading}
                  onDragStart={(e) => !media.isUploading && handleMediaDragStart(e as unknown as React.DragEvent<Element>, media)}
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
                    <motion.div
                      className="absolute inset-0 flex items-center justify-center bg-black/40"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                        <span className="text-[10px] text-white">Uploading...</span>
                      </div>
                    </motion.div>
                  )}

                  {/* Play icon overlay */}
                  {!media.isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <motion.div
                        className="rounded-full bg-black/60 p-2"
                        initial={{ scale: 0.8 }}
                        whileHover={{ scale: 1.1 }}
                      >
                        <Play className="h-4 w-4 text-white fill-white" />
                      </motion.div>
                    </div>
                  )}

                  {/* Status indicators */}
                  <div className="absolute top-1.5 left-1.5 flex gap-1">
                    {/* Cloud status */}
                    {media.storageUrl ? (
                      <motion.div
                        className="rounded-full bg-emerald-500/80 p-1"
                        title="Saved to cloud"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      >
                        <Cloud className="h-2.5 w-2.5 text-white" />
                      </motion.div>
                    ) : !media.isUploading && (
                      <div className="rounded-full bg-amber-500/80 p-1" title="Not saved">
                        <CloudOff className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}

                    {/* TwelveLabs indexing status */}
                    {media.twelveLabsStatus === "indexing" || media.twelveLabsStatus === "pending" ? (
                      <motion.div
                        className="rounded-full bg-cyan-500/80 p-1"
                        title="Indexing..."
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      >
                        <Loader2 className="h-2.5 w-2.5 text-white animate-spin" />
                      </motion.div>
                    ) : media.twelveLabsStatus === "ready" ? (
                      <motion.div
                        className="rounded-full bg-cyan-500/80 p-1"
                        title="Searchable"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      >
                        <Search className="h-2.5 w-2.5 text-white" />
                      </motion.div>
                    ) : media.twelveLabsStatus === "failed" ? (
                      <motion.div
                        className="rounded-full bg-red-500/80 p-1"
                        title={media.twelveLabsError ? `Failed: ${media.twelveLabsError}` : "Indexing failed"}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      >
                        <AlertCircle className="h-2.5 w-2.5 text-white" />
                      </motion.div>
                    ) : null}
                  </div>

                  {/* Action buttons */}
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Index button - show if not indexed, failed, or no status (and has storageUrl) */}
                    {media.storageUrl && (!media.twelveLabsStatus || media.twelveLabsStatus === "failed") && (
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation()
                          onReindexMedia(media.id)
                        }}
                        className="rounded-full bg-cyan-500/80 p-1 hover:bg-cyan-500 cursor-pointer"
                        title={media.twelveLabsStatus === "failed" ? "Retry indexing" : "Make searchable"}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Search className="h-3 w-3 text-white" />
                      </motion.button>
                    )}

                    {/* Remove button */}
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveFile(media.id)
                      }}
                      className="rounded-full bg-black/60 p-1 hover:bg-black/80 cursor-pointer"
                      title="Remove"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <X className="h-3 w-3 text-white" />
                    </motion.button>
                  </div>

                  {/* Info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-2">
                    <div className="text-xs font-medium text-white truncate">
                      {media.name}
                    </div>
                    <div className="text-[10px] text-white/60">{media.duration}</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredFiles.length === 0 && searchQuery && !showNlpResults && !isSearching && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No media matching "{searchQuery}"
                {hasIndexedMedia && (
                  <div className="mt-2 text-[10px]">
                    Try using natural language to search video content
                  </div>
                )}
              </div>
            )}

            {/* NLP Search Results */}
            {showNlpResults && nlpResults.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                  <Zap className="h-3 w-3 text-primary" />
                  <span>AI Found {nlpResults.length} matching moment{nlpResults.length > 1 ? 's' : ''}</span>
                </div>
                <AnimatePresence mode="popLayout">
                  {nlpResults.map((result, index) => (
                    <motion.div
                      key={`nlp-${result.videoId}-${result.start}-${index}`}
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                      className="group relative overflow-hidden rounded border border-primary/30 bg-primary/5 hover:border-primary hover:bg-primary/10 transition-colors cursor-pointer"
                      draggable={!!result.media}
                      onDragStart={(e) => handleNlpResultDragStart(e as unknown as React.DragEvent<Element>, result)}
                      onClick={() => handlePreviewResult(result)}
                    >
                      <div className="flex gap-2 p-2">
                        {/* Drag handle */}
                        <div 
                          className="flex items-center text-muted-foreground/50 group-hover:text-primary/70 transition-colors cursor-grab active:cursor-grabbing"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                        
                        {/* Thumbnail with play overlay */}
                        <div className="relative w-16 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                          {result.media?.thumbnail ? (
                            <img
                              src={result.media.thumbnail}
                              alt={result.media.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Film className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                            <Play className="h-3 w-3 text-white fill-white" />
                          </div>
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium text-foreground truncate">
                            {result.media?.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex items-center gap-1 text-[10px] text-primary">
                              <Clock className="h-3 w-3" />
                              <span>{formatTime(result.start)} - {formatTime(result.end)}</span>
                            </div>
                            <div className="text-[9px] text-muted-foreground">
                              Rank #{result.rank}
                            </div>
                          </div>
                        </div>
                        
                        {/* Click to preview hint */}
                        <div className="flex items-center text-[9px] text-muted-foreground/60 group-hover:text-primary/60 transition-colors whitespace-nowrap">
                          Click to preview
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* NLP Result Preview Modal */}
      <AnimatePresence>
        {previewResult && previewResult.media && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
            onClick={() => setPreviewResult(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-2xl w-full mx-4 bg-background rounded-lg overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{previewResult.media.name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(previewResult.start)} - {formatTime(previewResult.end)}</span>
                    <span className="text-muted-foreground/60">({Math.round(previewResult.end - previewResult.start)}s)</span>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewResult(null)}
                  className="p-1.5 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              {/* Video */}
              <div className="relative aspect-video bg-black">
                <video
                  ref={previewVideoRef}
                  src={previewResult.media.objectUrl || previewResult.media.storageUrl}
                  className="w-full h-full object-contain"
                  controls
                  onTimeUpdate={handlePreviewTimeUpdate}
                  onEnded={() => {
                    if (previewVideoRef.current && previewResult) {
                      previewVideoRef.current.currentTime = previewResult.start
                    }
                  }}
                />
              </div>
              
              {/* Footer with drag hint */}
              <div className="p-3 border-t flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Press Esc or click outside to close
                </div>
                <div 
                  className="flex items-center gap-2 text-xs text-primary cursor-grab active:cursor-grabbing px-3 py-1.5 rounded border border-primary/30 hover:bg-primary/10 transition-colors"
                  draggable
                  onDragStart={(e) => handleNlpResultDragStart(e as unknown as React.DragEvent<Element>, previewResult)}
                >
                  <GripVertical className="h-3 w-3" />
                  <span>Drag to timeline</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const EFFECT_PRESETS: { id: EffectPreset; label: string }[] = [
  { id: "none", label: "None" },
  { id: "grayscale", label: "Black & White" },
  { id: "sepia", label: "Sepia" },
  { id: "invert", label: "Invert" },
  { id: "cyberpunk", label: "Cyberpunk" },
  { id: "noir", label: "Film Noir" },
  { id: "vhs", label: "VHS Retro" },
  { id: "glitch", label: "Glitch" },
  { id: "ascii", label: "Dreamy" },
]

function EffectsTab() {
  const { 
    selectedClipId, 
    timelineClips, 
    updateClip, 
    mediaFiles,
    generateCaptions,
    showCaptions,
    setShowCaptions,
    captionStyle,
    setCaptionStyle,
  } = useEditor()

  const selectedClip = timelineClips.find(c => c.id === selectedClipId)
  
  if (!selectedClip) {
    return (
      <div className="flex h-full items-center justify-center p-3">
        <p className="text-xs text-muted-foreground">Select a clip to edit</p>
      </div>
    )
  }
  
  const transform = selectedClip.transform ?? DEFAULT_CLIP_TRANSFORM
  const effects = selectedClip.effects ?? DEFAULT_CLIP_EFFECTS

  const handleTransformChange = (key: keyof ClipTransform, value: number) => {
    if (!selectedClipId) return
    updateClip(selectedClipId, {
      transform: { ...transform, [key]: value }
    })
  }

  const handlePresetChange = (preset: EffectPreset) => {
    if (!selectedClipId) return
    updateClip(selectedClipId, {
      effects: { ...effects, preset }
    })
  }

  const handleEffectChange = (key: keyof ClipEffects, value: number) => {
    if (!selectedClipId) return
    updateClip(selectedClipId, {
      effects: { ...effects, [key]: value }
    })
  }

  const handleChromakeyToggle = (enabled: boolean) => {
    if (!selectedClipId) return
    const currentChromakey = effects.chromakey ?? {
      enabled: false,
      keyColor: "#00FF00",
      similarity: 0.4,
      smoothness: 0.1,
      spill: 0.3,
    }
    updateClip(selectedClipId, {
      effects: {
        ...effects,
        chromakey: {
          ...currentChromakey,
          enabled,
        },
      },
    })
  }

  const handleChromakeyChange = (key: "keyColor" | "similarity" | "smoothness" | "spill", value: string | number) => {
    if (!selectedClipId) return
    const currentChromakey = effects.chromakey ?? {
      enabled: false,
      keyColor: "#00FF00",
      similarity: 0.4,
      smoothness: 0.1,
      spill: 0.3,
    }
    updateClip(selectedClipId, {
      effects: {
        ...effects,
        chromakey: {
          ...currentChromakey,
          [key]: value,
        },
      },
    })
  }

  const resetAll = () => {
    if (!selectedClipId) return
    updateClip(selectedClipId, { 
      transform: DEFAULT_CLIP_TRANSFORM,
      effects: DEFAULT_CLIP_EFFECTS 
    })
  }

  const currentPresetLabel = EFFECT_PRESETS.find(p => p.id === effects.preset)?.label ?? "None"

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <motion.span
          className="text-xs font-medium text-foreground truncate max-w-[60%]"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          {selectedClip.label}
        </motion.span>
        <motion.button
          onClick={resetAll}
          className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          whileHover={{ scale: 1.05, x: -2 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          Reset All
        </motion.button>
      </div>
      
      <Accordion type="multiple" className="w-full">
        {/* Transform Accordion */}
        <AccordionItem value="transform" className="border-border">
          <AccordionTrigger className="px-3 py-2 text-xs font-medium hover:no-underline">
            Transform
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Position X</label>
                  <input
                    type="number"
                    value={transform.positionX}
                    onChange={(e) => handleTransformChange("positionX", parseInt(e.target.value) || 0)}
                    className="w-full rounded border border-input bg-background px-2 py-1 text-xs text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Position Y</label>
                  <input
                    type="number"
                    value={transform.positionY}
                    onChange={(e) => handleTransformChange("positionY", parseInt(e.target.value) || 0)}
                    className="w-full rounded border border-input bg-background px-2 py-1 text-xs text-foreground"
                  />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Scale</span>
                  <span className="text-muted-foreground">{transform.scale}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="200"
                  value={transform.scale}
                  onChange={(e) => handleTransformChange("scale", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Opacity</span>
                  <span className="text-muted-foreground">{transform.opacity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={transform.opacity}
                  onChange={(e) => handleTransformChange("opacity", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Presets Accordion */}
        <AccordionItem value="presets" className="border-border">
          <AccordionTrigger className="px-3 py-2 text-xs font-medium hover:no-underline">
            <div className="flex items-center justify-between w-full pr-2">
              <span>Presets</span>
              <span className="text-muted-foreground font-normal">{currentPresetLabel}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3">
            <div className="flex flex-col gap-0.5">
              {EFFECT_PRESETS.map((preset, index) => (
                <motion.button
                  key={preset.id}
                  onClick={() => handlePresetChange(preset.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                    effects.preset === preset.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 25,
                    delay: index * 0.03
                  }}
                  whileHover={{ x: 4, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <motion.span
                    animate={effects.preset === preset.id ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 0.2 }}
                  >
                    {preset.label}
                  </motion.span>
                  {effects.preset === preset.id && (
                    <motion.div
                      className="inline-block ml-2 w-1.5 h-1.5 rounded-full bg-primary"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Adjustments Accordion */}
        <AccordionItem value="adjustments" className="border-border">
          <AccordionTrigger className="px-3 py-2 text-xs font-medium hover:no-underline">
            Adjustments
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3">
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Blur</span>
                  <span className="text-muted-foreground">{effects.blur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={effects.blur}
                  onChange={(e) => handleEffectChange("blur", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Brightness</span>
                  <span className="text-muted-foreground">{effects.brightness}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={effects.brightness}
                  onChange={(e) => handleEffectChange("brightness", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Contrast</span>
                  <span className="text-muted-foreground">{effects.contrast}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={effects.contrast}
                  onChange={(e) => handleEffectChange("contrast", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Saturation</span>
                  <span className="text-muted-foreground">{effects.saturate}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={effects.saturate}
                  onChange={(e) => handleEffectChange("saturate", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Hue Rotate</span>
                  <span className="text-muted-foreground">{effects.hueRotate}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={effects.hueRotate}
                  onChange={(e) => handleEffectChange("hueRotate", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Chromakey Accordion */}
        <AccordionItem value="chromakey" className="border-border">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <AccordionTrigger className="flex-1 text-xs font-medium hover:no-underline py-0">
              <span>Green Screen</span>
            </AccordionTrigger>
            <motion.button
              type="button"
              onClick={() => handleChromakeyToggle(!(effects.chromakey?.enabled ?? false))}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                effects.chromakey?.enabled
                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <AnimatePresence mode="wait">
                {effects.chromakey?.enabled ? (
                  <motion.div
                    key="on"
                    className="flex items-center gap-1.5"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.3 }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </motion.div>
                    <span>On</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="off"
                    className="flex items-center gap-1.5"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    <span>Off</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
          <AccordionContent className="px-3 pb-3">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Key Color</label>
                <ColorPicker
                  value={effects.chromakey?.keyColor ?? "#00FF00"}
                  onChange={(color) => handleChromakeyChange("keyColor", color)}
                  disabled={!effects.chromakey?.enabled}
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Similarity</span>
                  <span className="text-muted-foreground">{((effects.chromakey?.similarity ?? 0.4) * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={((effects.chromakey?.similarity ?? 0.4) * 100)}
                  onChange={(e) => handleChromakeyChange("similarity", parseInt(e.target.value) / 100)}
                  className="w-full accent-primary"
                  disabled={!effects.chromakey?.enabled}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">How close colors must be to be removed</p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Smoothness</span>
                  <span className="text-muted-foreground">{((effects.chromakey?.smoothness ?? 0.1) * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={((effects.chromakey?.smoothness ?? 0.1) * 100)}
                  onChange={(e) => handleChromakeyChange("smoothness", parseInt(e.target.value) / 100)}
                  className="w-full accent-primary"
                  disabled={!effects.chromakey?.enabled}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Edge softness</p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Spill Suppression</span>
                  <span className="text-muted-foreground">{((effects.chromakey?.spill ?? 0.3) * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={((effects.chromakey?.spill ?? 0.3) * 100)}
                  onChange={(e) => handleChromakeyChange("spill", parseInt(e.target.value) / 100)}
                  className="w-full accent-primary"
                  disabled={!effects.chromakey?.enabled}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Removes color bleed from edges</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Captions Accordion */}
        <AccordionItem value="captions" className="border-border">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <AccordionTrigger className="flex-1 text-xs font-medium hover:no-underline py-0">
              <div className="flex items-center gap-1.5">
                <Captions className="h-3.5 w-3.5" />
                <span>Captions</span>
              </div>
            </AccordionTrigger>
            <motion.button
              type="button"
              onClick={() => setShowCaptions(!showCaptions)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                showCaptions
                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <AnimatePresence mode="wait">
                {showCaptions ? (
                  <motion.div
                    key="show"
                    className="flex items-center gap-1.5"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.3 }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </motion.div>
                    <span>Show</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="hide"
                    className="flex items-center gap-1.5"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    <span>Hide</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
          <AccordionContent className="px-3 pb-3">
            <CaptionsSection 
              selectedClip={selectedClip} 
              mediaFiles={mediaFiles} 
              generateCaptions={generateCaptions}
              captionStyle={captionStyle}
              setCaptionStyle={setCaptionStyle}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

const LANGUAGES = [
  { code: "", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "ru", label: "Russian" },
]

interface CaptionsSectionProps {
  selectedClip: TimelineClip
  mediaFiles: MediaFile[]
  generateCaptions: (mediaId: string, options?: { language?: string; prompt?: string }) => Promise<void>
  captionStyle: "classic" | "tiktok"
  setCaptionStyle: (style: "classic" | "tiktok") => void
}

function CaptionsSection({ selectedClip, mediaFiles, generateCaptions, captionStyle, setCaptionStyle }: CaptionsSectionProps) {
  const [selectedLanguage, setSelectedLanguage] = useState("")
  const media = mediaFiles.find((m) => m.id === selectedClip.mediaId)
  
  if (!media) {
    return (
      <p className="text-xs text-muted-foreground">Media not found</p>
    )
  }

  const hasCaptions = media.captions && media.captions.length > 0
  const isGenerating = media.captionsGenerating ?? false
  const isVideoType = media.type.startsWith("video")

  if (!isVideoType) {
    return (
      <p className="text-xs text-muted-foreground">Captions are only available for video clips with audio</p>
    )
  }

  const handleGenerate = async () => {
    if (!media.storageUrl) {
      return
    }
    await generateCaptions(media.id, {
      language: selectedLanguage || undefined,
    })
  }

  return (
    <div className="space-y-3">
      {!media.storageUrl ? (
        <p className="text-xs text-muted-foreground">Upload media to cloud first to generate captions</p>
      ) : (
        <>
          {/* Language Selector */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Language</label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              disabled={isGenerating}
              className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs text-foreground disabled:opacity-50"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground mt-1">Specifying the language improves accuracy</p>
          </div>

          <motion.button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors cursor-pointer ${
              isGenerating
                ? "bg-secondary text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
            whileHover={!isGenerating ? { scale: 1.02 } : {}}
            whileTap={!isGenerating ? { scale: 0.98 } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div
                  key="generating"
                  className="flex items-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="h-3.5 w-3.5" />
                  </motion.div>
                  <span>Generating...</span>
                </motion.div>
              ) : hasCaptions ? (
                <motion.span
                  key="regenerate"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                >
                  Regenerate Captions
                </motion.span>
              ) : (
                <motion.span
                  key="generate"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                >
                  Generate Captions
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {hasCaptions && (
            <div className="space-y-3">
              {/* Caption Style Selector */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Style</label>
                <div className="relative flex rounded-md border border-border bg-secondary/30 p-0.5">
                  {/* Animated background indicator */}
                  <motion.div
                    className="absolute inset-y-0.5 rounded bg-primary"
                    initial={false}
                    animate={{
                      x: captionStyle === "classic" ? "2px" : "calc(100% + 2px)",
                      width: "calc(50% - 4px)",
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                    style={{ left: 0 }}
                  />
                  <motion.button
                    onClick={() => setCaptionStyle("classic")}
                    className={`relative z-10 flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                      captionStyle === "classic"
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    Classic
                  </motion.button>
                  <motion.button
                    onClick={() => setCaptionStyle("tiktok")}
                    className={`relative z-10 flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                      captionStyle === "tiktok"
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    TikTok
                  </motion.button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Words detected</span>
                <span className="text-foreground font-medium">{media.captions!.length}</span>
              </div>
              
              <div className="max-h-32 overflow-y-auto rounded border border-border bg-secondary/30 p-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {media.captions!.map((c) => c.word).join(" ")}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
