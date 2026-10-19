/**
 * useActorRole (C3a-2a, V6/K1): `leitung`, wenn `hasPermission(rolle, 'leadMatches')` gilt, sonst
 * `helper`; zuletzt bekannte Rolle in `safeLocalStorage` zwischengespeichert und ohne bekannte
 * Rolle (z. B. offline) daraus, sonst `helper`.
 *
 * `safeLocalStorage` wird gemockt (eigenes In-Memory-Fake) statt des echten jsdom-`localStorage`
 * -- gleiches Muster wie `ClockSync`-Tests (`ClockStorage`-Fake statt echtem Storage).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// A-11: useActorRole fragt über useCan; „Rolle unbekannt“ (offline) meldet useMyTournamentRole seither mit isUnknown.
const mockRole: { role: 'owner' | 'co-admin' | 'collaborator' | null } = { role: null };
vi.mock('../../features/auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () =>
    mockRole.role === null ? { role: null, isLoading: false, isUnknown: true } : { role: mockRole.role, isLoading: false },
}));

const fakeStorage = new Map<string, string>();
vi.mock('../../core/utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: (key: string) => fakeStorage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      fakeStorage.set(key, value);
    },
    removeItem: (key: string) => {
      fakeStorage.delete(key);
    },
  },
}));

import { useActorRole } from '../useActorRole';

describe('useActorRole', () => {
  beforeEach(() => {
    mockRole.role = null;
    fakeStorage.clear();
  });

  it('owner/co-admin (leadMatches erlaubt) -> "leitung"', () => {
    mockRole.role = 'co-admin';
    const { result } = renderHook(() => useActorRole('t1'));
    expect(result.current).toBe('leitung');
  });

  it('collaborator (kein leadMatches) -> "helper"', () => {
    mockRole.role = 'collaborator';
    const { result } = renderHook(() => useActorRole('t1'));
    expect(result.current).toBe('helper');
  });

  it('unbekannte Rolle ohne Cache -> "helper" (K1: keine Rechte erzwingen)', () => {
    mockRole.role = null;
    const { result } = renderHook(() => useActorRole('t1'));
    expect(result.current).toBe('helper');
  });

  // A-11 (Baustein Regel 3: Gedächtnis-Pin umgeschrieben): das Gedächtnis liegt jetzt in useCan unter
  // `tournament-role:<id>` und speichert die ROLLE (vorher `engine-actor-role:<id>` mit dem Akteur „leitung“).
  it('zuletzt bekannte Rolle wird zwischengespeichert und bei erneut unbekannter Rolle verwendet', async () => {
    mockRole.role = 'owner';
    renderHook(() => useActorRole('t-cache'));
    await waitFor(() => expect(fakeStorage.get('tournament-role:t-cache')).toBe('owner'));
    expect(fakeStorage.has('engine-actor-role:t-cache')).toBe(false);

    mockRole.role = null;
    const { result } = renderHook(() => useActorRole('t-cache'));
    expect(result.current).toBe('leitung');
  });

  it('alter Schlüssel engine-actor-role („leitung“) wird bei unbekannter Rolle weiter gelesen', () => {
    fakeStorage.set('engine-actor-role:t-alt', 'leitung');
    const { result } = renderHook(() => useActorRole('t-alt'));
    expect(result.current).toBe('leitung');
  });
});
