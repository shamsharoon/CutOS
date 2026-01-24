"use client"

import { Play, Pause, SkipBack, SkipForward, Film } from "lucide-react"
import { useRef, useEffect, useState, useCallback } from "react"
import { useEditor, PIXELS_PER_SECOND, DEFAULT_CLIP_TRANSFORM, DEFAULT_CLIP_EFFECTS } from "./editor-context"
import type { ClipEffects } from "@/lib/projects"

// Build CSS filter string from effects
function buildFilterString(effects: ClipEffects): string {
  const filters: string[] = []
  
  // Add preset filters
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
      // Dreamy/Bloom effect - soft glow look
      filters.push("brightness(115%)", "contrast(90%)", "saturate(120%)", "blur(0.5px)")
      break
  }
  
  // Add adjustment filters
  if (effects.blur > 0) filters.push(`blur(${effects.blur}px)`)
  if (effects.brightness !== 100) filters.push(`brightness(${effects.brightness}%)`)
  if (effects.contrast !== 100) filters.push(`contrast(${effects.contrast}%)`)
  if (effects.saturate !== 100) filters.push(`saturate(${effects.saturate}%)`)
  if (effects.hueRotate > 0) filters.push(`hue-rotate(${effects.hueRotate}deg)`)
  
  return filters.join(" ")
}

