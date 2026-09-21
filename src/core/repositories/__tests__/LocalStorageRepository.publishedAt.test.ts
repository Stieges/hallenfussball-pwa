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

  // Fix 1 (Review 2026-09-21): isPublic/shareCode beweisen NICHTS über eine vergangene
  // Freigabe — beide waren unter dem alten Code der DEFAULT für jedes neu angelegte Turnier
  // (createDraft() setzte isPublic:true, die Sichtbarkeits-Seite generierte beim Mounten
  // automatisch eine shareCode). Ein Bestandsentwurf von vor diesem Branch trägt die
  // Altwerte noch, ohne je freigegeben worden zu sein. Der frühere (breitere) Backfill hätte
  // ihn hier fälschlich als "released" markiert und beim nächsten Save irreversibel gemacht.
  it('ein Entwurf mit isPublic=true (alter Default, kein Freigabe-Beleg) bekommt weiterhin kein publishedAt', async () => {
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

    expect(tournament?.publishedAt).toBeUndefined();
  });

  it('ein Entwurf mit shareCode (alter Default, kein Freigabe-Beleg) bekommt weiterhin kein publishedAt', async () => {
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

    expect(tournament?.publishedAt).toBeUndefined();
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
