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
// P2 (Fixrunde 3): reconfigurierbar je Test -- steuert, ob der Server (Sammelabfrage/`catchUp`)
// fuer ein Spiel Ereignisse liefert (dann ist es ein echtes Engine-Spiel) oder nicht (Altspiel).
const mockFetchConfirmed = vi.fn().mockResolvedValue({ events: [], newWatermark: 0 });
// `as unknown as MatchEngineContextValue` -- gleiches Muster wie `useEngineMatches.test.tsx`: der
// Test braucht nur `engine`/`clock`, `sender`/`store`/`accountId` sind fuer `useEngineMatchReadiness`
// (das nur `context.engine.ensureMatch` und `context` als Praesenz-Check liest) irrelevant.
const mockContext = {
  engine: new MatchEngine({
    store,
    clock: { serverNow: () => Date.now() } as unknown as ClockSync,
    sender: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() },
    fetchConfirmed: mockFetchConfirmed,
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
    mockFetchConfirmed.mockClear().mockResolvedValue({ events: [], newWatermark: 0 });
    await mockContext.engine.start('acc-engine-readiness');
  });

  it('isEngineDestinedMatch ist schon VOR dem asynchronen ensureMatch synchron wahr fuer ein neues scheduled-Spiel', () => {
    const t = tournament([match({ id: 'm-race', teamA: 'teamA', teamB: 'teamB', matchStatus: 'scheduled' })]);
    const { result } = renderHook(() => useEngineMatchReadiness(t, mockContext, new Map()));

    expect(result.current.isEngineDestinedMatch('m-race')).toBe(true);
  });

  it('isEngineDestinedMatch bleibt false fuer ein bereits abgeschlossenes Altspiel MIT eingetragenem Ergebnis', () => {
    // Ergebnis gesetzt (echtes, unzweideutiges Altspiel) -- ein `finished` Spiel OHNE Ergebnis waere
    // seit P2 (E1-Randfall) ein "fremd-Kandidat" (s. eigene Tests unten), kein reines Altspiel mehr.
    const t = tournament([match({ id: 'm-old', teamA: 'teamA', teamB: 'teamB', matchStatus: 'finished', scoreA: 3, scoreB: 0 })]);
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

  // P2 (Fixrunde 3, E1-Randfall): ein Spiel, das auf einem ANDEREN Geraet bereits laeuft, hat
  // `matchStatus` != 'scheduled' (RPC-Projektion), aber auf DIESEM Geraet weder eine Altzeile noch
  // ein Ergebnis. Die B1-Klausel allein (nur `scheduled`) haette es als reines Altspiel behandelt --
  // `service.initializeMatch`/`liveMatchRepository.save` liefen, ein Anpfiff ginge ueber den Altweg.
  it('P2: ein fremd (auf einem anderen Geraet) laufendes Spiel (matchStatus != scheduled, keine Altzeile, kein Ergebnis) ist engine-destined', () => {
    const t = tournament([match({ id: 'm-foreign', teamA: 'teamA', teamB: 'teamB', matchStatus: 'running' })]);
    const { result } = renderHook(() => useEngineMatchReadiness(t, mockContext, new Map()));

    expect(result.current.isEngineDestinedMatch('m-foreign')).toBe(true);
  });

  it('P2: ein "fremdes" Spiel MIT bereits eingetragenem Ergebnis oder aktiver Altzeile ist NICHT engine-destined (echtes Altspiel/Uebergang)', () => {
    const withResult = tournament([match({ id: 'm-foreign-result', teamA: 'teamA', teamB: 'teamB', matchStatus: 'finished', scoreA: 2, scoreB: 1 })]);
    const { result: r1 } = renderHook(() => useEngineMatchReadiness(withResult, mockContext, new Map()));
    expect(r1.current.isEngineDestinedMatch('m-foreign-result')).toBe(false);

    const withOldRunning = tournament([match({ id: 'm-foreign-old', teamA: 'teamA', teamB: 'teamB', matchStatus: 'running' })]);
    const oldLiveMatches = new Map<string, LiveMatch>([
      ['m-foreign-old', { id: 'm-foreign-old', status: 'RUNNING' } as unknown as LiveMatch],
    ]);
    const { result: r2 } = renderHook(() => useEngineMatchReadiness(withOldRunning, mockContext, oldLiveMatches));
    expect(r2.current.isEngineDestinedMatch('m-foreign-old')).toBe(false);
  });

  // E1: "Test fuer beide Ausgaenge" -- hat der Server (Sammelabfrage/`catchUp`) Ereignisse fuer
  // dieses Spiel, ist es ein Engine-Spiel (Ansicht kommt zurueck); hat er keine, bleibt es ein
  // Altspiel (ensureEngineMatchReady liefert `null`, der Aufrufer weicht auf den Altweg aus).
  it('P2 (beide Ausgaenge): Server LIEFERT Ereignisse -- ensureEngineMatchReady loest eine echte Engine-Ansicht auf', async () => {
    mockFetchConfirmed.mockResolvedValue({
      events: [{
        id: 'start-1', type: 'MATCH_START', at: 0, actor: 'leitung', section: 1, clockMs: 0,
        payload: { rules: { sections: 2, sectionSeconds: 600, breakSeconds: 60, knockout: false, tiebreak: null, overtimeSeconds: 0, shootersPerTeam: 5, suddenDeathAfter: 5, penaltySeconds: 120 } },
        seq: 1,
      }],
      newWatermark: 1,
    });
    const t = tournament([match({ id: 'm-foreign-has-events', teamA: 'teamA', teamB: 'teamB', matchStatus: 'running' })]);
    const { result } = renderHook(() => useEngineMatchReadiness(t, mockContext, new Map()));

    const ready = await result.current.ensureEngineMatchReady('m-foreign-has-events');

    expect(ready).not.toBeNull();
    expect(ready?.status).not.toBe('NOT_STARTED');
  });

  it('P2 (beide Ausgaenge): Server liefert KEINE Ereignisse -- ensureEngineMatchReady liefert null (Altspiel, alter Weg erlaubt)', async () => {
    mockFetchConfirmed.mockResolvedValue({ events: [], newWatermark: 0 });
    const t = tournament([match({ id: 'm-foreign-no-events', teamA: 'teamA', teamB: 'teamB', matchStatus: 'running' })]);
    const { result } = renderHook(() => useEngineMatchReadiness(t, mockContext, new Map()));

    await expect(result.current.ensureEngineMatchReady('m-foreign-no-events')).resolves.toBeNull();
  });

  // E1 (Fixrunde 4, Important 1): scheitert die Server-Klaerung (offline/Netzfehler), schluckt
  // `catchUp` den Fehler intern (MatchEngine.runCatchUp) -- ein "unklares" Spiel darf dann NICHT
  // als bestaetigtes Altspiel gelten (das waere `null`). Unklar bleibt "vorlaeufig nur lesen".
  it('E1 offline: scheitert die Server-Abfrage fuer einen fremd-Kandidaten, wirft ensureEngineMatchReady statt null zu liefern (bleibt unklar)', async () => {
    mockFetchConfirmed.mockRejectedValueOnce(new Error('Netz weg'));
    const t = tournament([match({ id: 'm-foreign-offline', teamA: 'teamA', teamB: 'teamB', matchStatus: 'running' })]);
    const { result } = renderHook(() => useEngineMatchReadiness(t, mockContext, new Map()));

    await expect(result.current.ensureEngineMatchReady('m-foreign-offline')).rejects.toThrow();
  });

  it('E1 offline: nach einer gescheiterten Klaerung loest ein ERNEUTER Aufruf mit funktionierendem Netz korrekt auf (kein dauerhaftes "unklar")', async () => {
    mockFetchConfirmed.mockRejectedValueOnce(new Error('Netz weg'));
    const t = tournament([match({ id: 'm-foreign-retry', teamA: 'teamA', teamB: 'teamB', matchStatus: 'running' })]);
    const { result } = renderHook(() => useEngineMatchReadiness(t, mockContext, new Map()));

    await expect(result.current.ensureEngineMatchReady('m-foreign-retry')).rejects.toThrow();

    // Naechste Gelegenheit: das Netz ist wieder da, der Server hat (in diesem Fall) keine
    // Ereignisse -- die Klaerung darf jetzt definitiv zu "Altspiel" (`null`) kommen.
    mockFetchConfirmed.mockResolvedValueOnce({ events: [], newWatermark: 0 });
    await expect(result.current.ensureEngineMatchReady('m-foreign-retry')).resolves.toBeNull();
  });

  it('E1 offline: Gast/ohne Supabase loest trotz scheiternder fetchConfirmed sofort als Altspiel auf (kein Wurf) -- runCatchUp ruft fetchConfirmed fuer guest gar nicht auf', async () => {
    mockFetchConfirmed.mockRejectedValue(new Error('sollte fuer guest nie aufgerufen werden'));
    await mockContext.engine.start('guest');
    const t = tournament([match({ id: 'm-foreign-guest', teamA: 'teamA', teamB: 'teamB', matchStatus: 'running' })]);
    const { result } = renderHook(() => useEngineMatchReadiness(t, mockContext, new Map()));

    await expect(result.current.ensureEngineMatchReady('m-foreign-guest')).resolves.toBeNull();
    expect(mockFetchConfirmed).not.toHaveBeenCalled();
  });
});
