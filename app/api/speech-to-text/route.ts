import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 })
    }

    // Create new FormData for ElevenLabs API
    const elevenLabsFormData = new FormData()
    elevenLabsFormData.append("model_id", "scribe_v2") // Use the latest model
    elevenLabsFormData.append("file", audioFile)

    // Send audio to ElevenLabs Speech-to-Text API
    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
      },
      body: elevenLabsFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = "Transcription failed"
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.detail?.message || errorJson.error?.message || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    const result = await response.json()
    
    // ElevenLabs returns the transcript in the 'text' field
    const transcript = result.text || ""

    if (!transcript) {
      return NextResponse.json(
        { error: "No transcript returned from API" },
        { status: 500 }
      )
    }

    return NextResponse.json({ text: transcript })
  } catch (error) {
    console.error("Speech-to-text error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
