/**
 * A-25c, Auflage M-1 (Opus-Review A-25c): Die Tabelle auf dem Gerät der Turnierleitung liest die lokale Kopie. Während
 * des Turniers kommen Einträge über den Feldweg (Regel S, `decideCloudAdoption` → `applyServerLedPatch`), nicht über die
 * ganze Kopie. Der Feldweg muss `forfeitAbsent` mitführen, sonst zählt eine Wertung beider (gespeichert 0:0) als Remis
 * und ein altes Merkmal bleibt nach einer Rücknahme stehen.
 * Records `2026-09-27_wizard-regelinhalte` (@W2A-024, @W2A-026) und `2026-10-01_turniermodi` (@TM-063).
 */
import { describe, expect, it } from 'vitest';
import { decideCloudAdoption } from '../../repositories/cloudAdoption';
import { applyServerLedPatch } from '../../repositories/serverLedMatchFields';
import { calculateStandings, getMatchWinner } from '../../../utils/calculations';
import type { ForfeitAbsent, Match, Standing, Tournament } from '../../../types/tournament';
import { id, league, NAME, parseMatches, type Key } from './fixtures';
import { cloudTournament, matchIdOf } from './forfeitKit';

const RESULTS = 'N–B 2:1; N–W 1:0; N–O 3:0; B–W 2:2; B–O 1:1; W–O 0:0';
const WEST_OST = matchIdOf(RESULTS, 'W–O');
const { teams } = league('NBWO', RESULTS, { group: 'A' });
const VERSION = 5; // gleiche Turnier-Version: Einträge zählen nur die Revision je Spiel → Feldweg

type Stand = { kind: 'open' } | { kind: 'forfeit'; absent: ForfeitAbsent; score: readonly [number, number] };

/** Cloud-Stand der Gruppe A mit West – Ost im angegebenen Zustand (über die Cloud-Zeile und den Mapper). */
function cloudWith(stand: Stand): Tournament {
  if (stand.kind === 'open') {
    return { ...cloudTournament(teams, parseMatches(RESULTS, { group: 'A', open: ['W–O'] })), version: VERSION };
  }
  const results = RESULTS.replace('W–O 0:0', `W–O ${String(stand.score[0])}:${String(stand.score[1])}`);
  return { ...cloudTournament(teams, parseMatches(results, { group: 'A' }), { [WEST_OST]: stand.absent }), version: VERSION };
}

interface Device { tournament: Tournament; stored: Map<string, number> }

/** Ein Abruf auf dem Gerät der Turnierleitung: West – Ost hat jetzt Revision `revision`, die übrigen Spiele 1. */
function fetchOnDevice(device: Device, cloud: Tournament, revision: number): Device {
  const revisions = new Map(cloud.matches.map((m) => [m.id, m.id === WEST_OST ? revision : 1]));
  const adoption = decideCloudAdoption(device.tournament, { tournament: cloud, matchRevisions: revisions }, device.stored,
    { mayCache: true, whole: false, owned: (t) => t });
  expect(adoption.save, 'Feldweg, nicht die ganze Kopie').toBeUndefined();
  const matches = applyServerLedPatch(device.tournament.matches, adoption.patch ?? new Map());
  return { tournament: { ...device.tournament, matches }, stored: new Map(adoption.revisions) };
}

/** Gerät, das den Stand zuletzt als ganze Kopie geladen hat (Versionsweg, trägt alle Felder). */
const deviceWith = (stand: Stand): Device => ({ tournament: cloudWith(stand), stored: new Map([[WEST_OST, 2]]) });

const table = (t: Tournament): Standing[] => calculateStandings(t.teams, t.matches, t, 'A');
const rowOf = (t: Tournament, key: Key) => {
  const row = table(t).find((r) => r.team.id === id(key));
  if (row === undefined) { throw new Error(`Team ${key} fehlt`); }
  return { won: row.won, drawn: row.drawn, lost: row.lost, goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst, points: row.points };
};
const westOst = (t: Tournament): Match => {
  const match = t.matches.find((m) => m.id === WEST_OST);
  if (match === undefined) { throw new Error('West – Ost fehlt'); }
  return match;
};

