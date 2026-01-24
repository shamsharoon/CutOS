"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useCallback, useEffect, useRef, useState, useMemo } from "react"
import {
  useEditor,
  PIXELS_PER_SECOND,
  DEFAULT_CLIP_TRANSFORM,
  DEFAULT_CLIP_EFFECTS,
  type TimelineClip,
} from "@/components/editor-context"
import type { TimelineState } from "./system-prompt"
import type { AgentAction } from "./tools"

// Helper to extract text content from UIMessage parts
function getMessageText(message: UIMessage): string {
  if (!message.parts) return ""
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("")
}

export function useVideoAgent() {
  const editor = useEditor()
  const pendingActionsRef = useRef<AgentAction[]>([])
  const processedToolCallsRef = useRef<Set<string>>(new Set())
  const [input, setInput] = useState("")

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
      // Debug: log the tool call structure
      console.log("onToolCall received:", JSON.stringify(toolCall, null, 2))

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
        }

        if (action) {
          console.log("Executing action from tool call:", action)
          processedToolCallsRef.current.add(tc.toolCallId)
          handleAction(action)
        }
      }
    },
    onFinish: () => {
      console.log("onFinish called")
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
    let hasNewActions = false

    for (const message of messages) {
      if (message.role === "assistant" && message.parts) {
        // Debug: log all parts to understand the structure
        console.log("Assistant message parts:", message.parts.map(p => ({ type: (p as Record<string, unknown>).type, state: (p as Record<string, unknown>).state })))

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
              console.log("Found tool result in message:", partAny.type, action)
              processedToolCallsRef.current.add(toolId)
              handleAction(action)
              hasNewActions = true
            }
          }
        }
      }
    }

    if (hasNewActions) {
      console.log("Processed new tool actions from messages")
    }
  }, [messages, handleAction])

  // Convert UIMessage[] to simpler format for display
  const displayMessages = useMemo(() => {
    return messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: getMessageText(msg),
    }))
  }, [messages])

  return {
    messages: displayMessages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    sendQuickAction,
    error,
  }
}
