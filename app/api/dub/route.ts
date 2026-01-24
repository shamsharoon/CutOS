import { createClient } from "@/lib/supabase/server"

export const maxDuration = 300 // 5 minutes max for long dubbing jobs

const BUCKET_NAME = "project-media"

// Supported languages for dubbing (ElevenLabs)
const SUPPORTED_LANGUAGES = new Set([
  "en", "es", "fr", "de", "pt", "zh", "ja", "ar", "ru", "hi",
  "ko", "id", "it", "nl", "tr", "pl", "sv", "fil", "ms", "ro",
  "uk", "el", "cs", "da", "fi", "bg", "hr", "sk", "ta"
])

interface DubRequest {
  mediaUrl: string
  targetLang: string
  sourceLang?: string
  projectId: string
  mediaName?: string
}

interface DubResponse {
  success: boolean
  dubbedMediaUrl?: string
  dubbedMediaPath?: string
  error?: string
}

interface ElevenLabsDubResponse {
  dubbing_id: string
  expected_duration_sec: number
}

interface ElevenLabsStatusResponse {
  dubbing_id: string
  name: string
  status: "dubbing" | "dubbed" | "failed"
  target_languages: string[]
  error?: string
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json() as DubRequest
    const { mediaUrl, targetLang, sourceLang = "auto", projectId, mediaName } = body

    // Validate inputs
    if (!mediaUrl || !targetLang || !projectId) {
      return Response.json(
        { success: false, error: "Missing required fields: mediaUrl, targetLang, projectId" } as DubResponse,
        { status: 400 }
      )
    }

    // Validate language code
    if (!SUPPORTED_LANGUAGES.has(targetLang)) {
      return Response.json(
        { success: false, error: `Unsupported language code: ${targetLang}. Supported: ${Array.from(SUPPORTED_LANGUAGES).join(", ")}` } as DubResponse,
        { status: 400 }
      )
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return Response.json(
        { success: false, error: "ElevenLabs API key not configured" } as DubResponse,
        { status: 500 }
      )
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return Response.json(
        { success: false, error: "Not authenticated" } as DubResponse,
        { status: 401 }
      )
    }

    // Step 1: Create dubbing job
    const formData = new FormData()
    formData.append("source_url", mediaUrl)
    formData.append("target_lang", targetLang)
    formData.append("source_lang", sourceLang)
    formData.append("name", mediaName || `Dubbed to ${targetLang}`)
    formData.append("num_speakers", "0") // Auto-detect speakers
    formData.append("watermark", "true") // Enable watermark for non-Creator+ plans

    const createResponse = await fetch("https://api.elevenlabs.io/v1/dubbing", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
      },
      body: formData,
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      let errorMessage = "Failed to create dubbing job"
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.detail?.message || errorJson.error?.message || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }
      return Response.json(
        { success: false, error: errorMessage } as DubResponse,
        { status: createResponse.status }
      )
    }

    const dubResult = await createResponse.json() as ElevenLabsDubResponse
    const { dubbing_id, expected_duration_sec } = dubResult

    // Step 2: Poll for completion
    const maxPollingTime = Math.max(expected_duration_sec * 2, 120) * 1000 // At least 2 minutes, or 2x expected duration
    const pollInterval = 5000 // Poll every 5 seconds
    const startTime = Date.now()

    let status: ElevenLabsStatusResponse | null = null
    
    while (Date.now() - startTime < maxPollingTime) {
      const statusResponse = await fetch(`https://api.elevenlabs.io/v1/dubbing/${dubbing_id}`, {
        method: "GET",
        headers: {
          "xi-api-key": apiKey,
        },
      })

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text()
        return Response.json(
          { success: false, error: `Failed to check dubbing status: ${errorText}` } as DubResponse,
          { status: 500 }
        )
      }

      status = await statusResponse.json() as ElevenLabsStatusResponse

      if (status.status === "dubbed") {
        break
      }

      if (status.status === "failed") {
        return Response.json(
          { success: false, error: status.error || "Dubbing failed" } as DubResponse,
          { status: 500 }
        )
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    if (!status || status.status !== "dubbed") {
      return Response.json(
        { success: false, error: "Dubbing timed out" } as DubResponse,
        { status: 504 }
      )
    }

    // Step 3: Download dubbed audio
    const audioResponse = await fetch(`https://api.elevenlabs.io/v1/dubbing/${dubbing_id}/audio/${targetLang}`, {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
    })

    if (!audioResponse.ok) {
      const errorText = await audioResponse.text()
      return Response.json(
        { success: false, error: `Failed to download dubbed audio: ${errorText}` } as DubResponse,
        { status: 500 }
      )
    }

    const audioBlob = await audioResponse.blob()
    const contentType = audioResponse.headers.get("content-type") || "video/mp4"
    
    // Determine file extension from content type
    let extension = "mp4"
    if (contentType.includes("mp3")) extension = "mp3"
    else if (contentType.includes("webm")) extension = "webm"
    else if (contentType.includes("wav")) extension = "wav"

    // Step 4: Upload to Supabase storage
    const uniqueId = crypto.randomUUID()
    const fileName = `dubbed_${targetLang}_${uniqueId}.${extension}`
    const path = `${user.id}/${projectId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, audioBlob, {
        cacheControl: "3600",
        contentType,
        upsert: false,
      })

    if (uploadError) {
      return Response.json(
        { success: false, error: `Failed to upload dubbed media: ${uploadError.message}` } as DubResponse,
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path)

    return Response.json({
      success: true,
      dubbedMediaUrl: urlData.publicUrl,
      dubbedMediaPath: path,
    } as DubResponse)

  } catch (error) {
    console.error("Dubbing error:", error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Dubbing failed" } as DubResponse,
      { status: 500 }
    )
  }
}
