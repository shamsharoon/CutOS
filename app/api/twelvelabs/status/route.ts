import { NextRequest, NextResponse } from "next/server"
import { getAssetStatus } from "@/lib/twelvelabs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { indexId, videoId } = body

    if (!indexId) {
      return NextResponse.json(
        { error: "indexId is required" },
        { status: 400 }
      )
    }

    if (!videoId) {
      return NextResponse.json(
        { error: "videoId is required" },
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

    // Get the status of the video
    const asset = await getAssetStatus(indexId, videoId)

    return NextResponse.json({
      success: true,
      videoId: asset.id,
      status: asset.status,
    })
  } catch (error) {
    console.error("TwelveLabs status error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get video status" },
      { status: 500 }
    )
  }
}
