"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, Save, Loader2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ExportModal } from "./export-modal"
import { MediaPanel } from "./media-panel"
import { VideoPreview } from "./video-preview"
import { Timeline } from "./timeline"
import { InspectorPanel } from "./inspector-panel"
import { EditorProvider, useEditor } from "./editor-context"
import { getProject, updateProject, type ProjectData } from "@/lib/projects"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"

interface EditorShellProps {
  projectId: string
}

function EditorContent({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState("")
  const [isUpdatingName, setIsUpdatingName] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { setProjectId, setProjectResolution, loadTimelineData, saveProject, isSaving, hasUnsavedChanges, isPlaying, setIsPlaying, sortedVideoClips, currentTime, setCurrentTime, timelineEndTime, activeClip, splitClip, selectedClipId, removeClip, undo, redo, canUndo, canRedo, copyClip, pasteClip, canPaste } = useEditor()

  useEffect(() => {
    async function loadProject() {
      setIsLoading(true)
      const { data, error } = await getProject(projectId)
      
      if (error || !data) {
        setError(error?.message || "Project not found")
        setIsLoading(false)
        return
      }
      
      setProject(data)
      setProjectId(data.id)
      setProjectResolution(data.resolution)
      loadTimelineData(data.timeline_data)
      setIsLoading(false)
      }
    
    loadProject()
  }, [projectId, setProjectId, loadTimelineData])

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return
    }

    // Ctrl+Z or Cmd+Z - Undo
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault()
      if (canUndo) {
        undo()
      }
      return
    }

    // Ctrl+Shift+Z or Cmd+Shift+Z - Redo
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
      e.preventDefault()
      if (canRedo) {
        redo()
      }
      return
    }

    // Ctrl+C or Cmd+C - Copy selected clip
    if ((e.ctrlKey || e.metaKey) && e.key === "c") {
      e.preventDefault()
      if (selectedClipId) {
        copyClip(selectedClipId)
      }
      return
    }

    // Ctrl+V or Cmd+V - Paste clip
    if ((e.ctrlKey || e.metaKey) && e.key === "v") {
      e.preventDefault()
      if (canPaste) {
        pasteClip()
      }
      return
    }

    // Delete or Backspace - Delete selected clip
    if ((e.key === "Delete" || e.key === "Backspace") && selectedClipId) {
      e.preventDefault()
      removeClip(selectedClipId)
      return
    }

    if (e.code === "Space") {
      e.preventDefault() // Prevent page scroll
      
      if (!sortedVideoClips.length) return
      
      // If at end, restart from beginning
      if (currentTime >= timelineEndTime) {
        setCurrentTime(0)
      }
      
      setIsPlaying(!isPlaying)
    }

    // S key - Split clip at playhead
    if (e.code === "KeyS" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      if (activeClip) {
        splitClip(activeClip.id, currentTime)
      }
    }
  }, [isPlaying, setIsPlaying, sortedVideoClips.length, currentTime, timelineEndTime, setCurrentTime, activeClip, splitClip, selectedClipId, removeClip, undo, redo, canUndo, canRedo, copyClip, pasteClip, canPaste])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const handleBackToProjects = () => {
    router.push("/projects")
  }

  const handleSave = async () => {
    await saveProject()
  }

  const handleNameClick = () => {
    if (project) {
      setEditedName(project.name)
      setIsEditingName(true)
    }
  }

  const handleNameBlur = async () => {
    if (!project || !editedName.trim() || editedName === project.name) {
      setIsEditingName(false)
      return
    }

    setIsUpdatingName(true)
    const { data, error } = await updateProject(project.id, { name: editedName.trim() })
    
    if (error || !data) {
      console.error("Failed to update project name:", error)
      setEditedName(project.name) // Revert on error
    } else {
      setProject(data)
    }
    
    setIsUpdatingName(false)
    setIsEditingName(false)
  }

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur()
    } else if (e.key === "Escape") {
      if (project) {
        setEditedName(project.name)
      }
      setIsEditingName(false)
    }
  }

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [isEditingName])

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading project...</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-destructive">{error || "Project not found"}</p>
          <Button onClick={handleBackToProjects}>Back to Projects</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* Top Bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover="hover"
            whileTap={{ scale: 0.97 }}
          >
            <Button variant="ghost" size="sm" className="gap-2 cursor-pointer" onClick={handleBackToProjects}>
              <motion.div
                variants={{
                  hover: { x: -3, transition: { type: "spring", stiffness: 400, damping: 20 } }
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </motion.div>
              Projects
            </Button>
          </motion.div>
          <div className="h-4 w-px bg-border" />
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              disabled={isUpdatingName}
              className="text-sm font-semibold text-foreground bg-transparent border-b-2 border-primary focus:outline-none px-1 min-w-[120px] max-w-[300px] disabled:opacity-50"
            />
          ) : (
            <motion.div
              className="text-sm font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
              onClick={handleNameClick}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {project.name}
            </motion.div>
          )}
          <div className="text-xs text-muted-foreground">
            {project.resolution} • {project.frame_rate} fps
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? "Saving..." : hasUnsavedChanges ? "Save" : "Saved"}
          </Button>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Button
              variant="default"
              size="sm"
              className="gap-2"
              onClick={() => setShowExportModal(true)}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal open={showExportModal} onOpenChange={setShowExportModal} />

      {/* Main Content Area - Resizable Panels */}
      <ResizablePanelGroup direction="vertical" className="flex-1">
        {/* Top Section: Media, Preview, Inspector */}
        <ResizablePanel defaultSize={65} minSize={30}>
          <ResizablePanelGroup direction="horizontal">
            {/* Left Panel - Media Bin */}
            <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
              <div className="h-full border-r border-border bg-card">
                <MediaPanel />
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Center Panel - Video Preview */}
            <ResizablePanel defaultSize={55} minSize={30}>
              <div className="h-full">
                <VideoPreview />
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right Panel - Inspector */}
            <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
              <div className="h-full border-l border-border bg-card">
                <InspectorPanel />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        {/* Invisible but functional resize handle */}
        <ResizableHandle className="bg-transparent after:bg-transparent hover:bg-border/50 transition-colors" />

        {/* Bottom Panel - Timeline */}
        <ResizablePanel defaultSize={35} minSize={20} maxSize={60}>
          <div className="h-full border-t border-border bg-card">
            <Timeline />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

export function EditorShell({ projectId }: EditorShellProps) {
  return (
    <EditorProvider>
      <EditorContent projectId={projectId} />
    </EditorProvider>
  )
}
