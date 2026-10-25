/**
 * Test-Hilfen R3-2b „Turnier abschließen“: das Nikolaus-Turnier (eine Gruppe, 6 Teams, ECHT ERZEUGT über Generator → publish →
 * Mapper, `group-state.json`), alle 15 Spiele entschieden, Gleichstand Petting/Otting per Strafstoßschießen 4:3 für Otting
 * entschieden und die Gruppe abgeschlossen – der Endstand steht fest (N7c: Kammer, Waging rot, Otting, Petting, Fridolfing,
 * Waging blau). Dazu eine Antwort von `finish_preflight` auf genau diesem Stand. Nur Testumgebung.
 */
import type { Tournament } from '../../../types/tournament';
import type { FinishPreflight } from '../../repositories/lifecycleRpc';
import { NK, tournamentFromFixture } from '../../standings/__tests__/groupCompletionKit';
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
export const N7C = ['DJK Kammer', 'TSV Waging rot', 'DJK Otting', 'TSV Petting', 'TSV 1921 Fridolfing', 'TSV Waging blau'];

/** `finish_preflight` auf dem Stand von `t`: Läuft, nichts offen, keine Warnung – sofern nicht überschrieben. */
export function preflightFor(t: Pick<Tournament, 'matches'>, over: Partial<FinishPreflight> = {}): FinishPreflight {
  return { lifecycle: 'running', finishedAt: null, canFinish: true, items: [], warnings: [], state: expectedTournamentState(t), ...over };
}
