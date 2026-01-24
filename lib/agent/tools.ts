import { tool } from "ai"
import { z } from "zod"

// Action types returned by tools - client interprets these
export type AgentAction =
  | { action: "SPLIT_CLIP"; payload: { clipId: string; splitTimeSeconds: number } }
  | { action: "SPLIT_AT_TIME"; payload: { timeSeconds: number; trackId?: string } }
  | { action: "TRIM_CLIP"; payload: { clipId: string; trimStartSeconds?: number; trimEndSeconds?: number } }
  | { action: "DELETE_CLIP"; payload: { clipId: string } }
  | { action: "DELETE_AT_TIME"; payload: { timeSeconds: number; trackId?: string } }
  | { action: "DELETE_ALL_CLIPS"; payload: { trackId?: string } }
  | { action: "MOVE_CLIP"; payload: { clipId: string; newStartTimeSeconds?: number; newTrackId?: string } }
  | { action: "APPLY_EFFECT"; payload: { clipId: string; effect: string } }
  | { action: "APPLY_CHROMAKEY"; payload: { clipId: string; enabled: boolean; keyColor?: string; similarity?: number; smoothness?: number; spill?: number } }
  | { action: "ADD_MEDIA_TO_TIMELINE"; payload: { mediaId: string; trackId: string; startTimeSeconds?: number } }

// Define the input schemas
const splitClipInput = z.object({
  clipId: z.string().describe("The ID of the clip to split"),
  splitTimeSeconds: z
    .number()
    .describe("The timeline position (in seconds) where to split the clip"),
})

const splitAtTimeInput = z.object({
  timeSeconds: z
    .number()
    .describe("The timeline position (in seconds) where to split. The clip at this position will be automatically found and split."),
  trackId: z
    .string()
    .optional()
    .describe("Optional track ID to specify which track (V1, V2, A1, A2). If not provided, splits clips on all tracks at that time."),
})

const trimClipInput = z.object({
  clipId: z.string().describe("The ID of the clip to trim"),
  trimStartSeconds: z
    .number()
    .optional()
    .describe("Seconds to trim (remove) from the start of the clip"),
  trimEndSeconds: z
    .number()
    .optional()
    .describe("Seconds to trim (remove) from the end of the clip"),
})

const deleteClipInput = z.object({
  clipId: z.string().describe("The ID of the clip to delete"),
})

const deleteAtTimeInput = z.object({
  timeSeconds: z
    .number()
    .describe("The timeline position (in seconds). The clip at this position will be deleted."),
  trackId: z
    .string()
    .optional()
    .describe("Optional track ID (V1, V2, A1, A2). If not provided, deletes clips on all tracks at that time."),
})

const deleteAllClipsInput = z.object({
  trackId: z
    .string()
    .optional()
    .describe("Optional track ID (V1, V2, A1, A2). If provided, only deletes clips on that track. If not provided, deletes ALL clips from the timeline."),
})

const moveClipInput = z.object({
  clipId: z.string().describe("The ID of the clip to move"),
  newStartTimeSeconds: z
    .number()
    .optional()
    .describe("New start position on the timeline in seconds"),
  newTrackId: z
    .string()
    .optional()
    .describe("ID of the track to move to (V1, V2, A1, or A2)"),
})

const applyEffectInput = z.object({
  clipId: z.string().describe("The ID of the clip to apply the effect to"),
  effect: z
    .enum(["none", "grayscale", "sepia", "invert", "cyberpunk", "noir", "vhs", "glitch", "ascii"])
    .describe("The effect preset to apply"),
})

const applyChromakeyInput = z.object({
  clipId: z.string().describe("The ID of the clip to apply green screen removal to"),
  enabled: z.boolean().describe("Whether to enable or disable chromakey (green screen removal)"),
  keyColor: z
    .string()
    .optional()
    .describe("Hex color to remove (e.g., '#00FF00' for green, '#0000FF' for blue). Defaults to green (#00FF00) if not specified."),
  similarity: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("How close colors must be to the key color to be removed (0-1). Higher values remove more colors. Defaults to 0.4."),
  smoothness: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Edge softness (0-1). Higher values create softer edges. Defaults to 0.1."),
  spill: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Spill suppression strength (0-1). Removes color bleed from edges. Defaults to 0.3."),
})

const addMediaToTimelineInput = z.object({
  mediaId: z.string().describe("The ID of the media file to add from the media pool"),
  trackId: z.string().describe("The track to add to (V1, V2 for video; A1, A2 for audio)"),
  startTimeSeconds: z
    .number()
    .optional()
    .describe("Where to place it on the timeline in seconds (defaults to end of track)"),
})

