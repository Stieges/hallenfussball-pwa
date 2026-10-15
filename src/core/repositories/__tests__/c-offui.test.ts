/**
 * C-OFFUI Beleg (Task C1, Aufgabe 0 -- nur Nachweis, KEIN Fix):
 * Ohne Netz liefert `SupabaseLiveMatchRepository.get()` `null` zurueck
 * (SupabaseLiveMatchRepository.ts:88-90 und :107-109). Der Altweg-Fall
 * (recordGoal -> "not found") entfiel mit A-08d2a. Belegt ueber den echten Pfad mit gemocktem Supabase-Client
 * (Muster wie SupabaseLiveMatchRepository.appendMatchEvents.test.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const singleMock = vi.fn();
  const matchesEqMock = vi.fn(() => ({ single: singleMock }));
  const matchesSelectMock = vi.fn(() => ({ eq: matchesEqMock }));
  const teamsSecondEqMock = vi.fn();
  const teamsFirstEqMock = vi.fn(() => ({ eq: teamsSecondEqMock }));
  const teamsSelectMock = vi.fn(() => ({ eq: teamsFirstEqMock }));
  const eventsOrderMock = vi.fn(() => Promise.resolve({ data: [], error: null }));
  const eventsEqMock = vi.fn(() => ({ order: eventsOrderMock }));
  const eventsSelectMock = vi.fn(() => ({ eq: eventsEqMock }));
  const fromMock = vi.fn((table: string) => {
    if (table === 'teams') { return { select: teamsSelectMock }; }
    if (table === 'matches') { return { select: matchesSelectMock }; }
    if (table === 'match_events') { return { select: eventsSelectMock }; }
    throw new Error(`unexpected table in test mock: ${table}`);
  });
  return {
    singleMock,
    teamsSecondEqMock,
    fromMock,
    supabaseMock: { from: fromMock },
  };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: hoisted.supabaseMock,
  isSupabaseConfigured: true,
}));

vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

import { SupabaseLiveMatchRepository } from '../SupabaseLiveMatchRepository';

const { singleMock, teamsSecondEqMock } = hoisted;

const TOURNAMENT_ID = 't1';
const MATCH_ID = 'm1';

describe('C-OFFUI: Netzfehler bei get() liefert null (Beleg, kein Fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    teamsSecondEqMock.mockResolvedValue({ data: [], error: null });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('get() liefert null, wenn der Supabase-Client einen Netzfehler als error meldet', async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
    const repo = new SupabaseLiveMatchRepository();

    const result = await repo.get(TOURNAMENT_ID, MATCH_ID);

    expect(result).toBeNull();
  });

  it('get() liefert null, wenn die Abfrage wirft (Netzabbruch)', async () => {
    singleMock.mockRejectedValue(new Error('Failed to fetch'));
    const repo = new SupabaseLiveMatchRepository();

    const result = await repo.get(TOURNAMENT_ID, MATCH_ID);

    expect(result).toBeNull();
  });
});
