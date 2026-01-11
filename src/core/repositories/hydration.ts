/**
 * Data Hydration Utilities
 *
 * When data is loaded from localStorage or external JSON sources,
 * Date objects become ISO strings. This module provides functions
 * to "hydrate" the data by converting known date fields back to Date objects.
 *
 * @see src/types/tournament.ts - Match.scheduledTime is typed as Date
 * @see src/core/models/schemas/TournamentSchema.ts - Acknowledges this issue
 */

import type { Tournament, Match } from '../models/types';

/**
 * Hydrates a single Match object by converting date strings to Date objects.
 *
 * Fields converted:
 * - scheduledTime: string -> Date (if present)
 */
export function hydrateMatch(raw: unknown): Match {
  const match = raw as Record<string, unknown>;

  // Convert scheduledTime from string to Date if present
  if (match.scheduledTime && typeof match.scheduledTime === 'string') {
    return {
      ...match,
      scheduledTime: new Date(match.scheduledTime),
    } as unknown as Match;
  }

  // Already a Date or undefined - return as-is
  return match as unknown as Match;
}

/**
 * Hydrates a Tournament object by converting all date strings to Date objects.
 *
 * This should be called whenever loading data from:
 * - localStorage (JSON.parse returns strings for dates)
 * - External JSON imports
 *
 * Fields converted in matches:
 * - scheduledTime: string -> Date
 *
 * Note: createdAt/updatedAt are intentionally kept as ISO strings
 * as they are typed that way in the Tournament interface.
 */
export function hydrateTournament(raw: unknown): Tournament {
  const tournament = raw as Record<string, unknown>;

  // Hydrate all matches
  const rawMatches = tournament.matches as unknown[] | undefined;
  const hydratedMatches = rawMatches?.map(hydrateMatch) ?? [];

  return {
    ...tournament,
    matches: hydratedMatches,
  } as Tournament;
}

/**
 * Hydrates an array of Tournament objects.
 */
export function hydrateTournaments(raw: unknown[]): Tournament[] {
  return raw.map(hydrateTournament);
}
