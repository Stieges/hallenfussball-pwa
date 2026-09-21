/**
 * Task 3 — Read-Time-Backfill für lokal gespeicherte Turniere.
 *
 * Bestandsturniere im lokalen Speicher tragen kein `publishedAt`. Beim Laden gilt ein
 * Turnier mit `status: 'published'` als bereits freigegeben (createdAt als Freigabezeit) —
 * sonst würde der Wizard-Statuswechsel auf 'draft' ein laufendes Turnier entwerten.
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

describe('LocalStorageRepository — publishedAt-Backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ein veröffentlichtes Bestandsturnier ohne publishedAt erbt createdAt', async () => {
    storageGet.mockResolvedValue([
      { id: 't1', status: 'published', createdAt: '2025-11-03T08:30:00.000Z', matches: [] },
    ]);

    const tournament = await new LocalStorageRepository().get('t1');

    expect(tournament?.publishedAt).toBe('2025-11-03T08:30:00.000Z');
  });

  it('ein echter Entwurf bekommt kein publishedAt', async () => {
    storageGet.mockResolvedValue([
      { id: 't1', status: 'draft', createdAt: '2025-11-03T08:30:00.000Z', matches: [] },
    ]);

    const tournament = await new LocalStorageRepository().get('t1');

    expect(tournament?.publishedAt).toBeUndefined();
  });

  // Fix 2 (Review 2026-09-18): status ist nicht das einzige verlässliche Signal. Ein
  // freigegebenes Turnier, das ein Reload mitten in der Bearbeitung auf status='draft'
  // stehen lässt, muss trotzdem als "schon mal freigegeben" erkannt werden — sonst sieht
  // publish() isFirstRelease=true und setzt isPublic zwangsweise wieder auf true, selbst
  // wenn der Organisator es bewusst privat gemacht hatte.
  it('ein "stuck-at-draft" Turnier mit isPublic=true erbt trotzdem createdAt', async () => {
    storageGet.mockResolvedValue([
      {
        id: 't1',
        status: 'draft',
        isPublic: true,
        createdAt: '2025-11-03T08:30:00.000Z',
        matches: [],
      },
    ]);

    const tournament = await new LocalStorageRepository().get('t1');

    expect(tournament?.publishedAt).toBe('2025-11-03T08:30:00.000Z');
  });

  it('ein "stuck-at-draft" Turnier mit shareCode erbt trotzdem createdAt', async () => {
    storageGet.mockResolvedValue([
      {
        id: 't1',
        status: 'draft',
        shareCode: 'ABC123',
        createdAt: '2025-11-03T08:30:00.000Z',
        matches: [],
      },
    ]);

    const tournament = await new LocalStorageRepository().get('t1');

    expect(tournament?.publishedAt).toBe('2025-11-03T08:30:00.000Z');
  });

  it('ein echter Entwurf ohne isPublic und ohne shareCode bekommt weiterhin kein publishedAt', async () => {
    storageGet.mockResolvedValue([
      {
        id: 't1',
        status: 'draft',
        isPublic: false,
        createdAt: '2025-11-03T08:30:00.000Z',
        matches: [],
      },
    ]);

    const tournament = await new LocalStorageRepository().get('t1');

    expect(tournament?.publishedAt).toBeUndefined();
  });

  it('ein vorhandenes publishedAt bleibt unverändert', async () => {
    storageGet.mockResolvedValue([
      {
        id: 't1',
        status: 'draft',
        createdAt: '2025-11-03T08:30:00.000Z',
        publishedAt: '2026-02-01T10:00:00.000Z',
        matches: [],
      },
    ]);

    const tournament = await new LocalStorageRepository().get('t1');

    expect(tournament?.publishedAt).toBe('2026-02-01T10:00:00.000Z');
  });
});
