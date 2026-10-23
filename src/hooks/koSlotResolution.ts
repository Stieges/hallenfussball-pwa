/**
 * koSlotResolution (A-08f3e2, H-2): K.-o.-Auflösung nach einem Ergebnis als reine Funktionen -- nur Slots,
 * nie ein Spielstand (die Cloud übernimmt Seiten nur aus den Slots, A-02/A-03). Die Resolver besetzen nur offene
 * Seiten und sind damit wiederholbar (ein zweiter Lauf liefert nichts).
 */
import type { Tournament } from '../types/tournament';
import type { MatchUpdate } from '../core/models/types';
import { applyEngineOverlay, engineOverlayFields, type MatchEngineView } from '../core/match/client';
import { resolveBracketAfterPlayoffMatch } from '../core/generators';
import type { ValidMatchEntry } from './engineMatchModel';

/** Turnier mit der aktuellen Engine-Ansicht EINES Spiels überlagert (React hat evtl. noch nicht neu gerendert). */
export function withEngineResult(tournament: Tournament, entry: ValidMatchEntry, view: MatchEngineView | null): Tournament {
  if (!view) {
    return tournament;
  }
  return applyEngineOverlay(tournament, new Map([[entry.externalId, engineOverlayFields(view, entry.ctx)]]));
}

/**
 * Slot-Updates der K.-o.-Auflösung nach einem Ergebnis; der Resolver schreibt `tournament.matches` neu -- deshalb flache Kopie.
 * GA4 A-13c: Gruppenplätze besetzt ausschließlich „Gruppe abschließen“ (@TM-044: das letzte Gruppenspiel besetzt nichts, @TM-016);
 * hier entstehen nur Slot-Updates mit Herkunft aus einem Spiel (Sieger/Verlierer), nie aus einer Gruppe. Das gilt auch für
 * den Offline-Pfad (`useResultEntryAck`).
 */
export function slotUpdatesAfterResult(tournament: Tournament): MatchUpdate[] {
  const working: Tournament = { ...tournament };
  const ids = new Set<string>();
  const bracket = resolveBracketAfterPlayoffMatch(working);
  if (bracket?.wasResolved) {
    bracket.updatedMatchIds.forEach((id) => ids.add(id));
  }
  return [...ids].flatMap((id) => {
    const resolved = working.matches.find((m) => m.id === id);
    return resolved ? [{ id, slotA: resolved.slotA, slotB: resolved.slotB }] : [];
  });
}

/** Übernimmt Slot-Updates in ein Turnier (lokaler Stand nach dem Speichern). */
export function applySlotUpdates(tournament: Tournament, updates: readonly MatchUpdate[]): Tournament {
  const byId = new Map(updates.map((update) => [update.id, update]));
  return {
    ...tournament,
    matches: tournament.matches.map((match) => {
      const update = byId.get(match.id);
      return update?.slotA && update.slotB ? { ...match, slotA: update.slotA, slotB: update.slotB } : match;
    }),
  };
}
