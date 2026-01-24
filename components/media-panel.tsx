"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Film, Sparkles, FolderOpen, Search, Send, Upload, X, Play, Loader2, Cloud, CloudOff, Scissors, Trash2, Wand2, Mic, Check, AlertCircle, MessageSquarePlus, Zap } from "lucide-react"
import { useEditor, MediaFile } from "./editor-context"
import { useVideoAgent, type ToolCallInfo } from "@/lib/agent/use-agent"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"


export function MediaPanel() {
  const [activeTab, setActiveTab] = useState("media")
  const { mediaFiles, addMediaFiles, removeMediaFile } = useEditor()

  const tabs = [
    { id: "media", label: "Media", icon: FolderOpen },
    { id: "agent", label: "Agent", icon: Sparkles },
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
        {/* Media Tab */}
        <motion.div
          className="h-full absolute inset-0"
          initial={false}
          animate={{
            opacity: activeTab === "media" ? 1 : 0,
            x: activeTab === "media" ? 0 : -20,
            pointerEvents: activeTab === "media" ? "auto" : "none",
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <MediaTab
            mediaFiles={mediaFiles}
            onFilesAdded={addMediaFiles}
            onRemoveFile={removeMediaFile}
          />
        </motion.div>

        {/* Agent Tab */}
        <motion.div
          className="h-full absolute inset-0"
          initial={false}
          animate={{
            opacity: activeTab === "agent" ? 1 : 0,
            x: activeTab === "agent" ? 0 : 20,
            pointerEvents: activeTab === "agent" ? "auto" : "none",
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <AgentTab />
        </motion.div>
      </div>
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
                  className={`group relative aspect-video overflow-hidden rounded border bg-muted ${media.isUploading
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

                  {/* Cloud status indicator */}
                  <div className="absolute top-1.5 left-1.5">
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
                  </div>

                  {/* Remove button */}
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveFile(media.id)
                    }}
                    className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 cursor-pointer"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="h-3 w-3 text-white" />
                  </motion.button>

                  {/* Info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <div className="text-xs font-medium text-white truncate">
                      {media.name}
                    </div>
                    <div className="text-[10px] text-white/60">{media.duration}</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

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

function AgentTab() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, isLoadingHistory, sendQuickAction, clearChat, status, sendMessage } = useVideoAgent()
  const { selectedClipId, currentTime, timelineClips } = useEditor()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [showNewChatDialog, setShowNewChatDialog] = useState(false)

  // Auto-scroll to bottom when messages change or during streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, status])

  const handleQuickAction = (action: string) => {
    sendQuickAction(action)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())

        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

        // Send to API for transcription
        setIsTranscribing(true)
        try {
          const formData = new FormData()
          formData.append('audio', audioBlob, 'recording.webm')

          const response = await fetch('/api/speech-to-text', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Transcription failed')
          }

          const { text } = await response.json()
          if (text && text.trim()) {
            // Refine the transcription before sending
            try {
              const refineResponse = await fetch('/api/refine-transcription', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ transcription: text.trim() }),
              })

              if (refineResponse.ok) {
                const { text: refinedText } = await refineResponse.json()
                if (refinedText && refinedText.trim()) {
                  // Send the refined text to the chat
                  await sendMessage({ text: refinedText.trim() })
                } else {
                  // Fallback to original if refinement returns empty
                  await sendMessage({ text: text.trim() })
                }
              } else {
                // If refinement fails, use original transcription
                await sendMessage({ text: text.trim() })
              }
            } catch (refineError) {
              console.error('Refinement error:', refineError)
              // If refinement fails, use original transcription
              await sendMessage({ text: text.trim() })
            }
          }
        } catch (error) {
          console.error('Transcription error:', error)
          alert(error instanceof Error ? error.message : 'Failed to transcribe audio')
        } finally {
          setIsTranscribing(false)
        }
      }

      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
    } catch (error) {
      console.error('Failed to start recording:', error)
      alert('Failed to access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
      setIsRecording(false)
    }
  }

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const handleNewChat = () => {
    setShowNewChatDialog(true)
  }

  const confirmNewChat = () => {
    clearChat()
    setShowNewChatDialog(false)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header with New Chat button */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">AI Assistant</span>
        <motion.button
          onClick={handleNewChat}
          disabled={isLoading || messages.length === 0}
          className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Start new chat"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <MessageSquarePlus className="h-3 w-3" />
          New Chat
        </motion.button>
      </div>

      {/* Smart Enhance - One Stop Shop */}
      <div className="border-b border-border p-3">
        <div className="mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Smart Enhance</div>
        <motion.button
          onClick={() => {
            const message = "Analyze my video timeline and automatically apply smart improvements. Look at all clips and suggest enhancements like: trimming dead air at the start/end, applying cinematic effects, removing green screens if present, improving pacing with strategic splits, and any other optimizations. Apply all suggested improvements automatically using your tools."
            sendQuickAction(message)
          }}
          disabled={isLoading || timelineClips.length === 0}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 px-3 py-2.5 text-[11px] font-medium text-primary hover:from-primary/30 hover:to-primary/20 hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
          whileHover={{ scale: isLoading || timelineClips.length === 0 ? 1 : 1.02 }}
          whileTap={{ scale: isLoading || timelineClips.length === 0 ? 1 : 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <motion.div
            animate={isLoading ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 2, repeat: isLoading ? Infinity : 0, ease: "linear" }}
          >
            <Zap className="h-4 w-4" />
          </motion.div>
          <span>Auto Enhance Video</span>
        </motion.button>
        <p className="mt-1.5 text-[9px] text-muted-foreground/80 text-center">
          AI analyzes and applies multiple improvements automatically
        </p>
      </div>

      {/* Quick Actions */}
      <div className="border-b border-border p-3">
        <div className="mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Quick Actions</div>
        <div className="flex gap-1.5">
          <motion.button
            onClick={() => handleQuickAction(`Split the selected clip at the current playhead position (${currentTime.toFixed(1)} seconds)`)}
            disabled={!selectedClipId || isLoading}
            className="flex-1 flex items-center justify-center gap-1 rounded bg-primary/10 px-2 py-1.5 text-[10px] font-medium text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            whileHover={{ scale: 1.03, backgroundColor: "hsl(var(--primary) / 0.2)" }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Scissors className="h-3 w-3" />
            Split
          </motion.button>
          <motion.button
            onClick={() => handleQuickAction("Delete the selected clip from the timeline")}
            disabled={!selectedClipId || isLoading}
            className="flex-1 flex items-center justify-center gap-1 rounded bg-secondary px-2 py-1.5 text-[10px] font-medium text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </motion.button>
          <motion.button
            onClick={() => handleQuickAction("Apply a noir cinematic effect to the selected clip")}
            disabled={!selectedClipId || isLoading}
            className="flex-1 flex items-center justify-center gap-1 rounded bg-secondary px-2 py-1.5 text-[10px] font-medium text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Wand2 className="h-3 w-3" />
            Effect
          </motion.button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {/* Loading history indicator */}
        <AnimatePresence>
          {isLoadingHistory && (
            <motion.div
              className="flex justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading chat history...
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Initial greeting if no messages and not loading */}
        <AnimatePresence>
          {!isLoadingHistory && messages.length === 0 && (
            <motion.div
              className="flex justify-start"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs bg-muted text-foreground border border-border">
                Hi! I&apos;m your AI editing assistant. I can split, trim, delete, move clips, and apply effects. Just tell me what you&apos;d like to do!
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="popLayout">
          {messages.map((message, i) => {
            const isLastMessage = i === messages.length - 1
            const isStreaming = isLastMessage && message.role === "assistant" && status === "streaming"
            const hasContent = message.content.trim().length > 0
            const hasToolCalls = message.toolCalls && message.toolCalls.length > 0

            // Skip empty assistant messages with no tool calls (unless streaming)
            if (message.role === "assistant" && !hasContent && !hasToolCalls && !isStreaming) {
              return null
            }

            return (
              <motion.div
                key={i}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                initial={{ opacity: 0, y: 10, x: message.role === "user" ? 20 : -20 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 25, delay: isLastMessage ? 0 : 0.05 }}
                layout
              >
                <motion.div
                  className={`max-w-[85%] rounded-lg text-xs ${message.role === "user"
                      ? "bg-primary text-primary-foreground px-3 py-2"
                      : "bg-muted text-foreground border border-border"
                    }`}
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  {/* Show tool calls */}
                  {hasToolCalls && (
                    <div className={`space-y-1 ${hasContent ? "px-3 pt-2 pb-1" : "p-2"}`}>
                      {message.toolCalls!.map((tc, tcIndex) => (
                        <motion.div
                          key={tc.id}
                          className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[10px] ${tc.status === "success"
                              ? "bg-green-500/15 text-green-600 dark:text-green-400"
                              : tc.status === "error"
                                ? "bg-red-500/15 text-red-600 dark:text-red-400"
                                : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                            }`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: tcIndex * 0.1, type: "spring", stiffness: 400, damping: 20 }}
                        >
                          {tc.status === "running" && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          {tc.status === "success" && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 20 }}
                            >
                              <Check className="h-3 w-3" />
                            </motion.div>
                          )}
                          {tc.status === "error" && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 20 }}
                            >
                              <AlertCircle className="h-3 w-3" />
                            </motion.div>
                          )}
                          <span>{tc.description}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Show text content */}
                  {hasContent && (
                    <div className={hasToolCalls ? "px-3 pb-2 pt-1" : "px-3 py-2"}>
                      {message.content}
                      {isStreaming && (
                        <motion.span
                          className="inline-block w-1.5 h-3 ml-0.5 bg-foreground/70"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                        />
                      )}
                    </div>
                  )}

                  {/* Show streaming cursor even if no content yet */}
                  {!hasContent && !hasToolCalls && isStreaming && (
                    <div className="px-3 py-2">
                      <motion.span
                        className="inline-block w-1.5 h-3 bg-foreground/70"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Loading indicator - only show when submitted but no streaming yet */}
        <AnimatePresence>
          {status === "submitted" && (
            <motion.div
              className="flex justify-start"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs bg-muted text-foreground border border-border flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="h-3 w-3" />
                </motion.div>
                <motion.span
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  Thinking...
                </motion.span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border p-3">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Ask AI to edit your video..."
            value={input}
            onChange={handleInputChange}
            disabled={isLoading || isRecording}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
          />
          {input.trim() ? (
            <motion.button
              type="submit"
              className="flex items-center justify-center rounded-md bg-primary px-3 py-2.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={!input.trim() || isLoading}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Send className="h-3.5 w-3.5" />
            </motion.button>
          ) : (
            <div className="relative">
              {/* Pulsing rings when recording */}
              <AnimatePresence>
                {isRecording && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-md bg-red-500"
                      initial={{ opacity: 0.6, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.8 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-md bg-red-500"
                      initial={{ opacity: 0.4, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.5 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
                    />
                  </>
                )}
              </AnimatePresence>

              <motion.button
                type="button"
                onClick={toggleRecording}
                disabled={isLoading || isTranscribing}
                className={`relative flex items-center justify-center rounded-md px-3 py-2.5 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${isRecording
                    ? "bg-red-500"
                    : "bg-primary"
                  }`}
                title={isRecording ? "Stop recording" : "Start voice recording"}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={isRecording ? {
                  backgroundColor: ["#ef4444", "#dc2626", "#ef4444"],
                } : {}}
                transition={{
                  backgroundColor: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
                  scale: { type: "spring", stiffness: 400, damping: 17 }
                }}
              >
                <AnimatePresence mode="wait">
                  {isTranscribing ? (
                    <motion.div
                      key="transcribing"
                      initial={{ opacity: 0, rotate: 0 }}
                      animate={{ opacity: 1, rotate: 360 }}
                      exit={{ opacity: 0 }}
                      transition={{ rotate: { duration: 1, repeat: Infinity, ease: "linear" } }}
                    >
                      <Loader2 className="h-3.5 w-3.5" />
                    </motion.div>
                  ) : isRecording ? (
                    <motion.div
                      key="recording"
                      className="flex items-center gap-0.5"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    >
                      {/* Sound wave bars */}
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-0.5 bg-white rounded-full"
                          animate={{
                            height: ["8px", "14px", "8px"],
                          }}
                          transition={{
                            duration: 0.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.15,
                          }}
                        />
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    >
                      <Mic className="h-3.5 w-3.5" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          )}
        </div>
        <AnimatePresence>
          {isTranscribing && (
            <motion.div
              className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="h-3 w-3" />
              </motion.div>
              <span>Transcribing audio...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* New Chat Confirmation Dialog */}
      <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start New Chat?</DialogTitle>
            <DialogDescription>
              This will clear your current conversation. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <motion.button
              onClick={() => setShowNewChatDialog(false)}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              Cancel
            </motion.button>
            <motion.button
              onClick={confirmNewChat}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ x: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <motion.div
                initial={{ rotate: 0 }}
                whileHover={{ rotate: 180 }}
                transition={{ type: "spring", stiffness: 200, damping: 10 }}
              >
                <MessageSquarePlus className="h-4 w-4" />
              </motion.div>
              Start New Chat
            </motion.button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
