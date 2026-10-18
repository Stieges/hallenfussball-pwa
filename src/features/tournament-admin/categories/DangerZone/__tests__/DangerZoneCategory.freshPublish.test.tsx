/**
 * @LZ-003 / K1 (Fixrunde 1) — „Turnier löschen" für ein FRISCH festgelegtes Turnier.
 *
 * Pflichttest mit dem ECHTEN `TournamentCreationService.publish()`: publish() erzeugt
 * die Spiele OHNE `matchStatus` (TournamentCreationService.ts: `if (!statusSource) {
 * return base; }`). Ein fehlender `matchStatus` bedeutet im restlichen Projekt
 * 'scheduled' (geplant) — siehe types/tournament.ts („default: 'scheduled'"),
 * supabaseMappers.ts, filterMatches.ts. Der Test hält diese Regression fest, weil er
 * bewusst KEINE handgeschriebene Fixture benutzt, die man passend zum Code biegen kann.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';
import type { ITournamentRepository } from '../../../../../core/repositories/ITournamentRepository';

vi.mock('../../../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));

vi.mock('../../../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({ myMembership: null, isLoading: false }),
}));

import { TournamentCreationService } from '../../../../../core/services/TournamentCreationService';
import { DangerZoneCategory } from '../index';
import { testUuid } from '../../../../../test/testIds';

describe('DangerZoneCategory — frisch festgelegtes Turnier (@LZ-003, K1 Fixrunde 1)', () => {
  it('bietet „Turnier löschen" an (echtes publish(), Spiele ohne matchStatus)', async () => {
    const repository = {
      save: vi.fn(() => Promise.resolve()),
      get: vi.fn(() => Promise.resolve(null)),
    } as unknown as ITournamentRepository;
    const service = new TournamentCreationService(repository);

    const published: Tournament = await service.publish({
      title: 'Wintercup',
      numberOfFields: 1,
      numberOfTeams: 2,
      teams: [
        { id: testUuid(1), name: 'A' },
        { id: testUuid(2), name: 'B' },
      ],
    });

    // Prämisse des Gegenbeispiels: publish() liefert Spiele OHNE matchStatus.
    expect(published.matches.length).toBeGreaterThan(0);
    expect(published.matches.every((m) => m.matchStatus === undefined)).toBe(true);

    render(
      <DangerZoneCategory
        tournamentId={published.id}
        tournament={published}
        onTournamentUpdate={vi.fn()}
        onLocalTournamentUpdate={vi.fn()}
      />
    );

    expect(await screen.findByRole('button', { name: /Turnier löschen/i })).toBeInTheDocument();
  });
});
