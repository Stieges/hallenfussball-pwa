/**
 * R3-3 Gefahrenbereich nach dem Abschluss: „Ergebnisse zurücksetzen“ gibt es nicht mehr (@LZ-036 „alles gesperrt“, @ZP-087),
 * „Turnier löschen“ auch nicht (`deleted_at` lehnt der Server mit 55000 ab; deleteTournament ist gesperrt, @LZ-037).
 * Gegenbeispiel: offen -- beide Karten angeboten (Löschen nur vor dem ersten Anpfiff, @LZ-003).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';

vi.mock('../../../../auth/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../../auth/hooks/useTournamentMembers', () => ({ useTournamentMembers: () => ({ myMembership: null, isLoading: false }) }));

import { setTournamentClosed, resetClosedTournaments } from '../../../../../core/services/closedTournaments';
import { DangerZoneCategory } from '../index';

const tournament = {
  id: 't1', title: 'Wintercup', status: 'published', teams: [], matches: [{ id: 'm1', matchStatus: 'scheduled' }],
  startDate: '2026-03-01', startTime: '10:00',
} as unknown as Tournament;

function renderZone() {
  render(<DangerZoneCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />);
}

beforeEach(() => { vi.clearAllMocks(); resetClosedTournaments(); });
afterEach(() => resetClosedTournaments());

describe('@LZ-036 Gefahrenbereich nach dem Abschluss', () => {
  it('abgeschlossen: kein „Ergebnisse zurücksetzen“, kein „Turnier löschen“, dafür der Hinweis', () => {
    setTournamentClosed('t1', true);
    renderZone();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('danger-zone-delete')).not.toBeInTheDocument();
    expect(screen.getByTestId('tournament-closed-hint')).toBeInTheDocument();
  });

  it('Gegenbeispiel: offen – Zurücksetzen und Löschen sind angeboten, kein Hinweis', () => {
    renderZone();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByTestId('danger-zone-delete')).toBeInTheDocument();
    expect(screen.queryByTestId('tournament-closed-hint')).not.toBeInTheDocument();
  });
});
