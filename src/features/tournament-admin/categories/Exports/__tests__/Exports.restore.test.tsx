/**
 * Exports.restore.test.tsx — A2 Fixrunde 1 (Ruling AJ, I1/I2:
 * .superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-review.md).
 *
 * I1: restoring a backup can change EXISTING matches' results/status. The full save() via
 * onTournamentUpdate (still needed for teams/settings/schedule/new matches) intentionally skips
 * result/status columns for existing matches (A2) -- this backfills exactly those via a targeted
 * onMatchesUpdate call, alongside the (unchanged) full save.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../../../types/tournament';
import { ExportsCategory } from '../index';

const tournament = {
  id: 't1',
  title: 'Test-Turnier',
  status: 'published',
  date: '2026-01-01',
  timeSlot: '10:00',
  numberOfFields: 1,
  numberOfTeams: 2,
  pointSystem: { win: 3, draw: 1, loss: 0 },
  placementLogic: [],
  teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
  matches: [
    { id: 'm1', round: 1, field: 1, teamA: 'A', teamB: 'B', scoreA: 1, scoreB: 0, matchStatus: 'finished' },
  ],
} as unknown as Tournament;

const backup = {
  version: '1.0',
  exportedAt: new Date().toISOString(),
  tournament: {
    ...tournament,
    matches: [
      { id: 'm1', round: 1, field: 1, teamA: 'A', teamB: 'B', scoreA: 3, scoreB: 3, matchStatus: 'finished' },
    ],
  },
};

describe('ExportsCategory — Backup wiederherstellen (A2 Fixrunde 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom hat weder createObjectURL noch revokeObjectURL implementiert -- die "Auto-Backup vor
    // Wiederherstellung"-Download-Logik in handleRestore() braucht nur einen No-Op-Stub, kein
    // echter Download.
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists a restored EXISTING match result via onMatchesUpdate, alongside the full save', async () => {
    const onTournamentUpdate = vi.fn();
    const onMatchesUpdate = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <ExportsCategory
        tournamentId="t1"
        tournament={tournament}
        onTournamentUpdate={onTournamentUpdate}
        onMatchesUpdate={onMatchesUpdate}
      />
    );

    const file = new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' });
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    await user.upload(input as HTMLInputElement, file);

    // Full save still runs (teams/settings/new matches, schedule columns for existing ones).
    expect(onTournamentUpdate).toHaveBeenCalledTimes(1);

    // A2 Fixrunde 1: the result/status change on the EXISTING match 'm1' is ALSO persisted via a
    // targeted update -- the full save above would silently skip it.
    expect(onMatchesUpdate).toHaveBeenCalledTimes(1);
    const updates = onMatchesUpdate.mock.calls[0][0];
    expect(updates).toEqual([
      expect.objectContaining({ id: 'm1', scoreA: 3, scoreB: 3 }),
    ]);
  });

  // A2 Fixrunde 3 (N3, .superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-rereview.md):
  // both onTournamentUpdate (full save) and onMatchesUpdate (targeted update) do a
  // read-modify-write against the SAME local tournament record (LocalStorageRepository), without
  // a lock. Firing onMatchesUpdate before onTournamentUpdate's save has actually finished races
  // two writers against the same record -- whichever finishes last silently discards the other's
  // changes (a local lost update). `handleRestore` must AWAIT the full save first.
  it('AWAITS the full save before firing the targeted update (no parallel race, N3)', async () => {
    let resolveSave: () => void = () => { /* replaced below before use */ };
    const savePromise = new Promise<void>((resolve) => { resolveSave = resolve; });
    const onTournamentUpdate = vi.fn().mockReturnValue(savePromise);
    const onMatchesUpdate = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <ExportsCategory
        tournamentId="t1"
        tournament={tournament}
        onTournamentUpdate={onTournamentUpdate}
        onMatchesUpdate={onMatchesUpdate}
      />
    );

    const file = new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' });
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    const uploadDone = user.upload(input as HTMLInputElement, file);

    // Give handleRestore's async body a chance to reach the await point.
    await waitFor(() => expect(onTournamentUpdate).toHaveBeenCalledTimes(1));
    // The full save has NOT resolved yet -- the targeted update must not have fired either.
    expect(onMatchesUpdate).not.toHaveBeenCalled();

    resolveSave();
    await uploadDone;

    expect(onMatchesUpdate).toHaveBeenCalledTimes(1);
  });
});
