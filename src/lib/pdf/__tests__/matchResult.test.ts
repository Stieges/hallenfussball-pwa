/**
 * B-28a3-4 Punkt 1: Ergebnis als Zustand (nicht als Text). Eingang über `withTournamentState` aus der Fixture, mit
 * echten `Match`-Objekten (Typ aus `types/tournament`). Szenarien: @BM-011, @BM-012, @BM-013, @BM-045.
 */
import { describe, expect, it } from 'vitest';
import type { Match, MatchStatus } from '../../../types/tournament';
import { resultState, type ResultState } from '../matchResult';
import { withTournamentState } from '../tournamentState';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';

const KORREKTUR_ZEIT = '2026-11-14T14:52:00';
/** Spiel 12 der Fixture; ihre Plan-ID wird für das Turnier-Spiegelbild gebraucht. */
function spiel(matchNumber: number, overrides: Partial<Match>): { matches: Match[]; scheduleMatchId: string } {
  const schedule = hallencupSchedule();
  const base = schedule.allMatches.find(m => m.matchNumber === matchNumber);
  if (!base) {throw new Error(`Spiel ${matchNumber} fehlt`);}
  const match: Match = {
    id: base.id,
    round: 0,
    field: base.field,
    teamA: base.originalTeamA,
    teamB: base.originalTeamB,
    group: base.group,
    phase: base.phase,
    matchNumber,
    ...overrides,
  };
  return { matches: [match], scheduleMatchId: base.id };
}

/** Zustand von Spiel 12 nach dem Einmischen über `withTournamentState`. */
function zustandVon(overrides: Partial<Match>, edition: 'plan' | 'blank' = 'plan'): ResultState {
  const tournament = hallencupTournament({ matches: spiel(12, overrides).matches });
  const schedule = withTournamentState(hallencupSchedule(tournament), tournament);
  const match = schedule.allMatches.find(m => m.matchNumber === 12);
  if (!match) {throw new Error('Spiel 12 fehlt im Plan');}
  return resultState(match, edition);
}

const KORREKTUR = [{
  timestamp: KORREKTUR_ZEIT,
  previousScoreA: 1,
  previousScoreB: 0,
  newScoreA: 2,
  newScoreB: 0,
}];

/** Je Status des echten `MatchStatus`-Typs der erwartete Zustand (geplant und wartend sind leer). */
const ERWARTET: Record<MatchStatus, { overrides: Partial<Match>; zustand: ResultState }> = {
  scheduled: { overrides: {}, zustand: { kind: 'empty' } },
  waiting: { overrides: { matchStatus: 'waiting' }, zustand: { kind: 'empty' } },
  running: { overrides: { matchStatus: 'running', scoreA: 1, scoreB: 0 }, zustand: { kind: 'live' } },
  finished: { overrides: { matchStatus: 'finished', scoreA: 2, scoreB: 1 }, zustand: { kind: 'final', scoreA: 2, scoreB: 1 } },
  skipped: { overrides: { matchStatus: 'skipped' }, zustand: { kind: 'empty', mark: { kind: 'skipped' } } },
};

describe('@BM-011 @BM-012 @BM-045 Ergebniszustand je Status des Spiels', () => {
  it.each(Object.entries(ERWARTET))('Status „%s“ ergibt den erwarteten Zustand', (_status, { overrides, zustand }) => {
    expect(zustandVon(overrides)).toEqual(zustand);
  });

  it('@BM-012 Gegenbeispiel: Spiel 12 läuft 1:0 → „live“, ohne Ziffern im Zustand', () => {
    const zustand = zustandVon({ matchStatus: 'running', scoreA: 1, scoreB: 0 });
    expect(zustand).toEqual({ kind: 'live' });
    expect(zustand).not.toHaveProperty('scoreA');
  });

  it('@BM-013 korrigiertes Spiel → Ergebnis mit Markierung „corrected“ und der Zeit der Korrektur', () => {
    const zustand = zustandVon({ matchStatus: 'finished', scoreA: 2, scoreB: 0, correctionHistory: KORREKTUR });
    expect(zustand).toEqual({ kind: 'final', scoreA: 2, scoreB: 0, mark: { kind: 'corrected', at: new Date(KORREKTUR_ZEIT) } });
  });

  it('@BM-013 übersprungenes Spiel → Markierung „skipped“', () => {
    expect(zustandVon({ matchStatus: 'skipped' })).toEqual({ kind: 'empty', mark: { kind: 'skipped' } });
  });

  it('Fassung „blank“ (Spielplan zum Ausfüllen): alle Zustände sind leer, auch ein laufendes oder beendetes Spiel', () => {
    for (const { overrides } of Object.values(ERWARTET)) {
      expect(zustandVon(overrides, 'blank')).toEqual({ kind: 'empty' });
    }
  });
});

describe('@BM-013 Zeile 2 „gewertet“ folgt mit A-25 / B-35', () => {
  it.todo('@BM-013 Zeile 2 „gewertet“ (nach A-25)');
});
