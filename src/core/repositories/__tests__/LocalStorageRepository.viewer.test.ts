/**
 * A-07e S-3 Gast-Hälfte (@AN-024): LocalStorageRepository mit viewer 'guest' (Gast-Zweig des
 * RepositoryContext). Nach dem Abmelden findet der Gast fremde Konto-Kopien nicht; ohne Parameter bleibt roh.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tournament } from '../../models/types';

const stores = vi.hoisted(() => ({ raw: new Map<string, unknown>() }));

vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () =>
    Promise.resolve({
      get: (key: string) => Promise.resolve(stores.raw.get(key)),
      set: (key: string, value: unknown) => {
        stores.raw.set(key, value);
        return Promise.resolve();
      },
    }),
}));

vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

import { LocalStorageRepository } from '../LocalStorageRepository';

function t(id: string): Tournament {
  return { id, title: `Turnier ${id}`, status: 'draft', teams: [], matches: [] } as unknown as Tournament;
}

function storedTournaments(): Tournament[] {
  return (stores.raw.get('tournaments') as Tournament[] | undefined) ?? [];
}

describe('A-07e S-3 Gast-Hälfte', () => {
  beforeEach(() => {
    stores.raw.clear();
  });

  it('S-3 Gast (viewer guest): nach Abmelden findet ein direkter Abruf von A nichts; Gast-Turnier bleibt erreichbar; delete loescht keine Konto-Kopie', async () => {
    stores.raw.set('tournaments', [{ ...t('T'), ownerId: 'A' }, { ...t('probe'), ownerId: 'guest' }, t('alt')]);
    const guest = new LocalStorageRepository({ viewer: 'guest' });

    expect(await guest.get('T')).toBeNull();
    expect((await guest.get('probe'))?.id).toBe('probe');
    expect((await guest.get('alt'))?.id).toBe('alt');

    await guest.delete('T');
    expect(storedTournaments().some((x) => x.id === 'T')).toBe(true);
    await guest.delete('probe');
    expect(storedTournaments().some((x) => x.id === 'probe')).toBe(false);
  });

  it('S-3 ohne viewer bleibt roh: der Abruf liefert auch fremde Kopien (Queue, Monitor, intern)', async () => {
    stores.raw.set('tournaments', [{ ...t('T'), ownerId: 'A' }]);
    expect((await new LocalStorageRepository().get('T'))?.id).toBe('T');
  });

  it('N-3 (S-2): Gast stellt eine Sicherung mit ownerId A wieder her, das Turnier bleibt im Gastmodus erreichbar', async () => {
    const guest = new LocalStorageRepository({ viewer: 'guest' });

    await guest.save({ ...t('R'), ownerId: 'A' });

    expect((await guest.get('R'))?.id).toBe('R');
    expect(storedTournaments().find((x) => x.id === 'R')?.ownerId).toBe('guest');
  });
});
