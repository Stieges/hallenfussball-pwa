/**
 * C-OFFUI Beleg (Task C1, Aufgabe 0 -- nur Nachweis, KEIN Fix):
 * Ohne Netz liefert `SupabaseLiveMatchRepository.get()` `null` zurueck
 * (SupabaseLiveMatchRepository.ts:88-90 und :107-109), wodurch
 * `MatchExecutionService.recordGoal` mit "not found" scheitert
 * (MatchExecutionService.ts:214-215) und der Helfer sein eben eingetragenes
 * Tor nicht sieht. Belegt ueber den echten Pfad mit gemocktem Supabase-Client
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
import type { ILiveMatchRepository } from '../ILiveMatchRepository';
import type { ITournamentRepository } from '../ITournamentRepository';
import { MatchExecutionService } from '../../services/MatchExecutionService';
import type { Tournament, MatchUpdate } from '../../models/types';

const { singleMock, teamsSecondEqMock } = hoisted;

const TOURNAMENT_ID = 't1';
const MATCH_ID = 'm1';

function makeTournamentRepo(): ITournamentRepository {
  return {
    get: vi.fn(async () => null),
    getByShareCode: vi.fn(async () => null),
    save: vi.fn(async () => undefined),
    updateMatch: vi.fn(async (_tournamentId: string, _update: MatchUpdate) => undefined),
    updateMatches: vi.fn(async (_tournamentId: string, _updates: MatchUpdate[], _baseVersion?: number) => undefined),
    delete: vi.fn(async () => undefined),
    listForCurrentUser: vi.fn(async (): Promise<Tournament[]> => []),
    makeTournamentPublic: vi.fn(async () => null),
    makeTournamentPrivate: vi.fn(async () => undefined),
    regenerateShareCode: vi.fn(async () => null),
  };
}

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

  it('recordGoal scheitert mit "not found", weil get() bei Netzfehler null liefert', async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
    const repo: ILiveMatchRepository = new SupabaseLiveMatchRepository();
    const service = new MatchExecutionService(repo, makeTournamentRepo());

    await expect(service.recordGoal(TOURNAMENT_ID, MATCH_ID, 'home', 1)).rejects.toThrow(
      `Match ${MATCH_ID} not found`,
    );
  });
});
