import { NextRequest, NextResponse } from "next/server"
import { getOrCreateIndex, indexVideo } from "@/lib/twelvelabs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, videoUrl, videoName, mediaId } = body

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      )
    }

    if (!videoUrl) {
      return NextResponse.json(
        { error: "videoUrl is required" },
        { status: 400 }
      )
    }

    // Check if TWELVELABS_API_KEY is configured
    if (!process.env.TWELVELABS_API_KEY) {
      return NextResponse.json(
        { error: "TwelveLabs API key is not configured" },
        { status: 500 }
      )
    }

    // Get or create index for this project
    const index = await getOrCreateIndex(projectId)

    // Index the video
    const asset = await indexVideo(index.id, videoUrl, videoName)

    return NextResponse.json({
      success: true,
      mediaId,
      indexId: index.id,
      videoId: asset.id,
      status: asset.status,
    })
  } catch (error: unknown) {
    console.error("TwelveLabs index error:", error)
    
    // Extract error message from various error formats
    let errorMessage = "Failed to index video"
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (error && typeof error === "object") {
      // TwelveLabs SDK errors may have different structures
      const err = error as Record<string, unknown>
      if (err.message && typeof err.message === "string") {
        errorMessage = err.message
      } else if (err.detail && typeof err.detail === "string") {
        errorMessage = err.detail
      } else if (err.error && typeof err.error === "string") {
        errorMessage = err.error
      } else {
        // Log full error for debugging
        errorMessage = JSON.stringify(error)
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
