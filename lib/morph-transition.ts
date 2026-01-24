import type { TimelineClip, MediaFile } from "@/components/editor-context"
import { PIXELS_PER_SECOND, DEFAULT_CLIP_TRANSFORM, DEFAULT_CLIP_EFFECTS } from "@/components/editor-context"
import { extractLastFrame, extractThirdFrame } from "./frame-extractor"
import { uploadMediaFile } from "./storage"

interface MorphTransitionResult {
  clip: TimelineClip
  media: MediaFile
  toClipUpdate: {
    clipId: string
    newStartTime: number
  }
}

/**
 * Creates an AI-powered morph transition between two clips
 * @param fromClip - The clip to morph from
 * @param toClip - The clip to morph to
 * @param mediaFiles - Array of all media files in the project
 * @param projectId - The project ID for storage
 * @param durationSeconds - Duration of the morph transition (default: 5)
 * @returns Promise with the new transition clip and media file
 */
export async function createMorphTransition(
  fromClip: TimelineClip,
  toClip: TimelineClip,
  mediaFiles: MediaFile[],
  projectId: string,
  durationSeconds: number = 5
): Promise<MorphTransitionResult> {
  // Find the source media files
  const fromMedia = mediaFiles.find((m) => m.id === fromClip.mediaId)
  const toMedia = mediaFiles.find((m) => m.id === toClip.mediaId)

  if (!fromMedia || !toMedia) {
    throw new Error("Source media files not found")
  }

  console.log("📸 Extracting frames from clips...")
  console.log("   From media:", fromMedia.name, "ID:", fromMedia.id)
  console.log("   To media:", toMedia.name, "ID:", toMedia.id)

  // Extract frames
  const [startFrameBlob, endFrameBlob] = await Promise.all([
    extractLastFrame(fromMedia),
    extractThirdFrame(toMedia), // Using 3rd frame instead of 1st frame
  ])

  console.log("☁️ Frames extracted, uploading to storage...")
  console.log("   Start frame blob size:", startFrameBlob.size, "type:", startFrameBlob.type)
  console.log("   End frame blob size:", endFrameBlob.size, "type:", endFrameBlob.type)


  // Convert blobs to files for upload
  const startFrameFile = new File([startFrameBlob], `morph-start-${Date.now()}.jpg`, {
    type: "image/jpeg",
  })
  const endFrameFile = new File([endFrameBlob], `morph-end-${Date.now()}.jpg`, {
    type: "image/jpeg",
  })

  // Upload frames to Supabase Storage
  const [startFrameResult, endFrameResult] = await Promise.all([
    uploadMediaFile(projectId, startFrameFile),
    uploadMediaFile(projectId, endFrameFile),
  ])

  if (startFrameResult.error || !startFrameResult.data) {
    throw new Error(`Failed to upload start frame: ${startFrameResult.error?.message}`)
  }

  if (endFrameResult.error || !endFrameResult.data) {
    throw new Error(`Failed to upload end frame: ${endFrameResult.error?.message}`)
  }

  console.log("🎨 Frames uploaded, calling Kling API...")
  console.log("   Start frame URL:", startFrameResult.data.url)
  console.log("   End frame URL:", endFrameResult.data.url)

  // Call Kling API
  const klingResponse = await fetch("/api/kling", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startImageUrl: startFrameResult.data.url,
      endImageUrl: endFrameResult.data.url,
      durationSeconds,
    }),
  })

  if (!klingResponse.ok) {
    const errorData = await klingResponse.json()
    throw new Error(`Kling API failed: ${errorData.error || klingResponse.statusText}`)
  }

  const { videoUrl } = await klingResponse.json()

  console.log("✅ Kling API success, downloading video:", videoUrl)

  // Download the generated video
  const videoResponse = await fetch(videoUrl)
  if (!videoResponse.ok) {
    throw new Error(`Failed to download generated video: ${videoResponse.statusText}`)
  }

  const videoBlob = await videoResponse.blob()
  const videoFile = new File([videoBlob], `morph-transition-${Date.now()}.mp4`, {
    type: "video/mp4",
  })

  console.log("⬆️ Video downloaded, uploading to storage...")

  // Upload the generated video to Supabase Storage
  const uploadResult = await uploadMediaFile(projectId, videoFile)

  if (uploadResult.error || !uploadResult.data) {
    throw new Error(`Failed to upload morph video: ${uploadResult.error?.message}`)
  }

  console.log("🎬 Morph video uploaded:", uploadResult.data.url)
  console.log("✨ Morph transition complete!")

  // Create a MediaFile entry for the morph video
  const mediaId = `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const morphMedia: MediaFile = {
    id: mediaId,
    name: `Morph Transition`,
    duration: formatDuration(durationSeconds),
    durationSeconds,
    thumbnail: null,
    type: "video/mp4",
    objectUrl: uploadResult.data.url,
    storagePath: uploadResult.data.path,
    storageUrl: uploadResult.data.url,
  }

  // Calculate position: place between fromClip and toClip
  // Position at the end of fromClip
  const startPosition = fromClip.startTime + fromClip.duration
  const durationPixels = durationSeconds * PIXELS_PER_SECOND

  // Determine track (prefer fromClip's track)
  const trackId = fromClip.trackId

  // Create timeline clip
  const clipId = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const morphClip: TimelineClip = {
    id: clipId,
    mediaId,
    trackId,
    startTime: startPosition,
    duration: durationPixels,
    mediaOffset: 0,
    label: "Morph Transition",
    type: "video",
    transform: DEFAULT_CLIP_TRANSFORM,
    effects: DEFAULT_CLIP_EFFECTS,
  }

  return {
    clip: morphClip,
    media: morphMedia,
    toClipUpdate: {
      clipId: toClip.id,
      newStartTime: startPosition + durationPixels, // Position right after the morph transition
    },
  }
}

/**
 * Formats duration in seconds to MM:SS format
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}
