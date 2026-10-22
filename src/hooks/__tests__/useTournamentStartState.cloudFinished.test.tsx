/**
 * C-LIVE-STAND-BEENDET-FEHLT (@LZ-003): Die Anpfiff-Sperre entscheidet über die strikte Abfrage
 * `hasStartedMatches` des Live-Repositorys, nicht über `getAll`.
 *
 * Lage: Ollis lokale Kopie führt alle Spiele als geplant, Tom hat auf seinem Gerät Spiel 1 angepfiffen
 * und beendet (im Cloud-Live-Stand ohne `live_state`). Dann ist das Turnier angepfiffen, und Olli
 * bekommt weder „Festlegen zurücknehmen“ noch „löschen“ angeboten.
 *
 * Gegenbeispiel: nichts angepfiffen -> 'not-started'. Lesefehler -> 'unknown' (fail-closed), nie
 * 'not-started'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useTournamentStartState } from '../useTournamentStartState';
import type { Tournament } from '../../types/tournament';
import type { ILiveMatchRepository } from '../../core/repositories/ILiveMatchRepository';
import { RealtimeEnabledContext } from '../../lib/realtimeEnabled';

const fakeLive = vi.hoisted(() => ({
  hasStartedMatches: vi.fn(),
  // Der Cloud-Stand ohne beendete Spiele: leer. Wer ihn statt der strikten Abfrage liest, sieht nichts.
  getAll: vi.fn(),
}));

vi.mock('../../core/contexts/RepositoryContext', () => ({
  useOptionalLiveMatchRepository: (): ILiveMatchRepository =>
    fakeLive as unknown as ILiveMatchRepository,
}));
vi.mock('../useOnlineStatus', () => ({
  useIsOnline: () => true,
  useOnlineStatus: () => ({ isOnline: true, wasOffline: false }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <RealtimeEnabledContext.Provider value={true}>{children}</RealtimeEnabledContext.Provider>
);

function scheduledTournament(): Pick<Tournament, 'id' | 'matches' | 'status' | 'publishedAt'> {
  return {
    id: 't1',
    matches: [
      { id: 'm1', round: 1, field: 1, teamA: '1', teamB: '2', scheduledTime: '09:00' },
    ] as unknown as Tournament['matches'],
    status: 'published',
    publishedAt: '2026-03-01T09:00:00Z',
  };
}

describe('C-LIVE-STAND-BEENDET-FEHLT: Anpfiff-Sperre über hasStartedMatches (@LZ-003)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeLive.getAll.mockResolvedValue(new Map());
  });

  it('@LZ-003 lokal geplant, in der Cloud ein Spiel beendet: angepfiffen (Anzeige und recheck)', async () => {
    fakeLive.hasStartedMatches.mockResolvedValue(true);
    const { result } = renderHook(() => useTournamentStartState(scheduledTournament()), { wrapper });

    await waitFor(() => expect(result.current.state).toBe('started'));
    await expect(result.current.recheck()).resolves.toBe('started');
  });

  it('@LZ-003 Lesefehler: nicht feststellbar, nicht „nicht angepfiffen“', async () => {
    fakeLive.hasStartedMatches.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useTournamentStartState(scheduledTournament()), { wrapper });

    await waitFor(() => expect(result.current.state).toBe('unknown'));
    await expect(result.current.recheck()).resolves.toBe('unknown');
  });

  it('Gegenbeispiel: nichts angepfiffen: nicht angepfiffen', async () => {
    fakeLive.hasStartedMatches.mockResolvedValue(false);
    const { result } = renderHook(() => useTournamentStartState(scheduledTournament()), { wrapper });

    await waitFor(() => expect(result.current.state).toBe('not-started'));
    await expect(result.current.recheck()).resolves.toBe('not-started');
  });
});
