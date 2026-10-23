/**
 * Sicht der App auf die Gleichstände einer Gruppe (Paket TB-B, TB-6b'/TB-6c'): offene Blöcke mit Hinweisform
 * („Strafstoßschießen nötig“ oder „Gleichstand – Entscheidung nötig“, Daniel Mockup v2/v3), Grund der Pflicht (G2),
 * entschiedene Blöcke und die Marke je Team. Dazu die Wirkung einer geänderten Einstellung „Diese Plätze müssen bei
 * Gleichstand ausgespielt werden“ auf bestehende Annahmen (@W2A-068 Zeile 3, Rückfrage vor dem Speichern, K15).
 * Alles reine Rechnung aus `rankGroup`; die Tabelle selbst bleibt die einzige Quelle. Rein, ohne React.
 */
import type { StandingDecision, Tournament } from '../../types/tournament';
import { standingsGroups } from '../models/standingsGroups';
import { groupClosedByFollowUp } from './groupClosure';
import { rankTournamentGroup, type TableTournament } from './tournamentTable';
import { blockMayShare, effectivePlacementsToPlayOut, followUpRanks, mandatoryReason, type MandatoryReason } from './playOutPlaces';

type ViewTournament = Pick<Tournament, 'teams' | 'matches'> & TableTournament;

export interface OpenTieBlock {
  groupId: string;
  teamIds: string[];
  place: number;
  size: number;
  /** Wahl „Ergebnis so akzeptieren“ erlaubt (`Gleichstand – Entscheidung nötig`); falsch = nur Strafstoßschießen. */
  mayShare: boolean;
  /** Grund, wenn `mayShare` falsch ist. */
  mandatory?: MandatoryReason;
}

export interface DecidedTieBlock {
  groupId: string;
  decision: StandingDecision;
  place: number;
  size: number;
}

export interface GroupTieView {
  groupId: string;
  open: OpenTieBlock[];
  decided: DecidedTieBlock[];
  /** Zwischenregel „Gruppe abgeschlossen“ bis GA4 A-13: ein Spiel mit Herkunft aus der Gruppe ist besetzt oder angepfiffen. */
  closed: boolean;
}

export type TieMarker =
  | { kind: 'need' }
  | { kind: 'open' }
  | { kind: 'same' }
  | { kind: 'shootoutWon'; winner: number; loser: number }
  | { kind: 'shootoutLost'; winner: number; loser: number }
  | { kind: 'ordered' };

/** Gleichstände einer Gruppe (`OVERALL_GROUP` = '' bei Jeder gegen jeden). */
export function groupTieView(tournament: ViewTournament, groupId: string): GroupTieView {
  const table = rankTournamentGroup(tournament, groupId);
  const places = effectivePlacementsToPlayOut(tournament);
  const followUps = followUpRanks(tournament.matches, table.groupId);
  // Markiert wird erst, wenn alle Gruppenspiele entschieden sind (`decisionNeeded`); mitten in der Gruppe bleibt es bei der Ziffer.
  const markedBlocks = table.openTies.filter((teamIds) => table.rows.filter((r) => teamIds.includes(r.team.id)).every((r) => r.decisionNeeded));
  const open: OpenTieBlock[] = markedBlocks.map((teamIds) => {
    const rows = table.rows.filter((r) => teamIds.includes(r.team.id));
    const block = { place: Math.min(...rows.map((r) => r.place)), size: rows.length };
    const mandatory = mandatoryReason(places, followUps, block);
    return { groupId: table.groupId, teamIds, ...block, mayShare: blockMayShare(places, followUps, block), ...(mandatory !== undefined ? { mandatory } : {}) };
  });
  const seen = new Set<string>();
  const decided: DecidedTieBlock[] = [];
  for (const row of table.rows) {
    if (row.decision !== undefined && !seen.has(row.decision.id)) {
      seen.add(row.decision.id);
      const members = table.rows.filter((r) => row.decision?.teamIds.includes(r.team.id));
      decided.push({ groupId: table.groupId, decision: row.decision, place: Math.min(...members.map((r) => r.place)), size: members.length });
    }
  }
  return { groupId: table.groupId, open, decided, closed: groupClosedByFollowUp(tournament, table.groupId) };
}

/** Marke eines Teams (Symbol und Wort, Farbe nie allein) oder `undefined`, wenn es keinen Gleichstand betrifft. */
export function tieMarkerOf(view: GroupTieView, teamId: string): TieMarker | undefined {
  const block = view.open.find((b) => b.teamIds.includes(teamId));
  if (block !== undefined) {
    return { kind: block.mayShare ? 'open' : 'need' };
  }
  const found = view.decided.find((d) => d.decision.teamIds.includes(teamId));
  if (found === undefined) {
    return undefined;
  }
  const { decision } = found;
  if (decision.kind === 'shared') {
    return { kind: 'same' };
  }
  if (decision.kind === 'order' || decision.shootout === undefined) {
    return { kind: 'ordered' };
  }
  const { winner, loser } = decision.shootout;
  return { kind: decision.order[0] === teamId ? 'shootoutWon' : 'shootoutLost', winner, loser };
}

function appliedDecisions(tournament: ViewTournament): Map<string, StandingDecision> {
  const applied = new Map<string, StandingDecision>();
  for (const { group } of standingsGroups(tournament.teams)) {
    for (const row of rankTournamentGroup(tournament, group).rows) {
      if (row.decision !== undefined) {
        applied.set(row.decision.id, row.decision);
      }
    }
  }
  return applied;
}

/**
 * Welche heute geltenden Entscheidungen würden durch die neue Einstellung aufgehoben? (Annahmen, deren Plätze dann
 * ausgespielt werden müssen; ein Strafstoßschießen oder eine Reihenfolge bleibt bei jeder Änderung bestehen, @W2A-068
 * Zeile 6.) Nichts wird gelöscht – kehrt die Einstellung zurück, gilt die Annahme wieder.
 */
export function placesChangeEffects(tournament: ViewTournament, newPlaces: readonly number[]): { lost: StandingDecision[] } {
  const before = appliedDecisions(tournament);
  const after = appliedDecisions({ ...tournament, placementsToPlayOut: [...newPlaces] });
  return { lost: [...before.values()].filter((d) => !after.has(d.id)) };
}
