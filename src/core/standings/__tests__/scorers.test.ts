/**
 * A-20b Torschützenliste (`computeScorers`), Tests aus dem Gherkin des Records `2026-10-01_endstand-und-torschuetzen`:
 * @ET-032 … @ET-040, @EK-009 (Torschützen-Teil), @SL-172 (Altdaten außerhalb 1–99 → „ohne Nummer“, H5 aus Review #332).
 */
import { describe, expect, it } from 'vitest';
import { reduceMatch, type EngineEvent } from '../../match';
import { toRuntimeEvents } from '../../match/client';
import { ctx, ev, goal, start } from '../../match/client/__tests__/fixtures';
import { FinalStandingsSnapshotSchema, ScorerRowSchema } from '../../models/schemas/FinalStandingsSchema';
import type { EngineEventsById } from '../../../utils/calculations';
import type { Match, RuntimeMatchEvent, Team } from '../../../types/tournament';
import { looseVs } from '../../../test/matchSlotFixtures';
import { computeScorers } from '../scorers';

const ID = {
  nord: '00000000-0000-4000-8000-000000000a01',
  mitte: '00000000-0000-4000-8000-000000000a02',
  sued: '00000000-0000-4000-8000-000000000a03',
  berg: '00000000-0000-4000-8000-000000000a04',
  pfalz: '00000000-0000-4000-8000-000000000a05',
  oehringen: '00000000-0000-4000-8000-000000000a06',
};
const TEAMS: Team[] = [
  { id: ID.nord, name: 'FC Nord' }, { id: ID.mitte, name: 'SG Mitte' }, { id: ID.sued, name: 'SV Süd' },
  { id: ID.berg, name: 'DJK Berg' }, { id: ID.pfalz, name: 'FC Pfalz' }, { id: ID.oehringen, name: 'FC Öhringen' },
];

let seq = 0;
type Tor = { team: string; nr?: number; eigentor?: boolean; typ?: string };
function event(tor: Tor): RuntimeMatchEvent {
  seq += 1;
  return {
    id: `e${seq}`, timestampSeconds: seq, type: (tor.typ ?? 'GOAL') as RuntimeMatchEvent['type'],
    payload: { teamId: tor.team, playerNumber: tor.nr, ownGoal: tor.eigentor },
    scoreAfter: { home: 0, away: 0 },
  };
}
function spiel(tore: Tor[], extra: Partial<Match> = {}): Match {
  seq += 1;
  return { id: `m${seq}`, round: 1, field: 1, ...looseVs(ID.nord, ID.mitte), events: tore.map(event), matchStatus: 'finished', ...extra };
}
const liste = (matches: Match[], map?: EngineEventsById) => computeScorers({ teams: TEAMS, matches }, map);
const mal = (n: number, tor: Tor): Tor[] => Array.from({ length: n }, () => tor);
/** Kurzschrift: Rang, Team, Nummer/Art, Tore. */
const kurz = (rows: ReturnType<typeof liste>) =>
  rows.map((r) => [r.rank, r.teamName, r.kind === 'player' ? r.number : r.kind, r.goals]);

