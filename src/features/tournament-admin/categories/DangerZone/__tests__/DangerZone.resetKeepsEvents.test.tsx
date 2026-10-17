/**
 * @SL-129 — „Spielplan zurücksetzen" löscht KEINE Spiel-Ereignisse.
 *
 * Szenario @SL-129: Zurückgesetzte Einträge bleiben im Verlauf sichtbar. Dieser
 * Test hält den heutigen Client-Weg fest: Die lokalen Ereignislisten
 * (`match.events`) überstehen das Zurücksetzen unverändert, und die gezielten
 * Match-Updates (diffMatchResultStatusUpdates) enthalten keinen Ereignis-Payload
 * (der Server-Weg/Migrations-Schutz kommt in einer anderen Aufgabe, A-10).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RuntimeMatchEvent, Tournament } from '../../../../../types/tournament';

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

const torEvent: RuntimeMatchEvent = {
  id: 'ev-1', matchId: 'm13', timestampSeconds: 240,
  type: 'GOAL', payload: { teamId: 'a', direction: 'INC', playerNumber: 9 },
  scoreAfter: { home: 1, away: 0 },
};

const kartenEvent: RuntimeMatchEvent = {
  id: 'ev-2', matchId: 'm13', timestampSeconds: 480,
  type: 'YELLOW_CARD', payload: { teamId: 'b', playerNumber: 4 },
  scoreAfter: { home: 1, away: 0 },
};

beforeEach(() => vi.clearAllMocks());

describe('DangerZone — „Spielplan zurücksetzen" behält die Spiel-Ereignisse', () => {
  it('@SL-129 Tor und Gelbe Karte bleiben nach dem Zurücksetzen in der Ereignisliste erhalten', async () => {
    const user = userEvent.setup();
    const onLocalTournamentUpdate = vi.fn();
    const onMatchesUpdate = vi.fn();
    const tournament = {
      id: 't1', title: 'Test-Turnier', status: 'published',
      teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      matches: [
        {
          id: 'm13', round: 1, field: 1, teamA: 'a', teamB: 'b',
          scoreA: 1, scoreB: 0, matchStatus: 'finished',
          events: [torEvent, kartenEvent],
        },
      ],
      startDate: '2026-03-01', startTime: '10:00',
    } as unknown as Tournament;

    render(
      <DangerZoneCategory
        tournamentId="t1"
        tournament={tournament}
        onTournamentUpdate={vi.fn()}
        onLocalTournamentUpdate={onLocalTournamentUpdate}
        onMatchesUpdate={onMatchesUpdate}
      />
    );

    await user.click(screen.getByRole('button', { name: /Spielplan zurücksetzen/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'ZURÜCKSETZEN');
    await user.click(within(dialog).getByRole('button', { name: /Spielplan zurücksetzen/i }));

    expect(onLocalTournamentUpdate).toHaveBeenCalledTimes(1);
    const updated = onLocalTournamentUpdate.mock.calls[0][0] as Tournament;
    expect(updated.matches[0].events).toEqual([torEvent, kartenEvent]);

    expect(onMatchesUpdate).toHaveBeenCalledTimes(1);
    const updates = onMatchesUpdate.mock.calls[0][0] as Record<string, unknown>[];
    expect(updates).toHaveLength(1);
    expect(updates[0]).not.toHaveProperty('events');
  });
});
