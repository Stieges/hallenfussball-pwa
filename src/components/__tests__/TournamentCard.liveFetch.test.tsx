/**
 * B-01a Fixrunde 2, P1 — Server-Abfragen sparen: Die Karte liest den Live-Stand
 * (ILiveMatchRepository.hasStartedMatches) nur, wenn die Abfrage das Ergebnis ändern kann:
 * die Aktion wird angeboten (enabled = Boolean(onSoftDelete)), der Grundzustand
 * aus den Spielen ist 'not-started' und es sind Spiele geladen
 * (matches.length > 0).
 *
 * Test:    Cloud-Turnier ohne Spieldaten in der Liste und Karte ohne Papierkorb
 *          → KEINE Live-Abfrage (Repository-Mock zählt die Aufrufe).
 * Gegenbeispiel: lokales Turnier mit geplanten Spielen → genau eine Abfrage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';
import type { ILiveMatchRepository } from '../../core/repositories/ILiveMatchRepository';

vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

const { getAll, liveRepository } = vi.hoisted(() => {
  const getAll = vi.fn(() => Promise.resolve(false));
  return { getAll, liveRepository: { hasStartedMatches: getAll } };
});

vi.mock('../../core/contexts/RepositoryContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/contexts/RepositoryContext')>()),
  useOptionalLiveMatchRepository: () => liveRepository as unknown as ILiveMatchRepository,
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

beforeEach(() => vi.clearAllMocks());

describe('TournamentCard — Live-Abfrage nur bei Bedarf (B-01a Fixrunde 2, P1)', () => {
  it('Cloud-Turnier ohne Spieldaten in der Liste: keine Live-Abfrage', () => {
    render(
      <TournamentCard
        tournament={tournamentWith([])}
        categoryLabel="upcoming"
        onClick={vi.fn()}
        onSoftDelete={vi.fn()}
      />
    );

    expect(getAll).not.toHaveBeenCalled();
  });

  it('Karte ohne Papierkorb: keine Live-Abfrage', () => {
    render(
      <TournamentCard
        tournament={tournamentWith(['scheduled'])}
        categoryLabel="upcoming"
        onClick={vi.fn()}
      />
    );

    expect(getAll).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: lokales Turnier mit geplanten Spielen fragt den Live-Stand genau einmal ab', () => {
    render(
      <TournamentCard
        tournament={tournamentWith(['scheduled'])}
        categoryLabel="upcoming"
        onClick={vi.fn()}
        onSoftDelete={vi.fn()}
      />
    );

    expect(getAll).toHaveBeenCalledTimes(1);
  });
});