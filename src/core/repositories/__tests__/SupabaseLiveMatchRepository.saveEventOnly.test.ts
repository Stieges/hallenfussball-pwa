/**
 * SupabaseLiveMatchRepository.save — V4 (C3a-2b): nur noch Event-Insert.
 *
 * save() fügt match_events ein und lässt die `matches`-Zeile unberührt (auch kein
 * updated_at-Touch, F6). Räum-Operationen bleiben: delete()/clear() setzen
 * live_state auf null (F7).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LiveMatch } from '../../models/LiveMatch';

const hoisted = vi.hoisted(() => {
  // matches: update(...).eq(...) reicht für delete()/clear(); save() darf update() nie aufrufen.
  function updateChain() {
    const api = {
      eq: vi.fn(() => api),
      select: vi.fn(() => api),
      maybeSingle: vi.fn().mockResolvedValue({ data: { version: 1 }, error: null }),
      single: vi.fn().mockResolvedValue({ data: { version: 1, match_status: 'scheduled' }, error: null }),
    };
    return api;
  }
  const matchesUpdateMock = vi.fn(() => updateChain());
  const eventsUpsertMock = vi.fn(() => Promise.resolve({ error: null }));
  const fromMock = vi.fn((table: string) => {
    if (table === 'matches') { return { update: matchesUpdateMock }; }
    if (table === 'match_events') { return { upsert: eventsUpsertMock }; }
    throw new Error(`unexpected table in test mock: ${table}`);
  });
  return { matchesUpdateMock, eventsUpsertMock, fromMock };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: hoisted.fromMock },
  isSupabaseConfigured: true,
}));

vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));

import { SupabaseLiveMatchRepository } from '../SupabaseLiveMatchRepository';

function makeLiveMatch(): LiveMatch {
  return {
    id: 'm1',
    number: 1,
    phaseLabel: 'Gruppenphase',
    fieldId: 'field-1',
    scheduledKickoff: '2024-01-01T12:00:00.000Z',
    version: 5,
    homeTeam: { id: 'a', name: 'A' },
    awayTeam: { id: 'b', name: 'B' },
    homeScore: 1,
    awayScore: 0,
    status: 'RUNNING',
    elapsedSeconds: 120,
    durationSeconds: 600,
    tournamentPhase: 'groupStage',
    events: [
      {
        id: 'ev-1',
        matchId: 'm1',
        timestampSeconds: 60,
        type: 'GOAL' as const,
        payload: { team: 'home' as const, delta: 1 },
        scoreAfter: { home: 1, away: 0 },
      },
    ],
  };
}

describe('SupabaseLiveMatchRepository.save — V4: nur Event-Insert (C3a-2b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('save() führt KEIN matches-UPDATE aus (nur Event-Insert)', async () => {
    const repo = new SupabaseLiveMatchRepository();

    await repo.save('t1', makeLiveMatch());

    expect(hoisted.matchesUpdateMock).not.toHaveBeenCalled();
    expect(hoisted.eventsUpsertMock).toHaveBeenCalledTimes(1);
  });

  it('B5: save() ohne matches-UPDATE, delete() räumt live_state weiterhin', async () => {
    const repo = new SupabaseLiveMatchRepository();

    await repo.save('t1', makeLiveMatch());
    expect(hoisted.matchesUpdateMock).not.toHaveBeenCalled();

    await repo.delete('t1', 'm1');
    expect(hoisted.matchesUpdateMock).toHaveBeenCalledWith({ live_state: null });
  });

  it('F7: clear() räumt live_state weiterhin', async () => {
    const repo = new SupabaseLiveMatchRepository();

    await repo.clear('t1');

    expect(hoisted.matchesUpdateMock).toHaveBeenCalledWith({ live_state: null });
  });
});
