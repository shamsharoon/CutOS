"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Download, Loader2, Check, AlertCircle, Film } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useEditor, PIXELS_PER_SECOND, DEFAULT_CLIP_TRANSFORM, DEFAULT_CLIP_EFFECTS } from "./editor-context"
import type { ClipEffects } from "@/lib/projects"

interface ExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ExportFormat = "mp4" | "webm"
type ExportQuality = "low" | "medium" | "high"

const QUALITY_SETTINGS: Record<ExportQuality, { bitrate: number; label: string }> = {
  low: { bitrate: 2_500_000, label: "Low (2.5 Mbps)" },
  medium: { bitrate: 5_000_000, label: "Medium (5 Mbps)" },
  high: { bitrate: 10_000_000, label: "High (10 Mbps)" },
}

// Build CSS filter string from effects
function buildFilterString(effects: ClipEffects): string {
  const filters: string[] = []

  switch (effects.preset) {
    case "grayscale":
      filters.push("grayscale(100%)")
      break
    case "sepia":
      filters.push("sepia(100%)")
      break
    case "invert":
      filters.push("invert(100%)")
      break
    case "cyberpunk":
      filters.push("saturate(180%)", "hue-rotate(280deg)", "contrast(130%)", "brightness(110%)")
      break
    case "noir":
      filters.push("grayscale(100%)", "contrast(150%)", "brightness(85%)")
      break
    case "vhs":
      filters.push("saturate(130%)", "contrast(115%)", "brightness(105%)", "sepia(20%)")
      break
    case "glitch":
      filters.push("contrast(130%)", "saturate(150%)")
      break
    case "ascii":
      filters.push("brightness(115%)", "contrast(90%)", "saturate(120%)")
      break
  }

  if (effects.blur > 0) filters.push(`blur(${effects.blur}px)`)
  if (effects.brightness !== 100) filters.push(`brightness(${effects.brightness}%)`)
  if (effects.contrast !== 100) filters.push(`contrast(${effects.contrast}%)`)
  if (effects.saturate !== 100) filters.push(`saturate(${effects.saturate}%)`)
  if (effects.hueRotate > 0) filters.push(`hue-rotate(${effects.hueRotate}deg)`)

  return filters.join(" ")
}

// Check if requestVideoFrameCallback is supported
const supportsVideoFrameCallback = typeof HTMLVideoElement !== 'undefined' &&
  'requestVideoFrameCallback' in HTMLVideoElement.prototype

// Type for requestVideoFrameCallback
type VideoFrameCallbackMetadata = {
  presentationTime: number
  expectedDisplayTime: number
  width: number
  height: number
  mediaTime: number
  presentedFrames: number
  processingDuration?: number
}

