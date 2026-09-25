/** DangerZone — Turnierabschluss (L5). Vorher: nur dashboardStatus:'finished' (Zeilen 302–318), das nirgends gelesen wird. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isTournamentCompleted } from '../../../../../utils/tournamentCategories';
import type { Tournament } from '../../../../../types/tournament';

// R7 (Fixrunde 1, useMyTournamentRole): DangerZoneCategory ruft seit der Löschen-Rollensperre
// useMyTournamentRole() auf, das intern useAuth() UND useTournamentMembers() braucht
// (AuthProvider-Kontext). Dieser Test prüft "Turnier beenden"/"Turnier archivieren" (kein
// Rollen-Gate), nicht "Turnier löschen" -- eine echte Mitgliedszeile mit role: 'owner' hält den
// bestehenden Testinhalt unverändert wahr (der Eigentümer sieht ohnehin alle Aktionen; dass der
// echte Eigentümer live KEINE solche Zeile hat, ist H-1 und wird dediziert in
// DangerZoneCategory.deleteVisibility.test.tsx geprüft, nicht hier).
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

const tournament = {
  id: 't1', title: 'Test-Turnier', status: 'published',
  teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
  matches: [{ id: 'm1', scoreA: 1, scoreB: 0 }, { id: 'm2' }],
  startDate: '2026-03-01', startTime: '10:00',
} as unknown as Tournament;

// Opener-Button ("Turnier beenden" / "Turnier archivieren") und der Bestätigungs-Button im Dialog tragen
// denselben Text (beide aus config.buttonLabel, siehe DangerZone/index.tsx Zeilen ~388 und ~478) — deshalb
// wird der Bestätigungs-Button gezielt innerhalb des Dialogs (role="dialog", components/dialogs/Dialog.tsx)
// gesucht, statt global per Regex, sonst wirft Testing Library "found multiple elements".
async function triggerAction(user: ReturnType<typeof userEvent.setup>, opener: RegExp, confirmText: string) {
  await user.click(screen.getByRole('button', { name: opener }));
  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByRole('textbox'), confirmText);
  await user.click(within(dialog).getByRole('button', { name: opener }));
}

describe('DangerZone — Turnierabschluss (L5)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('L5: "Turnier beenden" setzt manuallyCompleted, completedAt und statsSnapshot', async () => {
    const onTournamentUpdate = vi.fn(); const user = userEvent.setup();
    render(<DangerZoneCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={onTournamentUpdate} onLocalTournamentUpdate={onTournamentUpdate} onMatchesUpdate={vi.fn()} />);
    await triggerAction(user, /Turnier beenden/i, 'BEENDEN');
    const u = onTournamentUpdate.mock.calls[0][0] as Tournament;
    expect(u.manuallyCompleted).toBe(true); expect(u.completedAt).toBeDefined();
    expect(u.statsSnapshot?.teamCount).toBe(2); expect(u.statsSnapshot?.completedMatches).toBe(1);
    expect(u.dashboardStatus).toBe('finished');
  });
  it('L5: das beendete Turnier gilt in der Kategorisierung als beendet', async () => {
    const onTournamentUpdate = vi.fn(); const user = userEvent.setup();
    render(<DangerZoneCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={onTournamentUpdate} onLocalTournamentUpdate={onTournamentUpdate} onMatchesUpdate={vi.fn()} />);
    await triggerAction(user, /Turnier beenden/i, 'BEENDEN');
    expect(isTournamentCompleted(onTournamentUpdate.mock.calls[0][0] as Tournament)).toBe(true);
    expect(isTournamentCompleted(tournament)).toBe(false);
  });
  it('L5: "Turnier archivieren" verwendet dieselbe Logik', async () => {
    const onTournamentUpdate = vi.fn(); const user = userEvent.setup();
    render(<DangerZoneCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={onTournamentUpdate} onLocalTournamentUpdate={onTournamentUpdate} onMatchesUpdate={vi.fn()} />);
    await triggerAction(user, /Turnier archivieren/i, 'ARCHIVIEREN');
    const u = onTournamentUpdate.mock.calls[0][0] as Tournament;
    expect(u.manuallyCompleted).toBe(true); expect(u.statsSnapshot).toBeDefined();
  });
});
