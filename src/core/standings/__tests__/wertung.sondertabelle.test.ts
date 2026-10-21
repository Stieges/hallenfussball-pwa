/**
 * A-25c – Nichtantritts-Wertung in der Sondertabelle (direkter Vergleich) und im Fingerabdruck einer Entscheidung
 * (Plan GA4 v2 § 5 A-25c, § 15). Record `2026-09-27_wizard-regelinhalte` (@W2A-054); Verfall nach R-TB-11
 * (`decisions.ts`). Die Wertung kommt über die Cloud-Zeile (`decided_by 'forfeit'`, `forfeit_absent`).
 * Entscheidungen trägt Olli über `StandingDecisionService` mit der Repository-Attrappe ein (wie in der App).
 */
import { describe, expect, it } from 'vitest';
import { calculateStandings } from '../../../utils/calculations';
import { rankTournamentGroup } from '../tournamentTable';
import type { ForfeitAbsent, Standing, Tournament } from '../../../types/tournament';
import { id, league, NAME, names, parseMatches, type Key } from './fixtures';
import { cloudTournament, matchIdOf, viaCloud } from './forfeitKit';
import { jgj, MemoryRepo, shootout } from './decisionTestKit';

const table = (t: Tournament): Standing[] => calculateStandings(t.teams, t.matches, t);
const points = (rows: readonly Standing[], key: Key): number => rows.find((r) => r.team.id === id(key))?.points ?? -1;

/**
 * @W2A-054: West, Ost und Ufer haben als einzige je 7 Punkte (untereinander je ein Sieg), gegen Mitte, Nord und Berg
 * je Sieg, Remis, Niederlage; Mitte, Nord und Berg je 6. Ost – Ufer ist als Nichtantritt von Ufer 2:0 gewertet.
 */
const W2A_054 = 'W–O 1:0; O–U 2:0; U–W 1:0; W–M 1:0; W–N 1:1; B–W 1:0; O–N 1:0; O–B 0:0; M–O 1:0; U–B 1:0; U–M 1:1; N–U 1:0; M–N 1:1; M–B 1:1; N–B 1:1';

describe('A-25c Wertung in der Sondertabelle', () => {
  it('@W2A-054 eine Nichtantritts-Wertung zählt in der Sondertabelle wie ein Ergebnis: SC Ost vor TSV West vor VfB Ufer', () => {
    const { teams, matches } = league('WOUMNB', W2A_054);
    const t = cloudTournament(teams, matches, { [matchIdOf(W2A_054, 'O–U')]: 'B' });
    const rows = table(t);

    expect((['W', 'O', 'U', 'M', 'N', 'B'] as Key[]).map((k) => points(rows, k))).toEqual([7, 7, 7, 6, 6, 6]);
    expect(names(rows).slice(0, 3)).toEqual([NAME.O, NAME.W, NAME.U]);
    expect(rows.slice(0, 3).map((r) => r.place)).toEqual([1, 2, 3]);
    expect(rows.slice(0, 3).some((r) => r.decisionNeeded)).toBe(false);
  });

  it('@W2A-054 Gegenbeispiel: dieselbe Lage mit gespieltem 2:0 statt Wertung ergibt dieselbe Reihenfolge', () => {
    const { teams, matches } = league('WOUMNB', W2A_054);
    expect(names(table(cloudTournament(teams, matches))).slice(0, 3)).toEqual([NAME.O, NAME.W, NAME.U]);
  });
});

/**
 * Vier Teams: West und Ost nach allen Kriterien gleich auf Platz 1 (je 7 Punkte, 3:0 Tore, direktes Spiel 0:0), Ufer und
 * Mitte je 1 Punkt. Die 2:0-Siege gegen Ufer haben den Stand einer Wertung (2:0).
 */
const TIE = 'W–O 0:0; W–U 2:0; W–M 1:0; O–U 2:0; O–M 1:0; U–M 0:0';

/** Ein Spiel „H–G“ der Lage als Nichtantritt gewertet (bzw. ohne Wertung) – zurück über die Cloud-Zeile. */
function withForfeit(t: Tournament, pairing: string, absent?: ForfeitAbsent): Tournament {
  const matchId = matchIdOf(TIE, pairing);
  return { ...t, matches: t.matches.map((m) => (m.id === matchId ? viaCloud(m, absent) : m)) };
}

