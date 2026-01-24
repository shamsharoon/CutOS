import { createClient } from "@/lib/supabase/client"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  toolCalls?: {
    id: string
    name: string
    description: string
    status: "running" | "success" | "error"
  }[]
}

export interface ChatSession {
  id: string
  project_id: string
  user_id: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}

// Get chat session for a project (creates one if doesn't exist)
export async function getChatSession(projectId: string): Promise<{ data: ChatSession | null; error: Error | null }> {
  const supabase = createClient()

  const { data: user } = await supabase.auth.getUser()
  if (!user.user) {
    return { data: null, error: new Error("Not authenticated") }
  }

  // Try to get existing session
  const { data: session, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.user.id)
    .single()

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned, which is fine
    return { data: null, error: new Error(error.message) }
  }

  if (session) {
    return { data: session, error: null }
  }

  // Create new session if doesn't exist
  const { data: newSession, error: createError } = await supabase
    .from("chat_sessions")
    .insert({
      project_id: projectId,
      user_id: user.user.id,
      messages: [],
    })
    .select()
    .single()

  if (createError) {
    return { data: null, error: new Error(createError.message) }
  }

  return { data: newSession, error: null }
}

// Save messages to chat session
export async function saveChatMessages(
  projectId: string,
  messages: ChatMessage[]
): Promise<{ error: Error | null }> {
  const supabase = createClient()

  const { data: user } = await supabase.auth.getUser()
  if (!user.user) {
    return { error: new Error("Not authenticated") }
  }

  // Upsert - update if exists, insert if not
  const { error } = await supabase
    .from("chat_sessions")
    .upsert(
      {
        project_id: projectId,
        user_id: user.user.id,
        messages,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "project_id,user_id",
      }
    )

  if (error) {
    return { error: new Error(error.message) }
  }

  return { error: null }
}

// Clear chat session (start new chat)
export async function clearChatSession(projectId: string): Promise<{ error: Error | null }> {
  const supabase = createClient()

  const { data: user } = await supabase.auth.getUser()
  if (!user.user) {
    return { error: new Error("Not authenticated") }
  }

  const { error } = await supabase
    .from("chat_sessions")
    .update({
      messages: [],
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", projectId)
    .eq("user_id", user.user.id)

  if (error) {
    return { error: new Error(error.message) }
  }

  return { error: null }
}

// Delete chat session entirely (when project is deleted)
export async function deleteChatSession(projectId: string): Promise<{ error: Error | null }> {
  const supabase = createClient()

  const { data: user } = await supabase.auth.getUser()
  if (!user.user) {
    return { error: new Error("Not authenticated") }
  }

  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", user.user.id)

  if (error) {
    return { error: new Error(error.message) }
  }

  return { error: null }
}
