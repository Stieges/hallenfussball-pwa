/**
 * DangerZoneCategory — "Turnier löschen" nur für den Eigentümer sichtbar (Task R7).
 *
 * Vorher: Das Löschen eines Turniers hatte in der App keine Rollensperre (task-R5-report.md,
 * Abschnitt UI/M6: "DangerZone/TournamentAdminCenter.tsx (Turnier löschen) haben KEINE
 * Rollenprüfung"). Die DB lässt seit R5b nur den Eigentümer löschen
 * (protect_deleted_at → has_tournament_permission(..., 'deleteTournament')). Dieser Test
 * beweist das UI-Gegenstück, im selben Muster wie TeamHelpersCategory.inviteVisibility.test.tsx
 * (R5b/N4): Der "Turnier löschen"-Bereich wird für alle außer dem Eigentümer vollständig
 * ausgeblendet, nicht nur deaktiviert.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TournamentMembership } from '../../../../auth/types/auth.types';
import type { Tournament } from '../../../../../types/tournament';

const useTournamentMembersMock = vi.fn();

vi.mock('../../../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => useTournamentMembersMock(),
}));

import { DangerZoneCategory } from '../index';

function makeMembership(role: TournamentMembership['role']): TournamentMembership {
  return {
    id: 'membership-1',
    userId: 'user-1',
    tournamentId: 't1',
    role,
    teamIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const tournament = {
  id: 't1', title: 'Test-Turnier', status: 'published',
  teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
  matches: [{ id: 'm1', scoreA: 1, scoreB: 0 }, { id: 'm2' }],
  startDate: '2026-03-01', startTime: '10:00',
} as unknown as Tournament;

function setup(role: TournamentMembership['role'] | null) {
  useTournamentMembersMock.mockReturnValue({
    myMembership: role ? makeMembership(role) : null,
  });

  render(
    <DangerZoneCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={vi.fn()} />
  );
}

describe('DangerZoneCategory — "Turnier löschen" nur für den Eigentümer (Task R7)', () => {
  it('owner sieht den "Turnier löschen"-Bereich samt Knopf', () => {
    setup('owner');

    expect(screen.getByRole('button', { name: /Turnier löschen/i })).toBeInTheDocument();
  });

  it('co-admin sieht den "Turnier löschen"-Bereich NICHT', () => {
    setup('co-admin');

    expect(screen.queryByRole('button', { name: /Turnier löschen/i })).not.toBeInTheDocument();
  });

  it.each(['collaborator', 'trainer', 'viewer'] as const)(
    '%s sieht den "Turnier löschen"-Bereich NICHT',
    (role) => {
      setup(role);
      expect(screen.queryByRole('button', { name: /Turnier löschen/i })).not.toBeInTheDocument();
    }
  );

  it('ohne aufgelöste Mitgliedschaft (noch ladend): der Bereich bleibt sicherheitshalber verborgen', () => {
    setup(null);

    expect(screen.queryByRole('button', { name: /Turnier löschen/i })).not.toBeInTheDocument();
  });

  it('andere Gefahrenzone-Aktionen bleiben für den Co-Admin unverändert sichtbar (kein Overreach)', () => {
    setup('co-admin');

    expect(screen.getByRole('button', { name: /Turnier beenden/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Turnier archivieren/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Spielplan neu generieren/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Spielplan zurücksetzen/i })).toBeInTheDocument();
  });
});
