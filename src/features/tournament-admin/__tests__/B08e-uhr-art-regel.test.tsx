/**
 * B-08e: Uhr-Art als Turnierregel (Admin Center, Kategorie Match Cockpit).
 *
 * @SL-002: Ein neues Turnier hat die Uhr-Art „durchlaufend, letzte Minute angehalten“; wählbar sind außerdem
 *          „immer durchlaufend“ und „immer angehalten“.
 * @W2A-035: Die Turnierleitung legt ein Turnier an, ändert nichts an der Uhr, speichert die Regeln: die Uhr-Art
 *          gilt; sie kann stattdessen die beiden anderen wählen.
 * @W2A-030 (Erweiterung): die Uhr-Art ändert nur die Turnierleitung; Helfer sehen sie gesperrt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { MatchCockpitCategory } from '../categories/MatchCockpit';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type Tournament } from '../../../types/tournament';
import type { TournamentRole } from '../../auth/types/auth.types';

vi.unmock('i18next');
vi.unmock('react-i18next');

let currentRole: TournamentRole = 'owner';
vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'user-1' } }),
}));
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

beforeEach(async () => {
  vi.clearAllMocks();
  await initRealDeI18n();
});

/** Ein neues Turnier: Uhr-Art auf der Vorgabe, ohne gespeicherte Änderung. */
function neuesTurnier(): Tournament {
  return {
    id: 'tournament-1', title: 'Test-Turnier', numberOfFields: 1, teams: [], matches: [],
    matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS },
  } as unknown as Tournament;
}

const LETZTE_MINUTE = 'durchlaufend-letzte-minute-angehalten';

describe('B-08e @SL-002 / @W2A-035 – Uhr-Art als Turnierregel', () => {
  it('@SL-002: ein neues Turnier zeigt „durchlaufend, letzte Minute angehalten“ und bietet die beiden anderen an', () => {
    currentRole = 'owner';
    render(<MatchCockpitCategory tournamentId="tournament-1" tournament={neuesTurnier()} onTournamentUpdate={vi.fn()} />);

    const feld = screen.getByTestId('settings-clock-mode');
    expect(feld).toHaveValue(LETZTE_MINUTE);
    expect(within(feld).getByRole('option', { name: 'durchlaufend, letzte Minute angehalten' })).toBeInTheDocument();
    expect(within(feld).getByRole('option', { name: 'immer durchlaufend' })).toBeInTheDocument();
    expect(within(feld).getByRole('option', { name: 'immer angehalten' })).toBeInTheDocument();
  });

  it('@W2A-035: die Turnierleitung wählt „immer angehalten“, die Regel wird gespeichert', () => {
    currentRole = 'owner';
    const onTournamentUpdate = vi.fn();
    render(<MatchCockpitCategory tournamentId="tournament-1" tournament={neuesTurnier()} onTournamentUpdate={onTournamentUpdate} />);

    fireEvent.change(screen.getByTestId('settings-clock-mode'), { target: { value: 'immer-angehalten' } });

    expect(onTournamentUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        matchCockpitSettings: expect.objectContaining({ clockMode: 'immer-angehalten' }),
      }),
    );
  });

  it('@W2A-035 Gegenbeispiel: „immer durchlaufend“ wird ebenfalls gespeichert (nicht nur die Vorgabe)', () => {
    currentRole = 'co-admin';
    const onTournamentUpdate = vi.fn();
    render(<MatchCockpitCategory tournamentId="tournament-1" tournament={neuesTurnier()} onTournamentUpdate={onTournamentUpdate} />);

    fireEvent.change(screen.getByTestId('settings-clock-mode'), { target: { value: 'immer-durchlaufend' } });

    expect(onTournamentUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        matchCockpitSettings: expect.objectContaining({ clockMode: 'immer-durchlaufend' }),
      }),
    );
  });

  it('@W2A-030 Erweiterung: Helfer (collaborator) sieht die Uhr-Art gesperrt, eine Änderung wird nicht gespeichert', () => {
    currentRole = 'collaborator';
    const onTournamentUpdate = vi.fn();
    render(<MatchCockpitCategory tournamentId="tournament-1" tournament={neuesTurnier()} onTournamentUpdate={onTournamentUpdate} />);

    const feld = screen.getByTestId('settings-clock-mode');
    expect(feld).toBeDisabled();
    fireEvent.change(feld, { target: { value: 'immer-angehalten' } });
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });
});
