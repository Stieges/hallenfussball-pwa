/**
 * R3-3 Dashboard-Karte nach dem Abschluss: „Löschen“ (Papierkorb, `deleted_at` → 55000) wird nicht angeboten, „Kopieren“ bleibt.
 * @LZ-036. Gegenbeispiel: dasselbe Turnier offen -- „Löschen“ da (Eigentümer, vor dem ersten Anpfiff, @LZ-003).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../types/tournament';

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));

import { TournamentCard } from '../TournamentCard';

function nikolaus(lifecycleStatus: Tournament['lifecycleStatus']): Tournament {
  return {
    id: 'nikolaus', title: 'Nikolaus-Turnier', status: 'published', lifecycleStatus, myRole: 'owner',
    teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    matches: [{ id: 'm1', matchStatus: 'scheduled' }],
    startDate: '2026-12-06', startTime: '10:00', ageClass: 'U11',
    location: { name: 'Halle Süd', city: 'Musterstadt' }, placementLogic: [], groupSystem: 'roundRobin',
  } as unknown as Tournament;
}

async function openMenu(tournament: Tournament) {
  const user = userEvent.setup();
  render(<TournamentCard tournament={tournament} categoryLabel="upcoming" onClick={vi.fn()} onCopy={vi.fn()} onSoftDelete={vi.fn()} />);
  await user.click(screen.getByTestId('tournament-nikolaus-actions-trigger'));
}

beforeEach(() => vi.clearAllMocks());

describe('@LZ-036 Dashboard-Karte nach dem Abschluss', () => {
  it('abgeschlossen: kein „Löschen“, „Kopieren“ bleibt', async () => {
    await openMenu(nikolaus('finished'));
    expect(screen.queryByTestId('action-menu-item-delete')).not.toBeInTheDocument();
    expect(screen.getByTestId('action-menu-item-copy')).toBeInTheDocument();
  });

  it('Gegenbeispiel: offen – „Löschen“ wird angeboten', async () => {
    await openMenu(nikolaus('fixed'));
    expect(screen.getByTestId('action-menu-item-delete')).toBeInTheDocument();
  });
});
