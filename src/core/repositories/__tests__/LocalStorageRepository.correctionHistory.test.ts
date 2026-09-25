/**
 * A-Final-Fix 1 (`.superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A-final-fix-brief.md`,
 * `final-review-A.md` Important 1): `useCorrectionMode` now sends `correctionHistory` as part of
 * the SAME targeted `updateMatches()` call as the result. This test proves the OTHER half of the
 * fix independently of the hook: `LocalStorageRepository#updateMatches` must actually persist that
 * field to storage, and a subsequent load (simulated reload) must return it -- not just keep it in
 * the in-memory React state that `useCorrectionMode.test.tsx` already covers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IStorageAdapter } from '../../storage/IStorageAdapter';

const storageGet = vi.fn<(key: string) => Promise<unknown>>();
const storageSet = vi.fn<(key: string, value: unknown) => Promise<void>>();

vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () =>
    Promise.resolve({
      get: (key: string) => storageGet(key),
      set: (key: string, value: unknown) => storageSet(key, value),
    } as unknown as IStorageAdapter),
}));

vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

import { LocalStorageRepository } from '../LocalStorageRepository';

describe('LocalStorageRepository — correctionHistory-Roundtrip (updateMatches)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctionHistory aus einem targeted updateMatches()-Aufruf übersteht ein Neuladen', async () => {
    const storedTournament = {
      id: 't1',
      status: 'published',
      createdAt: '2026-01-01T00:00:00.000Z',
      matches: [{ id: 'm1', scoreA: 3, scoreB: 1, matchStatus: 'finished' }],
    };
    storageGet.mockResolvedValue([storedTournament]);

    const repo = new LocalStorageRepository();
    const correctionEntry = {
      timestamp: '2026-09-25T10:00:00.000Z',
      previousScoreA: 3,
      previousScoreB: 1,
      newScoreA: 4,
      newScoreB: 1,
      reasonType: 'referee_decision' as const,
      userName: 'Schiedsrichter',
    };

    await repo.updateMatches('t1', [
      { id: 'm1', scoreA: 4, correctionHistory: [correctionEntry] },
    ]);

    // The write went through -- capture what was persisted and feed it back as the "reload".
    expect(storageSet).toHaveBeenCalledTimes(1);
    const [, persisted] = storageSet.mock.calls[0];
    storageGet.mockResolvedValue(persisted);

    const reloaded = await repo.get('t1');

    expect(reloaded?.matches[0].scoreA).toBe(4);
    expect(reloaded?.matches[0].correctionHistory).toEqual([correctionEntry]);
  });
});
