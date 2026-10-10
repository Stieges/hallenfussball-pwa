/**
 * W1 (Fixrunde 1) — Die Anpfiff-Sperre berücksichtigt den Live-Stand.
 *
 * Ein Spiel gilt als angepfiffen, wenn `tournament.matches` es als
 * laufend/pausiert/beendet führt ODER der Live-Stand (Live-Repo, das auch das
 * Cockpit liest) es als laufend/pausiert führt. Schlägt das Lesen des
 * Live-Stands fehl, ist der Zustand „nicht feststellbar" → die destruktive
 * Aktion wird nicht angeboten (fail-closed).
 *
 * (a) Live-Stand „läuft", tournament.matches noch „geplant" → nicht angeboten
 * (b) Live-Stand lesen schlägt fehl → nicht angeboten
 * (c) Gegenbeispiel: alles geplant, Live-Stand leer → angeboten
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';
import type { LiveMatch } from '../../../../../core/models/LiveMatch';

const { getAllMock, liveRepositoryMock } = vi.hoisted(() => {
  const getAllMock = vi.fn();
  // Stabile Repo-Identität: ein neues Objekt je Render würde den useEffect in
  // useTournamentStartState endlos triggern (OOM).
  return { getAllMock, liveRepositoryMock: { getAll: getAllMock } };
});

vi.mock('../../../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));

vi.mock('../../../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({ myMembership: null, isLoading: false }),
}));

vi.mock('../../../../../core/contexts/RepositoryContext', () => ({
  useOptionalLiveMatchRepository: () => liveRepositoryMock,
}));

import { DangerZoneCategory } from '../index';

function liveMatchWith(status: string): LiveMatch {
  return { id: 'live-1', status } as unknown as LiveMatch;
}

function plannedTournament(): Tournament {
  return {
    id: 't1', title: 'Wintercup', status: 'published',
    teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    matches: [
      { id: 'm1', matchStatus: 'scheduled' },
      { id: 'm2', matchStatus: 'scheduled' },
    ],
    startDate: '2026-03-01', startTime: '10:00',
  } as unknown as Tournament;
}

function renderDangerZone(tournament: Tournament) {
  render(
    <DangerZoneCategory
      tournamentId="t1"
      tournament={tournament}
      onTournamentUpdate={vi.fn()}
      onLocalTournamentUpdate={vi.fn()}
      onMatchesUpdate={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DangerZone — Anpfiff-Sperre mit Live-Stand (@LZ-003, W1)', () => {
  it('(a) Live-Stand „läuft", matches noch „geplant": „Turnier löschen" wird nicht angeboten', async () => {
    getAllMock.mockResolvedValue(new Map([['live-1', liveMatchWith('RUNNING')]]));

    renderDangerZone(plannedTournament());
    await act(async () => {
      await Promise.resolve();
    });

    expect(getAllMock).toHaveBeenCalledWith('t1');
    expect(screen.queryByRole('button', { name: /Turnier löschen/i })).not.toBeInTheDocument();
  });

  it('(b) Live-Stand lesen schlägt fehl: „Turnier löschen" wird nicht angeboten', async () => {
    getAllMock.mockRejectedValue(new Error('Live-Repo nicht lesbar'));

    renderDangerZone(plannedTournament());
    await act(async () => {
      await Promise.resolve();
    });

    expect(getAllMock).toHaveBeenCalledWith('t1');
    expect(screen.queryByRole('button', { name: /Turnier löschen/i })).not.toBeInTheDocument();
  });

  it('(c) Gegenbeispiel: alles geplant, Live-Stand leer — „Turnier löschen" wird angeboten', async () => {
    getAllMock.mockResolvedValue(new Map());

    renderDangerZone(plannedTournament());

    expect(await screen.findByRole('button', { name: /Turnier löschen/i })).toBeInTheDocument();
  });
});
