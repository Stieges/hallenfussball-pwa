/**
 * MemberList — "+ Einladen"-Knopf im Header nur für den Eigentümer sichtbar (N4).
 *
 * R5b (.superpowers/sdd/2026-09-22-rechte-und-cockpit-2/task-R5b-brief.md, N4): siehe
 * TeamHelpersCategory.inviteVisibility.test.tsx für die vollständige Begründung -- derselbe
 * fehlende Komponententest galt hier zusätzlich für MemberList selbst (`onInvite`-Knopf im
 * Header, gesteuert über `canManageMembers = myMembership ? canCreateInvitations(role) : false`).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TournamentMembership } from '../../types/auth.types';

const useTournamentMembersMock = vi.fn();

vi.mock('../../hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => useTournamentMembersMock(),
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

function setup(role: TournamentMembership['role']) {
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

  render(<MemberList tournamentId="tournament-1" onInvite={vi.fn()} />);
}

describe('MemberList — "+ Einladen"-Knopf im Header (N4)', () => {
  it('owner sieht den "+ Einladen"-Knopf', () => {
    setup('owner');

    expect(screen.getByText('+ Einladen')).toBeInTheDocument();
  });

  it('co-admin sieht den "+ Einladen"-Knopf NICHT', () => {
    setup('co-admin');

    expect(screen.queryByText('+ Einladen')).not.toBeInTheDocument();
  });
});
