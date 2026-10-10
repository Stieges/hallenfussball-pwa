/**
 * @LZ-003 / F1 (Fixrunde 1 Teil b, U0) — Papierkorb im Cloud-Dashboard ohne Spieldaten.
 *
 * Die Cloud-Liste im Dashboard mapt `mapTournamentFromSupabase(row, [], [])`, das
 * Turnier kommt also OHNE Spiele auf die Karte (SupabaseRepository.listForCurrentUser).
 * Ein festgelegtes Turnier hat aber immer Spiele (publish() erzeugt sie) — eine leere
 * Liste heißt dann: Daten nicht geladen / die Liste liefert die Spiele nicht mit.
 * Das ist „nicht feststellbar" (fail-closed): Der Papierkorb wird NICHT angeboten.
 * Löschen bleibt über den Gefahrenbereich möglich, dort sind die Spiele geladen.
 *
 * Test (echtes publish() aus TournamentCreationService):    festgelegtes Turnier
 *   ohne Spiele in der Liste → kein Papierkorb.
 * Gegenbeispiel: rein lokales Turnier MIT geladenen geplanten Spielen → Papierkorb.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../types/tournament';
import type { ITournamentRepository } from '../../core/repositories/ITournamentRepository';

vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

import { TournamentCreationService } from '../../core/services/TournamentCreationService';
import { TournamentCard } from '../TournamentCard';

async function publishedTournament(): Promise<Tournament> {
  const repository = {
    save: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve(null)),
  } as unknown as ITournamentRepository;
  return new TournamentCreationService(repository).publish({
    title: 'Wintercup',
    numberOfFields: 1,
    numberOfTeams: 2,
    teams: [
      { id: 't1', name: 'A' },
      { id: 't2', name: 'B' },
    ],
  });
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

describe('TournamentCard — Papierkorb nur bei feststellbarem Anpfiff (@LZ-003, U0)', () => {
  it('@LZ-003 festgelegtes Turnier ohne Spiele in der Liste: kein Papierkorb', async () => {
    const published = await publishedTournament();
    // Prämisse: publish() erzeugt Spiele — die leere Liste ist die Cloud-Listen-Ansicht.
    expect(published.matches.length).toBeGreaterThan(0);

    await openActionMenu({ ...published, matches: [] });

    expect(screen.queryByTestId('action-menu-item-delete')).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: rein lokales Turnier mit geladenen geplanten Spielen bietet den Papierkorb an', async () => {
    const published = await publishedTournament();
    // publish() erzeugt die Spiele OHNE matchStatus — das ist „geplant" (K1).
    expect(published.matches.every((m) => m.matchStatus === undefined)).toBe(true);

    await openActionMenu(published);

    expect(screen.getByTestId('action-menu-item-delete')).toBeInTheDocument();
  });
});
