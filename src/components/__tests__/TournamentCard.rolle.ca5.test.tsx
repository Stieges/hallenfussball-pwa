/**
 * CA-5 (Befund C-LISTE-NUR-EIGENTUEMER, Plan-Review Auflage 10c) – Karte auf der Startseite der Co-Admin.
 *
 * NEU-CA1 (Vorschlag, Kennung vergibt der Controller) / @HE-085:
 *   „Dann steht das Nikolaus-Turnier auf ihrer Startseite mit der Angabe „Co-Admin“ …
 *    Aber „Löschen“ bietet die App ihr bei diesem Turnier nicht an“
 * Die Karte fragt das Recht `deleteTournament` (hasPermission), keinen Rollenvergleich.
 * Gegenbeispiele: Eigentümer-Karte unverändert (keine Marke, „Löschen“ da), Gast-Turnier ohne Rolle ebenso.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../types/tournament';

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));

import { TournamentCard } from '../TournamentCard';

function nikolaus(myRole?: Tournament['myRole']): Tournament {
  return {
    id: 'nikolaus', title: 'Nikolaus-Turnier', status: 'published',
    teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    matches: [{ id: 'm1', matchStatus: 'scheduled' }],
    startDate: '2026-12-06', startTime: '10:00', ageClass: 'U11',
    location: { name: 'Halle Süd', city: 'Musterstadt' },
    placementLogic: [], groupSystem: 'roundRobin',
    ...(myRole === undefined ? {} : { myRole }),
  } as unknown as Tournament;
}

async function renderCard(tournament: Tournament) {
  const onSoftDelete = vi.fn();
  const user = userEvent.setup();
  render(<TournamentCard tournament={tournament} categoryLabel="upcoming" onClick={vi.fn()} onCopy={vi.fn()} onSoftDelete={onSoftDelete} />);
  await user.click(screen.getByTestId('tournament-nikolaus-actions-trigger'));
  return { onSoftDelete };
}

beforeEach(() => vi.clearAllMocks());

describe('CA-5 TournamentCard: Rolle auf der Karte, „Löschen“ nur mit Recht deleteTournament', () => {
  it('@HE-085 Co-Admin: die Karte trägt die Marke „Co-Admin“, das Menü bietet „Löschen“ nicht an, „Kopieren“ bleibt', async () => {
    await renderCard(nikolaus('co-admin'));

    const card = screen.getByTestId('tournament-card-nikolaus');
    expect(within(card).getByTestId('tournament-role-nikolaus')).toHaveTextContent('card.role.co-admin');
    expect(screen.queryByTestId('action-menu-item-delete')).not.toBeInTheDocument();
    expect(screen.getByTestId('action-menu-item-copy')).toBeInTheDocument();
  });

  it.each(['collaborator', 'trainer', 'viewer'] as const)('Rolle %s: Marke mit der Rolle, kein „Löschen“', async (role) => {
    await renderCard(nikolaus(role));

    expect(screen.getByTestId('tournament-role-nikolaus')).toHaveTextContent(`card.role.${role}`);
    expect(screen.queryByTestId('action-menu-item-delete')).not.toBeInTheDocument();
  });

  it('Gegenbeispiel Eigentümer: keine Marke, „Löschen“ wird angeboten', async () => {
    await renderCard(nikolaus('owner'));

    expect(screen.queryByTestId('tournament-role-nikolaus')).not.toBeInTheDocument();
    expect(screen.getByTestId('action-menu-item-delete')).toBeInTheDocument();
  });

  it('Gegenbeispiel Turnier ohne Rolle (Gast, lokal angelegt): keine Marke, „Löschen“ wird angeboten', async () => {
    await renderCard(nikolaus());

    expect(screen.queryByTestId('tournament-role-nikolaus')).not.toBeInTheDocument();
    expect(screen.getByTestId('action-menu-item-delete')).toBeInTheDocument();
  });
});
