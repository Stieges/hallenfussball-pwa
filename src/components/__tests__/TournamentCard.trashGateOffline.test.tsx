/**
 * B-01a Fixrunde 2, P2 — Papierkorb offline im Cloud-Modus.
 *
 * Im Cloud-Modus (isRealtimeEnabled) ist der Live-Stand offline nicht lesbar —
 * der Anpfiff-Zustand ist dann „nicht feststellbar" (fail-closed): der
 * Papierkorb wird NICHT angeboten (Ruling W1).
 *
 * Test:    Cloud-Modus + useIsOnline() === false → kein Papierkorb.
 * Gegenbeispiel: online → wie bisher (Papierkorb vor dem Anpfiff angeboten).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../types/tournament';
import type { ILiveMatchRepository } from '../../core/repositories/ILiveMatchRepository';

vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

const { isOnline, liveRepository } = vi.hoisted(() => {
  const isOnline = { value: true };
  const getAll = vi.fn(() => Promise.resolve(new Map()));
  return { isOnline, liveRepository: { getAll } };
});

vi.mock('../../hooks/useOnlineStatus', () => ({
  useIsOnline: () => isOnline.value,
  useOnlineStatus: () => ({ isOnline: isOnline.value, wasOffline: false }),
}));

vi.mock('../../lib/realtimeEnabled', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/realtimeEnabled')>()),
  useIsRealtimeEnabled: () => true,
}));

vi.mock('../../core/contexts/RepositoryContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/contexts/RepositoryContext')>()),
  useOptionalLiveMatchRepository: () => liveRepository as unknown as ILiveMatchRepository,
}));

import { TournamentCard } from '../TournamentCard';

function plannedTournament(): Tournament {
  return {
    id: 't1', title: 'Wintercup', status: 'published',
    teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    matches: [{ id: 'm1', matchStatus: 'scheduled' }, { id: 'm2', matchStatus: 'scheduled' }],
    startDate: '2026-03-01', startTime: '10:00',
    ageClass: 'U11',
    location: { name: 'Halle Süd', city: 'Musterstadt' },
    placementLogic: [],
    groupSystem: 'roundRobin',
  } as unknown as Tournament;
}

async function openActionMenu(tournament: Tournament) {
  const user = userEvent.setup();
  render(
    <TournamentCard
      tournament={tournament}
      categoryLabel="upcoming"
      onClick={vi.fn()}
      onSoftDelete={vi.fn()}
    />
  );
  await user.click(screen.getByTestId(`tournament-${tournament.id}-actions-trigger`));
}

beforeEach(() => {
  vi.clearAllMocks();
  isOnline.value = true;
});

describe('TournamentCard — Papierkorb offline im Cloud-Modus (B-01a Fixrunde 2, P2)', () => {
  it('Cloud-Modus und offline: Zustand nicht feststellbar, kein Papierkorb', async () => {
    isOnline.value = false;

    await openActionMenu(plannedTournament());

    expect(screen.queryByTestId('action-menu-item-delete')).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: online wird der Papierkorb wie bisher angeboten', async () => {
    await openActionMenu(plannedTournament());

    expect(await screen.findByTestId('action-menu-item-delete')).toBeInTheDocument();
  });
});
