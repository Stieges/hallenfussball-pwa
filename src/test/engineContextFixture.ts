/**
 * Gemeinsames Engine-Testgerüst (A-08a): echte `MatchEngine` + `LocalMatchStore` + fake-indexeddb,
 * Spiel mit Teams `teama`/`teamb`. Jeder Aufruf bekommt ein EIGENES Konto, weil `fake-indexeddb`
 * die Kopie zwischen Tests teilt (kein Reset zwischen `it()`-Bloecken).
 */
import 'fake-indexeddb/auto';
import { vi } from 'vitest';
import { LocalMatchStore, ClockSync, MatchEngine } from '../core/match/client';
import type { MatchEngineContextValue } from '../features/match-engine/matchEngineContextInstance';

export const FIXTURE_ENGINE_MATCH_ID = 'engine-1';

let accountCounter = 0;

export async function makeEngineContext(engineMatchId: string = FIXTURE_ENGINE_MATCH_ID): Promise<MatchEngineContextValue> {
  const accountId = `acc-fixture-${(accountCounter += 1)}`;
  const store = new LocalMatchStore();
  const clock = new ClockSync(() => Promise.resolve(1_790_000_000_000), () => 1_790_000_000_000, {
    get: () => null,
    set: () => undefined,
  });
  const engine = new MatchEngine({
    store,
    clock,
    sender: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() },
    fetchConfirmed: vi.fn(),
    now: () => 1_790_000_000_000,
  });
  await engine.start(accountId);
  await engine.ensureMatch(engineMatchId, { matchId: engineMatchId, teamAId: 'teama', teamBId: 'teamb' });
  return {
    engine,
    store,
    clock,
    sender: { kick: vi.fn().mockResolvedValue(undefined) },
    accountId,
  } as unknown as MatchEngineContextValue;
}
