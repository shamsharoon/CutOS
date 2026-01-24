"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useCallback, useEffect, useRef, useState, useMemo } from "react"
import { toast } from "sonner"
import {
  useEditor,
  PIXELS_PER_SECOND,
  DEFAULT_CLIP_TRANSFORM,
  DEFAULT_CLIP_EFFECTS,
  type TimelineClip,
} from "@/components/editor-context"
import type { TimelineState } from "./system-prompt"
import type { AgentAction } from "./tools"

// Tool call display info
export type ToolCallInfo = {
  id: string
  name: string
  description: string
  status: "running" | "success" | "error"
}

// Display message type
export type DisplayMessage = {
  role: "user" | "assistant"
  content: string
  toolCalls?: ToolCallInfo[]
}

// Helper to extract text content from UIMessage parts
function getMessageText(message: UIMessage): string {
  if (!message.parts) return ""
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("")
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", pt: "Portuguese",
  zh: "Chinese", ja: "Japanese", ar: "Arabic", ru: "Russian", hi: "Hindi",
  ko: "Korean", id: "Indonesian", it: "Italian", nl: "Dutch", tr: "Turkish",
  pl: "Polish", sv: "Swedish", fil: "Filipino", ms: "Malay", ro: "Romanian",
  uk: "Ukrainian", el: "Greek", cs: "Czech", da: "Danish", fi: "Finnish",
  bg: "Bulgarian", hr: "Croatian", sk: "Slovak", ta: "Tamil"
}

// Human-readable descriptions for tool calls
function getToolDescription(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "splitClip":
      return `Split clip at ${input.splitTimeSeconds}s`
    case "splitAtTime":
      return `Split at ${input.timeSeconds}s${input.trackId ? ` on track ${input.trackId}` : ""}`
    case "trimClip": {
      const parts = []
      if (input.trimStartSeconds) parts.push(`${input.trimStartSeconds}s from start`)
      if (input.trimEndSeconds) parts.push(`${input.trimEndSeconds}s from end`)
      return `Trim ${parts.join(" and ")}`
    }
    case "deleteClip":
      return "Delete clip"
    case "deleteAtTime":
      return `Delete clip at ${input.timeSeconds}s${input.trackId ? ` on track ${input.trackId}` : ""}`
    case "deleteAllClips":
      return input.trackId ? `Clear track ${input.trackId}` : "Clear all clips"
    case "moveClip": {
      const parts = []
      if (input.newStartTimeSeconds !== undefined) parts.push(`to ${input.newStartTimeSeconds}s`)
      if (input.newTrackId) parts.push(`to track ${input.newTrackId}`)
      return `Move clip ${parts.join(" ")}`
    }
    case "applyEffect":
      return `Apply ${input.effect} effect`
    case "addMediaToTimeline":
      return `Add media to track ${input.trackId}${input.startTimeSeconds !== undefined ? ` at ${input.startTimeSeconds}s` : ""}`
    case "dubClip": {
      const langName = LANGUAGE_NAMES[input.targetLanguage as string] || input.targetLanguage
      return `Dubbing to ${langName}...`
    }
    case "createMorphTransition":
      return `Create ${input.durationSeconds}s morph transition`
    default:
      return toolName
  }
}

