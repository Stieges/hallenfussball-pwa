import { z } from 'zod';

const TeamLogoSchema = z.object({
    type: z.enum(['url', 'base64', 'initials']),
    value: z.string(),
    backgroundColor: z.string().optional(),
    uploadedAt: z.string().optional(),
    uploadedBy: z.enum(['organizer', 'trainer']).optional(),
});

const TeamColorsSchema = z.object({
    primary: z.string(),
    secondary: z.string().optional(),
});

export const TeamSchema = z.object({
    id: z.string(),
    name: z.string(),
    group: z.string().optional(),
    isRemoved: z.boolean().optional(),
    removedAt: z.string().optional(),
    logo: TeamLogoSchema.optional(),
    colors: TeamColorsSchema.optional(),
    trainers: z.array(z.any()).optional(),
});

export const MatchSchema = z.object({
    id: z.string(),
    round: z.number(),
    field: z.number(),
    slot: z.number().optional(),
    teamA: z.string(),
    teamB: z.string(),
    scoreA: z.number().optional(),
    scoreB: z.number().optional(),
    group: z.string().optional(),
    isFinal: z.boolean().optional(),
    finalType: z.string().optional(),
    label: z.string().optional(),
    scheduledTime: z.union([z.string(), z.date()]).optional(), // Date or string in JSON? JSON makes it string. Zod should handle transform?
    referee: z.number().optional(),
    matchStatus: z.string().optional(), // 'scheduled' | ...
    finishedAt: z.string().optional(),
    timerStartTime: z.string().optional(),
    timerPausedAt: z.string().optional(),
    timerElapsedSeconds: z.number().optional(),
    overtimeScoreA: z.number().optional(),
    overtimeScoreB: z.number().optional(),
    penaltyScoreA: z.number().optional(),
    penaltyScoreB: z.number().optional(),
    decidedBy: z.string().optional(),
    skippedReason: z.string().optional(),
    skippedAt: z.string().optional(),
    events: z.array(z.any()).optional(), // Persist match events (scorers, cards, etc.)
});

// Handling Date: JSON has strings. Our application assumes Date objects for some fields?
// `scheduledTime?: Date`.
// When loading from localStorage, it is a STRING.
// We should probably transform it to Date in the Repository if the app expects Date.
// Or schema handles string and we transform it.
// `z.preprocess((arg) => typeof arg === 'string' ? new Date(arg) : arg, z.date())`

export const TournamentSchema = z.object({
    id: z.string(),
    title: z.string(),
    status: z.enum(['draft', 'published', 'finished', 'archived', 'cancelled']).optional().default('draft'),

    // Data
    teams: z.array(TeamSchema),
    matches: z.array(MatchSchema),
    groups: z.array(z.any()).optional(),
    fields: z.array(z.any()).optional(),

    // Config
    sport: z.string(),
    sportId: z.string(),
    tournamentType: z.string(),
    mode: z.string(),

    // Stats/Meta
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().optional(),
    completedAt: z.string().optional(),
    cancelledAt: z.string().optional(),
    cancelledReason: z.string().optional(),
    lastVisitedStep: z.number().optional(),
})
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- passthrough needed to prevent data loss of unmapped fields
  .passthrough();
