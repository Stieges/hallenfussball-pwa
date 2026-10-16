/**
 * `cacheColumns` (C0a, V2/RC12): exakte Spalten wie `match_engine.cache_columns` (003) plus die
 * neuen `live_state`-Schlüssel. Vollständige Vergleiche für typische Zustände, dazu eine
 * Formprüfung über alle Engine-Fixtures (Schlüsselmenge, Ganzzahlen, `null` statt fehlend).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cacheColumns } from '../client/cacheColumns';
import { initialState } from '../applyEvent';
import { applyBatch, continueLog, reduceMatch } from '../reduceMatch';
import type { EngineEvent, MatchContext, MatchRules, MatchState } from '../types';

const ctx: MatchContext = { matchId: 'match-cache', teamAId: 'teamA', teamBId: 'teamB' };

const RULES: MatchRules = {
  sections: 2,
  sectionSeconds: 600,
  breakSeconds: 60,
  knockout: false,
  tiebreak: null,
  overtimeSeconds: 0,
  shootersPerTeam: 5,
  suddenDeathAfter: 5,
  penaltySeconds: 120,
};

function ev(partial: Partial<EngineEvent> & Pick<EngineEvent, 'id' | 'type' | 'at'>): EngineEvent {
  return { actor: 'helper', section: 1, clockMs: null, payload: {}, ...partial };
}

function run(events: EngineEvent[]): MatchState {
  const { state, results } = reduceMatch(events, ctx);
  for (const result of results) {
    expect(result.status).toBe('accepted');
  }
  return state;
}

/** Abgesetztes Spiel mit den uebergebenen angenommenen SKIP-Ereignissen als Zustand. */
function skippedState(accepted: Record<string, EngineEvent>): MatchState {
  return { ...initialState(ctx), status: 'skipped', accepted };
}

const COLUMN_KEYS = [
  'score_a',
  'score_b',
  'overtime_score_a',
  'overtime_score_b',
  'penalty_score_a',
  'penalty_score_b',
  'match_status',
  'decided_by',
  'running',
  'started',
  'anchor_at',
  'timer_elapsed_seconds',
  'finished_at',
  'live_state',
  'skipped_at',
  'skipped_reason',
].sort();

const LIVE_STATE_KEYS = [
  'engine',
  'status',
  'phase',
  'section',
  'running',
  'elapsedMs',
  'anchorAt',
  'elapsedSeconds',
  'durationSeconds',
  'playPhase',
  'tiebreakerMode',
  'overtimeDurationSeconds',
  'awaitingTiebreakerChoice',
  'sections',
  'sectionSeconds',
  'breakSeconds',
  'overtimeSeconds',
  'sectionStartMs',
  'breakStartedAt',
].sort();