export const videoEditingTools = {
  // Tool: Split a clip at a specific time (requires clip ID)
  splitClip: tool({
    description:
      "Split a specific clip into two parts at a timeline position. Use this when you know the exact clip ID to split.",
    inputSchema: splitClipInput,
    execute: async (input: z.infer<typeof splitClipInput>) => {
      return {
        action: "SPLIT_CLIP" as const,
        payload: { clipId: input.clipId, splitTimeSeconds: input.splitTimeSeconds },
      }
    },
  }),

  // Tool: Split at a timeline position (automatically finds the clip)
  splitAtTime: tool({
    description:
      "Split at a specific timeline position. Automatically finds which clip exists at that time and splits it. Use this when the user says 'split at X seconds' or 'split at the playhead' without specifying a clip.",
    inputSchema: splitAtTimeInput,
    execute: async (input: z.infer<typeof splitAtTimeInput>) => {
      return {
        action: "SPLIT_AT_TIME" as const,
        payload: { timeSeconds: input.timeSeconds, trackId: input.trackId },
      }
    },
  }),

  // Tool: Trim clip start or end
  trimClip: tool({
    description:
      "Trim the start or end of a clip to remove unwanted parts. Specify how many seconds to remove from the beginning and/or end.",
    inputSchema: trimClipInput,
    execute: async (input: z.infer<typeof trimClipInput>) => {
      return {
        action: "TRIM_CLIP" as const,
        payload: { clipId: input.clipId, trimStartSeconds: input.trimStartSeconds, trimEndSeconds: input.trimEndSeconds },
      }
    },
  }),

  // Tool: Delete a clip by ID
  deleteClip: tool({
    description:
      "Remove a specific clip from the timeline by its ID. Use this when you know the exact clip ID to delete.",
    inputSchema: deleteClipInput,
    execute: async (input: z.infer<typeof deleteClipInput>) => {
      return {
        action: "DELETE_CLIP" as const,
        payload: { clipId: input.clipId },
      }
    },
  }),

  // Tool: Delete at a timeline position (automatically finds the clip)
  deleteAtTime: tool({
    description:
      "Delete the clip at a specific timeline position. Automatically finds which clip exists at that time and removes it. Use this when the user says 'delete at X seconds' or 'delete at the playhead' without specifying a clip.",
    inputSchema: deleteAtTimeInput,
    execute: async (input: z.infer<typeof deleteAtTimeInput>) => {
      return {
        action: "DELETE_AT_TIME" as const,
        payload: { timeSeconds: input.timeSeconds, trackId: input.trackId },
      }
    },
  }),

  // Tool: Delete all clips
  deleteAllClips: tool({
    description:
      "Delete all clips from the timeline. Use this when the user says 'delete all clips', 'clear the timeline', 'remove everything', or 'start fresh'. Can optionally delete only clips on a specific track.",
    inputSchema: deleteAllClipsInput,
    execute: async (input: z.infer<typeof deleteAllClipsInput>) => {
      return {
        action: "DELETE_ALL_CLIPS" as const,
        payload: { trackId: input.trackId },
      }
    },
  }),

  // Tool: Move a clip
  moveClip: tool({
    description:
      "Move a clip to a new position on the timeline or to a different track. Use this to reposition clips.",
    inputSchema: moveClipInput,
    execute: async (input: z.infer<typeof moveClipInput>) => {
      return {
        action: "MOVE_CLIP" as const,
        payload: { clipId: input.clipId, newStartTimeSeconds: input.newStartTimeSeconds, newTrackId: input.newTrackId },
      }
    },
  }),

  // Tool: Apply effect to clip
  applyEffect: tool({
    description:
      "Apply a visual effect preset to a clip. Available effects: grayscale, sepia, invert, cyberpunk, noir, vhs, glitch, ascii, or none to remove effects.",
    inputSchema: applyEffectInput,
    execute: async (input: z.infer<typeof applyEffectInput>) => {
      return {
        action: "APPLY_EFFECT" as const,
        payload: { clipId: input.clipId, effect: input.effect },
      }
    },
  }),

  // Tool: Apply chromakey (green screen removal)
  applyChromakey: tool({
    description:
      "Remove green screen (or any color) from a video clip, making it transparent. IMPORTANT: Before using this tool, you MUST verify and confirm which clip you're applying chromakey to by stating the clip's name/label and ID. Use this when the user wants to remove a green screen, blue screen, or any colored background from a video. You can enable/disable it, and optionally adjust the color to remove, similarity threshold, edge smoothness, and spill suppression. Always confirm the clip details before applying.",
    inputSchema: applyChromakeyInput,
    execute: async (input: z.infer<typeof applyChromakeyInput>) => {
      return {
        action: "APPLY_CHROMAKEY" as const,
        payload: {
          clipId: input.clipId,
          enabled: input.enabled,
          keyColor: input.keyColor,
          similarity: input.similarity,
          smoothness: input.smoothness,
          spill: input.spill,
        },
      }
    },
  }),

  // Tool: Add media to timeline
  addMediaToTimeline: tool({
    description:
      "Add a media file from the media pool to the timeline. Specify which track and optionally where to place it.",
    inputSchema: addMediaToTimelineInput,
    execute: async (input: z.infer<typeof addMediaToTimelineInput>) => {
      return {
        action: "ADD_MEDIA_TO_TIMELINE" as const,
        payload: { mediaId: input.mediaId, trackId: input.trackId, startTimeSeconds: input.startTimeSeconds },
      }
    },
  }),
}