export function useVideoAgent() {
  const editor = useEditor()
  const pendingActionsRef = useRef<AgentAction[]>([])
  const processedToolCallsRef = useRef<Set<string>>(new Set())
  const toolCallInfoRef = useRef<Map<string, ToolCallInfo>>(new Map())
  const [input, setInput] = useState("")
  // Force re-render when tool calls complete
  const [, forceUpdate] = useState(0)

  // Build timeline state for the agent
  const getTimelineContext = useCallback((): TimelineState => {
    return {
      clips: editor.timelineClips.map((clip) => ({
        id: clip.id,
        mediaId: clip.mediaId,
        label: clip.label,
        trackId: clip.trackId,
        startTimeSeconds: clip.startTime / PIXELS_PER_SECOND,
        durationSeconds: clip.duration / PIXELS_PER_SECOND,
        type: clip.type,
        effects: clip.effects,
      })),
      media: editor.mediaFiles.map((m) => ({
        id: m.id,
        name: m.name,
        durationSeconds: m.durationSeconds,
      })),
      currentTimeSeconds: editor.currentTime,
      selectedClipId: editor.selectedClipId,
    }
  }, [editor.timelineClips, editor.mediaFiles, editor.currentTime, editor.selectedClipId])

  // Handle a single tool result action
  const handleAction = useCallback(
    (action: AgentAction) => {
      switch (action.action) {
        case "SPLIT_CLIP": {
          editor.splitClip(action.payload.clipId, action.payload.splitTimeSeconds)
          break
        }

        case "SPLIT_AT_TIME": {
          const { timeSeconds, trackId } = action.payload
          const timePixels = timeSeconds * PIXELS_PER_SECOND

          // Find clips at this time position
          const clipsAtTime = editor.timelineClips.filter((c) => {
            const matchesTrack = !trackId || c.trackId === trackId
            const withinClip = timePixels >= c.startTime && timePixels < c.startTime + c.duration
            return matchesTrack && withinClip
          })

          // Split all clips found at this position
          for (const clip of clipsAtTime) {
            editor.splitClip(clip.id, timeSeconds)
          }
          break
        }

        case "TRIM_CLIP": {
          const clip = editor.timelineClips.find((c) => c.id === action.payload.clipId)
          if (!clip) break

          const updates: Partial<TimelineClip> = {}
          const trimStart = action.payload.trimStartSeconds ?? 0
          const trimEnd = action.payload.trimEndSeconds ?? 0

          if (trimStart > 0) {
            const trimStartPixels = trimStart * PIXELS_PER_SECOND
            updates.startTime = clip.startTime + trimStartPixels
            updates.duration = clip.duration - trimStartPixels
            updates.mediaOffset = clip.mediaOffset + trimStartPixels
          }

          if (trimEnd > 0) {
            const trimEndPixels = trimEnd * PIXELS_PER_SECOND
            updates.duration = (updates.duration ?? clip.duration) - trimEndPixels
          }

          if (Object.keys(updates).length > 0) {
            editor.updateClip(action.payload.clipId, updates)
          }
          break
        }

        case "DELETE_CLIP": {
          editor.removeClip(action.payload.clipId)
          break
        }

        case "DELETE_AT_TIME": {
          const { timeSeconds, trackId } = action.payload
          const timePixels = timeSeconds * PIXELS_PER_SECOND

          // Find clips at this time position
          const clipsAtTime = editor.timelineClips.filter((c) => {
            const matchesTrack = !trackId || c.trackId === trackId
            const withinClip = timePixels >= c.startTime && timePixels < c.startTime + c.duration
            return matchesTrack && withinClip
          })

          // Delete all clips found at this position
          for (const clip of clipsAtTime) {
            editor.removeClip(clip.id)
          }
          break
        }

        case "DELETE_ALL_CLIPS": {
          const { trackId } = action.payload

          // Find clips to delete (all clips or just on a specific track)
          const clipsToDelete = trackId
            ? editor.timelineClips.filter((c) => c.trackId === trackId)
            : [...editor.timelineClips]

          // Delete all matching clips
          for (const clip of clipsToDelete) {
            editor.removeClip(clip.id)
          }
          break
        }

        case "MOVE_CLIP": {
          const moveUpdates: Partial<TimelineClip> = {}

          if (action.payload.newStartTimeSeconds !== undefined) {
            moveUpdates.startTime = action.payload.newStartTimeSeconds * PIXELS_PER_SECOND
          }

          if (action.payload.newTrackId) {
            moveUpdates.trackId = action.payload.newTrackId
          }

          if (Object.keys(moveUpdates).length > 0) {
            editor.updateClip(action.payload.clipId, moveUpdates)
          }
          break
        }

        case "APPLY_EFFECT": {
          const targetClip = editor.timelineClips.find((c) => c.id === action.payload.clipId)
          if (targetClip) {
            editor.updateClip(action.payload.clipId, {
              effects: {
                ...targetClip.effects,
                preset: action.payload.effect as typeof targetClip.effects.preset,
              },
            })
          }
          break
        }

        case "APPLY_CHROMAKEY": {
          const targetClip = editor.timelineClips.find((c) => c.id === action.payload.clipId)
          if (targetClip) {
            const currentChromakey = targetClip.effects.chromakey ?? {
              enabled: false,
              keyColor: "#00FF00",
              similarity: 0.4,
              smoothness: 0.1,
              spill: 0.3,
            }

            editor.updateClip(action.payload.clipId, {
              effects: {
                ...targetClip.effects,
                chromakey: {
                  enabled: action.payload.enabled,
                  keyColor: action.payload.keyColor ?? currentChromakey.keyColor,
                  similarity: action.payload.similarity ?? currentChromakey.similarity,
                  smoothness: action.payload.smoothness ?? currentChromakey.smoothness,
                  spill: action.payload.spill ?? currentChromakey.spill,
                },
              },
            })
          }
          break
        }

        case "ADD_MEDIA_TO_TIMELINE": {
          const media = editor.mediaFiles.find((m) => m.id === action.payload.mediaId)
          if (!media) break

          // Find the end of the track to place the clip
          const trackClips = editor.timelineClips.filter(
            (c) => c.trackId === action.payload.trackId
          )
          const trackEnd =
            trackClips.length > 0
              ? Math.max(...trackClips.map((c) => c.startTime + c.duration))
              : 0

          const startTimePixels =
            action.payload.startTimeSeconds !== undefined
              ? action.payload.startTimeSeconds * PIXELS_PER_SECOND
              : trackEnd

          const newClip: TimelineClip = {
            id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            mediaId: media.id,
            trackId: action.payload.trackId,
            startTime: startTimePixels,
            duration: media.durationSeconds * PIXELS_PER_SECOND,
            mediaOffset: 0,
            label: media.name,
            type: action.payload.trackId.startsWith("V") ? "video" : "audio",
            transform: { ...DEFAULT_CLIP_TRANSFORM },
            effects: { ...DEFAULT_CLIP_EFFECTS },
          }

          editor.addClipToTimeline(newClip)
          break
        }

        case "CREATE_MORPH_TRANSITION": {
          const fromClip = editor.timelineClips.find((c) => c.id === action.payload.fromClipId)
          const toClip = editor.timelineClips.find((c) => c.id === action.payload.toClipId)

          if (!fromClip || !toClip) {
            console.error("Clips not found for morph transition")
            toast.error("Clips not found for morph transition")
            break
          }

          // Show loading toast with promise
          const morphPromise = import("@/lib/morph-transition")
            .then(({ createMorphTransition }) => {
              return createMorphTransition(
                fromClip,
                toClip,
                editor.mediaFiles,
                editor.projectId || "",
                action.payload.durationSeconds
              )
            })
            .then((result) => {
              // Add the morph video to media files
              editor.addMediaFiles([result.media])
              // Add the morph clip to timeline
              editor.addClipToTimeline(result.clip)
              // Reposition the toClip to come right after the morph transition
              editor.updateClip(result.toClipUpdate.clipId, {
                startTime: result.toClipUpdate.newStartTime,
              })
              return result
            })

          toast.promise(morphPromise, {
            loading: "Generating AI morph transition...",
            success: "Morph transition added to timeline!",
            error: (err) => `Failed to create morph transition: ${err.message || "Unknown error"}`,
            duration: 5000,
          })

          break
        }

        // DUB_CLIP is handled separately as async operation - see handleDubClip
        case "DUB_CLIP":
          // This case is handled in onToolCall with handleDubClip
          break
      }
    },
    [editor]
  )

  // Handle async dubbing operation
  const handleDubClip = useCallback(
    async (
      clipId: string,
      targetLanguage: string,
      replaceOriginal: boolean | undefined,
      toolCallId: string
    ): Promise<{ success: boolean; error?: string }> => {
      // Find the clip and its media
      const clip = editor.timelineClips.find((c) => c.id === clipId)
      if (!clip) {
        return { success: false, error: "Clip not found" }
      }

      const media = editor.mediaFiles.find((m) => m.id === clip.mediaId)
      if (!media) {
        return { success: false, error: "Media not found for clip" }
      }

      if (!media.storageUrl) {
        return { success: false, error: "Media must be uploaded to cloud first. Please wait for upload to complete." }
      }

      try {
        // Call the dub API
        const response = await fetch("/api/dub", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaUrl: media.storageUrl,
            targetLang: targetLanguage,
            projectId: editor.projectId,
            mediaName: `${media.name} (${LANGUAGE_NAMES[targetLanguage] || targetLanguage})`,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          const errorMsg = errorData.error || "Dubbing request failed"
          // Check for common errors and provide helpful messages
          if (errorMsg.includes("permission") || errorMsg.includes("dubbing_write")) {
            return {
              success: false,
              error: "API key lacks dubbing permission. Please update your ElevenLabs API key with dubbing_write permission (requires Creator plan or higher)."
            }
          }
          return { success: false, error: errorMsg }
        }

        const result = await response.json()
        if (!result.success) {
          return { success: false, error: result.error || "Dubbing failed" }
        }

        // Create a new media file for the dubbed content
        const langName = LANGUAGE_NAMES[targetLanguage] || targetLanguage
        const dubbedMediaId = `dubbed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        const dubbedMedia = {
          id: dubbedMediaId,
          name: `${media.name} (${langName})`,
          duration: media.duration,
          durationSeconds: media.durationSeconds,
          thumbnail: media.thumbnail,
          type: media.type,
          objectUrl: result.dubbedMediaUrl,
          storagePath: result.dubbedMediaPath,
          storageUrl: result.dubbedMediaUrl,
          isUploading: false,
        }

        // Add dubbed media to the pool
        editor.addMediaFiles([dubbedMedia])

        if (replaceOriginal) {
          // Update the original clip to use the dubbed media
          editor.updateClip(clipId, {
            mediaId: dubbedMediaId,
            label: dubbedMedia.name,
          })
        }

        return { success: true }
      } catch (error) {
        console.error("Dubbing error:", error)
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
      }
    },
    [editor]
  )

  // Process any pending actions
  const processPendingActions = useCallback(() => {
    while (pendingActionsRef.current.length > 0) {
      const action = pendingActionsRef.current.shift()
      if (action) {
        handleAction(action)
      }
    }
  }, [handleAction])

  // Create transport that includes timeline state in body
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/agent",
      body: () => ({
        timelineState: getTimelineContext(),
      }),
    })
  }, [getTimelineContext])

  const { messages, sendMessage, status, error } = useChat({
    transport,
    onToolCall: ({ toolCall }) => {
      // In AI SDK v6, onToolCall fires when the tool INPUT is available
      // The tool executes server-side and we get the result
      // We can construct the action from the tool name and input
      const tc = toolCall as {
        type: string
        toolCallId: string
        toolName: string
        input: Record<string, unknown>
      }

      if (tc.type === "tool-input-available" && tc.toolName && tc.input) {
        // Skip if already processed
        if (processedToolCallsRef.current.has(tc.toolCallId)) {
          return
        }

        // Record tool call as running
        const toolInfo: ToolCallInfo = {
          id: tc.toolCallId,
          name: tc.toolName,
          description: getToolDescription(tc.toolName, tc.input),
          status: "running",
        }
        toolCallInfoRef.current.set(tc.toolCallId, toolInfo)

        // Construct the action based on the tool name and input
        let action: AgentAction | null = null

        switch (tc.toolName) {
          case "splitClip":
            action = {
              action: "SPLIT_CLIP",
              payload: {
                clipId: tc.input.clipId as string,
                splitTimeSeconds: tc.input.splitTimeSeconds as number,
              },
            }
            break
          case "splitAtTime":
            action = {
              action: "SPLIT_AT_TIME",
              payload: {
                timeSeconds: tc.input.timeSeconds as number,
                trackId: tc.input.trackId as string | undefined,
              },
            }
            break
          case "trimClip":
            action = {
              action: "TRIM_CLIP",
              payload: {
                clipId: tc.input.clipId as string,
                trimStartSeconds: tc.input.trimStartSeconds as number | undefined,
                trimEndSeconds: tc.input.trimEndSeconds as number | undefined,
              },
            }
            break
          case "deleteClip":
            action = {
              action: "DELETE_CLIP",
              payload: { clipId: tc.input.clipId as string },
            }
            break
          case "deleteAtTime":
            action = {
              action: "DELETE_AT_TIME",
              payload: {
                timeSeconds: tc.input.timeSeconds as number,
                trackId: tc.input.trackId as string | undefined,
              },
            }
            break
          case "deleteAllClips":
            action = {
              action: "DELETE_ALL_CLIPS",
              payload: {
                trackId: tc.input.trackId as string | undefined,
              },
            }
            break
          case "moveClip":
            action = {
              action: "MOVE_CLIP",
              payload: {
                clipId: tc.input.clipId as string,
                newStartTimeSeconds: tc.input.newStartTimeSeconds as number | undefined,
                newTrackId: tc.input.newTrackId as string | undefined,
              },
            }
            break
          case "applyEffect":
            action = {
              action: "APPLY_EFFECT",
              payload: {
                clipId: tc.input.clipId as string,
                effect: tc.input.effect as string,
              },
            }
            break
          case "applyChromakey":
            action = {
              action: "APPLY_CHROMAKEY",
              payload: {
                clipId: tc.input.clipId as string,
                enabled: tc.input.enabled as boolean,
                keyColor: tc.input.keyColor as string | undefined,
                similarity: tc.input.similarity as number | undefined,
                smoothness: tc.input.smoothness as number | undefined,
                spill: tc.input.spill as number | undefined,
              },
            }
            break
          case "addMediaToTimeline":
            action = {
              action: "ADD_MEDIA_TO_TIMELINE",
              payload: {
                mediaId: tc.input.mediaId as string,
                trackId: tc.input.trackId as string,
                startTimeSeconds: tc.input.startTimeSeconds as number | undefined,
              },
            }
            break
          case "dubClip":
            // Handle dubbing as a special async case
            processedToolCallsRef.current.add(tc.toolCallId)

            // Start async dubbing operation
            handleDubClip(
              tc.input.clipId as string,
              tc.input.targetLanguage as string,
              tc.input.replaceOriginal as boolean | undefined,
              tc.toolCallId
            ).then((result) => {
              if (result.success) {
                toolInfo.status = "success"
                toolInfo.description = `Dubbed to ${LANGUAGE_NAMES[tc.input.targetLanguage as string] || tc.input.targetLanguage}`
              } else {
                toolInfo.status = "error"
                toolInfo.description = result.error || "Dubbing failed"
              }
              toolCallInfoRef.current.set(tc.toolCallId, { ...toolInfo })
              forceUpdate((n) => n + 1)
            }).catch((err) => {
              toolInfo.status = "error"
              toolInfo.description = err instanceof Error ? err.message : "Dubbing failed"
              toolCallInfoRef.current.set(tc.toolCallId, { ...toolInfo })
              forceUpdate((n) => n + 1)
            })

            // Return early - don't process as regular action
            return
          case "createMorphTransition":
            action = {
              action: "CREATE_MORPH_TRANSITION",
              payload: {
                fromClipId: tc.input.fromClipId as string,
                toClipId: tc.input.toClipId as string,
                durationSeconds: (tc.input.durationSeconds as number) || 5,
              },
            }
            break
        }

        if (action) {
          processedToolCallsRef.current.add(tc.toolCallId)
          try {
            handleAction(action)
            // Mark as success
            toolInfo.status = "success"
            toolCallInfoRef.current.set(tc.toolCallId, { ...toolInfo })
          } catch (err) {
            // Mark as error
            toolInfo.status = "error"
            toolCallInfoRef.current.set(tc.toolCallId, { ...toolInfo })
          }
          // Force re-render to show updated status
          forceUpdate((n) => n + 1)
        }
      }
    },
  })

  const isLoading = status === "streaming" || status === "submitted"

  // Also process actions periodically during streaming
  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        processPendingActions()
      }, 100)
      return () => clearInterval(interval)
    }
  }, [isLoading, processPendingActions])

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value)
    },
    []
  )

  // Custom submit that sends the message
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      if (!input.trim() || isLoading) return

      const message = input
      setInput("")

      await sendMessage({ text: message })
    },
    [input, isLoading, sendMessage]
  )

  // Send a quick action message
  const sendQuickAction = useCallback(
    async (message: string) => {
      if (isLoading) return
      await sendMessage({ text: message })
    },
    [isLoading, sendMessage]
  )

  // Process tool invocations from messages
  // In AI SDK v6, tool results come as parts of the message
  useEffect(() => {
    for (const message of messages) {
      if (message.role === "assistant" && message.parts) {
        for (const part of message.parts) {
          // Check for tool-result parts (AI SDK v6 uses tool-result type)
          // Also check for tool-invocation with state === "output"
          const partAny = part as Record<string, unknown>

          // Try to extract tool result - structure varies by SDK version
          let toolId: string | undefined
          let result: unknown

          if (partAny.type === "tool-result") {
            toolId = partAny.toolCallId as string
            result = partAny.result
          } else if (partAny.type?.toString().startsWith("tool-") && partAny.state === "output") {
            toolId = partAny.toolCallId as string
            result = partAny.output
          }

          if (toolId && result) {
            // Skip if already processed
            if (processedToolCallsRef.current.has(toolId)) {
              continue
            }

            const action = result as AgentAction
            if (action && action.action) {
              processedToolCallsRef.current.add(toolId)
              handleAction(action)
            }
          }
        }
      }
    }

  }, [messages, handleAction])

  // Convert UIMessage[] to simpler format for display
  // Don't use useMemo - we want to recompute on every render to catch streaming updates
  const displayMessages: DisplayMessage[] = messages.map((msg) => {
    const content = getMessageText(msg)

    // Extract tool calls from message parts
    const toolCalls: ToolCallInfo[] = []
    if (msg.role === "assistant" && msg.parts) {
      for (const part of msg.parts) {
        const partAny = part as Record<string, unknown>
        // Check for tool-invocation type parts
        if (partAny.type === "tool-invocation" || partAny.type?.toString().startsWith("tool-")) {
          const toolCallId = partAny.toolCallId as string
          if (toolCallId) {
            // Get info from our tracked tool calls
            const info = toolCallInfoRef.current.get(toolCallId)
            if (info) {
              toolCalls.push(info)
            }
          }
        }
      }
    }

    return {
      role: msg.role as "user" | "assistant",
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    }
  })

  return {
    messages: displayMessages,
    status, // expose status for more granular UI control
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    sendQuickAction,
    error,
  }
}
