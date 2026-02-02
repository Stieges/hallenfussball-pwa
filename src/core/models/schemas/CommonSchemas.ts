import { z } from 'zod';

// =============================================================================
// Team Trainer Schema
// =============================================================================

export const TeamTrainerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  inviteStatus: z.enum(['pending', 'sent', 'accepted']),
  inviteToken: z.string().optional(),
  inviteSentAt: z.string().optional(),
  acceptedAt: z.string().optional(),
  createdAt: z.string(),
})
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- passthrough for forward-compatibility
  .passthrough();

// =============================================================================
// Tournament Group Schema
// =============================================================================

export const TournamentGroupSchema = z.object({
  id: z.string(),
  customName: z.string().optional(),
  shortCode: z.string().optional(),
  allowedFieldIds: z.array(z.string()).optional(),
})
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- passthrough for forward-compatibility
  .passthrough();

// =============================================================================
// Tournament Field Schema
// =============================================================================

export const TournamentFieldSchema = z.object({
  id: z.string(),
  defaultName: z.string(),
  customName: z.string().optional(),
  shortCode: z.string().optional(),
})
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- passthrough for forward-compatibility
  .passthrough();

// =============================================================================
// Runtime Match Event Schema
// =============================================================================

const RuntimeMatchEventPayloadSchema = z.object({
  teamId: z.string().optional(),
  teamName: z.string().optional(),
  direction: z.enum(['INC', 'DEC']).optional(),
  newHomeScore: z.number().optional(),
  newAwayScore: z.number().optional(),
  toStatus: z.enum(['NOT_STARTED', 'RUNNING', 'PAUSED', 'FINISHED']).optional(),
  playerNumber: z.number().optional(),
  assists: z.array(z.number()).optional(),
  penaltyDuration: z.number().optional(),
  playersOut: z.array(z.number()).optional(),
  playersIn: z.array(z.number()).optional(),
  cardType: z.enum(['YELLOW', 'RED']).optional(),
})
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- passthrough for forward-compatibility
  .passthrough();

export const RuntimeMatchEventSchema = z.object({
  id: z.string(),
  matchId: z.string().optional(),
  timestampSeconds: z.number(),
  type: z.enum(['GOAL', 'RESULT_EDIT', 'STATUS_CHANGE', 'YELLOW_CARD', 'RED_CARD', 'TIME_PENALTY', 'SUBSTITUTION', 'FOUL']),
  payload: RuntimeMatchEventPayloadSchema,
  scoreAfter: z.object({
    home: z.number(),
    away: z.number(),
  }),
  incomplete: z.boolean().optional(),
})
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- passthrough for forward-compatibility
  .passthrough();
