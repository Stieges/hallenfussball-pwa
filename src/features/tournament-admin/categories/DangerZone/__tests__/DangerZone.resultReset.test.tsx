/**
 * DangerZone.resultReset.test.tsx — A2 Fixrunde 1 (Ruling AJ, I1/I2:
 * .superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-review.md).
 *
 * I1: "Ergebnisse zurücksetzen" (reset_schedule) and "Spielplan neu generieren"
 * (regenerate_schedule) reset RESULT/STATUS columns (score, status, timer) on EXISTING matches.
 * They used to persist ONLY via a full onTournamentUpdate() save, which (since A2) skips those
 * columns for existing matches -- the reset landed in local state, never in the cloud. Fixed by
 * ALSO calling onMatchesUpdate with a targeted UPDATE_MATCH per touched match.
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

describe('DangerZone — Ergebnis-/Statuszurücksetzung (A2 Fixrunde 1)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('"Spielplan zurücksetzen" persists via onMatchesUpdate (UPDATE_MATCH per match), NOT a full save', async () => {
    const onTournamentUpdate = vi.fn();
    const onLocalTournamentUpdate = vi.fn();
    const onMatchesUpdate = vi.fn();
    const user = userEvent.setup();

    render(
      <DangerZoneCategory
        tournamentId="t1"
        tournament={tournament}
        onTournamentUpdate={onTournamentUpdate}
        onLocalTournamentUpdate={onLocalTournamentUpdate}
        onMatchesUpdate={onMatchesUpdate}
      />
    );

    await triggerAction(user, /Spielplan zurücksetzen/i, 'ZURÜCKSETZEN');

    // Full save is NOT used for this -- local sync + targeted update instead.
    expect(onTournamentUpdate).not.toHaveBeenCalled();
    expect(onLocalTournamentUpdate).toHaveBeenCalledTimes(1);

    expect(onMatchesUpdate).toHaveBeenCalledTimes(1);
    const updates = onMatchesUpdate.mock.calls[0][0];
    expect(updates).toHaveLength(2);
    for (const update of updates) {
      expect(update.matchStatus).toBe('scheduled');
      expect('scoreA' in update).toBe(true);
      expect(update.scoreA).toBeUndefined();
    }
  });
});
