"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Video, Volume2, Lock, Eye, Film, Trash2, Scissors, Undo2, Redo2, Copy, Clipboard } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
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
    activeClip,
    splitClip,
    undo,
    redo,
    canUndo,
    canRedo,
    copyClip,
    pasteClip,
    canPaste,
    zoomLevel,
    zoomIn,
    zoomOut,
    zoomToFit,
    pixelsPerSecond,
  } = useEditor()

  // Editing actions
  const handleCut = () => {
    if (activeClip) {
      splitClip(activeClip.id, currentTime)
    }
  }

  const handleDelete = () => {
    if (selectedClipId) {
      removeClip(selectedClipId)
    } else if (activeClip) {
      removeClip(activeClip.id)
    }
  }

  const handleCopy = () => {
    if (selectedClipId) {
      copyClip(selectedClipId)
    } else if (activeClip) {
      copyClip(activeClip.id)
    }
  }

  // Local state for smooth playhead animation
  const [localPlayheadPosition, setLocalPlayheadPosition] = useState(currentTime * pixelsPerSecond)
  const animationRef = useRef<number | null>(null)

  // Sync local position with context when not playing or when currentTime/zoom changes
  useEffect(() => {
    if (!isPlaying) {
      setLocalPlayheadPosition(currentTime * pixelsPerSecond)
    }
  }, [currentTime, isPlaying, pixelsPerSecond])

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
      setLocalPlayheadPosition(currentTime * pixelsPerSecond)
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [isPlaying, currentTime, pixelsPerSecond])

  const playheadPosition = localPlayheadPosition

  const [draggedClip, setDraggedClip] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [dropTargetTrack, setDropTargetTrack] = useState<string | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  const tracks = ["V2", "V1", "A2", "A1"]

  const handleClipMouseDown = useCallback((e: React.MouseEvent, clipId: string) => {
    e.preventDefault() // Prevent text selection and default drag behavior
    e.stopPropagation()
    if (!timelineRef.current) return
    
    // Calculate offset relative to timeline, not the clip itself
    const timelineRect = timelineRef.current.getBoundingClientRect()
    const clip = timelineClips.find(c => c.id === clipId)
    if (!clip) return
    
    // Calculate where the mouse is within the timeline (visual pixels)
    const mouseXInTimeline = e.clientX - timelineRect.left - 96 // Subtract track label width
    
    // Calculate where the clip starts (visual pixels)
    const clipVisualStart = (clip.startTime / PIXELS_PER_SECOND) * pixelsPerSecond
    
    // The drag offset is how far into the clip the user clicked (visual pixels)
    setDragOffset(mouseXInTimeline - clipVisualStart)
    setDraggedClip(clipId)
    setSelectedClipId(clipId)
  }, [timelineClips, pixelsPerSecond, setSelectedClipId])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
    if (!draggedClip || !timelineRef.current) return

    const timelineRect = timelineRef.current.getBoundingClientRect()
    const mouseXInTimeline = e.clientX - timelineRect.left - 96 // Subtract track label width
    const relativeY = e.clientY - timelineRect.top
    
    // Calculate the new position (visual pixels)
    const relativeX = mouseXInTimeline - dragOffset

      // Snap to grid based on zoom level (visual pixels)
    const gridSize = pixelsPerSecond // 1 second grid at current zoom
    const snappedVisualX = Math.max(0, Math.round(relativeX / gridSize) * gridSize)
    
    // Convert visual position back to base pixels for storage
    const snappedX = (snappedVisualX / pixelsPerSecond) * PIXELS_PER_SECOND

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
    [draggedClip, dragOffset, updateClip, timelineClips, tracks, pixelsPerSecond]
    )

  const handleMouseUp = useCallback(() => {
    setDraggedClip(null)
    setDragOffset(0)
  }, [])

  useEffect(() => {
    if (draggedClip) {
      // Use capture phase to ensure we always get the mouseup event
      const handleMouseUpCapture = (e: MouseEvent) => {
        handleMouseUp()
      }
      
      // Handle Escape key to cancel drag
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          handleMouseUp()
        }
      }
      
      // Listen on both window and document to catch all mouseup events
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUpCapture, true) // Capture phase
      document.addEventListener("mouseup", handleMouseUpCapture, true) // Also on document
      
      // Also clear drag state if mouse leaves the window
      window.addEventListener("mouseleave", handleMouseUp)
      
      // Allow Escape key to cancel drag
      window.addEventListener("keydown", handleEscape)
      
      return () => {
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUpCapture, true)
        document.removeEventListener("mouseup", handleMouseUpCapture, true)
        window.removeEventListener("mouseleave", handleMouseUp)
        window.removeEventListener("keydown", handleEscape)
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

      // Check for NLP search result time range (from AI search)
      const clipStartStr = e.dataTransfer.getData("application/x-clip-start")
      const clipEndStr = e.dataTransfer.getData("application/x-clip-end")
      
      let mediaOffset = 0 // Start from beginning of source media by default
      let clipDuration: number
      let clipLabel = media.name
      
      if (clipStartStr && clipEndStr) {
        // NLP search result with specific time range
        const clipStart = parseFloat(clipStartStr)
        const clipEnd = parseFloat(clipEndStr)
        mediaOffset = clipStart * PIXELS_PER_SECOND // Convert seconds to base pixels
        clipDuration = Math.max(80, (clipEnd - clipStart) * PIXELS_PER_SECOND)
        
        // Format time for label
        const formatTime = (s: number) => {
          const mins = Math.floor(s / 60)
          const secs = Math.floor(s % 60)
          return `${mins}:${secs.toString().padStart(2, "0")}`
        }
        clipLabel = `${media.name} (${formatTime(clipStart)} - ${formatTime(clipEnd)})`
      } else {
        // Full media clip
        clipDuration = Math.max(80, media.durationSeconds * PIXELS_PER_SECOND)
      }

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
        duration: clipDuration,
        mediaOffset: mediaOffset,
        label: clipLabel,
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
      return Math.max(0, relativeX / pixelsPerSecond)
    }
    return null
  }, [pixelsPerSecond])

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

  // Handle scroll wheel zoom on timeline
  useEffect(() => {
    const timelineElement = timelineRef.current
    if (!timelineElement) return

    const handleWheel = (e: WheelEvent) => {
      // Check if Ctrl or Cmd is pressed (standard zoom gesture)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        
        // Determine zoom direction (negative deltaY = zoom in, positive = zoom out)
        if (e.deltaY < 0) {
          // Zoom in
          if (zoomLevel < 500) {
            zoomIn()
          }
        } else {
          // Zoom out
          if (zoomLevel > 25) {
            zoomOut()
          }
        }
      }
    }

    timelineElement.addEventListener('wheel', handleWheel, { passive: false })
    
    return () => {
      timelineElement.removeEventListener('wheel', handleWheel)
    }
  }, [zoomLevel, zoomIn, zoomOut])

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
          {/* Editing Toolbar */}
          <div className="flex items-center gap-1 border-l border-border pl-3 ml-3">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleCut}
                disabled={!activeClip}
                title="Split clip at playhead (S)"
              >
                <Scissors className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleDelete}
                disabled={!selectedClipId && !activeClip}
                title="Delete clip (Delete)"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
            <div className="w-px h-3 bg-border mx-0.5" />
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={undo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z / Cmd+Z)"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Ctrl+Shift+Z / Cmd+Shift+Z)"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
            <div className="w-px h-3 bg-border mx-0.5" />
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleCopy}
                disabled={!selectedClipId && !activeClip}
                title="Copy clip (Ctrl+C / Cmd+C)"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={pasteClip}
                disabled={!canPaste}
                title="Paste clip (Ctrl+V / Cmd+V)"
              >
                <Clipboard className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
          </div>
          <div className="font-mono text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
            {formatRulerTime(currentTime)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button 
            onClick={zoomToFit}
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Zoom to fit all clips"
          >
            Fit
          </motion.button>
          <div className="flex items-center gap-1">
            <motion.button 
              onClick={zoomOut}
              disabled={zoomLevel <= 25}
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: zoomLevel > 25 ? 1.05 : 1 }}
              whileTap={{ scale: zoomLevel > 25 ? 0.95 : 1 }}
              title="Zoom out (max 10 minutes)"
            >
              −
            </motion.button>
            <div className="px-2 text-xs text-muted-foreground font-mono min-w-[48px] text-center">
              {zoomLevel}%
            </div>
            <motion.button 
              onClick={zoomIn}
              disabled={zoomLevel >= 500}
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: zoomLevel < 500 ? 1.05 : 1 }}
              whileTap={{ scale: zoomLevel < 500 ? 0.95 : 1 }}
              title="Zoom in (max detail)"
            >
              +
            </motion.button>
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
          className={`relative flex-1 overflow-x-auto scrollbar-thin select-none ${
            isScrubbing ? "cursor-ew-resize" : draggedClip ? "cursor-grabbing" : ""
          }`}
          onMouseDown={handleTimelineMouseDown}
          style={{ 
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none'
          } as React.CSSProperties}
        >
          {/* Time Ruler - Dynamic based on zoom level */}
          <div className="sticky top-0 z-10 flex h-6 border-b border-border bg-card">
            {(() => {
              // Calculate ruler segments based on zoom
              // At 100% zoom: 10px/sec, show every 8 seconds (80px segments)
              // At 25% zoom (10 min view): 2.5px/sec, show every 30 seconds
              // At 500% zoom: 50px/sec, show every 2 seconds
              const secondsPerSegment = zoomLevel <= 50 ? 30 : zoomLevel <= 100 ? 8 : zoomLevel <= 200 ? 4 : 2
              const segmentWidth = secondsPerSegment * pixelsPerSecond
              
              // Always show at least up to 10 minutes (600 seconds) so timeline is usable
              // Users can zoom out to see full 10 minutes, or zoom in to see detail
              const maxTimelineSeconds = 600 // 10 minutes max
              const numSegments = Math.ceil(maxTimelineSeconds / secondsPerSegment)
              
              return Array.from({ length: numSegments }).map((_, i) => (
                <div key={i} className="shrink-0 border-r border-border" style={{ width: `${segmentWidth}px` }}>
                  <div className="px-2 text-[10px] text-muted-foreground">
                    {formatRulerTime(i * secondsPerSegment)}
                  </div>
                </div>
              ))
            })()}
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
                {/* Grid lines - sync with ruler */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {(() => {
                    const secondsPerSegment = zoomLevel <= 50 ? 30 : zoomLevel <= 100 ? 8 : zoomLevel <= 200 ? 4 : 2
                    const segmentWidth = secondsPerSegment * pixelsPerSecond
                    const maxTimelineSeconds = 600 // Match ruler
                    const numSegments = Math.ceil(maxTimelineSeconds / secondsPerSegment)
                    
                    return Array.from({ length: numSegments }).map((_, i) => (
                      <div key={i} className="shrink-0 border-r border-border/30" style={{ width: `${segmentWidth}px` }} />
                    ))
                  })()}
                </div>

                {timelineClips
                  .filter((clip) => clip.trackId === track)
                  .map((clip) => {
                    const media = mediaFiles.find((m) => m.id === clip.mediaId)
                    // Convert stored base pixels to visual pixels based on zoom
                    const visualStartTime = (clip.startTime / PIXELS_PER_SECOND) * pixelsPerSecond
                    const visualDuration = (clip.duration / PIXELS_PER_SECOND) * pixelsPerSecond
                    return (
                    <div
                      key={clip.id}
                        data-clip-id={clip.id}
                      onMouseDown={(e) => handleClipMouseDown(e, clip.id)}
                        className={`absolute z-10 mx-1 my-1.5 h-9 rounded border overflow-hidden group transition-opacity ${
                        clip.type === "video" ? "bg-primary/80 border-primary" : "bg-chart-2/80 border-chart-2"
                        } ${draggedClip === clip.id ? "opacity-70 cursor-grabbing z-50" : "cursor-grab"} ${
                          selectedClipId === clip.id ? "ring-2 ring-white" : ""
                        }`}
                      style={{ left: `${visualStartTime}px`, width: `${visualDuration}px` }}
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
