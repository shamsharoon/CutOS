import { tool } from "ai"
import { z } from "zod"

// Action types returned by tools - client interprets these
export type AgentAction =
  | { action: "SPLIT_CLIP"; payload: { clipId: string; splitTimeSeconds: number } }
  | { action: "TRIM_CLIP"; payload: { clipId: string; trimStartSeconds?: number; trimEndSeconds?: number } }
  | { action: "DELETE_CLIP"; payload: { clipId: string } }
  | { action: "MOVE_CLIP"; payload: { clipId: string; newStartTimeSeconds?: number; newTrackId?: string } }
  | { action: "APPLY_EFFECT"; payload: { clipId: string; effect: string } }
  | { action: "ADD_MEDIA_TO_TIMELINE"; payload: { mediaId: string; trackId: string; startTimeSeconds?: number } }

// Define the input schemas
const splitClipInput = z.object({
  clipId: z.string().describe("The ID of the clip to split"),
  splitTimeSeconds: z
    .number()
    .describe("The timeline position (in seconds) where to split the clip"),
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

const addMediaToTimelineInput = z.object({
  mediaId: z.string().describe("The ID of the media file to add from the media pool"),
  trackId: z.string().describe("The track to add to (V1, V2 for video; A1, A2 for audio)"),
  startTimeSeconds: z
    .number()
    .optional()
    .describe("Where to place it on the timeline in seconds (defaults to end of track)"),
})

export const videoEditingTools = {
  // Tool: Split a clip at a specific time
  splitClip: tool({
    description:
      "Split a clip into two parts at a specific timeline position. Use this when the user wants to cut, split, or divide a clip at a particular time.",
    inputSchema: splitClipInput,
    execute: async (input: z.infer<typeof splitClipInput>) => {
      return {
        action: "SPLIT_CLIP" as const,
        payload: { clipId: input.clipId, splitTimeSeconds: input.splitTimeSeconds },
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

  // Tool: Delete a clip
  deleteClip: tool({
    description:
      "Remove a clip from the timeline entirely. Use this when the user wants to delete, remove, or get rid of a clip.",
    inputSchema: deleteClipInput,
    execute: async (input: z.infer<typeof deleteClipInput>) => {
      return {
        action: "DELETE_CLIP" as const,
        payload: { clipId: input.clipId },
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
