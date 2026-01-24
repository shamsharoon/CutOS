import { createClient } from "@/lib/supabase/client"

export interface ProjectData {
  id: string
  user_id: string
  name: string
  resolution: string
  frame_rate: number
  duration: string
  thumbnail: string | null
  timeline_data: TimelineData | null
  created_at: string
  updated_at: string
}

export interface TimelineData {
  clips: TimelineClipData[]
  media: MediaFileData[]
}

export interface ClipTransform {
  positionX: number
  positionY: number
  scale: number
  opacity: number
}

export type EffectPreset = "none" | "grayscale" | "sepia" | "invert" | "glitch" | "vhs" | "ascii" | "cyberpunk" | "noir"

export interface ClipEffects {
  preset: EffectPreset
  blur: number        // 0-20px
  brightness: number  // 0-200%
  contrast: number    // 0-200%
  saturate: number    // 0-200%
  hueRotate: number   // 0-360deg
  chromakey?: {
    enabled: boolean
    keyColor: string      // Hex color to remove (e.g., "#00FF00")
    similarity: number    // 0-1: How close colors must be to be removed
    smoothness: number    // 0-1: Edge softness
    spill: number         // 0-1: Spill suppression strength
  }
}

export interface TimelineClipData {
  id: string
  mediaId: string
  trackId: string
  startTime: number
  duration: number
  mediaOffset?: number // Optional for backwards compatibility
  label: string
  type: "video" | "audio"
  transform?: ClipTransform // Optional for backwards compatibility
  effects?: ClipEffects // Optional for backwards compatibility
}

export interface MediaFileData {
  id: string
  name: string
  duration: string
  durationSeconds: number
  type: string
  storagePath: string // Path in Supabase Storage
  storageUrl: string // Public URL to access the file
  thumbnail: string | null // Base64 thumbnail
}

// Create a new project
export async function createProject(data: {
  name: string
  resolution: string
  frame_rate: number
}): Promise<{ data: ProjectData | null; error: Error | null }> {
  const supabase = createClient()
  
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) {
    return { data: null, error: new Error("Not authenticated") }
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.user.id,
      name: data.name,
      resolution: data.resolution,
      frame_rate: data.frame_rate,
      duration: "00:00:00",
      thumbnail: null,
      timeline_data: null,
    })
    .select()
    .single()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: project, error: null }
}

// Get all projects for the current user
export async function getProjects(): Promise<{ data: ProjectData[] | null; error: Error | null }> {
  const supabase = createClient()
  
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) {
    return { data: null, error: new Error("Not authenticated") }
  }

  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.user.id)
    .order("updated_at", { ascending: false })

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: projects, error: null }
}

// Get a single project by ID
export async function getProject(id: string): Promise<{ data: ProjectData | null; error: Error | null }> {
  const supabase = createClient()
  
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) {
    return { data: null, error: new Error("Not authenticated") }
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.user.id)
    .single()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: project, error: null }
}

// Update a project
export async function updateProject(
  id: string,
  data: Partial<{
    name: string
    resolution: string
    frame_rate: number
    duration: string
    thumbnail: string | null
    timeline_data: TimelineData | null
  }>
): Promise<{ data: ProjectData | null; error: Error | null }> {
  const supabase = createClient()
  
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) {
    return { data: null, error: new Error("Not authenticated") }
  }

  const { data: project, error } = await supabase
    .from("projects")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.user.id)
    .select()
    .single()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: project, error: null }
}

// Delete a project
export async function deleteProject(id: string): Promise<{ error: Error | null }> {
  const supabase = createClient()
  
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) {
    console.error("Delete failed: Not authenticated")
    return { error: new Error("Not authenticated") }
  }

  console.log("Attempting to delete project:", id, "for user:", user.user.id)

  // First verify the project exists
  const { data: existing } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", id)
    .single()
  
  console.log("Project to delete:", existing)

  const { error, status, statusText } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", user.user.id)

  console.log("Delete result - status:", status, statusText, "error:", error)

  if (error) {
    console.error("Delete error:", error)
    return { error: new Error(error.message) }
  }

  return { error: null }
}

// Duplicate a project
export async function duplicateProject(id: string): Promise<{ data: ProjectData | null; error: Error | null }> {
  const supabase = createClient()
  
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) {
    return { data: null, error: new Error("Not authenticated") }
  }

  // Get the original project
  const { data: original, error: fetchError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.user.id)
    .single()

  if (fetchError || !original) {
    return { data: null, error: new Error(fetchError?.message || "Project not found") }
  }

  // Create a copy
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.user.id,
      name: `${original.name} (Copy)`,
      resolution: original.resolution,
      frame_rate: original.frame_rate,
      duration: original.duration,
      thumbnail: original.thumbnail,
      timeline_data: original.timeline_data,
    })
    .select()
    .single()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: project, error: null }
}

