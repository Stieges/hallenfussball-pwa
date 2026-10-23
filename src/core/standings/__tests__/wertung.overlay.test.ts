/**
 * Review A-25c, „Muss für G1a/A-25n“: Test „lokaler Eintrag Wertung beider vor der Server-Zeile → kein Remis“.
 * Die Turnierleitung wertet West – Ost als „beide nicht angetreten“; die Server-Zeile führt das Spiel noch offen, die
 * Kopie bekommt den Eintrag über die Engine-Überlagerung (`applyEngineOverlay`). Die Tabelle (A-25c, `matchOutcome`)
 * muss daraus je 0 Punkte und je 0:2 rechnen, nicht ein Remis.
 * Records `2026-09-27_wizard-regelinhalte` (@W2A-024, @W2A-026) und `2026-10-01_turniermodi` (@TM-063).
 */
import { describe, expect, it } from 'vitest';
import { applyEngineOverlay, engineOverlayFields } from '../../match/client/applyEngineOverlay';
import type { MatchEngineView } from '../../match/client/MatchEngine';
import { reduceMatch } from '../../match/reduceMatch';
import type { EngineEvent, MatchContext } from '../../match/types';
import { calculateStandings } from '../../../utils/calculations';
import type { Tournament } from '../../../types/tournament';
import { id, league, parseMatches, type Key } from './fixtures';
import { cloudTournament, matchIdOf } from './forfeitKit';

const RESULTS = 'N–B 2:1; N–W 1:0; N–O 3:0; B–W 2:2; B–O 1:1; W–O 0:0';
const WEST_OST = matchIdOf(RESULTS, 'W–O');
const { teams } = league('NBWO', RESULTS, { group: 'A' });
/** Server-Zeile: West – Ost noch offen (der lokale Eintrag ist noch nicht zurückgemeldet). */
const serverStand = (): Tournament => cloudTournament(teams, parseMatches(RESULTS, { group: 'A', open: ['W–O'] }));
const ctx: MatchContext = { matchId: WEST_OST, teamAId: id('W'), teamBId: id('O') };

let seq = 0;
function ev(type: EngineEvent['type'], payload: Record<string, unknown> = {}, extra: Partial<EngineEvent> = {}): EngineEvent {
  seq += 1;
  return {
    id: `0000a25c-0000-4000-9000-${String(seq).padStart(12, '0')}`,
    type, actor: 'leitung', at: 1000 * seq, section: null, clockMs: null, payload, ...extra,
  };
}

/** Kopie der Turnierleitung: Server-Stand mit dem lokalen Engine-Eintrag für West – Ost überlagert. */
function lokal(log: EngineEvent[]): Tournament {
  const { state } = reduceMatch(log, ctx);
  const view: MatchEngineView = { result: { state, localRejected: [], needsFullReload: false }, log, confirmedCount: 0 };
  return applyEngineOverlay(serverStand(), new Map([[WEST_OST, engineOverlayFields(view, ctx)]]));
}

const rowOf = (t: Tournament, key: Key) => {
  const row = calculateStandings(t.teams, t.matches, t, 'A').find((r) => r.team.id === id(key));
  if (row === undefined) { throw new Error(`Team ${key} fehlt`); }
  return { won: row.won, drawn: row.drawn, lost: row.lost, goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst, points: row.points };
};

/** West ohne West – Ost: N–W 0:1, B–W 2:2; Ost: N–O 0:3, B–O 1:1. */
const WEST_OHNE = { won: 0, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 1 };
const OST_OHNE = { won: 0, drawn: 1, lost: 1, goalsFor: 1, goalsAgainst: 4, points: 1 };

describe('Review A-25c: lokaler Eintrag vor der Server-Zeile (Engine-Überlagerung) in der Tabelle', () => {
  it('@W2A-024:teil @TM-063:teil beide nicht angetreten, nur lokal: je 0 Punkte und je 0:2, kein Remis', () => {
    const t = lokal([ev('RESULT_ENTRY', { scores: { [id('W')]: 0, [id('O')]: 0 }, forfeit: { absent: 'both' } })]);
    expect(rowOf(t, 'W')).toEqual({ ...WEST_OHNE, lost: 2, goalsAgainst: 5 });
    expect(rowOf(t, 'O')).toEqual({ ...OST_OHNE, lost: 2, goalsAgainst: 6 });
  });

  it('@W2A-024:teil Gegenbeispiel: ein gespieltes 0:0 (lokal eingetragen, ohne Wertung) bleibt ein Remis', () => {
    const t = lokal([ev('RESULT_ENTRY', { scores: { [id('W')]: 0, [id('O')]: 0 } })]);
    expect(rowOf(t, 'W')).toEqual({ ...WEST_OHNE, drawn: 2, points: 2 });
    expect(rowOf(t, 'O')).toEqual({ ...OST_OHNE, drawn: 2, points: 2 });
  });

  it('@W2A-026:teil Gegenbeispiel: beide gewertet, dann lokal zurückgenommen: West – Ost zählt nicht (wieder offen)', () => {
    const t = lokal([ev('RESULT_ENTRY', { scores: { [id('W')]: 0, [id('O')]: 0 }, forfeit: { absent: 'both' } }), ev('REOPEN')]);
    expect(rowOf(t, 'W')).toEqual(WEST_OHNE);
    expect(rowOf(t, 'O')).toEqual(OST_OHNE);
  });
});