/** West vorher: N–W 0:1 (Niederlage), B–W 2:2 (Remis); Ost: N–O 0:3 (Niederlage), B–O 1:1 (Remis). */
const WEST_OHNE = { won: 0, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 1 };
const OST_OHNE = { won: 0, drawn: 1, lost: 1, goalsFor: 1, goalsAgainst: 4, points: 1 };
const plus = (base: typeof WEST_OHNE, d: Partial<typeof WEST_OHNE>) => ({
  won: base.won + (d.won ?? 0), drawn: base.drawn + (d.drawn ?? 0), lost: base.lost + (d.lost ?? 0),
  goalsFor: base.goalsFor + (d.goalsFor ?? 0), goalsAgainst: base.goalsAgainst + (d.goalsAgainst ?? 0), points: base.points + (d.points ?? 0),
});
const BOTH_LOST = { lost: 1, goalsAgainst: 2 };

describe('A-25c Feldweg: Wertung auf dem Gerät der Turnierleitung', () => {
  it('@W2A-024:teil @TM-063:teil beide nicht angetreten, über den Feldweg übernommen: je 0 Punkte und je 0:2, kein Remis', () => {
    const device = fetchOnDevice(deviceWith({ kind: 'open' }), cloudWith({ kind: 'forfeit', absent: 'both', score: [0, 0] }), 3);

    expect(westOst(device.tournament)).toMatchObject({ decidedBy: 'forfeit', forfeitAbsent: 'both', scoreA: 0, scoreB: 0, matchStatus: 'finished' });
    expect(rowOf(device.tournament, 'W')).toEqual(plus(WEST_OHNE, BOTH_LOST));
    expect(rowOf(device.tournament, 'O')).toEqual(plus(OST_OHNE, BOTH_LOST));
    expect(getMatchWinner(westOst(device.tournament))).toBeNull();
  });

  it('@W2A-024:teil Gegenbeispiel: Wertung West fehlt → Rücknahme → beide fehlen: kein Remis (altes Merkmal „A“ bleibt nicht stehen)', () => {
    let device = deviceWith({ kind: 'forfeit', absent: 'A', score: [0, 2] });
    expect(rowOf(device.tournament, 'O')).toEqual(plus(OST_OHNE, { won: 1, goalsFor: 2, points: 3 }));
    device = fetchOnDevice(device, cloudWith({ kind: 'open' }), 3); // Rücknahme (@W2A-026)
    expect(westOst(device.tournament).forfeitAbsent).toBeUndefined();
    device = fetchOnDevice(device, cloudWith({ kind: 'forfeit', absent: 'both', score: [0, 0] }), 4);

    expect(westOst(device.tournament).forfeitAbsent).toBe('both');
    expect(rowOf(device.tournament, 'W')).toEqual(plus(WEST_OHNE, BOTH_LOST));
    expect(rowOf(device.tournament, 'O')).toEqual(plus(OST_OHNE, BOTH_LOST));
  });

  it('@W2A-024:teil Gegenbeispiel: beide fehlen → Rücknahme → Ost fehlt: West gewinnt 2:0 (altes Merkmal „both“ bleibt nicht stehen)', () => {
    let device = deviceWith({ kind: 'forfeit', absent: 'both', score: [0, 0] });
    device = fetchOnDevice(device, cloudWith({ kind: 'open' }), 3); // Rücknahme (@W2A-026)
    device = fetchOnDevice(device, cloudWith({ kind: 'forfeit', absent: 'B', score: [2, 0] }), 4);

    expect(westOst(device.tournament)).toMatchObject({ decidedBy: 'forfeit', forfeitAbsent: 'B', scoreA: 2, scoreB: 0 });
    expect(rowOf(device.tournament, 'W')).toEqual(plus(WEST_OHNE, { won: 1, goalsFor: 2, points: 3 }));
    expect(rowOf(device.tournament, 'O')).toEqual(plus(OST_OHNE, { lost: 1, goalsAgainst: 2 }));
    expect(getMatchWinner(westOst(device.tournament))?.winner).toBe(id('W'));
    expect(NAME.W).toBe('TSV West');
  });
});
