import { createClient } from "@/lib/supabase/client"

const BUCKET_NAME = "project-media"

export interface UploadResult {
  path: string
  url: string
}

// Upload a media file to Supabase Storage
export async function uploadMediaFile(
  projectId: string,
  file: File
): Promise<{ data: UploadResult | null; error: Error | null }> {
  const supabase = createClient()
  
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) {
    return { data: null, error: new Error("Not authenticated") }
  }

  // Create a unique path: user_id/project_id/filename
  const fileExt = file.name.split('.').pop()
  const uniqueId = crypto.randomUUID()
  const path = `${user.user.id}/${projectId}/${uniqueId}.${fileExt}`

  console.log("Uploading file to:", path)

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (uploadError) {
    console.error("Upload error:", uploadError)
    return { data: null, error: new Error(uploadError.message) }
  }

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path)

  return { 
    data: { 
      path, 
      url: urlData.publicUrl 
    }, 
    error: null 
  }
}

// Download a media file from Supabase Storage (returns blob URL)
export async function getMediaFileUrl(path: string): Promise<{ url: string | null; error: Error | null }> {
  const supabase = createClient()

  // Get signed URL for private bucket or public URL
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path)

  return { url: data.publicUrl, error: null }
}

// Delete a media file from Supabase Storage
export async function deleteMediaFile(path: string): Promise<{ error: Error | null }> {
  const supabase = createClient()

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path])

  if (error) {
    return { error: new Error(error.message) }
  }

  return { error: null }
}

// Delete all media files for a project
export async function deleteProjectMedia(projectId: string): Promise<{ error: Error | null }> {
  const supabase = createClient()
  
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) {
    return { error: new Error("Not authenticated") }
  }

  const folderPath = `${user.user.id}/${projectId}`
  
  // List all files in the project folder
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET_NAME)
    .list(folderPath)

  if (listError) {
    return { error: new Error(listError.message) }
  }

  if (files && files.length > 0) {
    const filePaths = files.map(f => `${folderPath}/${f.name}`)
    
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filePaths)

    if (deleteError) {
      return { error: new Error(deleteError.message) }
    }
  }

  return { error: null }
}

