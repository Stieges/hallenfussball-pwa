/**
 * SupabaseLiveMatchRepository — event insert failure must not be forgotten (Task 2)
 * + Wiederholbarkeit des Event-Uploads (Sofort-Fix C-EVID, 2026-09-25, Ruling Q)
 *
 * Root cause (Task 2): `save()` writes new match_events in one batch insert. If Postgres
 * rejects the whole statement (e.g. CHECK violation because `type` isn't in the
 * allow-list — this used to be true for 'FOUL', see the 2026-09-18 migration),
 * the error was logged but swallowed ("Don't throw - match was updated
 * successfully"), and the loop right after it added ALL of those event ids to
 * `eventIdsCache` unconditionally. The next save() then believed those events
 * were already persisted and never sent them again — a silent, permanent loss.
 *
 * Sofort-Fix C-EVID (2026-09-25): `insert` → `upsert(…, { onConflict: 'id',
 * ignoreDuplicates: true })`, damit eine Wiederholung (z. B. nach verlorener
 * Erfolgsbestätigung) nicht am doppelten Schlüssel scheitert und den ganzen Stapel
 * blockiert. Ruling Q verlangt genau diesen Nachweis als Vitest mit Mock — der
 * einmalige Nachweis gegen den echten lokalen Stack steht im Report.
 *
 * `eventIdsCache` is private, so these tests assert its effect indirectly:
 * calling save() twice with the same LiveMatch and inspecting what the second
 * call actually sends to Postgres.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LiveMatch } from '../../models/LiveMatch';
import { toDeterministicUuid } from '../../utils/id';

// ============================================================================
// MOCKS
// ============================================================================

const hoisted = vi.hoisted(() => {
  const upsertMock = vi.fn();
  const maybeSingleMock = vi.fn();
  const selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const eqVersionMock = vi.fn(() => ({ select: selectMock }));
  const eqIdMock = vi.fn(() => ({ eq: eqVersionMock }));
  const updateMock = vi.fn(() => ({ eq: eqIdMock }));

  const fromMock = vi.fn((table: string) => {
    if (table === 'matches') {
      return { update: updateMock };
    }
    if (table === 'match_events') {
      return { upsert: upsertMock };
    }
    throw new Error(`unexpected table in test mock: ${table}`);
  });

  const supabaseMock = { from: fromMock };

  return { upsertMock, maybeSingleMock, selectMock, eqVersionMock, eqIdMock, updateMock, fromMock, supabaseMock };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: hoisted.supabaseMock,
  isSupabaseConfigured: true,
}));

vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

import { SupabaseLiveMatchRepository } from '../SupabaseLiveMatchRepository';
import { captureFeatureError } from '../../../lib/sentry';

const { upsertMock, maybeSingleMock } = hoisted;
const captureFeatureErrorMock = vi.mocked(captureFeatureError);

// ============================================================================
// FIXTURES
// ============================================================================

/** 'e1' ist eine Alt-Kennung ohne UUID-Format — mapMatchEventToSupabase rechnet sie
 *  deterministisch um. Die erwartete DB-Kennung ist darum toDeterministicUuid('e1'). */
const mappedE1 = toDeterministicUuid('e1');

function makeMatch(overrides: Partial<LiveMatch> = {}): LiveMatch {
  return {
    id: 'm1',
    number: 1,
    phaseLabel: 'Gruppenphase',
    fieldId: 'field-1',
    scheduledKickoff: '2024-01-01T12:00:00.000Z',
    version: 1,
    homeTeam: { id: 'a', name: 'A' },
    awayTeam: { id: 'b', name: 'B' },
    homeScore: 0,
    awayScore: 0,
    status: 'RUNNING',
    elapsedSeconds: 100,
    durationSeconds: 600,
    tournamentPhase: 'groupStage',
    events: [
      {
        id: 'e1',
        matchId: 'm1',
        type: 'FOUL',
        timestampSeconds: 30,
        payload: { team: 'home' },
        scoreAfter: { home: 0, away: 0 },
      },
    ],
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('SupabaseLiveMatchRepository — event insert failure (Task 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Match update always "succeeds" (version matches) so the tests exercise
    // only the events-upsert branch, not the optimistic-lock retry path.
    maybeSingleMock.mockResolvedValue({ data: { version: 2 }, error: null });
  });

  it('RED-GUARD: insert failure does not cache the ids — a second save() resends the same events', async () => {
    upsertMock.mockResolvedValue({ error: { message: 'CHECK violation', code: '23514' } });

    const repo = new SupabaseLiveMatchRepository();
    const match = makeMatch();

    await repo.save('t1', match);
    await repo.save('t1', match);

    expect(upsertMock).toHaveBeenCalledTimes(2);
    const firstBatch = upsertMock.mock.calls[0][0] as Array<{ id?: string }>;
    const secondBatch = upsertMock.mock.calls[1][0] as Array<{ id?: string }>;
    expect(firstBatch.map((e) => e.id)).toEqual([mappedE1]);
    // This is the load-bearing assertion: if the failed upsert had been cached
    // (today's bug), the second save() would send an empty array here.
    expect(secondBatch.map((e) => e.id)).toEqual([mappedE1]);
  });

  it('insert success caches the ids exactly once — a second save() sends no duplicates', async () => {
    upsertMock.mockResolvedValue({ error: null });

    const repo = new SupabaseLiveMatchRepository();
    const match = makeMatch();

    await repo.save('t1', match);
    await repo.save('t1', match);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const firstBatch = upsertMock.mock.calls[0][0] as Array<{ id?: string }>;
    expect(firstBatch.map((e) => e.id)).toEqual([mappedE1]);
  });

  it('insert failure is reported via captureFeatureError', async () => {
    const dbError = { message: 'CHECK violation', code: '23514' };
    upsertMock.mockResolvedValue({ error: dbError });

    const repo = new SupabaseLiveMatchRepository();
    const match = makeMatch();

    await repo.save('t1', match);

    expect(captureFeatureErrorMock).toHaveBeenCalledWith(
      dbError,
      'repository',
      'eventsInsert',
      { matchId: 'm1', count: 1 }
    );
  });
});

