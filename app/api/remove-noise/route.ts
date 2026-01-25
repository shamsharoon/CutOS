import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { mediaUrl, projectId, mediaName } = await request.json()
    console.log("Voice isolation request:", { mediaUrl, projectId, mediaName })

    if (!mediaUrl || !projectId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 })
    }
    console.log("✓ ElevenLabs API key found")

    // Download the media file
    console.log("Downloading media from:", mediaUrl)
    const mediaResponse = await fetch(mediaUrl)
    if (!mediaResponse.ok) {
      console.error("Failed to download media:", mediaResponse.status, mediaResponse.statusText)
      return NextResponse.json({ error: `Failed to download media: ${mediaResponse.statusText}` }, { status: 500 })
    }

    const mediaBlob = await mediaResponse.blob()
    console.log("✓ Media downloaded, size:", mediaBlob.size)

    // Send to ElevenLabs Audio Isolation API
    console.log("Sending to ElevenLabs Audio Isolation API...")
    const formData = new FormData()
    formData.append("audio", mediaBlob, "audio.mp4")

    const isolationResponse = await fetch("https://api.elevenlabs.io/v1/audio-isolation", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
      },
      body: formData,
    })

    if (!isolationResponse.ok) {
      const errorText = await isolationResponse.text()
      console.error("ElevenLabs isolation error:", isolationResponse.status, errorText)
      return NextResponse.json(
        { error: `ElevenLabs isolation failed (${isolationResponse.status}): ${errorText}` },
        { status: isolationResponse.status }
      )
    }

    // Get the isolated audio
    const isolatedBlob = await isolationResponse.blob()
    const isolatedAudioBuffer = Buffer.from(await isolatedBlob.arrayBuffer())
    console.log("✓ ElevenLabs isolation complete, isolated audio size:", isolatedAudioBuffer.length)

    // Merge isolated audio with original video using FFmpeg
    console.log("Merging isolated audio with original video...")
    const { execSync } = await import("child_process")
    const fs = await import("fs/promises")
    const path = await import("path")
    const os = await import("os")

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "voice-isolation-"))
    const inputVideoPath = path.join(tempDir, "input.mp4")
    const isolatedAudioPath = path.join(tempDir, "isolated.mp3")
    const outputVideoPath = path.join(tempDir, "output.mp4")

    try {
      // Save files to temp directory
      await fs.writeFile(inputVideoPath, Buffer.from(await mediaBlob.arrayBuffer()))
      await fs.writeFile(isolatedAudioPath, isolatedAudioBuffer)

      // Use FFmpeg to merge video with isolated audio
      const ffmpegCommand = `ffmpeg -i "${inputVideoPath}" -i "${isolatedAudioPath}" -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 -shortest "${outputVideoPath}" -y`
      
      execSync(ffmpegCommand, { 
        maxBuffer: 100 * 1024 * 1024,
        stdio: 'pipe'
      })

      const outputBuffer = await fs.readFile(outputVideoPath)
      console.log("✓ Video merged with isolated audio, output size:", outputBuffer.length)

      // Clean up temp files
      await fs.rm(tempDir, { recursive: true, force: true })

      // Upload to Supabase Storage (use service role key for server-side operations)
      console.log("Uploading to Supabase Storage...")
      const { createClient } = await import("@supabase/supabase-js")
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase credentials:", { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!serviceRoleKey 
      })
      return NextResponse.json({ error: "Supabase credentials not configured" }, { status: 500 })
    }
    
    console.log("✓ Supabase credentials found")
    const supabase = createClient(supabaseUrl, serviceRoleKey)

      const fileName = `${projectId}/isolated-${Date.now()}.mp4`
      console.log("Uploading to Supabase:", fileName, "Size:", outputBuffer.length)
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("project-media")
        .upload(fileName, outputBuffer, {
        contentType: "video/mp4",
        upsert: false,
      })

    if (uploadError) {
      console.error("Supabase upload error:", uploadError)
      return NextResponse.json({ 
        error: `Failed to upload isolated media: ${uploadError.message || JSON.stringify(uploadError)}` 
      }, { status: 500 })
    }
    
    console.log("Upload successful:", uploadData.path)

    // Get public URL
    const { data: urlData } = supabase.storage.from("project-media").getPublicUrl(uploadData.path)
      console.log("✓ Upload complete, public URL:", urlData.publicUrl)

      return NextResponse.json({
        success: true,
        isolatedMediaUrl: urlData.publicUrl,
        isolatedMediaPath: uploadData.path,
      })
    } catch (ffmpegError) {
      console.error("FFmpeg merge error:", ffmpegError)
      // Clean up temp directory on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch {}
      throw ffmpegError
    }
  } catch (error) {
    console.error("Voice isolation error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const errorStack = error instanceof Error ? error.stack : ""
    console.error("Error stack:", errorStack)
    return NextResponse.json(
      { error: `Voice isolation failed: ${errorMessage}` },
      { status: 500 }
    )
  }
}
