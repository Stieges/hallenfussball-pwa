/**
 * DangerZone.resultReset.test.tsx — A2 Fixrunde 1, umgeschrieben in A-10 (Baustein Regel 3, brief-A-10.md § 8 Fall 13).
 *
 * Vorher hielt der Test fest, dass „Spielplan zurücksetzen“ zusätzlich je Spiel ein UPDATE_MATCH sendet
 * (onMatchesUpdate). Seit C3a-2b verwarf der Mapper diese Spalten, die Cloud blieb unverändert; seit A-10 schreibt
 * nur der Server Ergebnisse (reset_match_results, DangerZone.resultsReset.a10.test.tsx). Ohne Cloud (hier: Supabase
 * nicht eingerichtet, wie im Gastmodus) setzt die DangerZone lokal zurück und speichert nicht voll.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

// A-08f3e4: Turnier ohne Einträge (@FU-090 Gegenbeispiel „läuft wie heute“) -- ohne Spiel-Engine sperrte der Wächter.
vi.mock('../../../../../hooks/useMatchEntryGuard', () => ({
  useMatchEntryGuard: () => ({ blocks: async () => false, read: async () => ({ matches: [], unreadable: false }), notify: () => undefined, isGuest: false }),
}));

import { DangerZoneCategory } from '../index';

const tournament = {
  id: 't1', title: 'Test-Turnier', status: 'published',
  teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
  matches: [
    { id: 'm1', round: 1, field: 1, teamA: 'A', teamB: 'B', scoreA: 3, scoreB: 1, matchStatus: 'finished' },
    { id: 'm2', round: 1, field: 2, teamA: 'A', teamB: 'B', scoreA: 1, scoreB: 1, matchStatus: 'finished' },
  ],
  startDate: '2026-03-01', startTime: '10:00',
} as unknown as Tournament;

async function triggerAction(user: ReturnType<typeof userEvent.setup>, opener: RegExp, confirmText: string) {
  await user.click(screen.getByRole('button', { name: opener }));
  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByRole('textbox'), confirmText);
  await user.click(within(dialog).getByRole('button', { name: opener }));
}

describe('DangerZone — Ergebnis-/Statuszurücksetzung (A2 Fixrunde 1, A-10)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('A-10 „Spielplan zurücksetzen“ ohne Cloud → lokal zurückgesetzt, kein Voll-Speichern, kein gezieltes Update', async () => {
    const onTournamentUpdate = vi.fn();
    const onLocalTournamentUpdate = vi.fn();
    const user = userEvent.setup();

    render(
      <DangerZoneCategory
        tournamentId="t1"
        tournament={tournament}
        onTournamentUpdate={onTournamentUpdate}
        onLocalTournamentUpdate={onLocalTournamentUpdate}
      />
    );

    await triggerAction(user, /Spielplan zurücksetzen/i, 'ZURÜCKSETZEN');

    expect(onTournamentUpdate).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(onLocalTournamentUpdate).toHaveBeenCalledTimes(1));
    const local = onLocalTournamentUpdate.mock.calls[0][0] as Tournament;
    expect(local.matches).toHaveLength(2);
    for (const match of local.matches) {
      expect(match).toMatchObject({ matchStatus: 'scheduled', scoreA: undefined, scoreB: undefined });
    }
  });
});
