"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Film, Plus, Search, Grid3x3, List, Clock, MoreVertical, Play, Copy, Trash2, Settings, LogOut, User, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { NewProjectModal } from "./new-project-modal"
import { ProjectSettingsModal } from "./project-settings-modal"
import { AccountSettingsModal } from "./account-settings-modal"
import { DeleteProjectDialog } from "./delete-project-dialog"
import { useAuth } from "./auth-provider"
import { getProjects, deleteProject, duplicateProject, type ProjectData } from "@/lib/projects"

export function ProjectsDashboard() {
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [showNewProject, setShowNewProject] = useState(false)
  const [showAccountSettings, setShowAccountSettings] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null)
  const [showProjectSettings, setShowProjectSettings] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<ProjectData | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const { user, signOut } = useAuth()

  const loadProjects = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await getProjects()
    if (data && !error) {
      setProjects(data)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (user) {
      loadProjects()
    }
  }, [user, loadProjects])

  const handleOpenProject = (projectId: string) => {
    router.push(`/projects/${projectId}`)
  }

  const handleOpenDeleteDialog = (project: ProjectData) => {
    setProjectToDelete(project)
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return
    console.log("Deleting project:", projectToDelete.id)
    const { error } = await deleteProject(projectToDelete.id)
    console.log("Delete completed, error:", error)
    if (!error) {
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id))
    } else {
      console.error("Failed to delete:", error)
    }
  }

  const handleDuplicateProject = async (projectId: string) => {
    const { data, error } = await duplicateProject(projectId)
    if (data && !error) {
      setProjects((prev) => [data, ...prev])
    }
  }

  const handleOpenProjectSettings = (project: ProjectData) => {
    setSelectedProject(project)
    setShowProjectSettings(true)
  }

  const handleProjectUpdated = (updatedProject: ProjectData) => {
    setProjects((prev) => 
      prev.map((p) => p.id === updatedProject.id ? updatedProject : p)
    )
  }

  const handleSignOut = async () => {
    await signOut()
    router.push("/")
  }

  const filteredProjects = projects.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString()
  }

  return (
    <>
      <div className="flex h-screen w-screen flex-col bg-background">
        {/* Top Bar */}
        <div className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push("/")}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
            >
            <img src="/cutos.svg" alt="CutOS" className="h-10 w-10" />
            </button>
          </div>

          <div className="flex items-center gap-3">
          <Button onClick={() => setShowNewProject(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <span className="hidden sm:block text-sm max-w-[150px] truncate">
                    {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.user_metadata?.full_name || "User"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/")}>
                  <Film className="mr-2 h-4 w-4" />
                  Home
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAccountSettings(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content Area */}
        <motion.div 
          className="flex-1 overflow-auto p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Page Header */}
          <motion.div 
            className="mb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <h2 className="text-2xl font-bold text-foreground">Your Projects</h2>
            <p className="text-muted-foreground">Manage and edit your video projects</p>
          </motion.div>

          {/* Controls Bar */}
          <motion.div 
            className="mb-6 flex items-center justify-between"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="flex items-center gap-3">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>

          {/* Loading State */}
          {isLoading ? (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading projects...</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
                <Film className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">No projects yet</h3>
                <p className="text-sm text-muted-foreground">Create your first video project to get started</p>
              </div>
              <Button onClick={() => setShowNewProject(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </div>
          ) : (
            <motion.div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  : "flex flex-col gap-2"
              }
              initial="hidden"
              animate={!isLoading ? "visible" : "hidden"}
              variants={{
                hidden: {},
                visible: {
                  transition: {
                    staggerChildren: 0.1,
                    delayChildren: 0.3,
                  },
                },
              }}
            >
              {filteredProjects.map((project, index) => (
                <motion.div
                  key={project.id}
                  className="group relative overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50"
                  variants={{
                    hidden: { opacity: 0, y: 30 },
                    visible: { 
                      opacity: 1, 
                      y: 0,
                      transition: {
                        duration: 0.5,
                        ease: [0.4, 0, 0.2, 1],
                      },
                    },
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    className="aspect-video w-full cursor-pointer bg-muted overflow-hidden"
                    onClick={() => handleOpenProject(project.id)}
                  >
                    {project.thumbnail ? (
                      <img 
                        src={project.thumbnail} 
                        alt={project.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                    <div className="flex h-full items-center justify-center">
                      <Film className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                    )}
                  </div>

                  {/* Project Info */}
                  <div className="flex items-start justify-between gap-2 p-4">
                    <div className="flex-1 cursor-pointer" onClick={() => handleOpenProject(project.id)}>
                      <h3 className="font-medium text-foreground">{project.name}</h3>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{project.resolution}</span>
                        <span>•</span>
                        <span>{project.frame_rate} fps</span>
                        <span>•</span>
                        <span>{project.duration}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(project.updated_at)}</span>
                      </div>
                    </div>

                    {/* Actions Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenProject(project.id)}>
                          <Play className="mr-2 h-4 w-4" />
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateProject(project.id)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenProjectSettings(project)}>
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleOpenDeleteDialog(project)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>

      <NewProjectModal 
        open={showNewProject} 
        onOpenChange={setShowNewProject}
        onProjectCreated={loadProjects}
      />

      <ProjectSettingsModal
        project={selectedProject}
        open={showProjectSettings}
        onOpenChange={setShowProjectSettings}
        onProjectUpdated={handleProjectUpdated}
      />

      <AccountSettingsModal
        open={showAccountSettings}
        onOpenChange={setShowAccountSettings}
      />

      <DeleteProjectDialog
        projectName={projectToDelete?.name || ""}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