export function ExportModal({ open, onOpenChange }: ExportModalProps) {
  const { sortedVideoClips, mediaFiles, timelineEndTime } = useEditor()

  const [format, setFormat] = useState<ExportFormat>("webm")
  const [quality, setQuality] = useState<ExportQuality>("medium")
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const abortRef = useRef(false)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setProgress(0)
      setError(null)
      setSuccess(false)
      abortRef.current = false
    }
  }, [open])

  const handleExport = useCallback(async () => {
    if (!canvasRef.current || sortedVideoClips.length === 0) return

    setIsExporting(true)
    setProgress(0)
    setError(null)
    setSuccess(false)
    abortRef.current = false

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) {
      setError("Failed to get canvas context")
      setIsExporting(false)
      return
    }

    // Set canvas size (1080p)
    canvas.width = 1920
    canvas.height = 1080

    // Sort clips by start time
    const clips = [...sortedVideoClips].sort((a, b) => a.startTime - b.startTime)

    // Create and preload video elements for each clip
    const videoElements: Map<string, HTMLVideoElement> = new Map()

    try {
      for (const clip of clips) {
        const media = mediaFiles.find(m => m.id === clip.mediaId)
        if (!media) continue

        const video = document.createElement("video")
        video.src = media.objectUrl
        video.muted = true
        video.playsInline = true
        video.preload = "auto"
        video.crossOrigin = "anonymous"

        // Wait for video to be fully loaded
        await new Promise<void>((resolve, reject) => {
          video.oncanplaythrough = () => resolve()
          video.onerror = () => reject(new Error(`Failed to load video: ${media.name}`))
          video.load()
        })

        // Pre-seek to the clip's media offset
        const mediaOffset = clip.mediaOffset / PIXELS_PER_SECOND
        video.currentTime = mediaOffset

        await new Promise<void>(resolve => {
          video.onseeked = () => resolve()
          setTimeout(resolve, 500) // Timeout fallback
        })

        videoElements.set(clip.id, video)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load videos")
      setIsExporting(false)
      return
    }

    // Setup MediaRecorder with supported codec
    let mimeType = "video/webm;codecs=vp9"
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "video/webm;codecs=vp8"
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm"
      }
    }

    const stream = canvas.captureStream(30)

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: QUALITY_SETTINGS[quality].bitrate,
    })

    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data)
      }
    }

    const exportPromise = new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error("Recording failed"))
      recorder.onstop = () => {
        if (abortRef.current) {
          reject(new Error("Export cancelled"))
          return
        }
        resolve(new Blob(chunks, { type: mimeType }))
      }
    })

    recorder.start(100)

    // Track export state
    let currentClipIndex = 0
    let exportStartTime = performance.now()
    let activeVideo: HTMLVideoElement | null = null
    let frameCallbackId: number | null = null

    // Helper to draw a frame to canvas
    const drawFrame = (video: HTMLVideoElement, clip: typeof clips[0]) => {
      const transform = clip.transform ?? DEFAULT_CLIP_TRANSFORM
      const effects = clip.effects ?? DEFAULT_CLIP_EFFECTS

      // Clear canvas
      ctx.fillStyle = "#000000"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Save context state
      ctx.save()

      // Apply filter if any
      const filterString = buildFilterString(effects)
      if (filterString) {
        ctx.filter = filterString
      }

      // Apply opacity
      ctx.globalAlpha = transform.opacity / 100

      // Calculate drawing position and size (maintain aspect ratio)
      const videoAspect = video.videoWidth / video.videoHeight
      const canvasAspect = canvas.width / canvas.height

      let drawWidth: number, drawHeight: number
      if (videoAspect > canvasAspect) {
        drawWidth = canvas.width
        drawHeight = canvas.width / videoAspect
      } else {
        drawHeight = canvas.height
        drawWidth = canvas.height * videoAspect
      }

      // Apply scale
      const scale = transform.scale / 100
      drawWidth *= scale
      drawHeight *= scale

      const drawX = (canvas.width - drawWidth) / 2 + transform.positionX
      const drawY = (canvas.height - drawHeight) / 2 + transform.positionY

      // Draw video frame
      try {
        ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight)
      } catch (e) {
        console.warn("Draw error:", e)
      }

      // Restore context
      ctx.restore()
    }

    // Calculate timeline time from elapsed export time
    const getTimelineTime = () => {
      return (performance.now() - exportStartTime) / 1000
    }

    // Find active clip at given timeline time
    const findActiveClip = (timelineTime: number) => {
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i]
        const clipStart = clip.startTime / PIXELS_PER_SECOND
        const clipEnd = clipStart + (clip.duration / PIXELS_PER_SECOND)
        if (timelineTime >= clipStart && timelineTime < clipEnd) {
          return { clip, index: i }
        }
      }
      return null
    }

    // Start playing a clip
    const startClip = async (clip: typeof clips[0]) => {
      const video = videoElements.get(clip.id)
      if (!video) return

      // Stop previous video
      if (activeVideo && activeVideo !== video) {
        activeVideo.pause()
      }

      activeVideo = video

      // Seek to correct position in the media
      const clipStart = clip.startTime / PIXELS_PER_SECOND
      const mediaOffset = clip.mediaOffset / PIXELS_PER_SECOND
      const timelineTime = getTimelineTime()
      const videoTime = mediaOffset + (timelineTime - clipStart)

      video.currentTime = Math.max(mediaOffset, Math.min(videoTime, video.duration))

      // Wait for seek to complete
      await new Promise<void>(resolve => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)
          resolve()
        }
        video.addEventListener('seeked', onSeeked)
        setTimeout(resolve, 100)
      })

      // Start playback
      try {
        await video.play()
      } catch (e) {
        console.warn("Play failed:", e)
      }
    }

    // Main render loop using requestVideoFrameCallback or requestAnimationFrame
    const renderLoop = () => {
      if (abortRef.current) {
        if (activeVideo) activeVideo.pause()
        recorder.stop()
        return
      }

      const timelineTime = getTimelineTime()

      // Check if export is complete
      if (timelineTime >= timelineEndTime) {
        if (activeVideo) activeVideo.pause()
        recorder.stop()
        return
      }

      // Update progress
      setProgress(Math.round((timelineTime / timelineEndTime) * 100))

      // Find and draw active clip
      const activeClipInfo = findActiveClip(timelineTime)

      if (activeClipInfo) {
        const { clip, index } = activeClipInfo

        // Check if we need to switch clips
        if (index !== currentClipIndex) {
          currentClipIndex = index
          startClip(clip)
        }

        const video = videoElements.get(clip.id)
        if (video && video.readyState >= 2) {
          drawFrame(video, clip)
        }
      } else {
        // No clip at this time, draw black
        ctx.fillStyle = "#000000"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      // Schedule next frame
      if (supportsVideoFrameCallback && activeVideo) {
        // Use requestVideoFrameCallback for frame-accurate timing
        frameCallbackId = (activeVideo as any).requestVideoFrameCallback(
          (_now: number, _metadata: VideoFrameCallbackMetadata) => {
            renderLoop()
          }
        )
      } else {
        // Fallback to requestAnimationFrame
        requestAnimationFrame(renderLoop)
      }
    }

    // Start first clip and begin render loop
    const firstClipInfo = findActiveClip(0)
    if (firstClipInfo) {
      await startClip(firstClipInfo.clip)
      currentClipIndex = firstClipInfo.index
    }

    // Start the render loop
    exportStartTime = performance.now()
    renderLoop()

    try {
      const blob = await exportPromise

      // Download the file
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `export-${Date.now()}.webm`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setSuccess(true)
    } catch (e) {
      if (!abortRef.current) {
        setError(e instanceof Error ? e.message : "Export failed")
      }
    } finally {
      setIsExporting(false)
      // Cleanup video elements
      videoElements.forEach(video => {
        video.pause()
        video.src = ""
        video.load()
      })
    }

  }, [sortedVideoClips, mediaFiles, timelineEndTime, quality])

  const handleCancel = () => {
    if (isExporting) {
      abortRef.current = true
    } else {
      onOpenChange(false)
    }
  }

  const hasClips = sortedVideoClips.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Video
          </DialogTitle>
          <DialogDescription>
            Render your project to a video file
          </DialogDescription>
        </DialogHeader>

        {!hasClips ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Film className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Add clips to the timeline before exporting
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Format Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Format</label>
              <div className="grid grid-cols-2 gap-2">
                {(["webm", "mp4"] as ExportFormat[]).map((f) => (
                  <motion.button
                    key={f}
                    onClick={() => setFormat(f)}
                    disabled={isExporting}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                      format === f
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground hover:bg-secondary/80"
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    {f.toUpperCase()}
                    {f === "mp4" && (
                      <span className="block text-[10px] opacity-70">
                        (exported as WebM)
                      </span>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Quality Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Quality</label>
              <div className="space-y-1">
                {(Object.entries(QUALITY_SETTINGS) as [ExportQuality, { bitrate: number; label: string }][]).map(([q, settings]) => (
                  <motion.button
                    key={q}
                    onClick={() => setQuality(q)}
                    disabled={isExporting}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors cursor-pointer disabled:opacity-50 ${
                      quality === q
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "bg-secondary/50 text-foreground hover:bg-secondary"
                    }`}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.99 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <span className="capitalize">{q}</span>
                    <span className="text-xs text-muted-foreground">{settings.label.split("(")[1]?.replace(")", "")}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Progress */}
            <AnimatePresence>
              {isExporting && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Exporting...</span>
                    <span className="font-mono">{progress}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ type: "spring", stiffness: 100, damping: 20 }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {supportsVideoFrameCallback
                      ? "Using frame-accurate rendering"
                      : "Export runs at 1x speed"}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md"
                >
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success */}
            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2 text-sm text-green-600 bg-green-500/10 px-3 py-2 rounded-md"
                >
                  <Check className="h-4 w-4" />
                  Export complete! Your download should start automatically.
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hidden canvas for rendering */}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-4">
          <motion.button
            onClick={handleCancel}
            className="px-4 py-2 rounded-md text-sm font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            {isExporting ? "Cancel" : "Close"}
          </motion.button>
          {hasClips && !success && (
            <motion.button
              onClick={handleExport}
              disabled={isExporting}
              className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
              whileHover={!isExporting ? { scale: 1.02 } : {}}
              whileTap={!isExporting ? { scale: 0.98 } : {}}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export
                </>
              )}
            </motion.button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
