/**
 * A-07e N-1 (@AN-024): Verdrahtung des Gast-Zweigs im RepositoryProvider. Im Gastmodus liefert
 * `tournamentRepository.get` für eine Kopie mit Marker A nichts; eine Gast-Kopie bleibt lesbar.
 * Mutation: Gast-Zweig wieder auf `localTournamentRepo` (roh) → rot.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
// eslint-disable-next-line no-restricted-imports -- Verdrahtungstest der React-Bridge (siehe RepositoryContext.tsx)
import { renderHook } from '@testing-library/react';
// eslint-disable-next-line no-restricted-imports -- Verdrahtungstest der React-Bridge (siehe RepositoryContext.tsx)
import type { ReactNode } from 'react';
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

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { channel: vi.fn(), from: vi.fn(), removeChannel: vi.fn() },
}));

import { RepositoryProvider, useRepositories } from '../RepositoryContext';

function t(id: string, ownerId?: string): Tournament {
  return {
    id,
    title: `Turnier ${id}`,
    status: 'draft',
    teams: [],
    matches: [],
    ...(ownerId === undefined ? {} : { ownerId }),
  } as unknown as Tournament;
}

const guestWrapper = ({ children }: { children: ReactNode }) => (
  <RepositoryProvider user={null}>{children}</RepositoryProvider>
);

const guestRoleWrapper = ({ children }: { children: ReactNode }) => (
  <RepositoryProvider user={{ globalRole: 'guest', id: 'gast-1' }}>{children}</RepositoryProvider>
);

describe('RepositoryProvider – Gast-Zweig liefert nur Gast-Sicht (A-07e N-1)', () => {
  beforeEach(() => {
    stores.raw.clear();
    stores.raw.set('tournaments', [t('T', 'A'), t('probe', 'guest'), t('alt')]);
  });

  it('ohne Konto (user null): Konto-Kopie A nicht gefunden, Gast-Kopie lesbar', async () => {
    const { result } = renderHook(() => useRepositories(), { wrapper: guestWrapper });
    const repo = result.current.tournamentRepository;

    expect(await repo.get('T')).toBeNull();
    expect((await repo.get('probe'))?.id).toBe('probe');
    expect((await repo.get('alt'))?.id).toBe('alt');
  });

  it('globalRole guest: Konto-Kopie A nicht gefunden, Gast-Kopie lesbar', async () => {
    const { result } = renderHook(() => useRepositories(), { wrapper: guestRoleWrapper });
    const repo = result.current.tournamentRepository;

    expect(await repo.get('T')).toBeNull();
    expect((await repo.get('probe'))?.id).toBe('probe');
  });
});
