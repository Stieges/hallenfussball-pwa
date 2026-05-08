import { z } from 'zod';
import { TeamTrainerSchema, TournamentGroupSchema, TournamentFieldSchema, RuntimeMatchEventSchema } from './CommonSchemas';

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
    trainers: z.array(TeamTrainerSchema).optional(),
});

export const MatchSchema = z.object({
    id: z.string(),
    round: z.number(),
    field: z.number(),
    slot: z.number().optional(),
    teamA: z.string(),
    teamB: z.string(),
    scoreA: z.number().min(0).optional(),
    scoreB: z.number().min(0).optional(),
    group: z.string().optional(),
    isFinal: z.boolean().optional(),
    finalType: z.string().optional(),
    label: z.string().optional(),
    scheduledTime: z.preprocess(
      (arg) => {
        if (arg instanceof Date) {
          return arg;
        }
        if (typeof arg === 'string' && arg.length > 0) {
          return new Date(arg);
        }
        return arg;
      },
      z.date().optional()
    ),
    referee: z.number().optional(),
    matchStatus: z.string().optional(), // 'scheduled' | ...
    finishedAt: z.string().optional(),
    timerStartTime: z.string().optional(),
    timerPausedAt: z.string().optional(),
    timerElapsedSeconds: z.number().optional(),
    overtimeScoreA: z.number().min(0).optional(),
    overtimeScoreB: z.number().min(0).optional(),
    penaltyScoreA: z.number().min(0).optional(),
    penaltyScoreB: z.number().min(0).optional(),
    decidedBy: z.string().optional(),
    skippedReason: z.string().optional(),
    skippedAt: z.string().optional(),
    events: z.array(RuntimeMatchEventSchema).optional(),
});

// scheduledTime uses z.preprocess to handle both Date objects and ISO strings from JSON/localStorage

export const TournamentSchema = z.object({
    id: z.string(),
    title: z.string(),
    status: z.enum(['draft', 'published', 'finished', 'archived', 'cancelled']).optional().default('draft'),

    // Data
    teams: z.array(TeamSchema),
    matches: z.array(MatchSchema),
    groups: z.array(TournamentGroupSchema).optional(),
    fields: z.array(TournamentFieldSchema).optional(),

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

    // Multi-User / Cloud Sync
    ownerId: z.string().optional(),
    version: z.number().optional(),
    isPublic: z.boolean().optional(),
    shareCode: z.string().optional(),
    shareCodeCreatedAt: z.string().optional(),
})
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- passthrough needed to prevent data loss of unmapped fields
  .passthrough();
