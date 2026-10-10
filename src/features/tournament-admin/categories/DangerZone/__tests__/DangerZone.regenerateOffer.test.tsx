/**
 * @OB-006 / @OB-007 — „Spielplan neu generieren" wird nie angeboten.
 *
 * @OB-006: während des Turniers (Spiel 8 läuft mit 1:0, Spiel 9 geplant) bietet
 * die App im Gefahrenbereich „Spielplan neu generieren" nicht an; die laufenden
 * bzw. geplanten Spiele bleiben unverändert.
 * @OB-007: auch vor dem ersten Anpfiff wird die Aktion nicht angeboten und kein
 * Text verspricht neu berechnete Spielzeiten.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';

vi.mock('../../../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock('../../../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({
    myMembership: {
      id: 'membership-1', userId: 'user-1', tournamentId: 't1', role: 'owner',
      teamIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    },
    isLoading: false,
  }),
}));

import { DangerZoneCategory } from '../index';

function renderDangerZone(tournament: Tournament) {
  const onTournamentUpdate = vi.fn();
  const onLocalTournamentUpdate = vi.fn();
  const onMatchesUpdate = vi.fn();
  render(
    <DangerZoneCategory
      tournamentId="t1"
      tournament={tournament}
      onTournamentUpdate={onTournamentUpdate}
      onLocalTournamentUpdate={onLocalTournamentUpdate}
      onMatchesUpdate={onMatchesUpdate}
    />
  );
  return { onTournamentUpdate, onLocalTournamentUpdate, onMatchesUpdate };
}

beforeEach(() => vi.clearAllMocks());

describe('DangerZone — „Spielplan neu generieren" wird nie angeboten', () => {
  it('@OB-006 Während des Turniers: kein Angebot, Spiel 8 und Spiel 9 bleiben unverändert', () => {
    const tournament = {
      id: 't1', title: 'Test-Turnier', status: 'published',
      teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      matches: [
        { id: 'm8', round: 1, field: 1, teamA: 'a', teamB: 'b', scoreA: 1, scoreB: 0, matchStatus: 'running' },
        { id: 'm9', round: 1, field: 2, teamA: 'a', teamB: 'b', matchStatus: 'scheduled' },
      ],
      startDate: '2026-03-01', startTime: '10:00',
    } as unknown as Tournament;

    const spies = renderDangerZone(tournament);

    expect(screen.queryByRole('button', { name: /Spielplan neu generieren/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Spielplan neu generieren/i)).not.toBeInTheDocument();
    expect(spies.onLocalTournamentUpdate).not.toHaveBeenCalled();
    expect(spies.onMatchesUpdate).not.toHaveBeenCalled();
    expect(spies.onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('@OB-007 Vor dem ersten Anpfiff: kein Angebot und kein Text verspricht neu berechnete Spielzeiten', () => {
    const tournament = {
      id: 't1', title: 'Frühjahrscup', status: 'published',
      teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      matches: [
        { id: 'm1', round: 1, field: 1, teamA: 'a', teamB: 'b', matchStatus: 'scheduled' },
        { id: 'm2', round: 1, field: 2, teamA: 'a', teamB: 'b', matchStatus: 'scheduled' },
      ],
      startDate: '2026-03-01', startTime: '10:00',
    } as unknown as Tournament;

    renderDangerZone(tournament);

    expect(screen.queryByRole('button', { name: /Spielplan neu generieren/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Spielzeiten werden neu berechnet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/neu berechnete Spielzeiten/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Spielplan (komplett )?neu/i)).not.toBeInTheDocument();
  });
});
