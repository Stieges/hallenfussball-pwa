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
 *
 * R7-Fixrunde 1 (H-1, final-review-2.md): Die ERSTE Fassung dieses Tests mockte für den
 * "Eigentümer"-Fall fälschlich eine echte `myMembership`-Zeile mit `role: 'owner'` — die es
 * live NIE gibt (`tournament_collaborators` kennt keinen Eigentümer-Eintrag,
 * `createOwnerMembership()` hat keinen Aufrufer). Mutationsprobe A1 aus dem Review
 * (`canDelete`-Bedingung fest auf `true`) machte den alten Test rot und bewies damit, dass er
 * das FALSCHE Verhalten erzwang. Diese Fassung bildet die drei echten Zustände nach, die
 * `useMyTournamentRole()` unterscheidet: Eigentümer OHNE Mitgliedszeile (RPC-Fallback),
 * Nicht-Eigentümer MIT Mitgliedszeile, und der Lokal-/Gastmodus ohne Cloud-Backend.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { TournamentMembership } from '../../../../auth/types/auth.types';
import type { Tournament } from '../../../../../types/tournament';

const useAuthMock = vi.fn();
const useTournamentMembersMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('../../../../auth/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => useTournamentMembersMock(),
}));

// Getter statt eines direkten Objekt-Literals: `vi.mock`-Factories laufen VOR den
// `const`-Deklarationen unten (ES-Module hebt `import`-Anweisungen -- auch das transitive
// `import '../index'` weiter unten -- über den gesamten restlichen Modul-Code). Ein Getter
// verzögert den Zugriff auf `rpcMock` bis zur tatsächlichen Nutzung im Hook (zur Laufzeit eines
// Tests), nicht bis zum Modul-Ladezeitpunkt.
vi.mock('../../../../../lib/supabase', () => ({
  get supabase() {
    return { rpc: rpcMock };
  },
  isSupabaseConfigured: true,
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

function renderDangerZone() {
  render(
    <DangerZoneCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} onMatchesUpdate={vi.fn()} />
  );
}

/** Cloud-Modus mit einer echten Mitgliedszeile (Nicht-Eigentümer-Rollen). */
function setupWithMembership(role: TournamentMembership['role']) {
  useAuthMock.mockReturnValue({ isAuthenticated: true });
  useTournamentMembersMock.mockReturnValue({ myMembership: makeMembership(role), isLoading: false });
  renderDangerZone();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DangerZoneCategory — "Turnier löschen" nur für den Eigentümer (Task R7, Fixrunde 1)', () => {
  it('Eigentümer OHNE Mitgliedszeile (Cloud-Modus, RPC-Fallback): sieht den "Turnier löschen"-Bereich', async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true });
    useTournamentMembersMock.mockReturnValue({ myMembership: null, isLoading: false });
    rpcMock.mockResolvedValue({ data: true, error: null });

    renderDangerZone();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Turnier löschen/i })).toBeInTheDocument();
    });
    expect(rpcMock).toHaveBeenCalledWith('has_tournament_permission', {
      p_tournament_id: 't1',
      p_permission: 'deleteTournament',
    });
  });

  it('Lokal-/Gastmodus (nicht authentifiziert): sieht den "Turnier löschen"-Bereich, ohne RPC-Aufruf', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false });
    useTournamentMembersMock.mockReturnValue({ myMembership: null, isLoading: false });

    renderDangerZone();

    expect(screen.getByRole('button', { name: /Turnier löschen/i })).toBeInTheDocument();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('co-admin (echte Mitgliedszeile) sieht den "Turnier löschen"-Bereich NICHT', () => {
    setupWithMembership('co-admin');

    expect(screen.queryByRole('button', { name: /Turnier löschen/i })).not.toBeInTheDocument();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each(['collaborator', 'trainer', 'viewer'] as const)(
    '%s (echte Mitgliedszeile) sieht den "Turnier löschen"-Bereich NICHT',
    (role) => {
      setupWithMembership(role);
      expect(screen.queryByRole('button', { name: /Turnier löschen/i })).not.toBeInTheDocument();
    }
  );

  it('Cloud-Modus, kein Mitglied, RPC verneint Eigentümerschaft: Bereich bleibt verborgen', async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true });
    useTournamentMembersMock.mockReturnValue({ myMembership: null, isLoading: false });
    rpcMock.mockResolvedValue({ data: false, error: null });

    renderDangerZone();

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button', { name: /Turnier löschen/i })).not.toBeInTheDocument();
  });

  it('Mitgliedschaft lädt noch: der Bereich bleibt sicherheitshalber verborgen', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true });
    useTournamentMembersMock.mockReturnValue({ myMembership: null, isLoading: true });

    renderDangerZone();

    expect(screen.queryByRole('button', { name: /Turnier löschen/i })).not.toBeInTheDocument();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('andere Gefahrenzone-Aktionen bleiben für den Co-Admin unverändert sichtbar (kein Overreach)', () => {
    setupWithMembership('co-admin');

    expect(screen.getByRole('button', { name: /Turnier beenden/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Turnier archivieren/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Spielplan neu generieren/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Spielplan zurücksetzen/i })).toBeInTheDocument();
  });
});
