import OpenAI from "openai"
import type { Caption } from "@/lib/projects"

export const maxDuration = 120 // Allow longer duration for transcription

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface TranscribeRequest {
  mediaId: string
  storageUrl: string
  language?: string // Optional: ISO-639-1 code (e.g., "en", "es", "fr") - improves accuracy
  prompt?: string // Optional: Context or vocabulary hints for better recognition
}

interface WhisperWord {
  word: string
  start: number
  end: number
}

interface WhisperSegment {
  id: number
  seek: number
  start: number
  end: number
  text: string
  tokens: number[]
  temperature: number
  avg_logprob: number
  compression_ratio: number
  no_speech_prob: number
}

interface WhisperVerboseResponse {
  task: string
  language: string
  duration: number
  text: string
  words?: WhisperWord[]
  segments?: WhisperSegment[]
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as TranscribeRequest
    const { mediaId, storageUrl, language, prompt } = body

    if (!mediaId || !storageUrl) {
      return new Response(
        JSON.stringify({ error: "Missing mediaId or storageUrl" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Fetch the media file from storage
    const mediaResponse = await fetch(storageUrl)
    if (!mediaResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch media file" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Get the file as a blob
    const mediaBlob = await mediaResponse.blob()
    
    // Determine file extension from URL or content type
    const contentType = mediaResponse.headers.get("content-type") || ""
    let extension = "mp4"
    if (contentType.includes("webm")) extension = "webm"
    else if (contentType.includes("mp3")) extension = "mp3"
    else if (contentType.includes("wav")) extension = "wav"
    else if (contentType.includes("m4a")) extension = "m4a"
    
    // Create a File object from the blob
    const file = new File([mediaBlob], `audio.${extension}`, { type: contentType })

    // Call OpenAI Whisper API with word-level timestamps and quality optimizations
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
      // Quality improvements:
      temperature: 0, // More deterministic/accurate results
      ...(language && { language }), // Specify language if known (improves accuracy)
      ...(prompt && { prompt }), // Context hints for domain-specific vocabulary
    }) as WhisperVerboseResponse

    // Extract captions from the response
    let captions: Caption[] = []

    if (transcription.words && transcription.words.length > 0) {
      // Use word-level timestamps
      captions = transcription.words.map((word) => ({
        word: word.word.trim(),
        start: word.start,
        end: word.end,
      }))
    } else if (transcription.segments && transcription.segments.length > 0) {
      // Fallback to segment-level if words not available
      // Split segments into words with estimated timestamps
      captions = transcription.segments.flatMap((segment) => {
        const words = segment.text.trim().split(/\s+/)
        const segmentDuration = segment.end - segment.start
        const wordDuration = segmentDuration / words.length
        
        return words.map((word, index) => ({
          word: word,
          start: segment.start + (index * wordDuration),
          end: segment.start + ((index + 1) * wordDuration),
        }))
      })
    }

    return new Response(
      JSON.stringify({ 
        mediaId, 
        captions,
        fullText: transcription.text,
        duration: transcription.duration,
        language: transcription.language,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("Transcription error:", error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Transcription failed" 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
