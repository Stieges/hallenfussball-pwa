/**
 * B-28a3-4 Punkt 1: Ergebnis als Zustand (nicht als Text). Eingang über `withTournamentState` aus der Fixture, mit
 * echten `Match`-Objekten (Typ aus `types/tournament`). Szenarien: @BM-011, @BM-012, @BM-013, @BM-045.
 */
import { describe, expect, it } from 'vitest';
import type { Match, MatchStatus } from '../../../types/tournament';
import { resultState, type ResultOptions, type ResultState } from '../matchResult';
import { withTournamentState } from '../tournamentState';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';

const KORREKTUR_ZEIT = '2026-11-14T14:52:00';
/** Quelle der Spiel-IDs: der Generator vergibt je Lauf neue IDs, alle Spiele dieses Tests kommen daher. */
const ID_QUELLE = hallencupSchedule();

/** Spiel 12 der Fixture; ihre Plan-ID wird für das Turnier-Spiegelbild gebraucht. */
function spiel(matchNumber: number, overrides: Partial<Match>): { matches: Match[]; scheduleMatchId: string } {
  const base = ID_QUELLE.allMatches.find(m => m.matchNumber === matchNumber);
  if (!base) {throw new Error(`Spiel ${matchNumber} fehlt`);}
  const match: Match = {
    id: base.id,
    round: 0,
    field: base.field,
    slotA: base.slotA,
    slotB: base.slotB,
    originA: base.originA,
    originB: base.originB,
    group: base.group,
    phase: base.phase,
    matchNumber,
    ...overrides,
  };
  return { matches: [match], scheduleMatchId: base.id };
}

/**
 * Zustand von Spiel 12 nach dem Einmischen über `withTournamentState`. Der Plan kommt aus dem Turnier OHNE Spiele
 * (F1, B-28a3-4F): sonst stünden Status und Ergebnis schon im Plan, und der Test prüfte das Einmischen nicht.
 */
function zustandVon(overrides: Partial<Match>, optionen: ResultOptions = {}): ResultState {
  const tournament = hallencupTournament({ matches: spiel(12, overrides).matches });
  const schedule = withTournamentState(hallencupSchedule(hallencupTournament({ matches: spiel(12, {}).matches })), tournament);
  const match = schedule.allMatches.find(m => m.matchNumber === 12);
  if (!match) {throw new Error('Spiel 12 fehlt im Plan');}
  return resultState(match, optionen);
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
  paused: { overrides: { matchStatus: 'paused', scoreA: 1, scoreB: 0 }, zustand: { kind: 'live' } },
  finished: { overrides: { matchStatus: 'finished', scoreA: 2, scoreB: 1 }, zustand: { kind: 'final', scoreA: 2, scoreB: 1 } },
  skipped: { overrides: { matchStatus: 'skipped' }, zustand: { kind: 'skipped' } },
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

  it('F6 zwei Korrekturen: die letzte zählt („korrigiert 14:52“, nicht 14:40)', () => {
    const zweiKorrekturen = [
      { ...KORREKTUR[0], timestamp: '2026-11-14T14:40:00' },
      { ...KORREKTUR[0], timestamp: KORREKTUR_ZEIT },
    ];
    const zustand = zustandVon({ matchStatus: 'finished', scoreA: 2, scoreB: 0, correctionHistory: zweiKorrekturen });
    expect(zustand).toEqual({ kind: 'final', scoreA: 2, scoreB: 0, mark: { kind: 'corrected', at: new Date(KORREKTUR_ZEIT) } });
  });

  it('N5 @DR-019 ausgefallenes Spiel ist eine eigene Art „skipped“ und nicht „empty“ (sonst bekäme es Schreibfelder)', () => {
    const zustand = zustandVon({ matchStatus: 'skipped' });
    expect(zustand).toEqual({ kind: 'skipped' });
    expect(zustand.kind).not.toBe('empty');
  });

  it('N6 @DR-019 beendetes Spiel trägt Verlängerung und Strafstoßschießen, wenn das Turnier sie hat', () => {
    const zustand = zustandVon({
      matchStatus: 'finished', scoreA: 2, scoreB: 2, overtimeScoreA: 3, overtimeScoreB: 3, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty',
    });
    expect(zustand).toEqual({ kind: 'final', scoreA: 2, scoreB: 2, overtime: { a: 3, b: 3 }, penalty: { a: 4, b: 3 } });
  });

  it('N6 gegenbeispiel: nur das Strafstoßschießen ist eingetragen → keine Verlängerung im Zustand', () => {
    const zustand = zustandVon({ matchStatus: 'finished', scoreA: 1, scoreB: 1, penaltyScoreA: 5, penaltyScoreB: 4 });
    expect(zustand).toEqual({ kind: 'final', scoreA: 1, scoreB: 1, penalty: { a: 5, b: 4 } });
    expect(zustand).not.toHaveProperty('overtime');
  });

  it('Fassung „blank“ (Spielplan ohne Ergebnisse): alle Zustände sind leer, auch ein laufendes oder beendetes Spiel', () => {
    for (const { overrides } of Object.values(ERWARTET)) {
      expect(zustandVon(overrides, { edition: 'blank' })).toEqual({ kind: 'empty' });
    }
  });

  it('F4 Schalter „Ergebnisse zeigen“ aus (results: false) ergibt leer, auch bei beendetem Spiel', () => {
    for (const { overrides } of Object.values(ERWARTET)) {
      expect(zustandVon(overrides, { results: false })).toEqual({ kind: 'empty' });
    }
  });

  it('F4 Gegenbeispiel: Schalter an (results: true) zeigt das beendete Spiel mit Ziffern', () => {
    expect(zustandVon({ matchStatus: 'finished', scoreA: 2, scoreB: 1 }, { results: true })).toEqual({ kind: 'final', scoreA: 2, scoreB: 1 });
  });
});

describe('@BM-013 Zeile 2 „gewertet“ folgt mit A-25 / B-35', () => {
  it.todo('@BM-013 Zeile 2 „gewertet“ (nach A-25)');
});