export function VideoPreview() {
  const { 
    previewMedia, 
    isPlaying, 
    setIsPlaying, 
    currentTime, 
    setCurrentTime,
    activeClip,
    clipTimeOffset,
    timelineEndTime,
    sortedVideoClips,
    setProjectThumbnail,
  } = useEditor()
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const scrubberRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | null>(null)
  const lastActiveClipIdRef = useRef<string | null>(null)
  
  const [displayTime, setDisplayTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)
  const [thumbnailCaptured, setThumbnailCaptured] = useState(false)

  // Track playback start time and position for smooth animation
  const playbackStartRef = useRef<{ startTime: number; startPosition: number } | null>(null)


  const activeClipTransform = activeClip?.transform ?? DEFAULT_CLIP_TRANSFORM
  const activeClipEffects = activeClip?.effects ?? DEFAULT_CLIP_EFFECTS
  
  // Build the filter string from effects
  const filterString = buildFilterString(activeClipEffects)
  
  // This applies the transformations and effects to the video
  const videoStyle: React.CSSProperties = {
    transform: `translate(${activeClipTransform.positionX}px, ${activeClipTransform.positionY}px) scale(${activeClipTransform.scale / 100})`,
    opacity: activeClipTransform.opacity / 100,
    filter: filterString || undefined,
  }
  // Animate timeline playback using requestAnimationFrame for smoothness
  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      playbackStartRef.current = null
      return
    }

    // Record when playback started and from what position
    playbackStartRef.current = {
      startTime: performance.now(),
      startPosition: currentTime,
    }

    const animate = (now: number) => {
      if (!playbackStartRef.current) return

      // Calculate elapsed time since playback started
      const elapsed = (now - playbackStartRef.current.startTime) / 1000
      const newTime = playbackStartRef.current.startPosition + elapsed
      
      // Stop at end of timeline
      if (newTime >= timelineEndTime) {
        setIsPlaying(false)
        setCurrentTime(timelineEndTime)
        return
      }
      
      setCurrentTime(newTime)
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, timelineEndTime, setCurrentTime, setIsPlaying])

  // Sync video element with active clip and offset
  useEffect(() => {
    if (!videoRef.current || !activeClip || !previewMedia) return

    // If we switched to a different clip, update the video source and seek
    if (lastActiveClipIdRef.current !== activeClip.id) {
      lastActiveClipIdRef.current = activeClip.id
      videoRef.current.currentTime = clipTimeOffset
      
      if (isPlaying) {
        videoRef.current.play().catch(() => {})
      }
    }
  }, [activeClip?.id, previewMedia, clipTimeOffset, isPlaying])

  // Keep video in sync during playback
  useEffect(() => {
    if (!videoRef.current || !activeClip || !isPlaying || isSeeking) return
    
    // Only sync if the video drifts too far from where it should be
    const expectedTime = clipTimeOffset
    const actualTime = videoRef.current.currentTime
    const drift = Math.abs(expectedTime - actualTime)
    
    if (drift > 0.5) {
      videoRef.current.currentTime = expectedTime
    }
  }, [clipTimeOffset, activeClip, isPlaying, isSeeking])

  // Handle play/pause state changes
  useEffect(() => {
    if (!videoRef.current || !previewMedia) return

    if (isPlaying) {
      videoRef.current.play().catch(() => {
        setIsPlaying(false)
      })
    } else {
      videoRef.current.pause()
    }
  }, [isPlaying, previewMedia, setIsPlaying])

  // Update duration when video metadata loads
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }, [])

  // Capture thumbnail from first frame of video
  const captureThumbnail = useCallback(() => {
    if (!videoRef.current || thumbnailCaptured) return
    
    const video = videoRef.current
    const canvas = document.createElement("canvas")
    canvas.width = 320 // Thumbnail width
    canvas.height = 180 // 16:9 aspect ratio
    
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const thumbnail = canvas.toDataURL("image/jpeg", 0.7)
      setProjectThumbnail(thumbnail)
      setThumbnailCaptured(true)
    } catch (error) {
      // CORS error - can't capture thumbnail from cross-origin video
      // This is expected when playing videos from Supabase Storage
      console.warn("Could not capture thumbnail (CORS):", error)
      setThumbnailCaptured(true) // Don't retry
    }
  }, [setProjectThumbnail, thumbnailCaptured])

  // Capture thumbnail when video can play
  const handleCanPlay = useCallback(() => {
    if (!thumbnailCaptured && videoRef.current) {
      // Small delay to ensure frame is rendered
      setTimeout(() => captureThumbnail(), 100)
    }
  }, [captureThumbnail, thumbnailCaptured])

  // Keep display time in sync during playback via animation frame
  useEffect(() => {
    if (!isPlaying) {
      setDisplayTime(currentTime)
      return
    }

    let frameId: number
    const syncDisplayTime = () => {
      setDisplayTime(currentTime)
      frameId = requestAnimationFrame(syncDisplayTime)
    }
    frameId = requestAnimationFrame(syncDisplayTime)

    return () => cancelAnimationFrame(frameId)
  }, [currentTime, isPlaying])

  const handlePlayPause = () => {
    if (!sortedVideoClips.length) return
    
    // If at end, restart from beginning
    if (currentTime >= timelineEndTime) {
      setCurrentTime(0)
    }
    
    setIsPlaying(!isPlaying)
  }

  const handleSkipBack = () => {
    const newTime = Math.max(0, currentTime - 5)
    setCurrentTime(newTime)
    if (videoRef.current && activeClip) {
      const newOffset = (newTime * PIXELS_PER_SECOND - activeClip.startTime) / PIXELS_PER_SECOND
      if (newOffset >= 0) {
        videoRef.current.currentTime = newOffset
      }
    }
  }

  const handleSkipForward = () => {
    const newTime = Math.min(timelineEndTime, currentTime + 5)
    setCurrentTime(newTime)
    if (videoRef.current && activeClip) {
      const newOffset = (newTime * PIXELS_PER_SECOND - activeClip.startTime) / PIXELS_PER_SECOND
      if (newOffset >= 0) {
        videoRef.current.currentTime = newOffset
      }
    }
  }

  // Scrubber interaction
  const handleScrubberClick = useCallback((e: React.MouseEvent) => {
    if (!scrubberRef.current || timelineEndTime === 0) return

    const rect = scrubberRef.current.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const newTime = percent * timelineEndTime

    setCurrentTime(newTime)
    setDisplayTime(newTime)
  }, [timelineEndTime, setCurrentTime])

  const handleScrubberDrag = useCallback((e: React.MouseEvent) => {
    if (!scrubberRef.current || timelineEndTime === 0) return

    setIsSeeking(true)
    const wasPlaying = isPlaying
    if (wasPlaying) {
      setIsPlaying(false)
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!scrubberRef.current) return

      const rect = scrubberRef.current.getBoundingClientRect()
      const percent = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width))
      const newTime = percent * timelineEndTime

      setCurrentTime(newTime)
      setDisplayTime(newTime)
    }

    const handleMouseUp = () => {
      setIsSeeking(false)
      if (wasPlaying) {
        setIsPlaying(true)
      }
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
  }, [timelineEndTime, isPlaying, setCurrentTime, setIsPlaying])

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  const progressPercent = timelineEndTime > 0 ? (displayTime / timelineEndTime) * 100 : 0
  const hasClips = sortedVideoClips.length > 0

  return (
    <div className="flex h-full flex-col">
      {/* Video Preview Area */}
      <div className="flex flex-1 items-center justify-center bg-black/40 p-6">
        <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-lg border border-border bg-black">
          {previewMedia && activeClip ? (
            <>
              <video
                ref={videoRef}
                key={previewMedia.id} // Force remount when media changes
                src={previewMedia.objectUrl}
                crossOrigin="anonymous"
                className="h-full w-full object-contain cursor-pointer"
                style={videoStyle}
                onClick={handlePlayPause}
                onLoadedMetadata={handleLoadedMetadata}
                onCanPlay={handleCanPlay}
                muted={false}
                playsInline
              />
              {/* VHS Scanlines Overlay */}
              {activeClipEffects.preset === "vhs" && (
                <div 
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)",
                    mixBlendMode: "multiply",
                  }}
                />
              )}
              {/* Glitch Effect Overlays - RGB Split */}
              {activeClipEffects.preset === "glitch" && (
                <>
                  <div 
                    className="pointer-events-none absolute inset-0 animate-pulse"
                    style={{
                      background: "linear-gradient(90deg, rgba(255,0,0,0.15) 0%, transparent 50%, rgba(0,255,255,0.15) 100%)",
                      mixBlendMode: "screen",
                    }}
                  />
                  <div 
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)",
                    }}
                  />
                </>
              )}
            </>
          ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Film className="mx-auto mb-2 h-16 w-16 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">
                  {hasClips ? "Move playhead over a clip" : "Drop media on timeline to preview"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transport Controls */}
      <div className="border-t border-border bg-card px-6 py-4">
        <div className="mx-auto max-w-5xl">
          {/* Playhead Scrubber */}
          <div className="mb-3 flex items-center gap-3">
            <div className="font-mono text-xs text-muted-foreground w-16">
              {formatTime(displayTime)}
            </div>
            <div
              ref={scrubberRef}
              className="relative h-1 flex-1 cursor-pointer rounded-full bg-secondary/50"
              onClick={handleScrubberClick}
              onMouseDown={handleScrubberDrag}
            >
              {/* Progress bar */}
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-primary"
                style={{ width: `${progressPercent}%` }}
              />
              
              {/* Playhead handle */}
              <div
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-background"
                style={{ left: `${progressPercent}%` }}
              />
            </div>
            <div className="font-mono text-xs text-muted-foreground w-16 text-right">
              {formatTime(timelineEndTime)}
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handleSkipBack}
              className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
              disabled={!hasClips}
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={handlePlayPause}
              className="rounded-md bg-primary p-3 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              disabled={!hasClips}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              onClick={handleSkipForward}
              className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
              disabled={!hasClips}
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
