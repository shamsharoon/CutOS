"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createProject } from "@/lib/projects"
import { Loader2 } from "lucide-react"

interface NewProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectCreated?: () => void
}

export function NewProjectModal({ open, onOpenChange, onProjectCreated }: NewProjectModalProps) {
  const [projectName, setProjectName] = useState("Untitled Project")
  const [resolution, setResolution] = useState("1920x1080")
  const [frameRate, setFrameRate] = useState("30")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleCreate = async () => {
    setIsLoading(true)
    setError(null)

    const { data: project, error } = await createProject({
      name: projectName,
      resolution,
      frame_rate: Number.parseInt(frameRate),
    })

    setIsLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    if (project) {
      onProjectCreated?.()
      router.push(`/projects/${project.id}`)
    onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My Video Project"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="resolution">Resolution</Label>
            <Select value={resolution} onValueChange={setResolution}>
              <SelectTrigger id="resolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1920x1080">1920x1080</SelectItem>
                <SelectItem value="2560x1440">2560x1440</SelectItem>
                <SelectItem value="3840x2160">3840x2160</SelectItem>
                <SelectItem value="7680x4320">7680x4320</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="framerate">Frame Rate</Label>
            <Select value={frameRate} onValueChange={setFrameRate}>
              <SelectTrigger id="framerate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 fps</SelectItem>
                <SelectItem value="30">30 fps</SelectItem>
                <SelectItem value="60">60 fps</SelectItem>
                <SelectItem value="120">120 fps</SelectItem>
              </SelectContent>
            </Select>
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
          <Button onClick={handleCreate} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
