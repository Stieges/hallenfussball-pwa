/**
 * TeamHelpersCategory — Einladen-Knopf nur für den Eigentümer sichtbar (N4).
 *
 * R5b (.superpowers/sdd/2026-09-22-rechte-und-cockpit-2/task-R5b-brief.md, N4): Das R5-Review
 * bemängelte, dass es keinen Komponententest dafür gibt, dass der "Mitarbeiter einladen"-
 * Abschnitt (und der davon abgeleitete "+ Einladen"-Knopf) für den Eigentümer sichtbar und für
 * einen Co-Admin unsichtbar ist -- eine Rückmutation der Inline-Regel
 * (`canManageMembers = myMembership ? canCreateInvitations(myMembership.role) : false`) würde
 * ohne diesen Test kein Test fangen.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TournamentMembership } from '../../../../auth/types/auth.types';
import type { Tournament } from '../../../../../types/tournament';

const useAuthMock = vi.fn();
const useTournamentMembersMock = vi.fn();
const useInvitationMock = vi.fn();

vi.mock('../../../../auth/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => useTournamentMembersMock(),
}));

vi.mock('../../../../auth/hooks/useInvitation', () => ({
  useInvitation: () => useInvitationMock(),
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

function setup(role: TournamentMembership['role']) {
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

  render(
    <TeamHelpersCategory
      tournamentId="tournament-1"
      tournament={makeTournament()}
      onTournamentUpdate={vi.fn()}
    />
  );
}

describe('TeamHelpersCategory — Einladen-Knopf (N4)', () => {
  it('owner sieht den "Mitarbeiter einladen"-Abschnitt und den Einladen-Knopf', () => {
    setup('owner');

    expect(screen.getByText('teamHelpers.inviteHelpers')).toBeInTheDocument();
    expect(screen.getByText('teamHelpers.createInvite')).toBeInTheDocument();
  });

  it('co-admin sieht WEDER den "Mitarbeiter einladen"-Abschnitt NOCH den Einladen-Knopf', () => {
    setup('co-admin');

    expect(screen.queryByText('teamHelpers.inviteHelpers')).not.toBeInTheDocument();
    expect(screen.queryByText('teamHelpers.createInvite')).not.toBeInTheDocument();
  });
});
