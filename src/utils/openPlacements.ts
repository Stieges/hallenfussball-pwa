/**
 * Plätze der Platzierungsspiele und vorläufige Plätze offener Spiele (A-36b Fixrunde 1b, @ET-042).
 *
 * Vor dem Abschluss zeigt die Rangliste den Endstand, wie er gerade steht (Record Endstand Z. 73): Die Teams eines noch
 * offenen Platzierungsspiels stehen auf den Plätzen DIESES Spiels (Finale → 1–2), gemeinsam und ohne Reihenfolge als
 * „offen“ – nie hinter den Gruppenplätzen.
 */
import type { Match, Team } from '../types/tournament';
import { matchSideTeamId } from '../core/models/matchSlot';

/** Plätze je Platzierungsspiel: [Sieger, Verlierer]. */
export const FINAL_TYPE_RANKS: Readonly<Record<string, [number, number]>> = {
  final: [1, 2],
  thirdPlace: [3, 4],
  fifthSixth: [5, 6],
  seventhEighth: [7, 8],
};

export const FINAL_TYPE_LABELS: Readonly<Record<string, string>> = {
  final: 'Finale',
  thirdPlace: 'Spiel um Platz 3',
  fifthSixth: 'Spiel um Platz 5',
  seventhEighth: 'Spiel um Platz 7',
};

export interface OpenPlacement {
  rank: number;
  /** Letzter Platz des gemeinsamen Bereichs (Finale offen: rank 1, rankTo 2). */
  rankTo: number;
  team: Team;
  decidedBy: 'open';
  matchLabel?: string;
}

/**
 * Vorläufige Plätze der besetzten, noch nicht entschiedenen Platzierungsspiele. `isDecided` ist die zentrale
 * Siegerregel (`getMatchWinner(m) !== null`); bereits platzierte Teams bleiben außen vor.
 */
export function openPlacements(
  teams: readonly Team[],
  matches: readonly Match[],
  isDecided: (match: Match) => boolean,
  placed: ReadonlySet<string>,
): OpenPlacement[] {
  return matches.flatMap((match) => {
    const ranks = match.isFinal === true && match.finalType !== undefined ? FINAL_TYPE_RANKS[match.finalType] : undefined;
    if (ranks === undefined || isDecided(match)) {
      return [];
    }
    const sides = [matchSideTeamId(match, 'A'), matchSideTeamId(match, 'B')];
    const found = sides.map((id) => teams.find((team) => team.id === id));
    if (found.some((team) => team === undefined || placed.has(team.id))) {
      return [];
    }
    return found.flatMap((team) => (team === undefined ? [] : [{
      rank: ranks[0], rankTo: ranks[1], team, decidedBy: 'open' as const, matchLabel: FINAL_TYPE_LABELS[match.finalType ?? ''],
    }]));
  });
}

/** Anzeige des Platzes: „1“ bzw. „1–2“ für einen gemeinsamen offenen Bereich. */
export function placementRankText(placement: { rank: number; rankTo?: number }): string {
  return placement.rankTo === undefined ? String(placement.rank) : `${placement.rank}–${placement.rankTo}`;
}
