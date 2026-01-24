"use client"

import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from "react"
import { updateProject, type TimelineData, type TimelineClipData, type MediaFileData, type ClipTransform, type ClipEffects } from "@/lib/projects"
import { uploadMediaFile } from "@/lib/storage"

export const PIXELS_PER_SECOND = 10 // Timeline scale: 10px = 1 second

export interface MediaFile {
  id: string
  file?: File // Optional - only present for newly added files
  name: string
  duration: string
  durationSeconds: number
  thumbnail: string | null
  type: string
  objectUrl: string // Local URL for playback (blob: or storage URL)
  storagePath?: string // Path in Supabase Storage
  storageUrl?: string // Public URL from Supabase Storage
  isUploading?: boolean // Track upload state
}

export interface TimelineClip {
  id: string
  mediaId: string
  trackId: string
  startTime: number // pixels from left (timeline position)
  duration: number // width in pixels
  mediaOffset: number // where in the source media this clip starts (in pixels)
  label: string
  type: "video" | "audio"
  transform: ClipTransform
  effects: ClipEffects
}

export const DEFAULT_CLIP_TRANSFORM: ClipTransform = {
  positionX: 0,
  positionY: 0,
  scale: 100,
  opacity: 100,
}

export const DEFAULT_CLIP_EFFECTS: ClipEffects = {
  preset: "none",
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hueRotate: 0,
  chromakey: {
    enabled: false,
    keyColor: "#00FF00", // Default green screen color
    similarity: 0.4,      // Default similarity threshold
    smoothness: 0.1,      // Default edge softness
    spill: 0.3,          // Default spill suppression
  },
}

interface EditorContextType {
  // Project
  projectId: string | null
  setProjectId: (id: string | null) => void
  
  // Media pool
  mediaFiles: MediaFile[]
  addMediaFiles: (files: MediaFile[]) => void
  removeMediaFile: (id: string) => void
  
  // Timeline
  timelineClips: TimelineClip[]
  addClipToTimeline: (clip: TimelineClip) => void
  updateClip: (id: string, updates: Partial<TimelineClip>) => void
  removeClip: (id: string) => void
  splitClip: (clipId: string, splitTime: number) => void // Split a clip at the given timeline time (in seconds)
  
  // Playback
  selectedClipId: string | null
  setSelectedClipId: (id: string | null) => void
  currentTime: number // Current playback time in seconds (timeline time)
  setCurrentTime: (time: number) => void
  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void
  
  // Get media for a clip
  getMediaForClip: (clipId: string) => MediaFile | undefined
  
  // Currently previewing media (from selection or playhead)
  previewMedia: MediaFile | null
  activeClip: TimelineClip | null // The clip currently at playhead
  clipTimeOffset: number // How far into the active clip we are (in seconds)
  
  // Timeline end time (for stopping playback)
  timelineEndTime: number
  
  // Sorted video clips for playback
  sortedVideoClips: TimelineClip[]
  
  // Load state from saved data
  loadTimelineData: (data: TimelineData | null) => void
  
  // Save state
  saveProject: () => Promise<void>
  isSaving: boolean
  hasUnsavedChanges: boolean
  
  // Thumbnail
  setProjectThumbnail: (thumbnail: string) => void
  
  // Color picker eyedropper
  isEyedropperActive: boolean
  setIsEyedropperActive: (active: boolean) => void
  onColorSampled?: (r: number, g: number, b: number) => void
  setColorSampledCallback: (callback: ((r: number, g: number, b: number) => void) | undefined) => void
}

const EditorContext = createContext<EditorContextType | null>(null)