describe('cacheColumns', () => {
  // C0b-Fixrunde 1 (Review M2, Ruling PC6): skipped_at (at des SKIP, Epoch-ms) und skipped_reason
  // (payload.reason oder null) nur im Status skipped, sonst null.
  it('abgesetzt mit Grund: skipped_at = at des SKIP, skipped_reason = payload.reason', () => {
    const state = run([ev({ id: 'k', type: 'SKIP', actor: 'leitung', at: 4321, payload: { reason: 'Team fehlt' } })]);
    expect(cacheColumns(state, ctx)).toMatchObject({ match_status: 'skipped', skipped_at: 4321, skipped_reason: 'Team fehlt', live_state: null });
  });

  it('abgesetzt ohne Grund: skipped_reason null', () => {
    const state = run([ev({ id: 'k', type: 'SKIP', actor: 'leitung', at: 4321 })]);
    expect(cacheColumns(state, ctx)).toMatchObject({ skipped_at: 4321, skipped_reason: null });
  });

  it('UNSKIP: beide null; erneuter SKIP: Zeit und Grund des letzten SKIP', () => {
    const unskipped = run([
      ev({ id: 'k1', type: 'SKIP', actor: 'leitung', at: 1000, payload: { reason: 'alt' } }),
      ev({ id: 'u1', type: 'UNSKIP', actor: 'leitung', at: 2000 }),
    ]);
    expect(cacheColumns(unskipped, ctx)).toMatchObject({ match_status: 'scheduled', skipped_at: null, skipped_reason: null });
    const again = run([
      ev({ id: 'k1', type: 'SKIP', actor: 'leitung', at: 1000, payload: { reason: 'alt' } }),
      ev({ id: 'u1', type: 'UNSKIP', actor: 'leitung', at: 2000 }),
      ev({ id: 'k2', type: 'SKIP', actor: 'leitung', at: 3000, payload: { reason: 'neu' } }),
    ]);
    expect(cacheColumns(again, ctx)).toMatchObject({ skipped_at: 3000, skipped_reason: 'neu' });
  });

  it('geplantes Spiel: keine Stände, kein live_state', () => {
    expect(cacheColumns(initialState(ctx), ctx)).toEqual({
      score_a: null,
      score_b: null,
      overtime_score_a: null,
      overtime_score_b: null,
      penalty_score_a: null,
      penalty_score_b: null,
      match_status: 'scheduled',
      decided_by: null,
      running: false,
      started: false,
      anchor_at: null,
      timer_elapsed_seconds: 0,
      finished_at: null,
      live_state: null,
      skipped_at: null,
      skipped_reason: null,
    });
  });

  it('laufendes Spiel in Abschnitt 2: alle live_state-Schlüssel', () => {
    const state = run([
      ev({ id: 's', type: 'MATCH_START', at: 1000, payload: { rules: RULES } }),
      ev({ id: 'g', type: 'GOAL', at: 2000, clockMs: 60000, teamId: 'teamB' }),
      ev({ id: 'e', type: 'SECTION_END', at: 601000, clockMs: 600000 }),
      ev({ id: 'st', type: 'SECTION_START', at: 661000, section: 2, clockMs: 600000 }),
    ]);
    expect(cacheColumns(state, ctx)).toEqual({
      score_a: 0,
      score_b: 1,
      overtime_score_a: null,
      overtime_score_b: null,
      penalty_score_a: null,
      penalty_score_b: null,
      match_status: 'running',
      decided_by: null,
      running: true,
      started: true,
      anchor_at: 661000,
      timer_elapsed_seconds: 600,
      finished_at: null,
      live_state: {
        engine: true,
        status: 'running',
        phase: 'regular',
        section: 2,
        running: true,
        elapsedMs: 600000,
        anchorAt: 661000,
        elapsedSeconds: 600,
        durationSeconds: 1200,
        playPhase: 'regular',
        tiebreakerMode: null,
        overtimeDurationSeconds: 0,
        awaitingTiebreakerChoice: false,
        sections: 2,
        sectionSeconds: 600,
        breakSeconds: 60,
        overtimeSeconds: 0,
        sectionStartMs: 600000,
        breakStartedAt: null,
      },
      skipped_at: null,
      skipped_reason: null,
    });
  });

  it('beendet per Korrektur: effektiver Stand, decided_by regular, live_state null', () => {
    const state = run([
      ev({ id: 's', type: 'MATCH_START', at: 1000, payload: { rules: RULES } }),
      ev({ id: 'g', type: 'GOAL', at: 2000, clockMs: 60000, teamId: 'teamA' }),
      ev({ id: 'end', type: 'MATCH_END', at: 5000, clockMs: 240500 }),
      ev({
        id: 'c',
        type: 'CORRECTION',
        actor: 'leitung',
        at: 6000,
        payload: { scores: { teamA: 2, teamB: 0 }, reason: 'Tor vergessen', basedOn: 'g' },
      }),
    ]);
    expect(cacheColumns(state, ctx)).toEqual({
      score_a: 2,
      score_b: 0,
      overtime_score_a: null,
      overtime_score_b: null,
      penalty_score_a: null,
      penalty_score_b: null,
      match_status: 'finished',
      decided_by: 'regular',
      running: false,
      started: true,
      anchor_at: null,
      timer_elapsed_seconds: 240,
      finished_at: 5000,
      live_state: null,
      skipped_at: null,
      skipped_reason: null,
    });
  });

  it('SKIP: wählt den mit größtem at (bei Gleichstand später eingefügter, nicht einfach letzten)', () => {
    const state = skippedState({
      k1: ev({ id: 'k1', type: 'SKIP', actor: 'leitung', at: 2000, payload: { reason: 'alt' } }),
      k2: ev({ id: 'k2', type: 'SKIP', actor: 'leitung', at: 3000, payload: { reason: 'neu' } }),
    });
    expect(cacheColumns(state, ctx)).toMatchObject({ skipped_at: 3000, skipped_reason: 'neu' });
  });

  it('SKIP bei Gleichstand: der spaeter eingefuegte gewinnt (Einfuegereihenfolge, nicht ID-Reihenfolge)', () => {
    // 'z' ist lexikographisch groesser als 'a', wird aber VORHER eingefuegt.
    const state = skippedState({
      z: ev({ id: 'z', type: 'SKIP', actor: 'leitung', at: 100, payload: { reason: 'zuerst' } }),
      a: ev({ id: 'a', type: 'SKIP', actor: 'leitung', at: 100, payload: { reason: 'spaeter' } }),
    });
    expect(cacheColumns(state, ctx)).toMatchObject({ skipped_at: 100, skipped_reason: 'spaeter' });
  });

  it('SKIP mit Nicht-UUID-IDs 1,2,3 bei gleichem at: der letzte gewinnt', () => {
    const state = skippedState({
      '1': ev({ id: '1', type: 'SKIP', actor: 'leitung', at: 100, payload: { reason: 'erster' } }),
      '2': ev({ id: '2', type: 'SKIP', actor: 'leitung', at: 100, payload: { reason: 'zweiter' } }),
      '3': ev({ id: '3', type: 'SKIP', actor: 'leitung', at: 100, payload: { reason: 'dritter' } }),
    });
    expect(cacheColumns(state, ctx)).toMatchObject({ skipped_at: 100, skipped_reason: 'dritter' });
  });

  it('SKIP mit Nicht-UUID-IDs: groesstes at gewinnt unabhängig von der ID', () => {
    const state = skippedState({
      '1': ev({ id: '1', type: 'SKIP', actor: 'leitung', at: 100, payload: { reason: 'frueh' } }),
      '2': ev({ id: '2', type: 'SKIP', actor: 'leitung', at: 200, payload: { reason: 'spaet' } }),
      '3': ev({ id: '3', type: 'SKIP', actor: 'leitung', at: 150, payload: { reason: 'mittel' } }),
    });
    expect(cacheColumns(state, ctx)).toMatchObject({ skipped_at: 200, skipped_reason: 'spaet' });
  });

  it('Golden Goal: Verlängerungsstand getrennt, decided_by goldenGoal', () => {
    const rules: MatchRules = { ...RULES, sections: 1, knockout: true, tiebreak: 'goldenGoal', overtimeSeconds: 300 };
    const state = run([
      ev({ id: 's', type: 'MATCH_START', at: 1000, payload: { rules } }),
      ev({ id: 'end', type: 'MATCH_END', at: 601000, clockMs: 600000 }),
      ev({ id: 'st', type: 'SECTION_START', at: 661000, section: 2, clockMs: 600000 }),
      ev({ id: 'gg', type: 'GOAL', at: 700000, section: 2, clockMs: 639000, teamId: 'teamA' }),
    ]);
    expect(cacheColumns(state, ctx)).toMatchObject({
      score_a: 0,
      score_b: 0,
      overtime_score_a: 1,
      overtime_score_b: 0,
      match_status: 'finished',
      decided_by: 'goldenGoal',
      timer_elapsed_seconds: 639,
      finished_at: 700000,
      live_state: null,
      skipped_at: null,
      skipped_reason: null,
    });
  });

  it('Strafstoßschießen: match_status paused, penalty_score gesetzt', () => {
    const rules: MatchRules = { ...RULES, sections: 1, knockout: true, tiebreak: 'shootout' };
    const state = run([
      ev({ id: 's', type: 'MATCH_START', at: 1000, payload: { rules } }),
      ev({ id: 'end', type: 'MATCH_END', at: 601000, clockMs: 600000 }),
      ev({ id: 'k', type: 'SHOOTOUT_KICK', at: 610000, teamId: 'teamA', payload: { scored: true } }),
    ]);
    const columns = cacheColumns(state, ctx);
    expect(columns).toMatchObject({
      score_a: 0,
      score_b: 0,
      overtime_score_a: null,
      penalty_score_a: 1,
      penalty_score_b: 0,
      match_status: 'paused',
      decided_by: null,
      started: true,
    });
    expect(columns.live_state).toMatchObject({ status: 'shootout', phase: 'shootout', playPhase: 'penalty' });
  });

  it('decided_by-Abbildung: shootout -> penalty, direct -> regular, nicht beendet -> null', () => {
    const base = initialState(ctx);
    expect(cacheColumns({ ...base, status: 'finished', decidedBy: 'shootout' }, ctx).decided_by).toBe('penalty');
    expect(cacheColumns({ ...base, status: 'finished', decidedBy: 'direct' }, ctx).decided_by).toBe('regular');
    expect(cacheColumns({ ...base, status: 'finished', decidedBy: 'overtime' }, ctx).decided_by).toBe('overtime');
    expect(cacheColumns({ ...base, status: 'finished', decidedBy: null }, ctx).decided_by).toBeNull();
    expect(cacheColumns({ ...base, status: 'paused', decidedBy: 'regular' }, ctx).decided_by).toBeNull();
  });
});

