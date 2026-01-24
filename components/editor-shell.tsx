"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MediaPanel } from "./media-panel"
import { VideoPreview } from "./video-preview"
import { Timeline } from "./timeline"
import { InspectorPanel } from "./inspector-panel"
import { EditorProvider, useEditor } from "./editor-context"
import { getProject, type ProjectData } from "@/lib/projects"
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
  const router = useRouter()
  const { setProjectId, loadTimelineData, saveProject, isSaving, hasUnsavedChanges, isPlaying, setIsPlaying, sortedVideoClips, currentTime, setCurrentTime, timelineEndTime, activeClip, splitClip } = useEditor()

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
  }, [isPlaying, setIsPlaying, sortedVideoClips.length, currentTime, timelineEndTime, setCurrentTime, activeClip, splitClip])

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
          <Button variant="ghost" size="sm" className="gap-2" onClick={handleBackToProjects}>
            <ArrowLeft className="h-4 w-4" />
            Projects
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="text-sm font-semibold text-foreground">{project.name}</div>
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
        </div>
      </div>

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