export function EditorProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [timelineClips, setTimelineClips] = useState<TimelineClip[]>([])
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0) // Time in seconds
  const [isPlaying, setIsPlaying] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [projectThumbnail, setProjectThumbnail] = useState<string | null>(null)
  const [isEyedropperActive, setIsEyedropperActive] = useState(false)
  const [colorSampledCallback, setColorSampledCallback] = useState<((r: number, g: number, b: number) => void) | undefined>(undefined)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const addMediaFiles = useCallback(async (files: MediaFile[]) => {
    // Add files immediately with uploading state
    const filesWithUploading = files.map(f => ({ ...f, isUploading: !!projectId }))
    setMediaFiles((prev) => [...prev, ...filesWithUploading])
    setHasUnsavedChanges(true)

    // Upload each file to storage if project exists
    if (projectId) {
      for (const file of files) {
        if (file.file) {
          try {
            const { data, error } = await uploadMediaFile(projectId, file.file)
            if (data && !error) {
              // Update the media file with storage info
              setMediaFiles((prev) =>
                prev.map((m) =>
                  m.id === file.id
                    ? {
                        ...m,
                        storagePath: data.path,
                        storageUrl: data.url,
                        isUploading: false,
                      }
                    : m
                )
              )
            } else {
              console.error("Failed to upload file:", file.name, error)
              // Mark as not uploading even on error
              setMediaFiles((prev) =>
                prev.map((m) =>
                  m.id === file.id ? { ...m, isUploading: false } : m
                )
              )
            }
          } catch (err) {
            console.error("Error uploading file:", file.name, err)
            // Mark as not uploading on exception
            setMediaFiles((prev) =>
              prev.map((m) =>
                m.id === file.id ? { ...m, isUploading: false } : m
              )
            )
          }
        }
      }
    }
  }, [projectId])

  const removeMediaFile = useCallback((id: string) => {
    setMediaFiles((prev) => prev.filter((f) => f.id !== id))
    setHasUnsavedChanges(true)
  }, [])

  const addClipToTimeline = useCallback((clip: TimelineClip) => {
    setTimelineClips((prev) => [...prev, clip])
    setSelectedClipId(clip.id)
    setHasUnsavedChanges(true)
  }, [])

  const updateClip = useCallback((id: string, updates: Partial<TimelineClip>) => {
    setTimelineClips((prev) =>
      prev.map((clip) => (clip.id === id ? { ...clip, ...updates } : clip))
    )
    setHasUnsavedChanges(true)
  }, [])

  const removeClip = useCallback((id: string) => {
    setTimelineClips((prev) => prev.filter((c) => c.id !== id))
    if (selectedClipId === id) {
      setSelectedClipId(null)
    }
    setHasUnsavedChanges(true)
  }, [selectedClipId])

  // Split a clip at the given timeline time (in seconds)
  const splitClip = useCallback((clipId: string, splitTime: number) => {
    const clip = timelineClips.find((c) => c.id === clipId)
    if (!clip) return

    const splitPositionPixels = splitTime * PIXELS_PER_SECOND
    const clipStart = clip.startTime
    const clipEnd = clip.startTime + clip.duration

    // Check if split point is within the clip
    if (splitPositionPixels <= clipStart || splitPositionPixels >= clipEnd) return

    // Calculate durations for the two new clips
    const firstClipDuration = splitPositionPixels - clipStart
    const secondClipDuration = clipEnd - splitPositionPixels

    // Update the original clip (becomes the first part)
    const updatedFirstClip: TimelineClip = {
      ...clip,
      duration: firstClipDuration,
    }

    // Create the second clip
    const secondClip: TimelineClip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      mediaId: clip.mediaId,
      trackId: clip.trackId,
      startTime: splitPositionPixels,
      duration: secondClipDuration,
      mediaOffset: clip.mediaOffset + firstClipDuration, // Offset into source media
      label: clip.label,
      type: clip.type,
      transform: { ...clip.transform },
      effects: { ...clip.effects },
    }

    setTimelineClips((prev) =>
      prev.map((c) => (c.id === clipId ? updatedFirstClip : c)).concat(secondClip)
    )
    setSelectedClipId(secondClip.id)
    setHasUnsavedChanges(true)
  }, [timelineClips])

  const getMediaForClip = useCallback(
    (clipId: string) => {
      const clip = timelineClips.find((c) => c.id === clipId)
      if (!clip) return undefined
      return mediaFiles.find((m) => m.id === clip.mediaId)
    },
    [timelineClips, mediaFiles]
  )

  // Load timeline data from saved project
  const loadTimelineData = useCallback((data: TimelineData | null) => {
    if (!data) return
    
    // Restore clips
    const restoredClips: TimelineClip[] = data.clips.map((clip: TimelineClipData) => ({
      id: clip.id,
      mediaId: clip.mediaId,
      trackId: clip.trackId,
      startTime: clip.startTime,
      duration: clip.duration,
      mediaOffset: clip.mediaOffset ?? 0,
      label: clip.label,
      type: clip.type,
      transform: clip.transform ?? DEFAULT_CLIP_TRANSFORM,
      effects: clip.effects ?? DEFAULT_CLIP_EFFECTS,
    }))
    
    // Restore media files from storage URLs
    const restoredMedia: MediaFile[] = data.media.map((m: MediaFileData) => ({
      id: m.id,
      name: m.name,
      duration: m.duration,
      durationSeconds: m.durationSeconds,
      type: m.type,
      thumbnail: m.thumbnail,
      storagePath: m.storagePath,
      storageUrl: m.storageUrl,
      objectUrl: m.storageUrl, // Use storage URL for playback
      isUploading: false,
    }))
    
    setMediaFiles(restoredMedia)
    setTimelineClips(restoredClips)
    setHasUnsavedChanges(false)
  }, [])

  // Save project to Supabase
  const saveProject = useCallback(async () => {
    if (!projectId) return
    
    setIsSaving(true)
    
    // Prepare timeline data (only save media that has been uploaded)
    const timelineData: TimelineData = {
      clips: timelineClips.map((clip): TimelineClipData => ({
        id: clip.id,
        mediaId: clip.mediaId,
        trackId: clip.trackId,
        startTime: clip.startTime,
        duration: clip.duration,
        mediaOffset: clip.mediaOffset,
        label: clip.label,
        type: clip.type,
        transform: clip.transform,
        effects: clip.effects,
      })),
      media: mediaFiles
        .filter((m) => m.storagePath && m.storageUrl) // Only save uploaded media
        .map((m): MediaFileData => ({
          id: m.id,
          name: m.name,
          duration: m.duration,
          durationSeconds: m.durationSeconds,
          type: m.type,
          storagePath: m.storagePath!,
          storageUrl: m.storageUrl!,
          thumbnail: m.thumbnail,
        })),
    }
    
    // Calculate duration
    const totalDuration = timelineClips.reduce((max, clip) => {
      const clipEnd = (clip.startTime + clip.duration) / PIXELS_PER_SECOND
      return Math.max(max, clipEnd)
    }, 0)
    
    const hours = Math.floor(totalDuration / 3600)
    const minutes = Math.floor((totalDuration % 3600) / 60)
    const seconds = Math.floor(totalDuration % 60)
    const durationStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    
    await updateProject(projectId, {
      timeline_data: timelineData,
      duration: durationStr,
      thumbnail: projectThumbnail,
    })
    
    setHasUnsavedChanges(false)
    setIsSaving(false)
  }, [projectId, timelineClips, mediaFiles, projectThumbnail])

  // Auto-save with debounce
  useEffect(() => {
    if (!projectId || !hasUnsavedChanges) return
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveProject()
    }, 2000) // Auto-save after 2 seconds of inactivity
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [projectId, hasUnsavedChanges, saveProject])

  // Convert current time to pixel position for timeline
  const playheadPixels = currentTime * PIXELS_PER_SECOND

  // Get video clips sorted by start time
  const sortedVideoClips = timelineClips
    .filter((clip) => clip.type === "video")
    .sort((a, b) => a.startTime - b.startTime)

  // Calculate timeline end time (end of last clip)
  const timelineEndTime = sortedVideoClips.reduce((max, clip) => {
    const clipEnd = (clip.startTime + clip.duration) / PIXELS_PER_SECOND
    return Math.max(max, clipEnd)
  }, 0)

  // Clamp currentTime if it's past the timeline end (e.g., after deleting clips)
  useEffect(() => {
    if (timelineEndTime > 0 && currentTime > timelineEndTime) {
      setCurrentTime(timelineEndTime)
    } else if (timelineEndTime === 0 && currentTime > 0) {
      // No clips left, reset to 0
      setCurrentTime(0)
    }
  }, [timelineEndTime, currentTime])

  // Find clip under the playhead
  const activeClip = sortedVideoClips.find(
    (clip) =>
      playheadPixels >= clip.startTime &&
      playheadPixels < clip.startTime + clip.duration
  ) ?? null

  // Calculate how far into the active clip we are (in seconds)
  // Calculate how far into the source media we should be
  // This accounts for both the position on the timeline AND the clip's mediaOffset (for split clips)
  const clipTimeOffset = activeClip
    ? ((playheadPixels - activeClip.startTime) + activeClip.mediaOffset) / PIXELS_PER_SECOND
    : 0

  // Determine preview media based on selection or active clip
  const previewMedia = (() => {
    // If a clip is selected and we're not playing, preview that
    if (selectedClipId && !isPlaying) {
      return getMediaForClip(selectedClipId) ?? null
    }
    
    // Otherwise use active clip under playhead
    if (activeClip) {
      return mediaFiles.find((m) => m.id === activeClip.mediaId) ?? null
    }
    
    return null
  })()

  return (
    <EditorContext.Provider
      value={{
        projectId,
        setProjectId,
        mediaFiles,
        addMediaFiles,
        removeMediaFile,
        timelineClips,
        addClipToTimeline,
        updateClip,
        removeClip,
        splitClip,
        selectedClipId,
        setSelectedClipId,
        currentTime,
        setCurrentTime,
        isPlaying,
        setIsPlaying,
        getMediaForClip,
        previewMedia,
        activeClip,
        clipTimeOffset,
        timelineEndTime,
        sortedVideoClips,
        loadTimelineData,
        saveProject,
        isSaving,
        hasUnsavedChanges,
        setProjectThumbnail,
        isEyedropperActive,
        setIsEyedropperActive,
        onColorSampled: colorSampledCallback,
        setColorSampledCallback,
      }}
    >
      {children}
    </EditorContext.Provider>
  )
}

export function useEditor() {
  const context = useContext(EditorContext)
  if (!context) {
    throw new Error("useEditor must be used within an EditorProvider")
  }
  return context
}
