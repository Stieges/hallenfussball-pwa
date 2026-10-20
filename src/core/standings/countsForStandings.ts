/**
 * Was zählt in einer Tabelle – an EINER Stelle für Gesamt- und Sondertabelle (Paket TB, Plan v2 § 3.1).
 * Rein, ohne React. `utils/calculations` exportiert `countsForStandings` weiter, damit bestehende Aufrufer bleiben.
 */
import type { Match, PointSystem } from '../../types/tournament';
import type { TeamId } from '../models/schemas/MatchSlotSchema';
import { matchSideTeamId } from '../models/matchSlot';

/**
 * Zählt ein Spiel für Tabelle, Weiterkommen und Finalrunden-Auflösung? (@TM-143)
 *
 * Nur abgepfiffene Spiele (`finished`): laufende oder unterbrochene Spiele tragen einen
 * Zwischenstand, der nicht zählen darf. Ein nicht gesetzter Status (`undefined`) zählt nur, weil
 * ältere lokale Turniere (Zod `optional`) und Testfixtures ohne Status existieren. Produktiv setzt
 * der Mapper `null` auf 'scheduled' und der Wizard 'scheduled', ein `undefined` entsteht dort kaum.
 * Ein „nicht ausgetragenes“ Spiel (`skipped`) zählt in keiner Spalte (@W2A-055).
 */
export const countsForStandings = (match: Match): boolean =>
  match.matchStatus === undefined || match.matchStatus === 'finished';

/**
 * Ist ein Gruppenspiel entschieden? Gezählt mit Stand – oder als „nicht ausgetragen“ beendet (`skipped`, @W2A-055):
 * es hält die Markierung eines Gleichstands nicht auf, zählt aber nicht.
 */
export const isGroupMatchDecided = (match: Match): boolean =>
  match.matchStatus === 'skipped'
  || (countsForStandings(match) && match.scoreA !== undefined && match.scoreB !== undefined);

/** Ergebnis eines gezählten Spiels aus Sicht einer Seite. */
export interface SideOutcome {
  teamId: TeamId;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  result: 'won' | 'drawn' | 'lost';
}

function side(teamId: TeamId, goalsFor: number, goalsAgainst: number, pointSystem: PointSystem): SideOutcome {
  if (goalsFor > goalsAgainst) {
    return { teamId, goalsFor, goalsAgainst, points: pointSystem.win, result: 'won' };
  }
  if (goalsFor < goalsAgainst) {
    return { teamId, goalsFor, goalsAgainst, points: pointSystem.loss, result: 'lost' };
  }
  return { teamId, goalsFor, goalsAgainst, points: pointSystem.draw, result: 'drawn' };
}

/**
 * Tore und Punkte je Seite eines Spiels – dieselbe Rechnung für Gesamt- und Sondertabelle (Andockpunkt für die
 * Nichtantritts-Wertung, GA4 A-25c). `null`, wenn das Spiel nicht zählt, ein Stand fehlt oder eine Seite offen ist.
 * Die Zuordnung läuft nur über die Team-ID aus dem Slot (A-03).
 */
export function matchOutcome(match: Match, pointSystem: PointSystem): readonly [SideOutcome, SideOutcome] | null {
  const idA = matchSideTeamId(match, 'A');
  const idB = matchSideTeamId(match, 'B');
  if (!countsForStandings(match) || idA === undefined || idB === undefined
    || match.scoreA === undefined || match.scoreB === undefined) {
    return null;
  }
  return [side(idA, match.scoreA, match.scoreB, pointSystem), side(idB, match.scoreB, match.scoreA, pointSystem)];
}