describe('A-20b computeScorers', () => {
  it('@ET-032 Nummer, Team, Tore; gleiche Nummer zweier Teams = zwei Einträge', () => {
    const rows = liste([spiel([...mal(5, { team: ID.nord, nr: 7 }), ...mal(4, { team: ID.mitte, nr: 10 }), ...mal(3, { team: ID.sued, nr: 7 })])]);
    expect(kurz(rows)).toEqual([[1, 'FC Nord', 7, 5], [2, 'SG Mitte', 10, 4], [3, 'SV Süd', 7, 3]]);
  });

  it('@ET-033 keine Namen: Zeilen tragen nur Rang, Team, Nummer, Tore', () => {
    const [row] = liste([spiel([{ team: ID.nord, nr: 7 }])]);
    expect(Object.keys(row).sort()).toEqual(['goals', 'kind', 'number', 'rank', 'teamId', 'teamName']);
  });

  describe('@ET-034 welche Tore zählen', () => {
    const grund = (): Match => spiel(mal(2, { team: ID.berg, nr: 9 }));
    it.each([
      ['reguläre Spielzeit des Spiels um Platz 3', [{ team: ID.berg, nr: 9 }], {}, 3],
      ['Verlängerung des Spiels um Platz 3 (Tor-Ereignis)', [{ team: ID.berg, nr: 9 }], { finalType: 'thirdPlace' as const }, 3],
      ['verwandelter Strafstoß im Schießen', [{ team: ID.berg, nr: 9, typ: 'SHOOTOUT_KICK' }], {}, 2],
      ['Tor in einem annullierten Spiel', [{ team: ID.berg, nr: 9 }], { matchStatus: 'skipped' as const }, 2],
    ])('%s', (_name, tore, extra, erwartet) => {
      const rows = liste([grund(), spiel(tore, extra)]);
      expect(kurz(rows)).toEqual([[1, 'DJK Berg', 9, erwartet]]);
    });
  });

  it('@ET-035 Wertung: keine Tor-Ereignisse, keine Zeile für den Gewinner', () => {
    const wertung = spiel([], { scoreA: 2, scoreB: 0, decidedBy: 'forfeit', forfeitAbsent: 'B' });
    expect(liste([wertung])).toEqual([]);
  });

  it('@ET-036 Eigentor: beim begünstigten Team, nie beim Schützen, ohne Rang am Ende', () => {
    const rows = liste([spiel([{ team: ID.nord, nr: 4, eigentor: true }, { team: ID.mitte, nr: 4 }])]);
    expect(kurz(rows)).toEqual([[1, 'SG Mitte', 4, 1], [null, 'FC Nord', 'ownGoals', 1]]);
  });

  it('@ET-037 Tore ohne Nummer gesammelt je Team, nie bei einem Spieler (Gegenbeispiel)', () => {
    const rows = liste([spiel([{ team: ID.nord }, { team: ID.nord }, { team: ID.mitte }])]);
    expect(kurz(rows)).toEqual([[null, 'FC Nord', 'noNumber', 2], [null, 'SG Mitte', 'noNumber', 1]]);
    expect(rows.some((r) => r.kind === 'player')).toBe(false);
  });

  it('@ET-038 Zeilen ohne Rang stehen hinter allen Torschützen, auch mit mehr Toren', () => {
    const rows = liste([spiel([{ team: ID.nord, nr: 7 }, { team: ID.nord }, { team: ID.nord }, { team: ID.nord, nr: 3, eigentor: true }])]);
    expect(kurz(rows)).toEqual([[1, 'FC Nord', 7, 1], [null, 'FC Nord', 'noNumber', 2], [null, 'FC Nord', 'ownGoals', 1]]);
  });

  it('@ET-039 Reihenfolge und gleicher Rang exakt', () => {
    const rows = liste([spiel([
      ...mal(5, { team: ID.nord, nr: 7 }), ...mal(3, { team: ID.mitte, nr: 10 }), ...mal(3, { team: ID.sued, nr: 7 }),
      ...mal(3, { team: ID.sued, nr: 3 }), ...mal(3, { team: ID.nord, nr: 11 }),
    ])]);
    expect(kurz(rows)).toEqual([
      [1, 'FC Nord', 7, 5], [2, 'FC Nord', 11, 3], [2, 'SG Mitte', 10, 3], [2, 'SV Süd', 3, 3], [2, 'SV Süd', 7, 3],
    ]);
  });

  it('@ET-040 deutsche Sortierung: FC Öhringen steht nicht hinter FC Pfalz', () => {
    const rows = liste([spiel([...mal(3, { team: ID.pfalz, nr: 9 }), ...mal(3, { team: ID.oehringen, nr: 5 }), ...mal(3, { team: ID.nord, nr: 2 })])]);
    expect(kurz(rows)).toEqual([[1, 'FC Nord', 2, 3], [1, 'FC Öhringen', 5, 3], [1, 'FC Pfalz', 9, 3]]);
  });

  it('Spieler im Rang danach: nach Nummer, wenn Team und Tore gleich', () => {
    const rows = liste([spiel([...mal(2, { team: ID.nord, nr: 12 }), ...mal(2, { team: ID.nord, nr: 3 })])]);
    expect(kurz(rows)).toEqual([[1, 'FC Nord', 3, 2], [1, 'FC Nord', 12, 2]]);
  });

  describe('@SL-172 / H5: Nummern außerhalb 1–99 in Altdaten stehen unter „ohne Nummer“', () => {
    it.each([[0], [100], [999], [1000], [123456], [-3], [4.5]])('Nummer %s', (nr) => {
      const rows = liste([spiel([{ team: ID.nord, nr }, { team: ID.nord, nr: 99 }, { team: ID.nord, nr: 1 }])]);
      expect(kurz(rows)).toEqual([[1, 'FC Nord', 1, 1], [1, 'FC Nord', 99, 1], [null, 'FC Nord', 'noNumber', 1]]);
    });
  });

  it('jede Zeile besteht die Schemaprüfung des Endstands (auch Nummer ≥ 1000 macht ihn nicht ungültig)', () => {
    const rows = liste([spiel([{ team: ID.nord, nr: 1000 }, { team: ID.nord, nr: 7 }, { team: ID.mitte, eigentor: true }])]);
    rows.forEach((row) => expect(ScorerRowSchema.safeParse(row).success).toBe(true));
    const snapshot = {
      format: 1, appVersion: '1.0.0', computedAt: '2026-11-28T15:30:00.000Z', scorers: rows,
      ranking: [{ place: 1, teamId: ID.nord, teamName: 'FC Nord', origin: { kind: 'groupPlace', group: '', place: 1 } }],
    };
    expect(FinalStandingsSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('Tor eines unbekannten Teams erzeugt keine Zeile ohne Teamnamen', () => {
    expect(liste([spiel([{ team: '00000000-0000-4000-8000-0000000000ff', nr: 5 }])])).toEqual([]);
  });

  it('Tore ohne Spiele: leere Liste', () => {
    expect(liste([])).toEqual([]);
  });

  describe('@EK-009 Torschützen folgen der Korrektur (Engine-Ereignisse, zurückgenommen zählt nicht)', () => {
    const ENGINE: Match = { id: 'm', round: 1, field: 1, ...looseVs('teamA', 'teamB'), matchStatus: 'finished' };
    const teams: Team[] = [{ id: 'teamA', name: 'FC Nord' }, { id: 'teamB', name: 'SV Süd' }];
    const runtime = (log: EngineEvent[]) => toRuntimeEvents(reduceMatch(log, ctx).state, log, ctx);
    const aus = (log: EngineEvent[]) => computeScorers({ teams, matches: [ENGINE] }, new Map([['m', runtime(log)]]));

    it('entferntes Tor zählt nicht mehr für die Nr. 7', () => {
      const rows = aus([start(), goal('g1', 'teamA', 2000, 30_000, { playerNumber: 7 }), goal('g2', 'teamA', 3000, 40_000, { playerNumber: 7 }),
        ev({ id: 'r1', type: 'RETRACT', at: 4000, targetId: 'g2' })]);
      expect(kurz(rows)).toEqual([[1, 'FC Nord', 7, 1]]);
    });

    it('ergänztes Tor für SV Süd Nr. 8 zählt für die Nr. 8', () => {
      const rows = aus([start(), goal('g1', 'teamA', 2000, 30_000, { playerNumber: 7 }), goal('g3', 'teamB', 5000, 50_000, { playerNumber: 8 })]);
      expect(kurz(rows)).toEqual([[1, 'FC Nord', 7, 1], [1, 'SV Süd', 8, 1]]);
    });

    it('Engine-Spiel ohne Karte in match.events: nur die Map zählt', () => {
      const rows = computeScorers({ teams, matches: [{ ...ENGINE, events: runtime([start(), goal('g1', 'teamA', 2000, 30_000, { playerNumber: 7 })]) }] }, new Map([['m', []]]));
      expect(rows).toEqual([]);
    });
  });
});
