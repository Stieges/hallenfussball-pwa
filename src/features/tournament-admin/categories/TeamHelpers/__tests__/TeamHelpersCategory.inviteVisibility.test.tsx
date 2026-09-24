/**
 * TeamHelpersCategory — Einladen-Knopf nur für den Eigentümer sichtbar (N4).
 *
 * R5b (.superpowers/sdd/2026-09-22-rechte-und-cockpit-2/task-R5b-brief.md, N4): Das R5-Review
 * bemängelte, dass es keinen Komponententest dafür gibt, dass der "Mitarbeiter einladen"-
 * Abschnitt (und der davon abgeleitete "+ Einladen"-Knopf) für den Eigentümer sichtbar und für
 * einen Co-Admin unsichtbar ist -- eine Rückmutation der Inline-Regel
 * (`canManageMembers = myMembership ? canCreateInvitations(myMembership.role) : false`) würde
 * ohne diesen Test kein Test fangen.
 *
 * R7-Fixrunde 1 (H-1, final-review-2.md): Die ERSTE Fassung mockte für den "Eigentümer"-Fall
 * fälschlich eine echte `myMembership`-Zeile mit `role: 'owner'` -- die es live nie gibt
 * (`tournament_collaborators` kennt keinen Eigentümer-Eintrag). Dieselbe Ursache wie in
 * DangerZoneCategory, jetzt über die gemeinsame `useMyTournamentRole()` behoben: der
 * "Eigentümer"-Fall hier bildet den RPC-Fallback nach (keine Mitgliedszeile, aber
 * `has_tournament_permission(..., 'deleteTournament')` liefert `true`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { TournamentMembership } from '../../../../auth/types/auth.types';
import type { Tournament } from '../../../../../types/tournament';

const useAuthMock = vi.fn();
const useTournamentMembersMock = vi.fn();
const useInvitationMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('../../../../auth/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => useTournamentMembersMock(),
}));

vi.mock('../../../../auth/hooks/useInvitation', () => ({
  useInvitation: () => useInvitationMock(),
}));

// Getter statt Objekt-Literal: siehe DangerZoneCategory.deleteVisibility.test.tsx -- `vi.mock`
// läuft vor den `const`-Deklarationen unten, ein Getter verzögert den `rpcMock`-Zugriff bis zur
// tatsächlichen Nutzung im Hook.
vi.mock('../../../../../lib/supabase', () => ({
  get supabase() {
    return { rpc: rpcMock };
  },
  isSupabaseConfigured: true,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count !== undefined ? `${key} (${options.count})` : key,
  }),
}));

import { TeamHelpersCategory } from '../index';

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

function makeTournament(): Tournament {
  return {
    id: 'tournament-1',
    teams: [],
  } as unknown as Tournament;
}

function render_() {
  render(
    <TeamHelpersCategory
      tournamentId="tournament-1"
      tournament={makeTournament()}
      onTournamentUpdate={vi.fn()}
    />
  );
}

/** Nicht-Eigentümer-Rolle über eine echte Mitgliedszeile (der realistische Fall). */
function setupWithMembership(role: TournamentMembership['role']) {
  useAuthMock.mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
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
  useInvitationMock.mockReturnValue({ getActiveInvitations: vi.fn().mockResolvedValue([]) });
  render_();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TeamHelpersCategory — Einladen-Knopf (N4, R7-Fixrunde 1: H-1)', () => {
  it('Eigentümer OHNE Mitgliedszeile (RPC-Fallback) sieht den "Mitarbeiter einladen"-Abschnitt und den Einladen-Knopf', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    useTournamentMembersMock.mockReturnValue({
      members: [], myMembership: null, isLoading: false, error: null,
      setRole: vi.fn(), remove: vi.fn(), canEditMember: () => false, canSetRole: () => false,
      canTransfer: () => false, clearError: vi.fn(),
    });
    useInvitationMock.mockReturnValue({ getActiveInvitations: vi.fn().mockResolvedValue([]) });
    rpcMock.mockResolvedValue({ data: true, error: null });

    render_();

    await waitFor(() => {
      expect(screen.getByText('teamHelpers.inviteHelpers')).toBeInTheDocument();
    });
    expect(screen.getByText('teamHelpers.createInvite')).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith('has_tournament_permission', {
      p_tournament_id: 'tournament-1',
      p_permission: 'deleteTournament',
    });
  });

  it('co-admin (echte Mitgliedszeile) sieht WEDER den "Mitarbeiter einladen"-Abschnitt NOCH den Einladen-Knopf', () => {
    setupWithMembership('co-admin');

    expect(screen.queryByText('teamHelpers.inviteHelpers')).not.toBeInTheDocument();
    expect(screen.queryByText('teamHelpers.createInvite')).not.toBeInTheDocument();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
