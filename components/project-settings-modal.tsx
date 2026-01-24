"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateProject, type ProjectData } from "@/lib/projects"
import { Loader2 } from "lucide-react"

interface ProjectSettingsModalProps {
  project: ProjectData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectUpdated?: (project: ProjectData) => void
}

export function ProjectSettingsModal({ 
  project, 
  open, 
  onOpenChange, 
  onProjectUpdated 
}: ProjectSettingsModalProps) {
  const [projectName, setProjectName] = useState("")
  const [resolution, setResolution] = useState("1920x1080")
  const [frameRate, setFrameRate] = useState("30")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when project changes
  useEffect(() => {
    if (project) {
      setProjectName(project.name)
      setResolution(project.resolution)
      setFrameRate(project.frame_rate.toString())
      setError(null)
    }
  }, [project])

  const handleSave = async () => {
    if (!project) return
    
    setIsLoading(true)
    setError(null)

    const { data, error } = await updateProject(project.id, {
      name: projectName,
      resolution,
      frame_rate: Number.parseInt(frameRate),
    })

    setIsLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    if (data) {
      onProjectUpdated?.(data)
      onOpenChange(false)
    }
  }

  if (!project) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My Video Project"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="resolution">Resolution</Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger id="resolution">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1280x720">1280x720</SelectItem>
                  <SelectItem value="1920x1080">1920x1080</SelectItem>
                  <SelectItem value="2560x1440">2560x1440</SelectItem>
                  <SelectItem value="3840x2160">3840x2160</SelectItem>
                  <SelectItem value="7680x4320">7680x4320</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="framerate">Frame Rate</Label>
              <Select value={frameRate} onValueChange={setFrameRate}>
                <SelectTrigger id="framerate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 fps</SelectItem>
                  <SelectItem value="25">25 fps</SelectItem>
                  <SelectItem value="30">30 fps</SelectItem>
                  <SelectItem value="50">50 fps</SelectItem>
                  <SelectItem value="60">60 fps</SelectItem>
                  <SelectItem value="120">120 fps</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md bg-muted p-3">
            <div className="text-xs text-muted-foreground space-y-1">
              <p><span className="font-medium">Created:</span> {new Date(project.created_at).toLocaleString()}</p>
              <p><span className="font-medium">Last modified:</span> {new Date(project.updated_at).toLocaleString()}</p>
              <p><span className="font-medium">Duration:</span> {project.duration}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

