/**
 * useMyTournamentRole / useEffectiveTournamentRole — H-1 (final-review-2.md, R7-Fixrunde 1).
 *
 * Vorher (Mutationsprobe A1 aus dem Review, `: false` → `: true` in DangerZoneCategory) belegte
 * den Fehler nur indirekt: `myMembership ? can…(myMembership.role) : false` sah den echten
 * Eigentümer (KEINE Zeile in tournament_collaborators, siehe Review-Beleg) immer als "kein
 * Recht" — der alte Test mockte fälschlich eine `owner`-Mitgliedschaftszeile, die es live nie
 * gibt, und zementierte damit den Fehler statt ihn zu fangen.
 *
 * Diese Tests decken die vier Zweige direkt an der Quelle ab, unabhängig von den drei
 * Aufrufstellen (DangerZoneCategory, TeamHelpersCategory, MemberList).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEffectiveTournamentRole, useMyTournamentRole } from '../useMyTournamentRole';

const useAuthMock = vi.fn();
const useTournamentMembersMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('../useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../useTournamentMembers', () => ({
  useTournamentMembers: () => useTournamentMembersMock(),
}));

vi.mock('../../../../lib/supabase', () => ({
  get supabase() {
    return mockSupabaseClient;
  },
  get isSupabaseConfigured() {
    return mockIsSupabaseConfigured;
  },
}));

let mockSupabaseClient: { rpc: typeof rpcMock } | null = { rpc: rpcMock };
let mockIsSupabaseConfigured = true;

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabaseClient = { rpc: rpcMock };
  mockIsSupabaseConfigured = true;
});

describe('useEffectiveTournamentRole', () => {
  it('Lokal-/Gastmodus (nicht authentifiziert): role="owner", kein RPC-Aufruf, unabhängig von der Mitgliedschaft', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false });

    const { result } = renderHook(() =>
      useEffectiveTournamentRole('t1', null, false)
    );

    expect(result.current).toEqual({ role: 'owner', isLoading: false });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('Mitgliedschaft lädt noch: role=null, isLoading=true, kein RPC-Aufruf', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true });

    const { result } = renderHook(() =>
      useEffectiveTournamentRole('t1', null, true)
    );

    expect(result.current).toEqual({ role: null, isLoading: true });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('echte Mitgliedszeile vorhanden: die Rolle aus der Zeile, kein RPC-Aufruf', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true });

    const { result } = renderHook(() =>
      useEffectiveTournamentRole('t1', { role: 'co-admin' }, false)
    );

    expect(result.current).toEqual({ role: 'co-admin', isLoading: false });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('Cloud-Modus, KEINE Mitgliedszeile, RPC bestätigt Eigentümerschaft: role="owner"', async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true });
    rpcMock.mockResolvedValue({ data: true, error: null });

    const { result } = renderHook(() =>
      useEffectiveTournamentRole('t1', null, false)
    );

    await waitFor(() => {
      expect(result.current).toEqual({ role: 'owner', isLoading: false });
    });
    expect(rpcMock).toHaveBeenCalledWith('has_tournament_permission', {
      p_tournament_id: 't1',
      p_permission: 'deleteTournament',
    });
  });

  it('Cloud-Modus, KEINE Mitgliedszeile, RPC verneint Eigentümerschaft: role=null (echter Nicht-Mitglied)', async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true });
    rpcMock.mockResolvedValue({ data: false, error: null });

    const { result } = renderHook(() =>
      useEffectiveTournamentRole('t1', null, false)
    );

    await waitFor(() => {
      expect(result.current).toEqual({ role: null, isLoading: false });
    });
  });

  it('Cloud-Modus, KEINE Mitgliedszeile, RPC-Fehler: role=null, kein Absturz', async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true });
    rpcMock.mockResolvedValue({ data: null, error: new Error('boom') });

    const { result } = renderHook(() =>
      useEffectiveTournamentRole('t1', null, false)
    );

    await waitFor(() => {
      expect(result.current).toEqual({ role: null, isLoading: false });
    });
  });

  it('Supabase nicht konfiguriert, authentifiziert (z.B. Testumgebung), keine Mitgliedszeile: kein RPC-Aufruf, role bleibt null', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true });
    mockIsSupabaseConfigured = false;
    mockSupabaseClient = null;

    const { result } = renderHook(() =>
      useEffectiveTournamentRole('t1', null, false)
    );

    expect(result.current).toEqual({ role: null, isLoading: false });
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe('useMyTournamentRole (Bequemlichkeits-Variante, holt die Mitgliedschaft selbst)', () => {
  it('delegiert an useTournamentMembers() und liefert dieselbe Auswertung', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true });
    useTournamentMembersMock.mockReturnValue({
      myMembership: { role: 'viewer' },
      isLoading: false,
    });

    const { result } = renderHook(() => useMyTournamentRole('t1'));

    expect(result.current).toEqual({ role: 'viewer', isLoading: false });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('Eigentümer ohne Mitgliedszeile: löst über den RPC-Fallback auf "owner" auf', async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true });
    useTournamentMembersMock.mockReturnValue({ myMembership: null, isLoading: false });
    rpcMock.mockResolvedValue({ data: true, error: null });

    const { result } = renderHook(() => useMyTournamentRole('t1'));

    await waitFor(() => {
      expect(result.current).toEqual({ role: 'owner', isLoading: false });
    });
  });
});
