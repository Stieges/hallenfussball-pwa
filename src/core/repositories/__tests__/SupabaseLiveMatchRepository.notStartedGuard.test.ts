import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LiveMatch } from '../../models/LiveMatch';

// ============================================================================
// MOCKS — Spy auf supabase.from (gleicher Ansatz wie saveEventOnly.test.ts)
// ============================================================================

const hoisted = vi.hoisted(() => {
  const matchesUpdateMock = vi.fn(() => Promise.resolve({ error: null }));
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

function makeNotStartedMatch(overrides: Partial<LiveMatch> = {}): LiveMatch {
  return {
    id: 'm1',
    number: 1,
    phaseLabel: 'Gruppenphase',
    fieldId: 'field-1',
    scheduledKickoff: '2024-01-01T12:00:00.000Z',
    version: 5,
    homeTeam: { id: 'a', name: 'A' },
    awayTeam: { id: 'b', name: 'B' },
    homeScore: 0,
    awayScore: 0,
    status: 'NOT_STARTED',
    elapsedSeconds: 0,
    durationSeconds: 600,
    tournamentPhase: 'groupStage',
    events: [],
    ...overrides,
  };
}

describe('SupabaseLiveMatchRepository — NOT_STARTED-Schreibschutz entbehrlich (V4, C3a-2b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Ersatz für „übersprungenes Spiel: save() mit NOT_STARTED setzt "skipped" NICHT auf
  // "scheduled" zurück, Konfliktpfad greift" (Alt-Test erwartete OptimisticLockError).
  // Ohne Zeilen-UPDATE gibt es nichts, was einen Schreibschutz bräuchte.
  it('save() ohne Zeilen-UPDATE braucht keinen NOT_STARTED-Schreibschutz mehr', async () => {
    const repo = new SupabaseLiveMatchRepository();
    const match = makeNotStartedMatch({ version: 5 });

    await expect(repo.save('t1', match)).resolves.toBeUndefined();

    expect(hoisted.matchesUpdateMock).not.toHaveBeenCalled();
  });

  // Ersatz für „Normalfall: ein nie gestartetes Spiel mit "scheduled" wird weiterhin
  // erfolgreich initialisiert" (Alt-Test erwartete matches-UPDATE inkl. Status-Schreib).
  it('save() wirft auch bei leerem Event-Set kein OptimisticLockError (kein CAS mehr)', async () => {
    const repo = new SupabaseLiveMatchRepository();
    const match = makeNotStartedMatch({ version: 1 });

    await expect(repo.save('t1', match)).resolves.toBeUndefined();

    expect(hoisted.matchesUpdateMock).not.toHaveBeenCalled();
  });
});
