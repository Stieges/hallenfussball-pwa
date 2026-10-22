/**
 * A-19a `readFinalStandings` (R-EA-9) und Schnitt N für Turniere mit Finalrunde (Daniel F12).
 * Record `2026-10-01_endstand-und-torschuetzen`: @ET-045 (gespeichert gilt, eine neue Version ändert nichts), @ET-042
 * (vorher vorläufig), @ET-031 (jedes Team genau einmal), @ET-058 (entferntes Team ohne Platz).
 */
import { describe, expect, it } from 'vitest';
import type { Tournament } from '../../../../types/tournament';
import { computeFinalStandings, readFinalStandings, type FinalStandingsSnapshot } from '..';
import { HC, NK, tournamentFromFixture } from '../../__tests__/groupCompletionKit';
import { completeGroup, decide } from './finalStandingsKit';

const ottingGewinnt = { groupId: '', teamIds: [NK.otting, NK.petting], order: [NK.otting, NK.petting], kind: 'shootout' as const, shootout: { winner: 4, loser: 3 } };

async function abgeschlossenerNikolaus(): Promise<Tournament> {
  return completeGroup(await decide({ ...tournamentFromFixture('nikolaus'), version: 1 }, ottingGewinnt));
}

/** Gespeicherter Endstand einer früheren App-Version (andere Reihenfolge als eine Neuberechnung heute). */
function gespeichert(t: Tournament): FinalStandingsSnapshot {
  const ranking = computeFinalStandings(t).ranking;
  const [erster, zweiter, ...rest] = ranking;
  return {
    format: 1,
    ranking: [{ ...zweiter, place: 1 }, { ...erster, place: 2 }, ...rest],
    scorers: [],
    appVersion: '2.2.0',
    computedAt: '2026-11-28T15:30:00.000Z',
  };
}

describe('A-19a readFinalStandings (R-EA-9)', () => {
  it('@ET-045 ein gespeicherter Endstand gilt unverändert, auch wenn eine Neuberechnung heute anders ordnen würde', async () => {
    const t = await abgeschlossenerNikolaus();
    const stored = gespeichert(t);
    const result = readFinalStandings(t, stored);
    expect(result).toEqual({ source: 'stored', snapshot: stored });
    expect(result.source === 'stored' && result.snapshot.ranking.map((row) => row.teamName).slice(0, 2)).toEqual(['TSV Waging rot', 'DJK Kammer']);
  });

  it('@ET-042 ohne gespeicherten Endstand (Turnier nicht abgeschlossen) zeigt die App den vorläufigen, auch bei abgeschlossener Gruppe', async () => {
    const t = await abgeschlossenerNikolaus();
    expect(readFinalStandings(t)).toEqual({ source: 'provisional', ranking: computeFinalStandings(t).ranking });
  });
});

describe('A-19a Schnitt N: mit Finalrunde nur vorläufig (Daniel F12, Teil F folgt)', () => {
  it('@ET-042 „Hallencup Nord“ (Gruppen + Finalrunde) → vorläufig, jedes der 8 Teams genau einmal (@ET-031)', () => {
    const t = tournamentFromFixture('hallencup');
    const result = computeFinalStandings(t);
    expect(result.state).toBe('provisional');
    expect(result.ranking.map((row) => row.teamId as string).sort()).toEqual(Object.values(HC).sort());
  });

  it('@ET-058 auch mit Finalrunde bekommt ein entferntes Team keinen Platz', () => {
    const t = tournamentFromFixture('hallencup');
    const ohneTal: Tournament = { ...t, teams: t.teams.map((team) => (team.id === HC.tal ? { ...team, isRemoved: true } : team)) };
    const ids = computeFinalStandings(ohneTal).ranking.map((row) => row.teamId as string);
    expect(ids).toHaveLength(7);
    expect(ids).not.toContain(HC.tal);
  });
});
