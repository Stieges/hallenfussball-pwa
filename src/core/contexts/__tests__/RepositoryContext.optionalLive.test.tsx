/**
 * RepositoryContext — null-sicherer Live-Repo-Zugriff (@LZ-003, W1).
 *
 * useOptionalLiveMatchRepository liefert dasselbe Live-Repo wie
 * useLiveMatchRepository, wirft aber ohne RepositoryProvider nicht — der
 * Anpfiff-Check entscheidet dann über die lokale Match-Liste (rein lokal).
 */
import { describe, it, expect, vi } from 'vitest';
// eslint-disable-next-line no-restricted-imports -- core/ ist framework-free, aber RepositoryContext.tsx selbst ist eine bewusste React-Bridge (siehe Kommentar dort); dieser Test verifiziert sie über React Testing Library.
import { renderHook } from '@testing-library/react';
// eslint-disable-next-line no-restricted-imports -- s.o.
import type { ReactNode } from 'react';

// Cloud-Pfad braucht eine konfigurierte Supabase-Umgebung (wie im
// publicLive-Test) — sonst bleibt der Provider im Offline-Only-Modus.
vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { channel: vi.fn(), from: vi.fn(), removeChannel: vi.fn() },
}));

import {
  RepositoryProvider,
  useOptionalLiveMatchRepository,
  useLiveMatchRepository,
  useRepositories,
  useRepositoryContext,
} from '../RepositoryContext';

const wrapperWithUser = (globalRole: string | null) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RepositoryProvider user={globalRole ? { globalRole } : null}>
        {children}
      </RepositoryProvider>
    );
  };

describe('RepositoryContext — optionaler Live-Repo-Zugriff', () => {
  it('ohne Provider: null statt Exception (lokale Match-Liste genügt)', () => {
    const { result } = renderHook(() => useOptionalLiveMatchRepository());

    expect(result.current).toBeNull();
  });

  it('mit Provider: liefert dasselbe Repo wie useLiveMatchRepository', () => {
    const { result } = renderHook(
      () => ({
        optional: useOptionalLiveMatchRepository(),
        strict: useLiveMatchRepository(),
        repos: useRepositories(),
      }),
      { wrapper: wrapperWithUser('guest') }
    );

    expect(result.current.optional).not.toBeNull();
    expect(result.current.optional).toBe(result.current.strict);
    expect(result.current.repos.liveMatchRepository).toBe(result.current.strict);
  });

  it('die strikten Hooks werfen weiterhin ohne Provider (Vertrag erhalten)', () => {
    expect(() => renderHook(() => useLiveMatchRepository())).toThrow(
      /must be used within a RepositoryProvider/
    );
    expect(() => renderHook(() => useRepositories())).toThrow(
      /must be used within a RepositoryProvider/
    );
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- Vertragstest s.o.
      renderHook(() => useRepositoryContext())
    ).toThrow(/must be used within a RepositoryProvider/);
  });

  it('Gastmodus: lokale Repos, kein Realtime', () => {
    const { result } = renderHook(
      () => ({
        repos: useRepositories(),
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- Vertragstest s.o.
        tournamentRepo: useRepositoryContext(),
      }),
      { wrapper: wrapperWithUser('guest') }
    );

    expect(result.current.repos.isRealtimeEnabled).toBe(false);
    expect(result.current.repos.supabaseLiveMatchRepo).toBeNull();
    expect(result.current.tournamentRepo).toBe(result.current.repos.tournamentRepository);
  });

  it('angemeldeter Nutzer: Cloud-Repos mit Realtime und optionalem Live-Repo', () => {
    const { result } = renderHook(
      () => ({
        repos: useRepositories(),
        optional: useOptionalLiveMatchRepository(),
      }),
      { wrapper: wrapperWithUser('user') }
    );

    expect(result.current.repos.isRealtimeEnabled).toBe(true);
    expect(result.current.repos.supabaseLiveMatchRepo).not.toBeNull();
    expect(result.current.optional).toBe(result.current.repos.liveMatchRepository);
  });
});
