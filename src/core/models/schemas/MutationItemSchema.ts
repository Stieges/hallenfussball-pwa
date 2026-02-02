import { z } from 'zod';

export const MutationItemSchema = z.object({
  id: z.string(),
  type: z.enum([
    'SAVE_TOURNAMENT',
    'DELETE_TOURNAMENT',
    'UPDATE_MATCH',
    'UPDATE_MATCHES',
    'UPDATE_TOURNAMENT_METADATA',
  ]),
  payload: z.unknown(),
  timestamp: z.number(),
  retryCount: z.number(),
});

export const FailedMutationItemSchema = MutationItemSchema.extend({
  failedAt: z.number(),
  lastError: z.string().optional(),
});
