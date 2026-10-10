/**
 * B-04 Fixrunde 1 – @W2A-030: Nur die Turnierleitung ändert Regeln, auch im Admin Center
 * (Kategorie „Match Cockpit“).
 *
 * Gegeben ein Helfer ist im Turnier angemeldet
 * Wenn er eine Regel ändern will
 * Dann bietet die App das nicht an
 *
 * Pflichttest mit der ECHTEN Kategorie und dem echten Panel: Helfer (collaborator) sieht
 * beide Regelfelder gesperrt, eine Regeländerung wird nicht gespeichert. Turnierleitung
 * (owner) und Co-Admin können ändern.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MatchCockpitCategory } from '../categories/MatchCockpit';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type Tournament } from '../../../types/tournament';
import type { TournamentRole } from '../../auth/types/auth.types';

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'user-1' } }),
}));

let currentRole: TournamentRole = 'owner';
vi.mock('../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({
    myMembership: {
      id: 'membership-1', userId: 'user-1', tournamentId: 'tournament-1',
      role: currentRole, teamIds: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    },
    members: [], coAdmins: [], isLoading: false, error: null,
  }),
}));

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({
    play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(),
    isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null,
  }),
}));

function makeTournament(): Tournament {
  return {
    id: 'tournament-1', title: 'Test-Turnier', numberOfFields: 1, teams: [], matches: [],
    matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, timePenaltyDurationSeconds: 120, penaltyShootersPerTeam: 5 },
  } as unknown as Tournament;
}

describe('B-04 Fixrunde 1 @W2A-030 – Admin Center, Kategorie Match Cockpit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Pflichttest: Helfer (collaborator) sieht beide Regelfelder gesperrt, Änderung wird nicht gespeichert', () => {
    currentRole = 'collaborator';
    const onTournamentUpdate = vi.fn();
    render(<MatchCockpitCategory tournamentId="tournament-1" tournament={makeTournament()} onTournamentUpdate={onTournamentUpdate} />);

    const zeitstrafe = screen.getByTestId('settings-time-penalty-duration');
    const schuetzen = screen.getByTestId('settings-penalty-shooters');
    expect(zeitstrafe).toBeDisabled();
    expect(schuetzen).toBeDisabled();

    fireEvent.change(zeitstrafe, { target: { value: '60' } });
    fireEvent.change(schuetzen, { target: { value: '3' } });
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: Turnierleitung (owner) kann die Zeitstrafe ändern', () => {
    currentRole = 'owner';
    const onTournamentUpdate = vi.fn();
    render(<MatchCockpitCategory tournamentId="tournament-1" tournament={makeTournament()} onTournamentUpdate={onTournamentUpdate} />);

    const zeitstrafe = screen.getByTestId('settings-time-penalty-duration');
    expect(zeitstrafe).not.toBeDisabled();
    fireEvent.change(zeitstrafe, { target: { value: '60' } });

    expect(onTournamentUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        matchCockpitSettings: expect.objectContaining({ timePenaltyDurationSeconds: 60 }),
      }),
    );
  });

  it('Gegenbeispiel: Co-Admin kann die Schützenzahl ändern', () => {
    currentRole = 'co-admin';
    const onTournamentUpdate = vi.fn();
    render(<MatchCockpitCategory tournamentId="tournament-1" tournament={makeTournament()} onTournamentUpdate={onTournamentUpdate} />);

    const schuetzen = screen.getByTestId('settings-penalty-shooters');
    expect(schuetzen).not.toBeDisabled();
    fireEvent.change(schuetzen, { target: { value: '3' } });
    fireEvent.blur(schuetzen);

    expect(onTournamentUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        matchCockpitSettings: expect.objectContaining({ penaltyShootersPerTeam: 3 }),
      }),
    );
  });
});
