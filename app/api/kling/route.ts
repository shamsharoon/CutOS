import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"

export const maxDuration = 300 // 5 minutes for video generation

interface KlingRequest {
  startImageUrl: string
  endImageUrl: string
  durationSeconds?: number
}

interface KlingResponse {
  videoUrl: string
  taskId?: string
}

/**
 * Generates a JWT token for Kling API authentication
 * Uses KLING_ACCESS_KEY and KLING_SECRET_KEY from environment
 * Follows JWT (RFC 7519) standard
 */
function generateKlingToken(): string {
  const accessKey = process.env.KLING_ACCESS_KEY
  const secretKey = process.env.KLING_SECRET_KEY

  if (!accessKey || !secretKey) {
    throw new Error("KLING_ACCESS_KEY and KLING_SECRET_KEY must be set in environment")
  }

  // Generate JWT token according to Kling API requirements
  const payload = {
    iss: accessKey, // Issuer (access key)
    exp: Math.floor(Date.now() / 1000) + 1800, // Expiration (30 minutes)
    nbf: Math.floor(Date.now() / 1000) - 5, // Not before (5 seconds ago to account for clock skew)
  }

  const token = jwt.sign(payload, secretKey, {
    algorithm: "HS256",
    header: {
      alg: "HS256",
      typ: "JWT",
    },
  })

  return token
}

/**
 * Polls the Kling API for task completion
 * @param taskId - The task ID to poll
 * @param token - Authentication token
 * @param maxAttempts - Maximum number of polling attempts
 * @returns The video URL when ready
 */
async function pollForCompletion(
  taskId: string,
  token: string,
  maxAttempts: number = 60
): Promise<string> {
  // Try different possible polling endpoints
  const pollUrl = `https://api-singapore.klingai.com/v1/videos/image2video/${taskId}`

  console.log("========== POLLING FOR TASK ==========")
  console.log("Task ID:", taskId)
  console.log("Poll URL:", pollUrl)
  console.log("======================================")

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(pollUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`Polling attempt ${attempt + 1} failed:`, response.status, response.statusText)
      console.error("Error body:", errorBody)
      throw new Error(`Polling failed (${response.status}): ${response.statusText}. Body: ${errorBody}`)
    }

    const data = await response.json()

    // Check status in data.data.task_status or data.status
    const status = data.data?.task_status || data.status
    console.log(`Polling attempt ${attempt + 1}/${maxAttempts}:`, status)
    console.log("Full polling response:", JSON.stringify(data, null, 2))

    if (status === "succeed" || status === "completed" || status === "succeeded") {
      const videoUrl = data.data?.task_result?.videos?.[0]?.url ||
        data.data?.video_url ||
        data.video_url ||
        data.videoUrl ||
        data.output
      if (videoUrl) {
        console.log("✅ Video generation complete! URL:", videoUrl)
        return videoUrl
      } else {
        console.error("Status is success but no video URL found in response")
      }
    }

    if (status === "failed" || status === "error") {
      throw new Error(`Video generation failed: ${data.message || data.error || "Unknown error"}`)
    }

    // Wait 5 seconds before next poll
    console.log(`Status: ${status} - waiting 5 seconds before next poll...`)
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }

  throw new Error("Video generation timed out after " + (maxAttempts * 5) + " seconds")
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as KlingRequest
    let { startImageUrl, endImageUrl, durationSeconds = 5 } = body

    if (!startImageUrl || !endImageUrl) {
      return NextResponse.json(
        { error: "startImageUrl and endImageUrl are required" },
        { status: 400 }
      )
    }

    // Kling API only supports 5 or 10 second durations
    // Round to nearest supported duration
    if (durationSeconds < 7.5) {
      durationSeconds = 5
    } else {
      durationSeconds = 10
    }

    console.log(`Using duration: ${durationSeconds} seconds`)

    // Generate authentication token
    const token = generateKlingToken()

    // Prepare request payload for Kling API
    // Using kling-v2-1 which supports start/end frame (image + image_tail)
    const payload = {
      model_name: "kling-v2-1", // v2.1 supports image-to-video with start and end frames
      prompt:
        "Transform the start image into the end image. Create a smooth, high-quality video transition where the subject and environment morph seamlessly from the first state to the second state. Maintain the identity of the subjects but allow the necessary visual changes to bridge the two images efficiently.",
      image: startImageUrl, // Start frame image URL
      image_tail: endImageUrl, // End frame image URL
      duration: durationSeconds, // Duration as number (5 or 10)
      mode: "pro", // Pro mode (required for v2.1 with start/end frames)
      aspect_ratio: "16:9", // Aspect ratio
    }

    // Call Kling API (Singapore region)
    const apiUrl = "https://api-singapore.klingai.com/v1/videos/image2video"

    console.log("========== KLING API REQUEST ==========")
    console.log("URL:", apiUrl)
    console.log("Payload:", JSON.stringify(payload, null, 2))
    console.log("Start Image URL (received by API route):", startImageUrl)
    console.log("End Image URL (received by API route):", endImageUrl)
    console.log("Token (first 30 chars):", token.substring(0, 30) + "...")
    console.log("=======================================")

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Kling API HTTP error:", response.status, response.statusText)
      console.error("Kling API error body:", errorText)

      let errorDetails = errorText
      try {
        const errorJson = JSON.parse(errorText)
        errorDetails = errorJson.message || errorJson.error || errorText
        console.error("Parsed error:", errorJson)
      } catch (e) {
        // Not JSON, use raw text
      }

      return NextResponse.json(
        {
          error: `Kling API error (${response.status}): ${errorDetails}`,
          details: errorText,
          status: response.status
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log("========== KLING API RESPONSE ==========")
    console.log(JSON.stringify(data, null, 2))
    console.log("========================================")

    // Check for API errors
    if (data.code && data.code !== 0) {
      return NextResponse.json(
        { error: `Kling API error: ${data.message}`, details: data },
        { status: 400 }
      )
    }

    // Handle different response formats
    let videoUrl: string | undefined
    let taskId: string | undefined

    // Extract task ID from response
    if (data.data?.task_id) {
      taskId = data.data.task_id
      console.log("Extracted task_id from data.data.task_id:", taskId)
    } else if (data.task_id || data.taskId || data.id) {
      taskId = data.task_id || data.taskId || data.id
      console.log("Extracted task_id from alternate location:", taskId)
    }

    // Check if response has immediate video URL
    if (data.data?.video_url || data.video_url || data.videoUrl || data.output) {
      videoUrl = data.data?.video_url || data.video_url || data.videoUrl || data.output
    }

    // If we have a task ID but no video URL, poll for completion
    if (taskId && !videoUrl) {
      console.log("Video generation started. Polling for task completion:", taskId)
      videoUrl = await pollForCompletion(taskId, token)
    }

    if (!videoUrl) {
      return NextResponse.json(
        { error: "No video URL in response", details: data },
        { status: 500 }
      )
    }

    return NextResponse.json({
      videoUrl,
      taskId,
    } as KlingResponse)
  } catch (error) {
    console.error("Error in Kling API route:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
