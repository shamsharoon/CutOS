"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Video, Volume2, Lock, Eye, Film, Trash2 } from "lucide-react"
import { useEditor, TimelineClip, PIXELS_PER_SECOND, DEFAULT_CLIP_TRANSFORM, DEFAULT_CLIP_EFFECTS } from "./editor-context"

export function Timeline() {
  const {
    mediaFiles,
    timelineClips,
    addClipToTimeline,
    updateClip,
    removeClip,
    selectedClipId,
    setSelectedClipId,
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    timelineEndTime,
    isScrubbing,
    setIsScrubbing,
  } = useEditor()

  // Local state for smooth playhead animation
  const [localPlayheadPosition, setLocalPlayheadPosition] = useState(currentTime * PIXELS_PER_SECOND)
  const animationRef = useRef<number | null>(null)

  // Sync local position with context when not playing or when currentTime changes externally
  useEffect(() => {
    if (!isPlaying) {
      setLocalPlayheadPosition(currentTime * PIXELS_PER_SECOND)
    }
  }, [currentTime, isPlaying])

  // Animate playhead smoothly during playback
  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      return
    }

    const animate = () => {
      // Read current time from context and update local position
      setLocalPlayheadPosition(currentTime * PIXELS_PER_SECOND)
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [isPlaying, currentTime])

  const playheadPosition = localPlayheadPosition

  const [draggedClip, setDraggedClip] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [dropTargetTrack, setDropTargetTrack] = useState<string | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  const tracks = ["V2", "V1", "A2", "A1"]

  const handleClipMouseDown = (e: React.MouseEvent, clipId: string) => {
    e.stopPropagation()
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setDragOffset(e.clientX - rect.left)
    setDraggedClip(clipId)
    setSelectedClipId(clipId)
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
    if (!draggedClip || !timelineRef.current) return

    const timelineRect = timelineRef.current.getBoundingClientRect()
    const relativeX = e.clientX - timelineRect.left - dragOffset - 96 // Subtract track label width
    const relativeY = e.clientY - timelineRect.top

      // Snap to grid (every 10px = 1 second)
    const snappedX = Math.max(0, Math.round(relativeX / 10) * 10)

    // Calculate which track the mouse is over
    // Track height is 48px (h-12), ruler is 24px (h-6)
    const TRACK_HEIGHT = 48
    const RULER_HEIGHT = 24
    const trackIndex = Math.floor((relativeY - RULER_HEIGHT) / TRACK_HEIGHT)
    
    // Get the dragged clip to check its type
    const clip = timelineClips.find(c => c.id === draggedClip)
    if (!clip) return

    // Determine the target track based on Y position
    let targetTrackId: string | null = null
    if (trackIndex >= 0 && trackIndex < tracks.length) {
      const targetTrack = tracks[trackIndex]
      // Only allow moving to compatible tracks (video clips to video tracks, audio clips to audio tracks)
      const isVideoTrack = targetTrack.startsWith("V")
      const isVideoClip = clip.type === "video"
      
      if ((isVideoClip && isVideoTrack) || (!isVideoClip && !isVideoTrack)) {
        targetTrackId = targetTrack
      }
    }

    // Update clip position and track if valid
    const updates: Partial<TimelineClip> = { startTime: snappedX }
    if (targetTrackId && targetTrackId !== clip.trackId) {
      updates.trackId = targetTrackId
    }

    updateClip(draggedClip, updates)
    },
    [draggedClip, dragOffset, updateClip, timelineClips, tracks]
    )

  const handleMouseUp = useCallback(() => {
    setDraggedClip(null)
    setDragOffset(0)
  }, [])

  useEffect(() => {
    if (draggedClip) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
      return () => {
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [draggedClip, handleMouseMove, handleMouseUp])

  // Handle drops from media panel
  const handleTrackDragOver = useCallback((e: React.DragEvent, trackId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDropTargetTrack(trackId)
  }, [])

  const handleTrackDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDropTargetTrack(null)
  }, [])

  const handleTrackDrop = useCallback(
    (e: React.DragEvent, trackId: string) => {
      e.preventDefault()
      e.stopPropagation()
      setDropTargetTrack(null)

      const mediaId = e.dataTransfer.getData("application/x-media-id")
      if (!mediaId) return

      const media = mediaFiles.find((m) => m.id === mediaId)
      if (!media) return

      // Calculate clip width based on duration (10px per second)
      const clipWidth = Math.max(80, media.durationSeconds * PIXELS_PER_SECOND)

      // Find clips on this track and get the end position of the last one
      const clipsOnTrack = timelineClips.filter((clip) => clip.trackId === trackId)
      
      let startPosition: number
      if (clipsOnTrack.length === 0) {
        // No clips on track - place at the beginning
        startPosition = 0
      } else {
        // Find the rightmost clip end position
        const lastClipEnd = clipsOnTrack.reduce((max, clip) => {
          const clipEnd = clip.startTime + clip.duration
          return Math.max(max, clipEnd)
        }, 0)
        startPosition = lastClipEnd
      }

      const newClip: TimelineClip = {
        id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        mediaId: media.id,
        trackId,
        startTime: startPosition,
        duration: clipWidth,
        mediaOffset: 0, // Start from beginning of source media
        label: media.name,
        type: trackId.startsWith("V") ? "video" : "audio",
        transform: DEFAULT_CLIP_TRANSFORM,
        effects: DEFAULT_CLIP_EFFECTS,
      }

      addClipToTimeline(newClip)
    },
    [mediaFiles, timelineClips, addClipToTimeline]
  )

  // Calculate time from mouse position
  const getTimeFromMouseEvent = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!timelineRef.current) return null
    const timelineRect = timelineRef.current.getBoundingClientRect()
    const relativeX = e.clientX - timelineRect.left
    if (relativeX >= 0) {
      return Math.max(0, relativeX / PIXELS_PER_SECOND)
    }
    return null
  }, [])

  // Handle scrubbing (drag to move playhead)
  const handleTimelineMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!timelineRef.current) return
      
      // Prevent text selection during drag
      e.preventDefault()
      e.stopPropagation()
      
      // Check if we clicked on a clip
      const target = e.target as HTMLElement
      if (target.closest("[data-clip-id]")) return

      const newTime = getTimeFromMouseEvent(e)
      if (newTime !== null) {
        // Pause playback if playing
        if (isPlaying) {
          setIsPlaying(false)
        }
        // Allow dragging past the timeline end
        const clampedTime = Math.max(0, newTime)
        setCurrentTime(clampedTime)
        setSelectedClipId(null)
        setIsScrubbing(true)
      }
    },
    [setCurrentTime, setSelectedClipId, getTimeFromMouseEvent, setIsScrubbing, isPlaying, setIsPlaying]
  )

  // Handle scrubbing mousemove
  const handleScrubMove = useCallback(
    (e: MouseEvent) => {
      if (!isScrubbing) return
      // Prevent text selection and default behaviors during drag
      e.preventDefault()
      e.stopPropagation()
      const newTime = getTimeFromMouseEvent(e)
      if (newTime !== null) {
        // Allow dragging past the timeline end
        const clampedTime = Math.max(0, newTime)
        setCurrentTime(clampedTime)
      }
    },
    [isScrubbing, setCurrentTime, getTimeFromMouseEvent]
  )

  // Handle scrubbing mouseup
  const handleScrubEnd = useCallback(() => {
    setIsScrubbing(false)
  }, [])

  // Add/remove scrubbing event listeners
  useEffect(() => {
    if (isScrubbing) {
      // Prevent text selection globally during scrubbing
      const originalUserSelect = document.body.style.userSelect
      const originalCursor = document.body.style.cursor
      const originalWebkitUserSelect = (document.body.style as any).webkitUserSelect
      
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'ew-resize'
      ;(document.body.style as any).webkitUserSelect = 'none'
      
      // Also prevent selection on the document
      const preventSelect = (e: Event) => e.preventDefault()
      document.addEventListener('selectstart', preventSelect)
      document.addEventListener('dragstart', preventSelect)
      
      window.addEventListener("mousemove", handleScrubMove)
      window.addEventListener("mouseup", handleScrubEnd)
      return () => {
        document.body.style.userSelect = originalUserSelect
        document.body.style.cursor = originalCursor
        ;(document.body.style as any).webkitUserSelect = originalWebkitUserSelect
        document.removeEventListener('selectstart', preventSelect)
        document.removeEventListener('dragstart', preventSelect)
        window.removeEventListener("mousemove", handleScrubMove)
        window.removeEventListener("mouseup", handleScrubEnd)
      }
    }
  }, [isScrubbing, handleScrubMove, handleScrubEnd])

  const handleDeleteClip = useCallback(
    (e: React.MouseEvent, clipId: string) => {
      e.stopPropagation()
      removeClip(clipId)
    },
    [removeClip]
  )

  // Format time for ruler (MM:SS)
  const formatRulerTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  return (
    <div className="flex h-full flex-col">
      {/* Timeline Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
        <div className="text-xs font-medium text-foreground">Timeline</div>
          <div className="font-mono text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
            {formatRulerTime(currentTime)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer">
            Fit
          </button>
          <div className="flex items-center gap-1">
            <button className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer">
              −
            </button>
            <div className="px-2 text-xs text-muted-foreground">100%</div>
            <button className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer">
              +
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Tracks */}
      <div className="flex flex-1 overflow-hidden">
        {/* Track Labels */}
        <div className="w-24 border-r border-border bg-secondary">
          {tracks.map((track) => (
            <div key={track} className="flex h-12 items-center gap-2 border-b border-border px-2">
              <div className="flex items-center gap-1">
                {track.startsWith("V") ? (
                  <Video className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <Volume2 className="h-3 w-3 text-muted-foreground" />
                )}
                <Lock className="h-2.5 w-2.5 text-muted-foreground/50" />
                <Eye className="h-2.5 w-2.5 text-muted-foreground/50" />
              </div>
              <div className="text-xs font-medium text-foreground">{track}</div>
            </div>
          ))}
        </div>

        {/* Timeline Grid */}
        <div
          ref={timelineRef}
          className={`relative flex-1 overflow-x-auto scrollbar-thin select-none ${isScrubbing ? "cursor-ew-resize" : ""}`}
          onMouseDown={handleTimelineMouseDown}
          style={{ 
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none'
          } as React.CSSProperties}
        >
          {/* Time Ruler - 80px = 8 seconds at 10px/second */}
          <div className="sticky top-0 z-10 flex h-6 border-b border-border bg-card">
            {Array.from({ length: 60 }).map((_, i) => (
              <div key={i} className="shrink-0 border-r border-border" style={{ width: "80px" }}>
                <div className="px-2 text-[10px] text-muted-foreground">
                  {formatRulerTime(i * 8)}
                </div>
              </div>
            ))}
          </div>

          {/* Tracks Content */}
          <div className="relative">
            {tracks.map((track, index) => (
              <div
                key={track}
                className={`flex h-12 border-b border-border transition-colors ${
                  dropTargetTrack === track ? "bg-primary/20" : ""
                }`}
                style={{
                  background: dropTargetTrack === track 
                    ? undefined 
                    : index < 2 ? "oklch(0.10 0 0)" : "oklch(0.12 0 0)",
                }}
                onDragOver={(e) => handleTrackDragOver(e, track)}
                onDragLeave={handleTrackDragLeave}
                onDrop={(e) => handleTrackDrop(e, track)}
              >
                {/* Grid lines */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {Array.from({ length: 60 }).map((_, i) => (
                    <div key={i} className="shrink-0 border-r border-border/30" style={{ width: "80px" }} />
                  ))}
                </div>

                {timelineClips
                  .filter((clip) => clip.trackId === track)
                  .map((clip) => {
                    const media = mediaFiles.find((m) => m.id === clip.mediaId)
                    return (
                    <div
                      key={clip.id}
                        data-clip-id={clip.id}
                      onMouseDown={(e) => handleClipMouseDown(e, clip.id)}
                        className={`absolute z-10 mx-1 my-1.5 h-9 rounded border cursor-move overflow-hidden group ${
                        clip.type === "video" ? "bg-primary/80 border-primary" : "bg-chart-2/80 border-chart-2"
                        } ${draggedClip === clip.id ? "opacity-70" : ""} ${
                          selectedClipId === clip.id ? "ring-2 ring-white" : ""
                        }`}
                      style={{ left: `${clip.startTime}px`, width: `${clip.duration}px` }}
                    >
                      {clip.type === "video" ? (
                          <div className="flex h-full items-center gap-1.5 px-2">
                            {media?.thumbnail ? (
                              <img 
                                src={media.thumbnail} 
                                alt="" 
                                className="h-6 w-10 object-cover rounded-sm shrink-0"
                              />
                            ) : (
                              <Film className="h-3 w-3 text-primary-foreground/80 shrink-0" />
                            )}
                            <div className="text-[10px] font-medium text-primary-foreground truncate">
                              {clip.label}
                            </div>
                        </div>
                      ) : (
                        <div className="h-full">
                          <div className="flex h-full items-center gap-1.5 px-2">
                              <Volume2 className="h-3 w-3 shrink-0 text-foreground/60" />
                            {/* Simple waveform visualization */}
                            <div className="flex h-full flex-1 items-center gap-px">
                                {Array.from({ length: Math.min(40, Math.floor(clip.duration / 8)) }).map((_, i) => (
                                <div
                                  key={i}
                                  className="flex-1 bg-foreground/60"
                                  style={{ height: `${30 + Math.random() * 70}%` }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                        
                        {/* Delete button on hover */}
                        <button
                          onClick={(e) => handleDeleteClip(e, clip.id)}
                          className="absolute top-0.5 right-0.5 rounded bg-black/60 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 cursor-pointer"
                        >
                          <Trash2 className="h-2.5 w-2.5 text-white" />
                        </button>
                    </div>
                    )
                  })}
              </div>
            ))}

            {/* Playhead - synced with video */}
            <div
              className="absolute top-0 z-20 h-full w-0.5 bg-red-500"
              style={{ left: `${playheadPosition}px` }}
            >
              {/* Draggable playhead handle */}
              <div 
                className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-red-500 ring-2 ring-background shadow-lg cursor-ew-resize hover:scale-125 transition-transform select-none"
                onMouseDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault() // Prevent text selection
                  // Pause playback if playing
                  if (isPlaying) {
                    setIsPlaying(false)
                  }
                  const newTime = getTimeFromMouseEvent(e)
                  if (newTime !== null) {
                    // Allow dragging past the timeline end
                    const clampedTime = Math.max(0, newTime)
                    setCurrentTime(clampedTime)
                  }
                  setIsScrubbing(true)
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Empty state hint */}
      {timelineClips.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-muted-foreground/50">
            <Film className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Drag media here to start editing</p>
          </div>
        </div>
      )}
    </div>
  )
}
