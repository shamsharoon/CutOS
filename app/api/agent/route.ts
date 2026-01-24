import { streamText, type UIMessage } from "ai"
import { openai } from "@ai-sdk/openai"
import { videoEditingTools } from "@/lib/agent/tools"
import { buildSystemPrompt, type TimelineState } from "@/lib/agent/system-prompt"

export const maxDuration = 30

// Extract text content from UIMessage parts
function getTextFromParts(parts: UIMessage["parts"]): string {
  if (!parts) return ""
  return parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("")
}

export async function POST(request: Request) {
  const body = await request.json()
  const { messages, timelineState } = body as {
    messages: UIMessage[]
    timelineState: TimelineState
  }

  const systemPrompt = buildSystemPrompt(timelineState)

  // Convert UIMessage format to ModelMessage format for streamText
  // Handle both UIMessage format (with parts) and simple format (with content)
  const formattedMessages = messages.map((msg) => {
    // If it has parts array, extract text from parts
    if (msg.parts && Array.isArray(msg.parts)) {
      return {
        role: msg.role as "user" | "assistant",
        content: getTextFromParts(msg.parts),
      }
    }
    // If it has content directly (legacy format), use that
    if ("content" in msg && typeof (msg as { content?: string }).content === "string") {
      return {
        role: msg.role as "user" | "assistant",
        content: (msg as { content: string }).content,
      }
    }
    // Fallback - return empty content
    return {
      role: msg.role as "user" | "assistant",
      content: "",
    }
  }).filter(msg => msg.content.trim() !== "") // Filter out empty messages

  // If no valid messages, return an error
  if (formattedMessages.length === 0) {
    return new Response(JSON.stringify({ error: "No valid messages provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages: formattedMessages,
    tools: videoEditingTools,
  })

  return result.toUIMessageStreamResponse()
}
