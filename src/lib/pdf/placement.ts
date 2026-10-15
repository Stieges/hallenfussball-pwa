/**
 * Zustand der Platzierung im Spielplan-PDF (B-28 C2, @DR-009, @DR-005). Rein, ohne Zeichnung.
 *
 * Zwei Zustände, keine Übergangsplatzierung im MVP: `open` (Satz und eine Schreiblinie je Team) und `final` (nach dem
 * Abschluss alle Plätze laut gespeichertem Endstand). Solange Abschluss und Endstand fehlen (bis A-19/A-21a), ist der
 * Zustand immer `open`; eine Rangfolge nach Punkten gibt es hier nie (C-RANK-FIN).
 */
import type { Team } from '../../types/tournament';

/** Ein Platz des gespeicherten Endstands (Record Endstand, @ET-011 bis @ET-013: alle Teams geordnet). */
export interface RankEntry {
  place: number;
  team: Team;
}

export type PlacementState = 'open' | 'final';

export interface PlacementInput {
  /** Fassung: `blank` (zum Ausfüllen) zeigt nie einen Endstand. */
  edition: 'plan' | 'blank';
  /** Gespeicherter Endstand in der Reihenfolge der Plätze. */
  ranking?: RankEntry[];
  /** Das Turnier ist abgeschlossen. */
  closed?: boolean;
  /** Zahl der Teams des Plans. */
  teamCount: number;
}

/** `final` nur im Abschluss mit vollständigem Endstand (ein Eintrag je Team) und nicht in der Fassung zum Ausfüllen. */
export function placementState({ edition, ranking, closed, teamCount }: PlacementInput): PlacementState {
  if (edition === 'blank' || closed !== true || ranking === undefined) {
    return 'open';
  }
  return ranking.length === teamCount ? 'final' : 'open';
}