/** Lage (optional mit Wertungen) und eingetragenes Strafstoßschießen 4:3 für SC Ost. */
async function tieDecided(forfeits: Readonly<Record<string, ForfeitAbsent>> = {}): Promise<MemoryRepo> {
  const start = Object.entries(forfeits).reduce((t, [pairing, absent]) => withForfeit(t, pairing, absent), jgj('WOUM', TIE));
  const repo = new MemoryRepo(start);
  const result = await repo.service(['e-ost']).decide(repo.tournament.id, shootout('O', 'W', 4, 3));
  expect(result.ok).toBe(true);
  return repo;
}

const stale = (t: Tournament): string[] => rankTournamentGroup(t, '').staleDecisionIds;

describe('A-25c Fingerabdruck einer Entscheidung mit Wertung', () => {
  it('vor jeder Änderung gilt die Entscheidung: Ost vor West', async () => {
    const repo = await tieDecided();
    const rows = table(repo.tournament);
    expect(names(rows).slice(0, 2)).toEqual([NAME.O, NAME.W]);
    expect(rows[0].decision?.id).toBe('e-ost');
  });

  it('wird das 0:0 zwischen den beiden Gleichen als Nichtantritt beider gewertet, verfällt die Entscheidung (gleicher Stand, andere Grundlage)', async () => {
    const repo = await tieDecided();
    const after = withForfeit(repo.tournament, 'W–O', 'both');
    const westOst = after.matches.find((m) => m.id === matchIdOf(TIE, 'W–O'));
    expect([westOst?.scoreA, westOst?.scoreB, westOst?.matchStatus]).toEqual([0, 0, 'finished']);

    const result = rankTournamentGroup(after, '');
    expect(result.staleDecisionIds).toEqual(['e-ost']);
    expect(result.openTies).toContainEqual([id('W'), id('O')]);
    const rows = table(after);
    expect([points(rows, 'W'), points(rows, 'O')]).toEqual([6, 6]);
    expect(rows.slice(0, 2).every((r) => r.decisionNeeded && r.decision === undefined)).toBe(true);
  });

  it('eine zurückgenommene Wertung lässt die Entscheidung verfallen, auch wenn das Spiel danach mit demselben 2:0 gespielt wird', async () => {
    const repo = await tieDecided({ 'W–U': 'B' });
    expect(stale(repo.tournament)).toEqual([]);
    const played = withForfeit(repo.tournament, 'W–U');
    expect(names(table(played)).slice(0, 4).sort()).toEqual(names(table(repo.tournament)).slice(0, 4).sort());
    expect(stale(played)).toEqual(['e-ost']);
  });

  it('ändert die Turnierleitung die Wertung (2:0 → 3:0), verfällt eine Entscheidung, deren Block eine Wertung beider enthält', async () => {
    const repo = await tieDecided({ 'W–O': 'both' });
    expect(stale(repo.tournament)).toEqual([]);
    expect(stale({ ...repo.tournament, forfeitScore: { winner: 3, loser: 0 } })).toEqual(['e-ost']);
  });

  it('Gegenbeispiel: ohne Wertung beider im Block lässt eine geänderte Wertung (3:0) die Entscheidung stehen', async () => {
    const repo = await tieDecided({ 'W–U': 'B' });
    expect(stale({ ...repo.tournament, forfeitScore: { winner: 3, loser: 0 } })).toEqual([]);
  });

  it('Gegenbeispiel: eine Wertung zwischen Unbeteiligten (Ufer – Mitte) lässt die Entscheidung stehen', async () => {
    const repo = await tieDecided();
    const after = withForfeit(repo.tournament, 'U–M', 'both');
    expect(stale(after)).toEqual([]);
    expect(names(table(after)).slice(0, 2)).toEqual([NAME.O, NAME.W]);
  });

  it('Gegenbeispiel: der Rundlauf über die Cloud-Zeile ohne Wertung ändert die Grundlage nicht', async () => {
    const repo = await tieDecided();
    const roundTrip = { ...repo.tournament, matches: repo.tournament.matches.map((m) => viaCloud(m)) };
    expect(stale(roundTrip)).toEqual([]);
    expect(parseMatches(TIE)).toHaveLength(6);
  });
});
