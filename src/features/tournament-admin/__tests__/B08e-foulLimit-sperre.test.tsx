/**
 * @W2A-030 / @W2A-037: Die Sperre im Match-Cockpit-Bereich selbst (`handleCockpitSettingsChange`), unabhängig davon, ob die
 * Oberfläche das Feld sperrt: ein Helfer, dessen Gerät die Foul-Grenze trotzdem ändert (Aufruf von onChange direkt),
 * speichert nichts; die Turnierleitung speichert.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MatchCockpitCategory } from '../categories/MatchCockpit';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type Tournament } from '../../../types/tournament';
import type { TournamentRole } from '../../auth/types/auth.types';

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
// Die Abschnitte rufen onChange direkt auf: die Oberfläche sperrt hier nichts.
vi.mock('../categories/MatchCockpit/FoulLimitSection', () => ({
  FoulLimitSection: ({ onChange }: { onChange: (wert: number | null) => void }) => (
    <button type="button" data-testid="foul-direkt" onClick={() => { onChange(3); }}>direkt</button>
  ),
}));

const turnier = (): Tournament => ({
  id: 'tournament-1', title: 'Test-Turnier', numberOfFields: 1, teams: [], matches: [],
  matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS },
}) as unknown as Tournament;

describe('Foul-Grenze: die Sperre der Kategorie', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('@W2A-030 Helfer: onChange direkt aufgerufen speichert nichts', () => {
    currentRole = 'collaborator';
    const onTournamentUpdate = vi.fn();
    render(<MatchCockpitCategory tournamentId="tournament-1" tournament={turnier()} onTournamentUpdate={onTournamentUpdate} />);
    fireEvent.click(screen.getByTestId('foul-direkt'));
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('@W2A-037 Gegenbeispiel: die Turnierleitung speichert dieselbe Änderung', () => {
    currentRole = 'owner';
    const onTournamentUpdate = vi.fn();
    render(<MatchCockpitCategory tournamentId="tournament-1" tournament={turnier()} onTournamentUpdate={onTournamentUpdate} />);
    fireEvent.click(screen.getByTestId('foul-direkt'));
    expect(onTournamentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ matchCockpitSettings: expect.objectContaining({ foulLimit: 3 }) }),
    );
  });
});
