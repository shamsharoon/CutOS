import { NextRequest, NextResponse } from "next/server"
import { searchVideos, getOrCreateIndex } from "@/lib/twelvelabs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, query, videoIds, pageLimit } = body

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      )
    }

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "query is required" },
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

    // Get the index for this project
    const index = await getOrCreateIndex(projectId)

    // Search videos
    const results = await searchVideos(index.id, query.trim(), {
      videoIds: videoIds?.length > 0 ? videoIds : undefined,
      pageLimit: pageLimit ?? 20,
    })

    return NextResponse.json({
      success: true,
      results,
      query: query.trim(),
    })
  } catch (error) {
    console.error("TwelveLabs search error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to search videos" },
      { status: 500 }
    )
  }
}