describe('cacheColumns über alle Engine-Fixtures: Form (null statt fehlend, Ganzzahlen)', () => {
  const fixturesDir = path.join(__dirname, '..', '__fixtures__');
  const fileNames = fs
    .readdirSync(fixturesDir)
    .filter((name) => name.endsWith('.json'))
    .sort();

  for (const fileName of fileNames) {
    it(fileName, () => {
      const fixture = JSON.parse(fs.readFileSync(path.join(fixturesDir, fileName), 'utf-8')) as {
        ctx: MatchContext;
        mode: 'log' | 'batch';
        prior?: EngineEvent[];
        events: EngineEvent[];
      };
      const prior = continueLog(initialState(fixture.ctx), fixture.prior ?? [], fixture.ctx);
      const outcome =
        fixture.mode === 'log'
          ? continueLog(prior.state, fixture.events, fixture.ctx)
          : applyBatch(prior.state, fixture.events, fixture.ctx);
      const columns = cacheColumns(outcome.state, fixture.ctx);
      expect(Object.keys(columns).sort()).toEqual(COLUMN_KEYS);
      for (const value of Object.values(columns)) {
        expect(value).not.toBeUndefined();
        if (typeof value === 'number') {
          expect(Number.isInteger(value)).toBe(true);
        }
      }
      if (columns.live_state !== null) {
        expect(Object.keys(columns.live_state).sort()).toEqual(LIVE_STATE_KEYS);
        for (const value of Object.values(columns.live_state)) {
          expect(value).not.toBeUndefined();
          if (typeof value === 'number') {
            expect(Number.isInteger(value)).toBe(true);
          }
        }
      }
    });
  }
});
