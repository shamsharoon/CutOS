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
import { getChatSession, saveChatMessages, clearChatSession, type ChatMessage } from "@/lib/chat"

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
    case "applyChromakey":
      return input.enabled ? `Enable chromakey (${input.keyColor || "green"})` : "Disable chromakey"
    case "addMediaToTimeline":
      return `Add media to track ${input.trackId}${input.startTimeSeconds !== undefined ? ` at ${input.startTimeSeconds}s` : ""}`
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

  // Chat persistence state
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [savedMessages, setSavedMessages] = useState<ChatMessage[]>([])
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([])
  const hasLoadedRef = useRef(false)
  const lastSavedRef = useRef<string>("")

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
  // DefaultChatTransport automatically includes all messages in the conversation
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/agent",
      body: () => ({
        timelineState: getTimelineContext(),
      }),
    })
  }, [getTimelineContext])

  const { messages, sendMessage, status, error, setMessages } = useChat({
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

    // Handle empty assistant messages
    let displayContent = content
    if (msg.role === "assistant" && (!content || !content.trim()) && toolCalls.length === 0) {
      displayContent = "I'm not sure what you'd like me to do. Could you please rephrase your request or ask another question?"
    }

    return {
      role: msg.role as "user" | "assistant",
      content: displayContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    }
  })

  // Load chat history on mount and restore to useChat
  useEffect(() => {
    if (!editor.projectId || hasLoadedRef.current) return

    const loadHistory = async () => {
      setIsLoadingHistory(true)
      try {
        const { data, error } = await getChatSession(editor.projectId!)
        if (error) {
          console.error("Failed to load chat history:", error)
        } else if (data?.messages && data.messages.length > 0) {
          setSavedMessages(data.messages)
          
          // Convert ChatMessage[] to UIMessage[] format for useChat
          const uiMessages: UIMessage[] = data.messages.map((msg, index) => ({
            id: `msg-${index}-${Date.now()}`,
            role: msg.role,
            parts: [
              {
                type: "text",
                text: msg.content,
              },
            ],
          }))
          setInitialMessages(uiMessages)
          
          // Restore messages to useChat hook
          if (setMessages && uiMessages.length > 0) {
            setMessages(uiMessages)
          }
        }
      } catch (err) {
        console.error("Error loading chat history:", err)
      } finally {
        setIsLoadingHistory(false)
        hasLoadedRef.current = true
      }
    }

    loadHistory()
  }, [editor.projectId, setMessages])

  // Save chat messages when they change (debounced)
  useEffect(() => {
    if (!editor.projectId || !hasLoadedRef.current) return
    if (displayMessages.length === 0) return
    if (status === "streaming" || status === "submitted") return // Don't save while streaming

    // Create a serializable version for comparison and storage
    const messagesToSave: ChatMessage[] = displayMessages
      .filter((m) => m.content.trim() || (m.toolCalls && m.toolCalls.length > 0))
      .map((m) => ({
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls,
      }))

    const serialized = JSON.stringify(messagesToSave)
    if (serialized === lastSavedRef.current) return // No changes

    const saveTimeout = setTimeout(async () => {
      try {
        const { error } = await saveChatMessages(editor.projectId!, messagesToSave)
        if (error) {
          console.error("Failed to save chat messages:", error)
        } else {
          lastSavedRef.current = serialized
        }
      } catch (err) {
        console.error("Error saving chat messages:", err)
      }
    }, 1000) // Debounce 1 second

    return () => clearTimeout(saveTimeout)
  }, [displayMessages, editor.projectId, status])

  // Clear chat and start new
  const clearChat = useCallback(async () => {
    if (!editor.projectId) return

    try {
      const { error } = await clearChatSession(editor.projectId)
      if (error) {
        console.error("Failed to clear chat:", error)
        return
      }

      // Reset local state
      setSavedMessages([])
      processedToolCallsRef.current.clear()
      toolCallInfoRef.current.clear()
      lastSavedRef.current = ""

      // Force page reload to reset useChat state
      window.location.reload()
    } catch (err) {
      console.error("Error clearing chat:", err)
    }
  }, [editor.projectId])

  // Use messages from useChat (which now includes initialMessages)
  // The displayMessages are already derived from useChat's messages, so we can use them directly
  const allMessages = displayMessages

  return {
    messages: allMessages,
    status, // expose status for more granular UI control
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    isLoadingHistory,
    sendQuickAction,
    sendMessage, // Expose sendMessage for direct message sending
    clearChat,
    error,
  }
}
