/**
 * useLiveMatches -- Monitor-Kartenanimation (C3b-2 F3b2, Fixrunde Aufgabe 6): der Pfad, der
 * `lastCardEvent.cardType` speist (Realtime-Aenderung -> `detectCardEvent` -> `detectedCardKind`),
 * liefert fuer Gelb-Rot 'YELLOW_RED' (nicht 'RED'). Gegenbeispiele: Rot -> 'RED', Gelb -> 'YELLOW'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { LiveMatch as CoreLiveMatch, MatchEvent as CoreMatchEvent } from '../../core/models/LiveMatch';

type ChangeHandler = (matchId: string, match: CoreLiveMatch | null) => void;
const handlers: { onMatchChange?: ChangeHandler } = {};
const getAll = vi.hoisted(() => vi.fn());
const subscribe = vi.hoisted(() => vi.fn());

const mockContext = {
  tournamentRepository: {},
  liveMatchRepository: { getAll: vi.fn() },
  isRealtimeEnabled: false,
  supabaseLiveMatchRepo: null as unknown,
  publicLiveMatchRepo: { getAll, subscribe, unsubscribe: vi.fn(), unsubscribeAll: vi.fn() },
};
vi.mock('../../core/contexts/RepositoryContext', () => ({ useRepositories: () => mockContext }));

import { useLiveMatches } from '../useLiveMatches';

function runningMatch(events: CoreMatchEvent[]): CoreLiveMatch {
  return {
    id: 'm1', number: 1, phaseLabel: 'Gruppe A', fieldId: 'field-1',
    scheduledKickoff: '2026-10-01T10:00:00.000Z', version: 1,
    homeTeam: { id: 'teamA', name: 'FC Alpha' }, awayTeam: { id: 'teamB', name: 'SV Beta' },
    homeScore: 0, awayScore: 0, status: 'RUNNING', elapsedSeconds: 30, durationSeconds: 600,
    events,
  };
}

function cardEvent(type: 'YELLOW_CARD' | 'RED_CARD', cardType: 'YELLOW' | 'YELLOW_RED' | 'RED'): CoreMatchEvent {
  return {
    id: `ev-${cardType}`, matchId: 'm1', timestampSeconds: 20, type,
    payload: { team: 'home', cardType }, scoreAfter: { home: 0, away: 0 },
  };
}

async function renderAndDeliver(event: CoreMatchEvent) {
  const hook = renderHook(() => useLiveMatches('t1', { allowPublicRealtime: true }));
  await waitFor(() => expect(subscribe).toHaveBeenCalled());
  // Erst nach dem Initial-Load (leer) zaehlt eine Aenderung als NEUES Ereignis.
  await waitFor(() => expect(getAll).toHaveBeenCalled());
  await act(async () => { await Promise.resolve(); });
  act(() => { handlers.onMatchChange?.('m1', runningMatch([event])); });
  return hook;
}

describe('useLiveMatches -- lastCardEvent.cardType (F3b2, Monitor-Kartenanimation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlers.onMatchChange = undefined;
    getAll.mockResolvedValue(new Map());
    subscribe.mockImplementation((_tournamentId: string, options: { onMatchChange?: ChangeHandler }) => {
      handlers.onMatchChange = options.onMatchChange;
    });
  });

  it('Gelb-Rot (RED_CARD + cardType YELLOW_RED) -> lastCardEvent.cardType "YELLOW_RED"', async () => {
    const { result } = await renderAndDeliver(cardEvent('RED_CARD', 'YELLOW_RED'));
    expect(result.current.lastCardEvent?.cardType).toBe('YELLOW_RED');
    expect(result.current.lastCardEvent?.side).toBe('home');
  });

  it('Gegenbeispiel: Rot (RED_CARD + cardType RED) -> "RED"', async () => {
    const { result } = await renderAndDeliver(cardEvent('RED_CARD', 'RED'));
    expect(result.current.lastCardEvent?.cardType).toBe('RED');
  });

  it('Gegenbeispiel: Gelb (YELLOW_CARD) -> "YELLOW"', async () => {
    const { result } = await renderAndDeliver(cardEvent('YELLOW_CARD', 'YELLOW'));
    expect(result.current.lastCardEvent?.cardType).toBe('YELLOW');
  });
});
