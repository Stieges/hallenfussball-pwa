/**
 * MemberList — "+ Einladen"-Knopf im Header nur für den Eigentümer sichtbar (N4).
 *
 * R5b (.superpowers/sdd/2026-09-22-rechte-und-cockpit-2/task-R5b-brief.md, N4): siehe
 * TeamHelpersCategory.inviteVisibility.test.tsx für die vollständige Begründung -- derselbe
 * fehlende Komponententest galt hier zusätzlich für MemberList selbst (`onInvite`-Knopf im
 * Header, gesteuert über `canManageMembers = myRole ? canCreateInvitations(myRole) : false`).
 *
 * R7-Fixrunde 1 (H-1, final-review-2.md): Die ERSTE Fassung mockte für den "Eigentümer"-Fall
 * fälschlich eine echte `myMembership`-Zeile mit `role: 'owner'` -- die es live nie gibt. Jetzt
 * über `useEffectiveTournamentRole()` (RPC-Fallback, gemeinsam mit DangerZoneCategory/
 * TeamHelpersCategory) korrekt aufgelöst.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { TournamentMembership } from '../../types/auth.types';

const useAuthMock = vi.fn();
const useTournamentMembersMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => useTournamentMembersMock(),
}));

// Getter statt Objekt-Literal: siehe DangerZoneCategory.deleteVisibility.test.tsx -- `vi.mock`
// läuft vor den `const`-Deklarationen unten.
vi.mock('../../../../lib/supabase', () => ({
  get supabase() {
    return { rpc: rpcMock };
  },
  isSupabaseConfigured: true,
}));

import { MemberList } from '../MemberList';

function makeMembership(role: TournamentMembership['role']): TournamentMembership {
  return {
    id: 'membership-1',
    userId: 'user-1',
    tournamentId: 'tournament-1',
    role,
    teamIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function render_() {
  render(<MemberList tournamentId="tournament-1" onInvite={vi.fn()} />);
}

function setupWithMembership(role: TournamentMembership['role']) {
  useAuthMock.mockReturnValue({ isAuthenticated: true });
  useTournamentMembersMock.mockReturnValue({
    members: [],
    myMembership: makeMembership(role),
    isLoading: false,
    error: null,
    setRole: vi.fn(),
    remove: vi.fn(),
    canEditMember: () => false,
    canSetRole: () => false,
    canTransfer: () => false,
    clearError: vi.fn(),
  });
  render_();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MemberList — "+ Einladen"-Knopf im Header (N4, R7-Fixrunde 1: H-1)', () => {
  it('Eigentümer OHNE Mitgliedszeile (RPC-Fallback) sieht den "+ Einladen"-Knopf', async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true });
    useTournamentMembersMock.mockReturnValue({
      members: [], myMembership: null, isLoading: false, error: null,
      setRole: vi.fn(), remove: vi.fn(), canEditMember: () => false, canSetRole: () => false,
      canTransfer: () => false, clearError: vi.fn(),
    });
    rpcMock.mockResolvedValue({ data: true, error: null });

    render_();

    await waitFor(() => {
      expect(screen.getByText('+ Einladen')).toBeInTheDocument();
    });
    expect(rpcMock).toHaveBeenCalledWith('has_tournament_permission', {
      p_tournament_id: 'tournament-1',
      p_permission: 'deleteTournament',
    });
  });

  it('co-admin (echte Mitgliedszeile) sieht den "+ Einladen"-Knopf NICHT', () => {
    setupWithMembership('co-admin');

    expect(screen.queryByText('+ Einladen')).not.toBeInTheDocument();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
