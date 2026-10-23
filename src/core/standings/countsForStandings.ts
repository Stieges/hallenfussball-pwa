/**
 * Was zählt in einer Tabelle – an EINER Stelle für Gesamt- und Sondertabelle (Paket TB, Plan v2 § 3.1).
 * Rein, ohne React. `utils/calculations` exportiert `countsForStandings` weiter, damit bestehende Aufrufer bleiben.
 */
import type { ForfeitScore, Match, PointSystem } from '../../types/tournament';
import type { TeamId } from '../models/schemas/MatchSlotSchema';
import { matchSideTeamId } from '../models/matchSlot';
import { isDoubleForfeit } from '../models/forfeit';

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

/** Beide nicht angetreten: keiner gewinnt, beide 0 Punkte und 0:`winner` Tore der Wertung (@W2A-024, @TM-063). */
function absentSide(teamId: TeamId, forfeitScore: ForfeitScore): SideOutcome {
  return { teamId, goalsFor: 0, goalsAgainst: forfeitScore.winner, points: 0, result: 'lost' };
}

/**
 * Tore und Punkte je Seite eines Spiels – EINE Rechnung für Gesamt- und Sondertabelle. `null`, wenn das Spiel nicht
 * zählt, ein Stand fehlt oder eine Seite offen ist. Die Zuordnung läuft nur über die Team-ID aus dem Slot (A-03).
 * Nichtantritts-Wertung (GA4 A-25c): fehlt eine Seite, zählt der gespeicherte Wertungsstand wie ein Ergebnis
 * (@W2A-022, @W2A-054); fehlen beide, gilt `absentSide` mit der Wertung des Turniers (`forfeitScore`), nie ein Remis.
 */
export function matchOutcome(
  match: Match,
  pointSystem: PointSystem,
  forfeitScore: ForfeitScore,
): readonly [SideOutcome, SideOutcome] | null {
  const idA = matchSideTeamId(match, 'A');
  const idB = matchSideTeamId(match, 'B');
  if (!countsForStandings(match) || idA === undefined || idB === undefined
    || match.scoreA === undefined || match.scoreB === undefined) {
    return null;
  }
  if (isDoubleForfeit(match)) {
    return [absentSide(idA, forfeitScore), absentSide(idB, forfeitScore)];
  }
  return [side(idA, match.scoreA, match.scoreB, pointSystem), side(idB, match.scoreB, match.scoreA, pointSystem)];
}
