"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, Pause, Film, Video, Volume2, Wand2, Loader2, Check, Sparkles, Search, Upload, ChevronLeft, Maximize2, Mic, SkipBack, SkipForward } from "lucide-react"

export function EditorDemo() {
  const [isPlaying, setIsPlaying] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [showAgentMessage, setShowAgentMessage] = useState(false)
  const [agentAction, setAgentAction] = useState<string | null>(null)
  const [agentMessage, setAgentMessage] = useState("")
  const animationRef = useRef<number | null>(null)
  const hasStartedRef = useRef(false)

  const demoClips = [
    { id: "1", name: "green_scr...", start: 0, duration: 80, track: "V2", color: "bg-lime-500" },
    { id: "2", name: "green_scr...", start: 80, duration: 70, track: "V2", color: "bg-lime-500" },
    { id: "3", name: "green_scr...", start: 150, duration: 60, track: "V2", color: "bg-lime-500" },
  ]

  const timelineEndTime = 210

  useEffect(() => {
    if (isPlaying) {
      const startTime = performance.now()
      const startPosition = currentTime

      const animate = () => {
        const elapsed = (performance.now() - startTime) / 1000
        const newTime = startPosition + elapsed

        if (newTime >= timelineEndTime) {
          setIsPlaying(false)
          setCurrentTime(0)
          setTimeout(() => setIsPlaying(true), 1000)
          return
        }

        setCurrentTime(newTime)
        animationRef.current = requestAnimationFrame(animate)
      }

      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, currentTime, timelineEndTime])

  useEffect(() => {
    if (!hasStartedRef.current) {
      const timer = setTimeout(() => {
        setIsPlaying(true)
        hasStartedRef.current = true
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (!isPlaying) return

    const checkTime = () => {
      if (currentTime >= 2 && currentTime < 4 && agentAction !== "effect") {
        setShowAgentMessage(true)
        setAgentAction("effect")
        setAgentMessage("Applying cinematic color grade...")
        setTimeout(() => {
          setShowAgentMessage(false)
          setAgentAction(null)
        }, 2500)
      } else if (currentTime >= 5 && currentTime < 7 && agentAction !== "split") {
        setShowAgentMessage(true)
        setAgentAction("split")
        setAgentMessage("Removing background...")
        setTimeout(() => {
          setShowAgentMessage(false)
          setAgentAction(null)
        }, 2500)
      } else if (currentTime >= 8 && currentTime < 10 && agentAction !== "captions") {
        setShowAgentMessage(true)
        setAgentAction("captions")
        setAgentMessage("Done! Background removed successfully.")
        setTimeout(() => {
          setShowAgentMessage(false)
          setAgentAction(null)
        }, 2500)
      }
    }

    checkTime()
  }, [currentTime, isPlaying, agentAction])

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  const formatShortTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  const playheadPosition = (currentTime / timelineEndTime) * 100

  return (
    <div className="relative w-full max-w-7xl mx-auto rounded-xl border border-neutral-800 bg-black shadow-2xl shadow-black/80 overflow-hidden">
      {/* Top Bar - mimicking actual editor */}
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white">
            <ChevronLeft className="h-4 w-4" />
            Projects
          </button>
          <div className="text-sm font-medium text-white">Untitled Project</div>
          <div className="text-xs text-neutral-500">1920x1080 • 30 fps</div>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Saved
        </div>
      </div>

      {/* Editor Interface */}
      <div className="flex flex-col h-[580px] bg-neutral-950">
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Media */}
          <div className="w-72 border-r border-neutral-800 bg-neutral-900/50 flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-neutral-800">
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs text-white bg-neutral-800/50 border-b-2 border-white/20">
                <Film className="h-3.5 w-3.5" />
                Media
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs text-neutral-500 hover:text-neutral-300">
                <Sparkles className="h-3.5 w-3.5" />
                Effects
              </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-neutral-800">
              <div className="flex items-center gap-2 rounded-md bg-neutral-800/50 border border-neutral-700/50 px-3 py-2">
                <Search className="h-3.5 w-3.5 text-neutral-500" />
                <span className="text-xs text-neutral-500">Search media...</span>
              </div>
            </div>

            {/* Add Videos Button */}
            <div className="p-3 border-b border-neutral-800">
              <button className="w-full flex items-center justify-center gap-2 rounded-md border border-dashed border-neutral-700 py-2.5 text-xs text-neutral-400 hover:border-neutral-600 hover:text-neutral-300 transition-colors">
                <Upload className="h-3.5 w-3.5" />
                Add more videos
              </button>
            </div>

            {/* Media Items */}
            <div className="flex-1 overflow-y-auto p-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="group cursor-pointer"
              >
                <div className="relative aspect-video rounded-md overflow-hidden border border-neutral-800 group-hover:border-neutral-600 transition-colors">
                  {/* Green screen thumbnail */}
                  <div className="absolute inset-0 bg-lime-400" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-20 bg-neutral-800 rounded-sm" />
                  </div>
                  {/* Play indicator */}
                  <div className="absolute top-2 left-2">
                    <div className="w-5 h-5 rounded-full bg-lime-500 flex items-center justify-center">
                      <Play className="h-2.5 w-2.5 text-black ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-xs font-medium text-white truncate">green_screen.mp4</div>
                  <div className="text-[10px] text-neutral-500">00:19</div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Center - Video Preview */}
          <div className="flex-1 flex flex-col bg-neutral-900/30">
            <div className="flex-1 flex items-center justify-center relative overflow-hidden p-4">
              {/* Video Preview Area */}
              <div className="relative w-full max-w-3xl aspect-video bg-black rounded overflow-hidden">
                {/* Simulated video - green screen with person silhouette */}
                <div className="absolute inset-0 bg-gradient-to-br from-lime-400 via-lime-500 to-lime-400" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-40 bg-neutral-700 rounded-t-full opacity-60" />
                </div>
                {/* Side decorations */}
                <div className="absolute top-0 right-0 w-20 h-full bg-gradient-to-l from-neutral-800/40 to-transparent" />

                {/* AI Agent Message Overlay */}
                <AnimatePresence>
                  {showAgentMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-3 left-3 right-3 z-10"
                    >
                      <div className="bg-neutral-900/95 backdrop-blur-sm border border-neutral-700 rounded-lg px-4 py-3 shadow-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                            {agentAction === "effect" && (
                              <Wand2 className="h-3 w-3 text-white" />
                            )}
                            {agentAction === "split" && (
                              <Loader2 className="h-3 w-3 text-white animate-spin" />
                            )}
                            {agentAction === "captions" && (
                              <Check className="h-3 w-3 text-emerald-400" />
                            )}
                          </div>
                          <span className="text-xs text-white">
                            {agentMessage}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Scrubber */}
            <div className="px-6 py-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-400 font-mono w-16">{formatTime(currentTime)}</span>
                <div className="flex-1 h-1 bg-neutral-800 rounded-full relative">
                  <div
                    className="absolute left-0 top-0 h-full bg-white/30 rounded-full"
                    style={{ width: `${playheadPosition}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg"
                    style={{ left: `${playheadPosition}%`, marginLeft: '-6px' }}
                  />
                </div>
                <span className="text-xs text-neutral-500 font-mono w-16 text-right">{formatTime(31)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="px-6 py-3 border-t border-neutral-800/50 flex items-center justify-center gap-2">
              <button className="p-2 text-neutral-400 hover:text-white transition-colors">
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>
              <button className="p-2 text-neutral-400 hover:text-white transition-colors">
                <SkipForward className="h-4 w-4" />
              </button>
              <div className="w-px h-5 bg-neutral-800 mx-2" />
              <button className="p-2 text-neutral-400 hover:text-white transition-colors">
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Right Panel - AI Assistant */}
          <div className="w-80 border-l border-neutral-800 bg-neutral-900/50 flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-[11px] font-medium text-neutral-400 tracking-wider">AI ASSISTANT</span>
              <button className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1">
                <span className="text-[10px]">+</span> New Chat
              </button>
            </div>

            {/* Smart Enhance Section */}
            <div className="p-4 border-b border-neutral-800">
              <div className="text-[10px] font-medium text-neutral-500 tracking-wider mb-3">SMART ENHANCE</div>
              <button className="w-full flex items-center justify-center gap-2 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 py-2.5 text-sm text-white transition-colors">
                <Sparkles className="h-4 w-4" />
                Auto Enhance Video
              </button>
              <p className="text-[10px] text-neutral-600 text-center mt-2">
                AI analyzes and applies multiple improvements automatically
              </p>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="bg-neutral-800/50 rounded-lg p-3 border border-neutral-700/50">
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Hi! I'm your AI editing assistant. I can split, trim, delete, move clips, and apply effects. Just tell me what you'd like to do!
                </p>
              </div>
            </div>

            {/* Input */}
            <div className="p-4 border-t border-neutral-800">
              <div className="flex items-center gap-2 rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2.5">
                <input
                  type="text"
                  placeholder="Ask AI to edit your video..."
                  className="flex-1 bg-transparent text-xs text-white placeholder:text-neutral-500 outline-none"
                  disabled
                />
                <button className="p-1 text-neutral-400 hover:text-white">
                  <Mic className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="h-44 border-t border-neutral-800 bg-neutral-900/80 flex flex-col">
          {/* Timeline Header */}
          <div className="px-3 py-2 border-b border-neutral-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-300">Timeline</span>
              <div className="flex items-center gap-1 ml-4">
                <button className="p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 12h16M12 4v16" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-neutral-500">
              <span className="bg-neutral-800 px-2 py-1 rounded text-neutral-400">0:00</span>
              <div className="flex items-center gap-2">
                <span>Fit</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Track Labels */}
            <div className="w-16 border-r border-neutral-800/80 flex-shrink-0">
              {["V2", "V1", "A2", "A1"].map((track) => (
                <div key={track} className="h-9 border-b border-neutral-800/50 flex items-center px-2">
                  <div className="flex items-center gap-1.5">
                    {track.startsWith("V") ? (
                      <Video className="h-3 w-3 text-neutral-600" />
                    ) : (
                      <Volume2 className="h-3 w-3 text-neutral-600" />
                    )}
                    <span className="text-[11px] text-neutral-500">{track}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Timeline Content */}
            <div className="flex-1 relative overflow-x-auto">
              {/* Time Ruler */}
              <div className="h-5 border-b border-neutral-800/50 bg-neutral-900/50 flex items-end px-1">
                {["0:00", "0:08", "0:16", "0:24", "0:32", "0:40", "0:48", "0:56"].map((time, i) => (
                  <div key={time} className="absolute bottom-1" style={{ left: `${(i / 8) * 100}%` }}>
                    <span className="text-[9px] text-neutral-600">{time}</span>
                  </div>
                ))}
              </div>

              {/* Tracks */}
              <div className="relative">
                {["V2", "V1", "A2", "A1"].map((track, trackIndex) => (
                  <div key={track} className="h-9 border-b border-neutral-800/30 relative">
                    {demoClips
                      .filter((clip) => clip.track === track)
                      .map((clip) => {
                        const left = (clip.start / timelineEndTime) * 100
                        const width = (clip.duration / timelineEndTime) * 100
                        return (
                          <motion.div
                            key={clip.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`absolute top-1 bottom-1 ${clip.color} rounded-sm cursor-pointer hover:brightness-110 transition-all flex items-center px-2 overflow-hidden`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                          >
                            {/* Mini thumbnail pattern */}
                            <div className="absolute inset-0 flex">
                              {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex-1 border-r border-lime-600/30 last:border-r-0" />
                              ))}
                            </div>
                            <span className="relative text-[9px] font-medium text-lime-900 truncate">{clip.name}</span>
                          </motion.div>
                        )
                      })}
                  </div>
                ))}

                {/* Playhead */}
                <motion.div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                  style={{ left: `${playheadPosition}%` }}
                  transition={{ duration: 0.1, ease: "linear" }}
                >
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-2 h-4 bg-red-500" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
