import { describe, it, expect } from 'vitest';
import { initialState } from '../../applyEvent';
import { reduceMatch } from '../../reduceMatch';
import type { MatchState } from '../../types';
import { applyEngineOverlay, engineOverlayFields, type OverlayableMatch } from '../applyEngineOverlay';
import { ctx, start, goal } from './fixtures';
import type { MatchEngineView } from '../MatchEngine';

function viewFromState(state: MatchState): MatchEngineView {
  return { result: { state, localRejected: [], needsFullReload: false }, log: [], confirmedCount: 0 };
}

describe('applyEngineOverlay (C3a-2a, B3/W7)', () => {
  it('B3: ein Verlaengerungstor zaehlt in der Projektion genau EINMAL (scoreA bleibt regulaer 2, overtimeScoreA separat 1)', () => {
    // Direkt konstruierter Zustand statt ueber Sektions-/Tiebreak-Handler geroutet -- die
    // Verlaengerungs-Semantik selbst ist bereits in cacheColumns.test.ts vollstaendig geprueft;
    // hier geht es nur um die Abbildung state -> Turnier-Felder (engineOverlayFields).
    const base = initialState(ctx);
    const state: MatchState = {
      ...base,
      status: 'finished',
      phase: 'overtime',
      finishedAt: 9999,
      decidedBy: 'overtime',
      baseDecidedBy: 'overtime',
      scores: {
        [ctx.teamAId]: { regular: 2, overtime: 1, shootout: 0 },
        [ctx.teamBId]: { regular: 2, overtime: 0, shootout: 0 },
      },
    };

    const fields = engineOverlayFields(viewFromState(state), ctx);

    expect(fields.scoreA).toBe(2);
    expect(fields.overtimeScoreA).toBe(1);
    expect(fields.scoreB).toBe(2);
    expect(fields.overtimeScoreB).toBe(0);
    expect(fields.decidedBy).toBe('overtime');
    expect(fields.matchStatus).toBe('finished');
    // Die "effektive" (fuer die Anzeige addierte) Rechnung waere 3 -- genau die Verwechslung,
    // die B3 (Plan-Review) ausschliesst.
    expect(fields.scoreA).not.toBe(3);
  });

  it('matchStatus: section_break/decision_pending/shootout (Engine "paused") wird auf "running" abgebildet (Turnierkopie kennt kein "paused")', () => {
    const base = initialState(ctx);
    const state: MatchState = { ...base, status: 'section_break', phase: 'regular' };

    const fields = engineOverlayFields(viewFromState(state), ctx);

    expect(fields.matchStatus).toBe('running');
  });

  it('applyEngineOverlay: unveraendertes Tournament-Objekt (Referenzstabilitaet), wenn nichts abweicht', () => {
    const { state } = reduceMatch([start()], ctx);
    const fields = engineOverlayFields(viewFromState(state), ctx);
    const match: OverlayableMatch = {
      id: ctx.matchId,
      scoreA: fields.scoreA,
      scoreB: fields.scoreB,
      matchStatus: fields.matchStatus,
    };
    const tournament = { matches: [match] };
    const overlays = new Map([[ctx.matchId, fields]]);

    expect(applyEngineOverlay(tournament, overlays)).toBe(tournament);
  });

  it('applyEngineOverlay: schreibt scoreA/scoreB/matchStatus fuer ein abweichendes Match und laesst andere unberuehrt', () => {
    const { state } = reduceMatch([start(), goal('g1', ctx.teamAId, 1000, 0)], ctx);
    const fields = engineOverlayFields(viewFromState(state), ctx);
    const untouched: OverlayableMatch = { id: 'm-other', scoreA: 3, scoreB: 3, matchStatus: 'scheduled' };
    const stale: OverlayableMatch = { id: ctx.matchId, scoreA: 0, scoreB: 0, matchStatus: 'scheduled' };
    const tournament = { matches: [untouched, stale] };
    const overlays = new Map([[ctx.matchId, fields]]);

    const result = applyEngineOverlay(tournament, overlays);

    expect(result).not.toBe(tournament);
    expect(result.matches[0]).toBe(untouched);
    expect(result.matches[1]).toMatchObject({ id: ctx.matchId, scoreA: 1, scoreB: 0, matchStatus: 'running' });
  });

  it('applyEngineOverlay: leere overlays-Map liefert dasselbe Tournament-Objekt', () => {
    const tournament = { matches: [{ id: 'm1', scoreA: 0, scoreB: 0 }] };
    expect(applyEngineOverlay(tournament, new Map())).toBe(tournament);
  });
});
