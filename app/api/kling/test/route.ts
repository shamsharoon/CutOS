import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"

export const dynamic = "force-dynamic"

/**
 * Test endpoint to verify Kling API credentials
 */
export async function GET() {
  try {
    console.log("🔑 Testing Kling API credentials...")

    // Check if environment variables are set
    const accessKey = process.env.KLING_ACCESS_KEY
    const secretKey = process.env.KLING_SECRET_KEY

    if (!accessKey || !secretKey) {
      return NextResponse.json(
        {
          success: false,
          error: "KLING_ACCESS_KEY and KLING_SECRET_KEY must be set in environment variables",
          details: {
            hasAccessKey: !!accessKey,
            hasSecretKey: !!secretKey,
          },
        },
        { status: 400 }
      )
    }

    console.log("✓ Environment variables found")
    console.log("  Access Key (first 10 chars):", accessKey.substring(0, 10) + "...")
    console.log("  Secret Key (first 10 chars):", secretKey.substring(0, 10) + "...")

    // Generate JWT token
    const payload = {
      iss: accessKey,
      exp: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
      nbf: Math.floor(Date.now() / 1000) - 5, // 5 seconds ago
    }

    let token: string
    try {
      token = jwt.sign(payload, secretKey, {
        algorithm: "HS256",
        header: {
          alg: "HS256",
          typ: "JWT",
        },
      })
      console.log("✓ JWT token generated successfully")
      console.log("  Token (first 30 chars):", token.substring(0, 30) + "...")
    } catch (jwtError) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to generate JWT token",
          details: jwtError instanceof Error ? jwtError.message : String(jwtError),
        },
        { status: 500 }
      )
    }

    // Test the token with a simple API call (list models or similar)
    // Using the image2video endpoint to verify authentication
    const testUrl = "https://api-singapore.klingai.com/v1/videos/image2video"

    console.log("🌐 Testing API call to:", testUrl)

    // We'll make a request that should fail validation (missing required fields)
    // but if auth works, we'll get a specific validation error, not an auth error
    const response = await fetch(testUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Intentionally incomplete to test auth, not create a video
        model_name: "kling-v2-1",
      }),
    })

    const responseText = await response.text()
    console.log("📡 API Response Status:", response.status)
    console.log("📡 API Response:", responseText)

    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { rawResponse: responseText }
    }

    // Check response
    if (response.status === 401 || response.status === 403) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication failed - Invalid API keys",
          details: {
            status: response.status,
            statusText: response.statusText,
            response: responseData,
          },
        },
        { status: 401 }
      )
    }

    // If we get a 400 (validation error) or 200, auth is working
    if (response.status === 400 || response.status === 200 || response.ok) {
      console.log("✅ Authentication successful! Keys are valid.")
      return NextResponse.json({
        success: true,
        message: "Kling API credentials are valid and working!",
        details: {
          status: response.status,
          authenticationWorking: true,
          note: "Received validation error as expected (missing required fields for video generation)",
          response: responseData,
        },
      })
    }

    // Some other error
    return NextResponse.json(
      {
        success: false,
        error: `Unexpected response from Kling API (${response.status})`,
        details: {
          status: response.status,
          statusText: response.statusText,
          response: responseData,
        },
      },
      { status: 500 }
    )
  } catch (error) {
    console.error("❌ Test failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Test failed with exception",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
