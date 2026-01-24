"use client"

import { Play, Pause, SkipBack, SkipForward, Film, Maximize, Minimize } from "lucide-react"
import { useRef, useEffect, useState, useCallback } from "react"
import { useEditor, PIXELS_PER_SECOND, DEFAULT_CLIP_TRANSFORM, DEFAULT_CLIP_EFFECTS } from "./editor-context"
import type { ClipEffects } from "@/lib/projects"
import { ChromakeyProcessor, type ChromakeyOptions } from "@/lib/chromakey"

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
    backgroundClip,
    clipTimeOffset,
    backgroundClipTimeOffset,
    timelineEndTime,
    sortedVideoClips,
    setProjectThumbnail,
    isEyedropperActive,
    onColorSampled,
    showCaptions,
    mediaFiles,
    captionStyle,
    getMediaForClip,
    projectResolution,
  } = useEditor()

  const videoRef = useRef<HTMLVideoElement>(null)
  const backgroundVideoRef = useRef<HTMLVideoElement>(null)
  const scrubberRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | null>(null)
  const lastActiveClipIdRef = useRef<string | null>(null)
  const lastBackgroundClipIdRef = useRef<string | null>(null)
  const chromakeyCanvasRef = useRef<HTMLCanvasElement>(null)
  const chromakeyProcessorRef = useRef<ChromakeyProcessor | null>(null)
  const chromakeyAnimationRef = useRef<number | null>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)

  const [displayTime, setDisplayTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)
  const [thumbnailCaptured, setThumbnailCaptured] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showFullscreenControls, setShowFullscreenControls] = useState(true)

  // Track playback start time and position for smooth animation
  const playbackStartRef = useRef<{ startTime: number; startPosition: number } | null>(null)
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)


  const activeClipTransform = activeClip?.transform ?? DEFAULT_CLIP_TRANSFORM
  const activeClipEffects = activeClip?.effects ?? DEFAULT_CLIP_EFFECTS
  const chromakeyEnabled = activeClipEffects.chromakey?.enabled ?? false
  
  // Get background clip media and transform
  const backgroundMedia = backgroundClip ? getMediaForClip(backgroundClip.id) ?? null : null
  const backgroundClipTransform = backgroundClip?.transform ?? DEFAULT_CLIP_TRANSFORM
  const backgroundClipEffects = backgroundClip?.effects ?? DEFAULT_CLIP_EFFECTS
  const backgroundFilterString = buildFilterString(backgroundClipEffects)
  
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

      // Clamp clipTimeOffset to valid video duration range
      const videoDuration = videoRef.current.duration
      if (!isNaN(videoDuration) && videoDuration > 0) {
        const clampedTime = Math.max(0, Math.min(clipTimeOffset, videoDuration))
        videoRef.current.currentTime = clampedTime
      }

      if (isPlaying) {
        videoRef.current.play().catch(() => { })
      }
    }
  }, [activeClip?.id, previewMedia, clipTimeOffset, isPlaying])

  // Sync background video when chromakey is enabled (only on clip change)
  useEffect(() => {
    if (!backgroundVideoRef.current || !backgroundClip || !backgroundMedia) return

    // If we switched to a different background clip, update the video source and seek
    if (lastBackgroundClipIdRef.current !== backgroundClip.id) {
      lastBackgroundClipIdRef.current = backgroundClip.id
      
      // Wait for video metadata to load before seeking
      const handleLoadedMetadata = () => {
        if (!backgroundVideoRef.current) return
        const videoDuration = backgroundVideoRef.current.duration
        if (!isNaN(videoDuration) && videoDuration > 0) {
          const clampedTime = Math.max(0, Math.min(backgroundClipTimeOffset, videoDuration))
          backgroundVideoRef.current.currentTime = clampedTime
        }
      }
      
      if (backgroundVideoRef.current.readyState >= 1) {
        // Metadata already loaded
        handleLoadedMetadata()
      } else {
        // Wait for metadata
        backgroundVideoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true })
      }
      
      if (isPlaying) {
        backgroundVideoRef.current.play().catch(() => {})
      }
    }
  }, [backgroundClip?.id, backgroundMedia?.id, isPlaying])

  // Seek background video when scrubbing (not playing) - debounced to prevent lag
  useEffect(() => {
    if (!backgroundVideoRef.current || !backgroundClip || !backgroundMedia || isPlaying) return
    
    // Debounce seeks to avoid lag when dragging the playhead
    const timeoutId = setTimeout(() => {
      if (!backgroundVideoRef.current || !backgroundClip || isPlaying) return
      
      // Only seek if backgroundClipTimeOffset is within valid video duration range
      const videoDuration = backgroundVideoRef.current.duration
      if (isNaN(videoDuration) || videoDuration === 0) return // Wait for video to load
      
      // Only seek if within bounds
      if (backgroundClipTimeOffset >= 0 && backgroundClipTimeOffset <= videoDuration) {
        backgroundVideoRef.current.currentTime = backgroundClipTimeOffset
      }
    }, 100) // Debounce to batch rapid seeks during scrubbing
    
    return () => clearTimeout(timeoutId)
  }, [backgroundClipTimeOffset, backgroundClip, backgroundMedia, isPlaying])

  // Keep background video in sync during playback (throttled to prevent lag)
  useEffect(() => {
    if (!backgroundVideoRef.current || !backgroundClip || !isPlaying || isSeeking) return
    
    // Use a throttled interval to check sync instead of running on every frame
    const syncInterval = setInterval(() => {
      if (!backgroundVideoRef.current || !backgroundClip || !isPlaying) return
      
      // Calculate expected time from current timeline position
      const playheadPixels = currentTime * PIXELS_PER_SECOND
      const expectedTime = ((playheadPixels - backgroundClip.startTime) + backgroundClip.mediaOffset) / PIXELS_PER_SECOND
      const actualTime = backgroundVideoRef.current.currentTime
      const drift = Math.abs(expectedTime - actualTime)
      
      // Only sync if drift is significant (more than 0.5 seconds) to avoid micro-seeks
      if (drift > 0.5 && backgroundVideoRef.current.duration > 0) {
        const clampedTime = Math.max(0, Math.min(expectedTime, backgroundVideoRef.current.duration))
        backgroundVideoRef.current.currentTime = clampedTime
      }
    }, 2000) // Check every 2 seconds instead of every frame
    
    return () => clearInterval(syncInterval)
  }, [backgroundClip, isPlaying, isSeeking, currentTime])

  // Seek video when scrubbing (not playing)
  useEffect(() => {
    if (!videoRef.current || !activeClip || !previewMedia || isPlaying) return

    // Only seek if clipTimeOffset is within valid video duration range
    // If dragging past the video, don't try to seek (will show last frame)
    const videoDuration = videoRef.current.duration
    if (isNaN(videoDuration) || videoDuration === 0) return // Wait for video to load

    // Only seek if within bounds, otherwise let it stay at the last frame
    if (clipTimeOffset >= 0 && clipTimeOffset <= videoDuration) {
      videoRef.current.currentTime = clipTimeOffset
    }
  }, [clipTimeOffset, activeClip, previewMedia, isPlaying])

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

  // Handle play/pause for background video
  useEffect(() => {
    if (!backgroundVideoRef.current || !backgroundMedia || !chromakeyEnabled) return

    if (isPlaying) {
      backgroundVideoRef.current.play().catch(() => {
        // Silently fail - background video play errors shouldn't stop playback
      })
    } else {
      backgroundVideoRef.current.pause()
    }
  }, [isPlaying, backgroundMedia, chromakeyEnabled])

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

  // Initialize chromakey processor when canvas is available
  useEffect(() => {
    if (!chromakeyCanvasRef.current) return

    // Dispose existing processor if it exists
    if (chromakeyProcessorRef.current) {
      chromakeyProcessorRef.current.dispose()
      chromakeyProcessorRef.current = null
    }

    // Create new processor
    const processor = new ChromakeyProcessor(chromakeyCanvasRef.current)
    if (processor.isReady()) {
      chromakeyProcessorRef.current = processor
    } else {
      console.warn("Chromakey processor failed to initialize")
    }

    return () => {
      if (chromakeyProcessorRef.current) {
        chromakeyProcessorRef.current.dispose()
        chromakeyProcessorRef.current = null
      }
    }
  }, [chromakeyEnabled, activeClip?.id]) // Re-initialize when chromakey is toggled or clip changes

  // Process chromakey frames when enabled
  useEffect(() => {
    if (!chromakeyEnabled || !chromakeyProcessorRef.current || !videoRef.current || !chromakeyCanvasRef.current) {
      if (chromakeyAnimationRef.current) {
        cancelAnimationFrame(chromakeyAnimationRef.current)
        chromakeyAnimationRef.current = null
      }
      return
    }

    const processor = chromakeyProcessorRef.current
    const video = videoRef.current
    const backgroundVideo = backgroundVideoRef.current
    const canvas = chromakeyCanvasRef.current
    const chromakeyOptions: ChromakeyOptions = {
      keyColor: activeClipEffects.chromakey?.keyColor ?? "#00FF00",
      similarity: activeClipEffects.chromakey?.similarity ?? 0.4,
      smoothness: activeClipEffects.chromakey?.smoothness ?? 0.1,
      spill: activeClipEffects.chromakey?.spill ?? 0.3,
    }

    const processFrame = () => {
      // Check if video has loaded and is ready
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        // Process chromakey - transparency will show background video through
        const success = processor.processFrame(video, chromakeyOptions)
        if (!success) {
          console.warn("Failed to process chromakey frame")
        }
      }
      chromakeyAnimationRef.current = requestAnimationFrame(processFrame)
    }

    // Wait a bit for video to be ready, then start processing
    const timeoutId = setTimeout(() => {
      processFrame()
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      if (chromakeyAnimationRef.current) {
        cancelAnimationFrame(chromakeyAnimationRef.current)
        chromakeyAnimationRef.current = null
      }
    }
  }, [chromakeyEnabled, activeClipEffects.chromakey, activeClip?.id, previewMedia?.id, backgroundClip?.id, backgroundMedia?.id])

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

  // Handle color sampling from video
  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement | HTMLCanvasElement>) => {
    if (isEyedropperActive && onColorSampled) {
      e.stopPropagation()

      const target = e.currentTarget
      const rect = target.getBoundingClientRect()

      // Get the actual video/canvas dimensions
      let sourceWidth: number
      let sourceHeight: number

      if (target instanceof HTMLVideoElement) {
        sourceWidth = target.videoWidth || rect.width
        sourceHeight = target.videoHeight || rect.height
      } else if (target instanceof HTMLCanvasElement) {
        sourceWidth = target.width
        sourceHeight = target.height
      } else {
        return
      }

      // Calculate the click position in source coordinates
      const scaleX = sourceWidth / rect.width
      const scaleY = sourceHeight / rect.height
      const x = Math.floor((e.clientX - rect.left) * scaleX)
      const y = Math.floor((e.clientY - rect.top) * scaleY)

      // Create a temporary canvas to sample the color
      const canvas = document.createElement("canvas")
      canvas.width = sourceWidth
      canvas.height = sourceHeight
      const ctx = canvas.getContext("2d")

      if (ctx) {
        try {
          if (target instanceof HTMLVideoElement) {
            ctx.drawImage(target, 0, 0, sourceWidth, sourceHeight)
          } else if (target instanceof HTMLCanvasElement) {
            ctx.drawImage(target, 0, 0, sourceWidth, sourceHeight)
          }

          const imageData = ctx.getImageData(Math.max(0, Math.min(x, sourceWidth - 1)), Math.max(0, Math.min(y, sourceHeight - 1)), 1, 1)
          const [r, g, b] = imageData.data

          // Ensure we have valid color values
          if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number' &&
            !isNaN(r) && !isNaN(g) && !isNaN(b) &&
            r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
            onColorSampled(r, g, b)
          }
        } catch (error) {
          console.warn("Failed to sample color:", error)
        }
      }
    } else {
      handlePlayPause()
    }
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

  const handleFullscreenScrub = useCallback((e: React.MouseEvent) => {
    if (timelineEndTime === 0) return
    e.preventDefault()

    // Get the progress bar element and its dimensions
    const progressBar = e.currentTarget as HTMLDivElement
    const rect = progressBar.getBoundingClientRect()

    setIsSeeking(true)
    const wasPlaying = isPlaying
    if (wasPlaying) {
      setIsPlaying(false)
    }

    // Function to calculate and update time
    const updateTime = (clientX: number) => {
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const newTime = percent * timelineEndTime
      setCurrentTime(newTime)
      setDisplayTime(newTime)
    }

    // Initial update
    updateTime(e.clientX)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault()
      updateTime(moveEvent.clientX)
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

  // Fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    if (!previewContainerRef.current) return

    try {
      if (!document.fullscreenElement) {
        await previewContainerRef.current.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (error) {
      console.error("Fullscreen error:", error)
    }
  }, [])

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  // Keyboard shortcut for fullscreen (F key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === "f" || e.key === "F") {
        e.preventDefault()
        toggleFullscreen()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [toggleFullscreen])

  // Auto-hide controls in fullscreen
  useEffect(() => {
    if (!isFullscreen) {
      setShowFullscreenControls(true)
      return
    }

    const showControls = () => {
      setShowFullscreenControls(true)

      // Clear existing timeout
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current)
      }

      // Hide after 3 seconds of inactivity (only if playing)
      if (isPlaying) {
        hideControlsTimeoutRef.current = setTimeout(() => {
          setShowFullscreenControls(false)
        }, 3000)
      }
    }

    // Show controls on mouse move
    const handleMouseMove = () => {
      showControls()
    }

    // Show controls initially
    showControls()

    window.addEventListener("mousemove", handleMouseMove)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current)
      }
    }
  }, [isFullscreen, isPlaying])

  const progressPercent = timelineEndTime > 0 ? (displayTime / timelineEndTime) * 100 : 0
  const hasClips = sortedVideoClips.length > 0

  // Get current caption based on style
  const getCurrentCaption = useCallback((): { type: "classic"; phrase: string } | { type: "tiktok"; words: string[]; key: string } | null => {
    if (!showCaptions || !activeClip || !previewMedia) return null

    const media = mediaFiles.find((m) => m.id === activeClip.mediaId)
    if (!media?.captions || media.captions.length === 0) return null

    // Find the current word index
    const currentWordIdx = media.captions.findIndex((caption) =>
      clipTimeOffset >= caption.start && clipTimeOffset < caption.end
    )

    if (currentWordIdx === -1) return null

    if (captionStyle === "classic") {
      // Classic style: show a phrase/sentence
      const PHRASE_WINDOW = 2.5
      const GAP_THRESHOLD = 0.8

      let startIdx = currentWordIdx
      let endIdx = currentWordIdx

      // Expand backward
      for (let i = currentWordIdx - 1; i >= 0; i--) {
        const gap = media.captions[i + 1].start - media.captions[i].end
        const timeDiff = clipTimeOffset - media.captions[i].start
        if (timeDiff > PHRASE_WINDOW || gap > GAP_THRESHOLD) break
        if (media.captions[i].word.match(/[.!?]$/)) break
        startIdx = i
      }

      // Expand forward
      for (let i = currentWordIdx + 1; i < media.captions.length; i++) {
        const gap = media.captions[i].start - media.captions[i - 1].end
        const timeDiff = media.captions[i].end - clipTimeOffset
        if (timeDiff > PHRASE_WINDOW || gap > GAP_THRESHOLD) break
        endIdx = i
        if (media.captions[i].word.match(/[.!?,;:]$/)) break
      }

      const phraseWords = media.captions.slice(startIdx, endIdx + 1).map(c => c.word)
      return { type: "classic", phrase: phraseWords.join(" ") }
    }

    // TikTok style: show 1-3 words at a time
    const words: string[] = []
    const currentWord = media.captions[currentWordIdx]
    words.push(currentWord.word.toUpperCase())

    if (currentWordIdx > 0) {
      const prevWord = media.captions[currentWordIdx - 1]
      if (currentWord.start - prevWord.end < 0.25) {
        words.unshift(prevWord.word.toUpperCase())
      }
    }

    if (currentWordIdx < media.captions.length - 1) {
      const nextWord = media.captions[currentWordIdx + 1]
      if (nextWord.start - currentWord.end < 0.15 && words.length < 3) {
        words.push(nextWord.word.toUpperCase())
      }
    }

    return { type: "tiktok", words, key: `${currentWordIdx}` }
  }, [showCaptions, activeClip, previewMedia, mediaFiles, clipTimeOffset, captionStyle])

  const captionData = getCurrentCaption()

  // Calculate aspect ratio from project resolution (e.g., "1920x1080" -> 16:9)
  const aspectRatio = (() => {
    if (!projectResolution) return 16 / 9 // Default to 16:9
    
    const match = projectResolution.match(/(\d+)x(\d+)/)
    if (!match) return 16 / 9
    
    const width = parseInt(match[1], 10)
    const height = parseInt(match[2], 10)
    if (width > 0 && height > 0) {
      return width / height
    }
    return 16 / 9
  })()

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Video Preview Area */}
      <div className="flex flex-1 min-h-0 items-center justify-center bg-black/40 p-4">
        <div
          ref={previewContainerRef}
          className={`relative overflow-hidden bg-black ${isFullscreen
            ? "w-full h-full max-w-none"
            : "rounded-lg border border-border"
            }`}
          style={!isFullscreen ? {
            aspectRatio: `${aspectRatio}`,
            width: 'min(100%, 80rem)',
            maxWidth: '80rem',
            maxHeight: '100%',
            height: 'auto',
            flexShrink: 0,
          } : undefined}
        >
          {previewMedia && activeClip ? (
            <>
              {/* Background video - shown when chromakey is enabled and background clip exists */}
              {chromakeyEnabled && backgroundMedia && backgroundClip && (
                <video
                  ref={backgroundVideoRef}
                  key={`bg-${backgroundMedia.id}-${backgroundClip.id}`}
                  src={backgroundMedia.objectUrl}
                  crossOrigin="anonymous"
                  className="absolute inset-0 h-full w-full object-contain pointer-events-none"
                  style={{
                    transform: `translate(${backgroundClipTransform.positionX}px, ${backgroundClipTransform.positionY}px) scale(${backgroundClipTransform.scale / 100})`,
                    opacity: backgroundClipTransform.opacity / 100,
                    filter: backgroundFilterString || undefined,
                    zIndex: 0,
                  }}
                  muted={false}
                  playsInline
                />
              )}
              {/* Video element - always present, behind canvas when chromakey is enabled */}
              <video
                ref={videoRef}
                key={previewMedia.id} // Force remount when media changes
                src={previewMedia.objectUrl}
                crossOrigin="anonymous"
                className={chromakeyEnabled ? "absolute inset-0 h-full w-full object-contain pointer-events-none -z-10" : `h-full w-full object-contain ${isEyedropperActive ? "cursor-crosshair" : "cursor-pointer"}`}
                style={chromakeyEnabled ? { ...videoStyle, visibility: "hidden" } : videoStyle}
                onClick={chromakeyEnabled ? undefined : handleVideoClick}
                onLoadedMetadata={handleLoadedMetadata}
                onCanPlay={handleCanPlay}
                muted={false}
                playsInline
              />
              {/* Chromakey canvas - shown when chromakey is enabled, composited on top of background */}
              {chromakeyEnabled && (
                <canvas
                  ref={chromakeyCanvasRef}
                  className={`absolute inset-0 h-full w-full ${isEyedropperActive ? "cursor-crosshair" : "cursor-pointer"}`}
                  style={{ ...videoStyle, zIndex: 1 }}
                  onClick={handleVideoClick}
                />
              )}
              {/* Debug indicator when eyedropper is active */}
              {isEyedropperActive && (
                <div className="absolute top-2 left-2 z-20 rounded bg-primary/90 px-2 py-1 text-xs text-primary-foreground">
                  Click on video to sample color
                </div>
              )}
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
              {/* Caption Overlay */}
              {showCaptions && captionData && captionData.type === "classic" && (
                <div className="pointer-events-none absolute bottom-6 left-0 right-0 z-30 flex justify-center px-8">
                  <div
                    className="max-w-[90%] rounded-md px-5 py-2.5"
                    style={{
                      background: "linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.9) 100%)",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                    }}
                  >
                    <p
                      className="text-center text-xl font-semibold leading-relaxed tracking-wide"
                      style={{
                        color: "#FFFFFF",
                        textShadow: "0 0 4px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.9), 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        WebkitFontSmoothing: "antialiased",
                      }}
                    >
                      {captionData.phrase}
                    </p>
                  </div>
                </div>
              )}
              {showCaptions && captionData && captionData.type === "tiktok" && (
                <div
                  key={captionData.key}
                  className="pointer-events-none absolute bottom-8 left-0 right-0 z-30 flex justify-center px-4"
                >
                  <div
                    className="animate-in zoom-in-95 fade-in duration-150 flex items-baseline gap-2"
                  >
                    {captionData.words.map((word, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: "clamp(1.75rem, 6vw, 3rem)",
                          fontWeight: 900,
                          fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
                          color: "#FFFFFF",
                          textTransform: "uppercase",
                          letterSpacing: "-0.02em",
                          lineHeight: 1.1,
                          textShadow: `
                            3px 3px 0 #000,
                            -3px -3px 0 #000,
                            3px -3px 0 #000,
                            -3px 3px 0 #000,
                            3px 0 0 #000,
                            -3px 0 0 #000,
                            0 3px 0 #000,
                            0 -3px 0 #000,
                            4px 4px 8px rgba(0,0,0,0.5)
                          `,
                          WebkitFontSmoothing: "antialiased",
                        }}
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Fullscreen Controls Overlay */}
              {isFullscreen && (
                <div
                  className={`absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-6 pb-6 pt-12 transition-opacity duration-300 ${showFullscreenControls ? "opacity-100" : "opacity-0"
                    }`}
                >
                  <div className="flex flex-col gap-4">
                    {/* Scrubber */}
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-xs font-medium text-white/90 w-16">
                        {formatTime(displayTime)}
                      </div>
                      <div
                        className="relative h-2 flex-1 cursor-pointer rounded-full bg-white/20 group hover:h-4 transition-all"
                        onMouseDown={handleFullscreenScrub}
                      >
                        {/* Progress bar */}
                        <div
                          className="absolute left-0 top-0 h-full rounded-full bg-primary"
                          style={{ width: `${progressPercent}%` }}
                        />

                        {/* Playhead handle */}
                        <div
                          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white scale-0 group-hover:scale-100 transition-transform shadow-md"
                          style={{ left: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="font-mono text-xs font-medium text-white/90 w-16 text-right">
                        {formatTime(timelineEndTime)}
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={handlePlayPause}
                          className="rounded-full bg-white p-2.5 text-black hover:bg-white/90 transition-colors"
                        >
                          {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSkipBack}
                            className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            <SkipBack className="h-5 w-5" />
                          </button>
                          <button
                            onClick={handleSkipForward}
                            className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            <SkipForward className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={toggleFullscreen}
                        className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        <Minimize className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
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
      <div className="shrink-0 border-t border-border bg-card px-6 py-4">
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
              className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={!hasClips}
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={handlePlayPause}
              className="rounded-md bg-primary p-3 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={!hasClips}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              onClick={handleSkipForward}
              className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={!hasClips}
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <div className="w-px h-6 bg-border mx-1" />
            <button
              onClick={toggleFullscreen}
              className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
              title={isFullscreen ? "Exit fullscreen (ESC)" : "Enter fullscreen (F)"}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