// ============================================================================
// Ruling Q (Pflicht): Idempotenz der Wiederholung, nachgewiesen als Vitest mit Mock.
// Der zusätzliche einmalige Nachweis gegen den lokalen Supabase-Stack (echtes
// ON CONFLICT DO NOTHING) steht im Report, das Skript dafür wird nicht committet.
// ============================================================================

describe('SupabaseLiveMatchRepository — Wiederholbarkeit des Event-Uploads (C-EVID, Ruling Q)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingleMock.mockResolvedValue({ data: { version: 2 }, error: null });
  });

  it('save() fügt Events per upsert mit onConflict "id" und ignoreDuplicates ein (ON CONFLICT DO NOTHING)', async () => {
    upsertMock.mockResolvedValue({ error: null });

    const repo = new SupabaseLiveMatchRepository();
    const match = makeMatch();

    await repo.save('t1', match);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.any(Array),
      { onConflict: 'id', ignoreDuplicates: true }
    );
  });

  it('eine Wiederholung mit exakt denselben Ereignissen (z. B. verlorene Erfolgsbestätigung, kein Cache-Treffer) schlägt nicht fehl', async () => {
    // Simuliert den Fall, dass zwei save()-Aufrufe dieselben Ereignisse an Postgres
    // schicken, OHNE dass der lokale eventIdsCache dazwischen greift (zwei unabhängige
    // Repository-Instanzen, z. B. nach einem Reload). Die DB-Policy ON CONFLICT DO
    // NOTHING (upsert mit ignoreDuplicates) muss das klaglos vertragen — kein Fehler,
    // keine Exception.
    upsertMock.mockResolvedValue({ error: null });

    const match = makeMatch();
    const repoA = new SupabaseLiveMatchRepository();
    const repoB = new SupabaseLiveMatchRepository();

    await expect(repoA.save('t1', match)).resolves.toBeUndefined();
    await expect(repoB.save('t1', match)).resolves.toBeUndefined();

    expect(upsertMock).toHaveBeenCalledTimes(2);
    const firstBatch = upsertMock.mock.calls[0][0] as Array<{ id?: string }>;
    const secondBatch = upsertMock.mock.calls[1][0] as Array<{ id?: string }>;
    // Beide Aufrufe senden dieselbe (gemappte) Kennung — die Wiederholung dupliziert
    // nichts, weil die DB-Seite (ON CONFLICT DO NOTHING) das übernimmt.
    expect(firstBatch.map((e) => e.id)).toEqual([mappedE1]);
    expect(secondBatch.map((e) => e.id)).toEqual([mappedE1]);
    expect(captureFeatureErrorMock).not.toHaveBeenCalled();
  });

  it('Alt-Ereignis wird nach erfolgreichem Übertragen nicht erneut gesendet (Ruling R: Cache vergleicht die gemappte Kennung)', async () => {
    upsertMock.mockResolvedValue({ error: null });

    const repo = new SupabaseLiveMatchRepository();
    const match = makeMatch(); // event.id = 'e1' (Alt-Kennung, kein UUID-Format)

    await repo.save('t1', match);
    // Zweiter save() mit demselben Match/Event — muss dank Cache (gefüllt mit der
    // GEMAPPTEN Kennung) gar nicht mehr an Postgres geschickt werden.
    await repo.save('t1', match);

    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});
