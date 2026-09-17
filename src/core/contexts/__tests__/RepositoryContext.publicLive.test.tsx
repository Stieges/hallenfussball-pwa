/** RepositoryContext — Anon-Lesezugang für Hallen-Monitore und Zuschauer (L2/L4) */
import { describe, it, expect, vi } from 'vitest';
// eslint-disable-next-line no-restricted-imports -- core/ ist framework-free, aber RepositoryContext.tsx selbst ist eine bewusste React-Bridge (siehe Kommentar dort); dieser Test verifiziert sie über React Testing Library.
import { renderHook } from '@testing-library/react';
// eslint-disable-next-line no-restricted-imports -- s.o.
import React from 'react';

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { channel: vi.fn(), from: vi.fn(), removeChannel: vi.fn() },
}));

import { RepositoryProvider, useRepositories } from '../RepositoryContext';
import { SupabaseLiveMatchRepository } from '../../repositories/SupabaseLiveMatchRepository';

describe('RepositoryContext — publicLiveMatchRepo', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <RepositoryProvider user={null}>{children}</RepositoryProvider>
  );

  it('L2/L4: liefert einen lesenden Supabase-Live-Repo auch ohne angemeldeten Nutzer', () => {
    const { result } = renderHook(() => useRepositories(), { wrapper });
    expect(result.current.publicLiveMatchRepo).toBeInstanceOf(SupabaseLiveMatchRepository);
  });

  it('lässt den Schreibpfad ohne Nutzer unverändert lokal', () => {
    const { result } = renderHook(() => useRepositories(), { wrapper });
    expect(result.current.isRealtimeEnabled).toBe(false);
    expect(result.current.supabaseLiveMatchRepo).toBeNull();
  });
});
