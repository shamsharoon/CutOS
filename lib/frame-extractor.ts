import type { MediaFile } from "@/components/editor-context"

/**
 * Extracts a single frame from a video file at a specified time
 * @param mediaFile - The media file to extract from
 * @param timeSeconds - The time position in seconds
 * @returns Promise<Blob> - JPEG image blob of the extracted frame
 */
export async function extractFrameFromClip(
  mediaFile: MediaFile,
  timeSeconds: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.preload = "metadata"
    video.muted = true
    video.playsInline = true

    // Use storage URL if available, otherwise use object URL
    const videoSrc = mediaFile.storageUrl || mediaFile.objectUrl

    video.onloadedmetadata = () => {
      // Clamp time to video duration
      const clampedTime = Math.min(Math.max(0, timeSeconds), video.duration)
      video.currentTime = clampedTime
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Could not get canvas context"))
          URL.revokeObjectURL(video.src)
          return
        }

        // Draw the video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error("Failed to create blob from canvas"))
            }
            // Clean up
            URL.revokeObjectURL(video.src)
          },
          "image/jpeg",
          0.85
        )
      } catch (error) {
        reject(error)
        URL.revokeObjectURL(video.src)
      }
    }

    video.onerror = () => {
      reject(new Error(`Failed to load video: ${videoSrc}`))
      URL.revokeObjectURL(video.src)
    }

    // Set the video source
    video.src = videoSrc
  })
}

/**
 * Extracts the last frame from a video clip
 * @param mediaFile - The media file to extract from
 * @returns Promise<Blob> - JPEG image blob of the last frame
 */
export async function extractLastFrame(mediaFile: MediaFile): Promise<Blob> {
  // Extract frame at the last second (or very close to end)
  const timeSeconds = Math.max(0, mediaFile.durationSeconds - 0.1)
  return extractFrameFromClip(mediaFile, timeSeconds)
}

/**
 * Extracts the first frame from a video clip
 * @param mediaFile - The media file to extract from
 * @returns Promise<Blob> - JPEG image blob of the first frame
 */
export async function extractFirstFrame(mediaFile: MediaFile): Promise<Blob> {
  return extractFrameFromClip(mediaFile, 0)
}

/**
 * Extracts the third frame from a video clip (approximately 0.1 seconds in)
 * @param mediaFile - The media file to extract from
 * @returns Promise<Blob> - JPEG image blob of the third frame
 */
export async function extractThirdFrame(mediaFile: MediaFile): Promise<Blob> {
  // At 30fps, 3rd frame is at ~0.1 seconds
  // At 24fps, 3rd frame is at ~0.125 seconds
  // Using 0.1 as a reasonable approximation
  return extractFrameFromClip(mediaFile, 0.1)
}
