import { TwelveLabs } from "twelvelabs-js"

// Singleton client instance
let client: TwelveLabs | null = null

export function getTwelveLabsClient(): TwelveLabs {
  if (!client) {
    const apiKey = process.env.TWELVELABS_API_KEY
    if (!apiKey) {
      throw new Error("TWELVELABS_API_KEY environment variable is not set")
    }
    client = new TwelveLabs({ apiKey })
  }
  return client
}

// Index configuration
const INDEX_MODEL = "marengo3.0"
const INDEX_MODEL_OPTIONS: ("visual" | "audio")[] = ["visual", "audio"]

export interface TwelveLabsIndex {
  id: string
  name: string
}

export interface TwelveLabsAsset {
  id: string
  status: "pending" | "indexing" | "ready" | "failed"
}

export interface SearchResult {
  videoId: string
  start: number
  end: number
  rank: number
  confidence?: string
}

// Create or get an index for a project
export async function getOrCreateIndex(projectId: string): Promise<TwelveLabsIndex> {
  const client = getTwelveLabsClient()
  const indexName = `cutos-project-${projectId}`

  // Try to find existing index
  const indexes = await client.indexes.list()
  for await (const index of indexes) {
    if (index.indexName === indexName) {
      return { id: index.id ?? "", name: index.indexName ?? "" }
    }
  }

  // Create new index if not found
  const newIndex = await client.indexes.create({
    indexName,
    models: [
      {
        modelName: INDEX_MODEL,
        modelOptions: INDEX_MODEL_OPTIONS,
      },
    ],
  })

  if (!newIndex.id) {
    throw new Error("Failed to create index")
  }

  return { id: newIndex.id, name: indexName }
}

// Upload and index a video
export async function indexVideo(
  indexId: string,
  videoUrl: string,
  videoName?: string
): Promise<TwelveLabsAsset> {
  const client = getTwelveLabsClient()

  try {
    // First, create an asset
    const asset = await client.assets.create({
      method: "url",
      url: videoUrl,
      filename: videoName,
    })

    if (!asset.id) {
      throw new Error("Failed to create asset - no ID returned")
    }

    // Then, create an indexed asset to start indexing
    const indexedAsset = await client.indexes.indexedAssets.create(indexId, {
      assetId: asset.id,
    })

    if (!indexedAsset.id) {
      throw new Error("Failed to create indexed asset - no ID returned")
    }

    return {
      id: indexedAsset.id,
      status: "indexing",
    }
  } catch (error: unknown) {
    // Re-throw with more context
    const errObj = error as Record<string, unknown>
    const detail = errObj?.detail || errObj?.message || errObj?.error || "Unknown error"
    throw new Error(`Failed to index video "${videoName}": ${detail}`)
  }
}

// Check the status of an indexed asset
export async function getAssetStatus(
  indexId: string,
  assetId: string
): Promise<TwelveLabsAsset> {
  const client = getTwelveLabsClient()

  const asset = await client.indexes.indexedAssets.retrieve(indexId, assetId)

  let status: TwelveLabsAsset["status"] = "pending"
  if (asset.status === "ready") {
    status = "ready"
  } else if (asset.status === "failed") {
    status = "failed"
  } else if (asset.status === "indexing" || asset.status === "pending" || asset.status === "queued") {
    status = "indexing"
  }

  return {
    id: assetId,
    status,
  }
}

// Search videos in an index
export async function searchVideos(
  indexId: string,
  query: string,
  options?: {
    videoIds?: string[]
    pageLimit?: number
  }
): Promise<SearchResult[]> {
  const client = getTwelveLabsClient()

  const searchRequest: Parameters<typeof client.search.query>[0] = {
    indexId,
    queryText: query,
    searchOptions: ["visual", "audio"],
    pageLimit: options?.pageLimit ?? 10,
  }

  // Filter by specific videos if provided
  if (options?.videoIds && options.videoIds.length > 0) {
    searchRequest.filter = JSON.stringify({
      id: options.videoIds,
    })
  }

  const results = await client.search.query(searchRequest)

  const searchResults: SearchResult[] = []
  for await (const clip of results) {
    searchResults.push({
      videoId: clip.videoId ?? "",
      start: clip.start ?? 0,
      end: clip.end ?? 0,
      rank: clip.rank ?? 0,
      confidence: clip.confidence,
    })
  }

  return searchResults
}

// Delete an index
export async function deleteIndex(indexId: string): Promise<void> {
  const client = getTwelveLabsClient()
  await client.indexes.delete(indexId)
}

// Delete a video from an index
export async function deleteVideo(indexId: string, videoId: string): Promise<void> {
  const client = getTwelveLabsClient()
  await client.indexes.indexedAssets.delete(indexId, videoId)
}
