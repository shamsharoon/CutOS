"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Mic, Check, AlertCircle, MessageSquarePlus, Zap, Loader2 } from "lucide-react"
import { useEditor } from "./editor-context"
import { useVideoAgent } from "@/lib/agent/use-agent"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function InspectorPanel() {
  return (
    <div className="flex h-full flex-col">
      <AgentTab />
    </div>
  )
}

function AgentTab() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, isLoadingHistory, sendQuickAction, clearChat, status, sendMessage } = useVideoAgent()
  const { selectedClipId, currentTime, timelineClips } = useEditor()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [showNewChatDialog, setShowNewChatDialog] = useState(false)

  // Auto-scroll to bottom when messages change or during streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, status])

  const handleQuickAction = (action: string) => {
    sendQuickAction(action)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())

        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

        // Send to API for transcription
        setIsTranscribing(true)
        try {
          const formData = new FormData()
          formData.append('audio', audioBlob, 'recording.webm')

          const response = await fetch('/api/speech-to-text', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Transcription failed')
          }

          const { text } = await response.json()
          if (text && text.trim()) {
            // Refine the transcription before sending
            try {
              const refineResponse = await fetch('/api/refine-transcription', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ transcription: text.trim() }),
              })

              if (refineResponse.ok) {
                const { text: refinedText } = await refineResponse.json()
                if (refinedText && refinedText.trim()) {
                  // Send the refined text to the chat
                  await sendMessage({ text: refinedText.trim() })
                } else {
                  // Fallback to original if refinement returns empty
                  await sendMessage({ text: text.trim() })
                }
              } else {
                // If refinement fails, use original transcription
                await sendMessage({ text: text.trim() })
              }
            } catch (refineError) {
              console.error('Refinement error:', refineError)
              // If refinement fails, use original transcription
              await sendMessage({ text: text.trim() })
            }
          }
        } catch (error) {
          console.error('Transcription error:', error)
          alert(error instanceof Error ? error.message : 'Failed to transcribe audio')
        } finally {
          setIsTranscribing(false)
        }
      }

      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
    } catch (error) {
      console.error('Failed to start recording:', error)
      alert('Failed to access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
      setIsRecording(false)
    }
  }

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const handleNewChat = () => {
    setShowNewChatDialog(true)
  }

  const confirmNewChat = () => {
    clearChat()
    setShowNewChatDialog(false)
  }

  // Keyboard shortcut: backtick key for speech-to-text (push-to-talk)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Backtick key (`) - start recording on keydown
      if (e.key === "`" || e.key === "Backquote") {
        e.preventDefault()
        if (!isLoading && !isTranscribing && !isRecording) {
          startRecording()
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      // Backtick key (`) - stop recording on keyup
      if (e.key === "`" || e.key === "Backquote") {
        e.preventDefault()
        if (isRecording) {
          stopRecording()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [isLoading, isTranscribing, isRecording, startRecording, stopRecording])

  return (
    <div className="flex h-full flex-col">
      {/* Header with New Chat button */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">AI Assistant</span>
        <motion.button
          onClick={handleNewChat}
          disabled={isLoading || messages.length === 0}
          className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Start new chat"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <MessageSquarePlus className="h-3 w-3" />
          New Chat
        </motion.button>
      </div>

      {/* Smart Enhance - One Stop Shop */}
      <div className="border-b border-border p-3">
        <div className="mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Smart Enhance</div>
        <motion.button
          onClick={() => {
            const message = "Analyze my video timeline and automatically apply smart improvements. Look at all clips and suggest enhancements like: trimming dead air at the start/end, applying cinematic effects, removing green screens if present, improving pacing with strategic splits, and any other optimizations. Apply all suggested improvements automatically using your tools."
            sendQuickAction(message)
          }}
          disabled={isLoading || timelineClips.length === 0}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 px-3 py-2.5 text-[11px] font-medium text-primary hover:from-primary/30 hover:to-primary/20 hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
          whileHover={{ scale: isLoading || timelineClips.length === 0 ? 1 : 1.02 }}
          whileTap={{ scale: isLoading || timelineClips.length === 0 ? 1 : 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <motion.div
            animate={isLoading ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 2, repeat: isLoading ? Infinity : 0, ease: "linear" }}
          >
            <Zap className="h-4 w-4" />
          </motion.div>
          <span>Auto Enhance Video</span>
        </motion.button>
        <p className="mt-1.5 text-[9px] text-muted-foreground/80 text-center">
          AI analyzes and applies multiple improvements automatically
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {/* Loading history indicator */}
        <AnimatePresence>
        {isLoadingHistory && (
          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading chat history...
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Initial greeting if no messages and not loading */}
        <AnimatePresence>
        {!isLoadingHistory && messages.length === 0 && (
          <motion.div
            className="flex justify-start"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs bg-muted text-foreground border border-border">
              Hi! I&apos;m your AI editing assistant. I can split, trim, delete, move clips, and apply effects. Just tell me what you&apos;d like to do!
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        <AnimatePresence mode="popLayout">
        {messages.map((message, i) => {
          const isLastMessage = i === messages.length - 1
          const isStreaming = isLastMessage && message.role === "assistant" && status === "streaming"
          const hasContent = message.content.trim().length > 0
          const hasToolCalls = message.toolCalls && message.toolCalls.length > 0

          // Skip empty assistant messages with no tool calls (unless streaming)
          if (message.role === "assistant" && !hasContent && !hasToolCalls && !isStreaming) {
            return null
          }

          return (
            <motion.div
              key={i}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              initial={{ opacity: 0, y: 10, x: message.role === "user" ? 20 : -20 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 25, delay: isLastMessage ? 0 : 0.05 }}
              layout
            >
              <motion.div
                className={`max-w-[85%] rounded-lg text-xs ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground px-3 py-2"
                    : "bg-muted text-foreground border border-border"
                }`}
                whileHover={{ scale: 1.01 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                {/* Show tool calls */}
                {hasToolCalls && (
                  <div className={`space-y-1 ${hasContent ? "px-3 pt-2 pb-1" : "p-2"}`}>
                    {message.toolCalls!.map((tc, tcIndex) => (
                      <motion.div
                        key={tc.id}
                        className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[10px] ${
                          tc.status === "success"
                            ? "bg-green-500/15 text-green-600 dark:text-green-400"
                            : tc.status === "error"
                            ? "bg-red-500/15 text-red-600 dark:text-red-400"
                            : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                        }`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: tcIndex * 0.1, type: "spring", stiffness: 400, damping: 20 }}
                      >
                        {tc.status === "running" && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {tc.status === "success" && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 20 }}
                          >
                            <Check className="h-3 w-3" />
                          </motion.div>
                        )}
                        {tc.status === "error" && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 20 }}
                          >
                            <AlertCircle className="h-3 w-3" />
                          </motion.div>
                        )}
                        <span>{tc.description}</span>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Show text content */}
                {hasContent && (
                  <div className={hasToolCalls ? "px-3 pb-2 pt-1" : "px-3 py-2"}>
                    {message.content}
                    {isStreaming && (
                      <motion.span
                        className="inline-block w-1.5 h-3 ml-0.5 bg-foreground/70"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                  </div>
                )}

                {/* Show streaming cursor even if no content yet */}
                {!hasContent && !hasToolCalls && isStreaming && (
                  <div className="px-3 py-2">
                    <motion.span
                      className="inline-block w-1.5 h-3 bg-foreground/70"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                )}
              </motion.div>
            </motion.div>
          )
        })}
        </AnimatePresence>

        {/* Loading indicator - only show when submitted but no streaming yet */}
        <AnimatePresence>
        {status === "submitted" && (
          <motion.div
            className="flex justify-start"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs bg-muted text-foreground border border-border flex items-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="h-3 w-3" />
              </motion.div>
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                Thinking...
              </motion.span>
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border p-3">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Ask AI to edit your video..."
            value={input}
            onChange={handleInputChange}
            disabled={isLoading || isRecording}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
          />
          {input.trim() ? (
            <motion.button
              type="submit"
              className="flex items-center justify-center rounded-md bg-primary px-3 py-2.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={!input.trim() || isLoading}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Send className="h-3.5 w-3.5" />
            </motion.button>
          ) : (
            <div className="relative">
              {/* Pulsing rings when recording */}
              <AnimatePresence>
                {isRecording && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-md bg-red-500"
                      initial={{ opacity: 0.6, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.8 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-md bg-red-500"
                      initial={{ opacity: 0.4, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.5 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
                    />
                  </>
                )}
              </AnimatePresence>

              <motion.button
                type="button"
                onClick={toggleRecording}
                disabled={isLoading || isTranscribing}
                className={`relative flex items-center justify-center rounded-md px-3 py-2.5 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                  isRecording
                    ? "bg-red-500"
                    : "bg-primary"
                }`}
                title={isRecording ? "Stop recording" : "Start voice recording"}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={isRecording ? {
                  backgroundColor: ["#ef4444", "#dc2626", "#ef4444"],
                } : {}}
                transition={{
                  backgroundColor: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
                  scale: { type: "spring", stiffness: 400, damping: 17 }
                }}
              >
                <AnimatePresence mode="wait">
                  {isTranscribing ? (
                    <motion.div
                      key="transcribing"
                      initial={{ opacity: 0, rotate: 0 }}
                      animate={{ opacity: 1, rotate: 360 }}
                      exit={{ opacity: 0 }}
                      transition={{ rotate: { duration: 1, repeat: Infinity, ease: "linear" } }}
                    >
                      <Loader2 className="h-3.5 w-3.5" />
                    </motion.div>
                  ) : isRecording ? (
                    <motion.div
                      key="recording"
                      className="flex items-center gap-0.5"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    >
                      {/* Sound wave bars */}
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-0.5 bg-white rounded-full"
                          animate={{
                            height: ["8px", "14px", "8px"],
                          }}
                          transition={{
                            duration: 0.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.15,
                          }}
                        />
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    >
                      <Mic className="h-3.5 w-3.5" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          )}
        </div>
        <AnimatePresence>
          {isTranscribing && (
            <motion.div
              className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="h-3 w-3" />
              </motion.div>
              <span>Transcribing audio...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* New Chat Confirmation Dialog */}
      <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start New Chat?</DialogTitle>
            <DialogDescription>
              This will clear your current conversation. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <motion.button
              onClick={() => setShowNewChatDialog(false)}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              Cancel
            </motion.button>
            <motion.button
              onClick={confirmNewChat}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ x: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <motion.div
                initial={{ rotate: 0 }}
                whileHover={{ rotate: 180 }}
                transition={{ type: "spring", stiffness: 200, damping: 10 }}
              >
                <MessageSquarePlus className="h-4 w-4" />
              </motion.div>
              Start New Chat
            </motion.button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
