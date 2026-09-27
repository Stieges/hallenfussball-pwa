/**
 * useEngineMatchReadiness (C3a-2a Fixrunde 2, Item 2 / B4-Race): `isEngineDestinedMatch` muss
 * synchron aus den Turnierdaten (B1-Klausel) ableitbar sein -- unabhaengig davon, ob der interne
 * `ensureMatch`-Effekt in `useEngineMatches` fuer dieses Spiel schon gelaufen ist.
 * `ensureEngineMatchReady` erzwingt `ensureMatch` fuer EIN Spiel und liefert danach dessen
 * Engine-Ansicht. Echte MatchEngine/LocalMatchStore (fake-indexeddb), nur der Provider-Kontext
 * ist gemockt -- gleiches Muster wie `useEngineMatches.test.tsx`.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { LocalMatchStore, MatchEngine, type ClockSync } from '../../core/match/client';
import type { Tournament, Match } from '../../types/tournament';
import type { LiveMatch } from '../../core/models/LiveMatch';
import type { MatchEngineContextValue } from '../../features/match-engine/matchEngineContextInstance';

const store = new LocalMatchStore();
// `as unknown as MatchEngineContextValue` -- gleiches Muster wie `useEngineMatches.test.tsx`: der
// Test braucht nur `engine`/`clock`, `sender`/`store`/`accountId` sind fuer `useEngineMatchReadiness`
// (das nur `context.engine.ensureMatch` und `context` als Praesenz-Check liest) irrelevant.
const mockContext = {
  engine: new MatchEngine({
    store,
    clock: { serverNow: () => Date.now() } as unknown as ClockSync,
    sender: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() },
    fetchConfirmed: vi.fn().mockResolvedValue({ events: [], newWatermark: 0 }),
    now: () => Date.now(),
  }),
  clock: { offsetMs: 0 },
} as unknown as MatchEngineContextValue;

import { useEngineMatchReadiness } from '../useEngineMatchReadiness';

function match(partial: Partial<Match> & Pick<Match, 'id' | 'teamA' | 'teamB'>): Match {
  return {
    round: 1,
    field: 1,
    matchNumber: 1,
    ...partial,
  };
}

function tournament(matches: Match[]): Tournament {
  return {
    id: 'tour-engine-readiness',
    teams: [
      { id: 'teamA', name: 'Heim' },
      { id: 'teamB', name: 'Gast' },
    ],
    matches,
    groupPhaseGameDuration: 20,
  } as unknown as Tournament;
}

describe('useEngineMatchReadiness', () => {
  beforeEach(async () => {
    await mockContext.engine.start('acc-engine-readiness');
  });

  it('isEngineDestinedMatch ist schon VOR dem asynchronen ensureMatch synchron wahr fuer ein neues scheduled-Spiel', () => {
    const t = tournament([match({ id: 'm-race', teamA: 'teamA', teamB: 'teamB', matchStatus: 'scheduled' })]);
    const { result } = renderHook(() => useEngineMatchReadiness(t, mockContext, new Map()));

    expect(result.current.isEngineDestinedMatch('m-race')).toBe(true);
  });

  it('isEngineDestinedMatch bleibt false fuer ein bereits abgeschlossenes Altspiel', () => {
    const t = tournament([match({ id: 'm-old', teamA: 'teamA', teamB: 'teamB', matchStatus: 'finished' })]);
    const { result } = renderHook(() => useEngineMatchReadiness(t, mockContext, new Map()));

    expect(result.current.isEngineDestinedMatch('m-old')).toBe(false);
  });

  it('isEngineDestinedMatch bleibt false fuer ein scheduled-Spiel MIT bereits laufendem Alt-LiveMatch (Uebergangsschutz)', () => {
    const t = tournament([match({ id: 'm-transition', teamA: 'teamA', teamB: 'teamB', matchStatus: 'scheduled' })]);
    const oldLiveMatches = new Map<string, LiveMatch>([
      ['m-transition', { id: 'm-transition', status: 'RUNNING' } as unknown as LiveMatch],
    ]);
    const { result } = renderHook(() => useEngineMatchReadiness(t, mockContext, oldLiveMatches));

    expect(result.current.isEngineDestinedMatch('m-transition')).toBe(false);
  });

  it('ensureEngineMatchReady liefert nach ensureMatch eine echte Engine-Ansicht fuer ein neues Spiel', async () => {
    const t = tournament([match({ id: 'm-race-ready', teamA: 'teamA', teamB: 'teamB', matchStatus: 'scheduled' })]);
    const { result } = renderHook(() => useEngineMatchReadiness(t, mockContext, new Map()));

    const ready = await result.current.ensureEngineMatchReady('m-race-ready');

    expect(ready).not.toBeNull();
    expect(ready?.id).toBe('m-race-ready');
    expect(ready?.status).toBe('NOT_STARTED');
  });

  it('ensureEngineMatchReady liefert null fuer ein unbekanntes Spiel (nicht im Spielplan)', async () => {
    const t = tournament([match({ id: 'm-known', teamA: 'teamA', teamB: 'teamB' })]);
    const { result } = renderHook(() => useEngineMatchReadiness(t, mockContext, new Map()));

    await expect(result.current.ensureEngineMatchReady('m-unknown')).resolves.toBeNull();
  });

  it('ohne MatchEngineProvider (context null): isEngineDestinedMatch false, ensureEngineMatchReady liefert null', async () => {
    const t = tournament([match({ id: 'm-no-provider', teamA: 'teamA', teamB: 'teamB', matchStatus: 'scheduled' })]);
    const { result } = renderHook(() => useEngineMatchReadiness(t, null, new Map()));

    expect(result.current.isEngineDestinedMatch('m-no-provider')).toBe(false);
    await expect(result.current.ensureEngineMatchReady('m-no-provider')).resolves.toBeNull();
  });
});
