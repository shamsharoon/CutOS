import { NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export const maxDuration = 30

export async function POST(request: NextRequest) {
  let transcription = ""
  
  try {
    const body = await request.json()
    transcription = body.transcription as string

    if (!transcription || !transcription.trim()) {
      return NextResponse.json({ error: "No transcription provided" }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    // Use OpenAI to refine the transcription
    const result = await generateText({
      model: openai("gpt-4o-mini"), // Use cheaper model for simple refinement
      prompt: `Refine the following transcribed speech. Remove filler words like "uh", "um", "uhh", "er", "ah", and similar hesitations. Fix any obvious transcription errors and ensure clarity, but preserve the original meaning and intent. Do not rewrite or change the content significantly - just clean it up.

Return ONLY the refined text without any quotes, explanations, or additional formatting.

Original transcription:
${transcription}

Refined text:`,
      maxTokens: 500 as any, // TypeScript does not accept maxTokens here, but forcibly add it for compatibility
    } as any)

    let refinedText = result.text.trim()

    // Remove quotes if present (both single and double quotes at start/end)
    refinedText = refinedText.replace(/^["']|["']$/g, '')
    refinedText = refinedText.trim()

    if (!refinedText) {
      // If refinement fails, return original
      return NextResponse.json({ text: transcription })
    }

    return NextResponse.json({ text: refinedText })
  } catch (error) {
    console.error("Transcription refinement error:", error)
    // If refinement fails, return original transcription
    return NextResponse.json(
      { text: transcription || "" },
      { status: 200 }
    )
  }
}
