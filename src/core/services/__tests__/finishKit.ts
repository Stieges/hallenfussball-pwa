/**
 * Test-Hilfen R3-2b „Turnier abschließen“: das Nikolaus-Turnier (eine Gruppe, 6 Teams, ECHT ERZEUGT über Generator → publish →
 * Mapper, `group-state.json`), alle 15 Spiele entschieden, Gleichstand Petting/Otting per Strafstoßschießen 4:3 für Otting
 * entschieden und die Gruppe abgeschlossen – der Endstand steht fest (N7c: Kammer, Waging 1, Otting, Petting, Fridolfing,
 * Waging 2). Dazu eine Antwort von `finish_preflight` auf genau diesem Stand. Nur Testumgebung.
 */
import type { Match, Tournament } from '../../../types/tournament';
import type { FinishPreflight } from '../../repositories/lifecycleRpc';
import { NK, matchOf, tournamentFromFixture, withMatch } from '../../standings/__tests__/groupCompletionKit';
import { completeGroup, decide } from '../../standings/finalStandings/__tests__/finalStandingsKit';
import { expectedTournamentState } from '../lifecycle';

const ottingGewinnt = {
  groupId: '', teamIds: [NK.otting, NK.petting], order: [NK.otting, NK.petting], kind: 'shootout' as const, shootout: { winner: 4, loser: 3 },
};

/** Nikolaus, alles entschieden, Gruppe abgeschlossen, festgelegt (Server: „Läuft“). */
export async function nikolausFertig(): Promise<Tournament> {
  const t = { ...tournamentFromFixture('nikolaus'), version: 1 };
  return { ...completeGroup(await decide(t, ottingGewinnt)), status: 'published', lifecycleStatus: 'fixed' };
}

/** Endstand N7c in Reihenfolge. */
export const N7C = ['DJK Kammer', 'TSV Waging 1', 'DJK Otting', 'TSV Petting', 'TSV 1921 Fridolfing', 'TSV Waging 2'];

/** `finish_preflight` auf dem Stand von `t`: Läuft, nichts offen, keine Warnung – sofern nicht überschrieben. */
export function preflightFor(t: Pick<Tournament, 'matches'>, over: Partial<FinishPreflight> = {}): FinishPreflight {
  return { lifecycle: 'running', finishedAt: null, canFinish: true, items: [], warnings: [], state: expectedTournamentState(t), ...over };
}

/** Ergebnis x:y für das Spiel der Teams x und y setzen (Seite beachten). */
export function ergebnis(t: Tournament, x: string, y: string, gx: number, gy: number): Tournament {
  const m: Match = matchOf(t, x, y);
  const xIsA = m.slotA.kind === 'team' && m.slotA.teamId === x;
  return withMatch(t, m.id, { matchStatus: 'finished', scoreA: xIsA ? gx : gy, scoreB: xIsA ? gy : gx });
}

/**
 * Nikolaus mit ECHTEM Gleichstand um Platz 1: Kammer und Waging 1 trennt nichts (je 0:0 gegeneinander und gegen Otting, je 1:0
 * gegen die übrigen), Otting gewinnt 1:0 gegen Petting und Fridolfing und spielt 0:0 gegen Waging 2 (`ottingGewinntGegenBlau`: 1:0,
 * dann sind alle drei gleich). Alle Spiele entschieden, ohne Entscheidung, Gruppe nicht abgeschlossen.
 */
export function gleichstandUmPlatz1(ottingGewinntGegenBlau: boolean): Tournament {
  const { kammer: A, waging1: B, otting: C, petting: P, fridolfing: F, waging2: W } = NK;
  let t: Tournament = { ...tournamentFromFixture('nikolaus'), version: 1, standingDecisions: [], groupCompletions: [] };
  t = ergebnis(t, A, B, 0, 0); t = ergebnis(t, A, C, 0, 0); t = ergebnis(t, B, C, 0, 0);
  for (const o of [P, F, W]) { t = ergebnis(t, A, o, 1, 0); t = ergebnis(t, B, o, 1, 0); }
  t = ergebnis(t, C, P, 1, 0); t = ergebnis(t, C, F, 1, 0); t = ergebnis(t, C, W, ottingGewinntGegenBlau ? 1 : 0, 0);
  t = ergebnis(t, P, F, 1, 0); t = ergebnis(t, P, W, 1, 0); return ergebnis(t, F, W, 1, 0);
}
