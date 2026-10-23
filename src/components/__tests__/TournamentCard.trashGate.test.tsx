/**
 * @LZ-003 / W4 (Fixrunde 1) — Der Papierkorb („Löschen" im Aktionsmenü der
 * Dashboard-Karte) wird nach dem ersten Anpfiff nicht angeboten.
 *
 * Gerendert wird src/components/TournamentCard.tsx (DashboardScreen importiert
 * '../components/TournamentCard'; die zweite Datei unter features/auth hat
 * keinen Papierkorb). Die Sperre nutzt die GLEICHE Anpfiff-Funktion wie
 * „Turnier löschen" (DangerZone) und „Im Wizard bearbeiten" (SettingsTab).
 *
 * Test:    nach Anpfiff kein Papierkorb im Aktionsmenü.
 * Gegenbeispiel: vor dem Anpfiff ist der Papierkorb da.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../types/tournament';

vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

import { TournamentCard } from '../TournamentCard';

function tournamentWith(statuses: Array<string | undefined>): Tournament {
  return {
    id: 't1', title: 'Wintercup', status: 'published',
    teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    matches: statuses.map((matchStatus, index) => ({ id: `m${index + 1}`, matchStatus })),
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

beforeEach(() => vi.clearAllMocks());

describe('TournamentCard — Papierkorb nur vor dem ersten Anpfiff (@LZ-003, W4)', () => {
  it('@LZ-003 Papierkorb wird nach dem Anpfiff nicht angeboten', async () => {
    await openActionMenu(tournamentWith(['running', 'scheduled']));

    expect(screen.queryByTestId('action-menu-item-delete')).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: vor dem Anpfiff wird der Papierkorb angeboten', async () => {
    await openActionMenu(tournamentWith(['scheduled', 'scheduled']));

    expect(screen.getByTestId('action-menu-item-delete')).toBeInTheDocument();
  });
});
