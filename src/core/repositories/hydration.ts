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
import { completeMatchCockpitSettings } from '../../types/tournament';
import { ensureMatchNumbers } from '../models/matchNumbers';
import { effectivePlacementLogic } from '../standings/placementDefaults';
import { parsePlacementsToPlayOut } from '../standings/playOutPlaces';

/**
 * Hydrates a single Match object by converting date strings to Date objects.
 *
 * Fields converted:
 * - scheduledTime: string -> Date (if present)
 */
export function hydrateMatch(raw: unknown): Match {
  const match = raw as Record<string, unknown>;

  // Convert scheduledTime (and B-26 originalStart) from string to Date if present
  const scheduledText = typeof match.scheduledTime === 'string' && match.scheduledTime !== '' ? match.scheduledTime : undefined;
  const originalText = typeof match.originalStart === 'string' && match.originalStart !== '' ? match.originalStart : undefined;
  if (scheduledText !== undefined || originalText !== undefined) {
    return {
      ...match,
      ...(scheduledText === undefined ? {} : { scheduledTime: new Date(scheduledText) }),
      ...(originalText === undefined ? {} : { originalStart: new Date(originalText) }),
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
  // C-SPIELNUMMER-FEHLT: lokal ohne Spielnummer gespeicherte Spiele (vor dem Fix veröffentlicht) bekommen sie nach
  // der Rückfallregel – dieselbe Zählung wie beim Lesen aus der Cloud.
  const hydratedMatches = ensureMatchNumbers(rawMatches?.map(hydrateMatch) ?? []);

  // Spielregeln „Spiel leiten“: fehlende Felder alter Konfigurationen bekommen die Vorgaben
  // (lokal gespeicherte, Gast- und per JSON wiederhergestellte Turniere; der Cloud-Pfad
  // ergänzt im Mapper).
  return {
    ...tournament,
    matches: hydratedMatches,
    matchCockpitSettings: completeMatchCockpitSettings(tournament.matchCockpitSettings),
    // C-WERTUNG-LEER: fehlende oder leere Reihenfolge ⇒ Voreinstellung BFV privat (@W2A-046)
    placementLogic: effectivePlacementLogic(tournament.placementLogic as Tournament['placementLogic'] | undefined),
    // Paket TB-B (TB-3'): fehlende oder unbrauchbare Einstellung ⇒ nur Platz 1 (Daniel K10, @W2A-066)
    placementsToPlayOut: parsePlacementsToPlayOut(tournament.placementsToPlayOut),
  } as Tournament;
}

/**
 * Hydrates an array of Tournament objects.
 */
export function hydrateTournaments(raw: unknown[]): Tournament[] {
  return raw.map(hydrateTournament);
}
