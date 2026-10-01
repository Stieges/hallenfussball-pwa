/**
 * loadEngineEventsForExport (C3b-2 F3b2, M8/U1): EIN Lauf beim Klick auf "Exportieren" --
 * ensureMatch fuer alle Spiele, Sammelabfrage, markEngineMatches, catchUpLoaded, dann
 * framework-frei die nicht zurueckgenommenen Ereignisse lesen. Ersetzt die zweite
 * `useEngineMatches`-Instanz (useEngineEventsById.ts) mit ihrem Dauer-Abo.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tournament } from '../../../types/tournament';
import { LocalMatchStore, ClockSync, MatchEngine, MatchCommands } from '../../../core/match/client';
import { serverRules } from '../../../core/match';
import type { MatchEngineContextValue } from '../matchEngineContextInstance';

const mockIsSupabaseConfigured = vi.hoisted(() => ({ current: false }));
const mockFetchEngineMatchIds = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/supabase', () => ({
  get isSupabaseConfigured() { return mockIsSupabaseConfigured.current; },
  supabase: {},
}));
vi.mock('../fetchEngineMatchIds', async () => {
  const actual = await vi.importActual<typeof import('../fetchEngineMatchIds')>('../fetchEngineMatchIds');
  return { ...actual, fetchEngineMatchIds: mockFetchEngineMatchIds };
});

import { loadEngineEventsForExport } from '../loadEngineEventsForExport';

const MATCH_ID = 'match-export-1';
const IDLE_MATCH_ID = 'match-export-2';

function tournament(withIdleMatch = false): Tournament {
  return {
    id: 'tour-export',
    matches: [
      { id: MATCH_ID, teamA: 'teama', teamB: 'teamb', round: 1, field: 1, matchNumber: 1 },
      ...(withIdleMatch
        ? [{ id: IDLE_MATCH_ID, teamA: 'teamb', teamB: 'teama', round: 2, field: 1, matchNumber: 2 }]
        : []),
    ],
    teams: [{ id: 'teama', name: 'Heim' }, { id: 'teamb', name: 'Gast' }],
    groupPhaseGameDuration: 20,
  } as unknown as Tournament;
}

let accountCounter = 0;

async function makeStoreWithGoal(fixedAccountId?: string) {
  const accountId = fixedAccountId ?? `acc-export-${(accountCounter += 1)}`;
  const store = new LocalMatchStore();
  const clock = new ClockSync(() => Promise.resolve(1_790_000_000_000), () => 1_790_000_000_000, {
    get: () => null, set: () => undefined,
  });
  // Eine erste Engine-Instanz "spielt" das Tor (wie ein vorheriger Cockpit-Besuch), dann wird sie
  // verworfen -- die naechste Instanz (in den eigentlichen Tests) hat KEINEN In-Memory-Zustand
  // mehr, nur der Store (IndexedDB) bleibt. Genau das Szenario "Export direkt nach App-Start,
  // Cockpit nie geoeffnet" (die React-Komponente, die den Export ausloest, lief nie vorher).
  const setupEngine = new MatchEngine({
    store, clock, sender: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() },
    fetchConfirmed: vi.fn(), now: () => 1_790_000_000_000,
  });
  await setupEngine.start(accountId);
  const ctx = { matchId: MATCH_ID, teamAId: 'teama', teamBId: 'teamb' };
  await setupEngine.ensureMatch(MATCH_ID, ctx);
  const commands = new MatchCommands({ engine: setupEngine, store, sender: { kick: vi.fn().mockResolvedValue(undefined) }, accountId });
  const rules = serverRules({
    durationMinutes: null, phase: null, groupPhaseDuration: 20, finalRoundDuration: null,
    config: { gamePeriods: 1, halftimeBreak: 0 }, finalsConfig: null,
  });
  await commands.start(MATCH_ID, ctx, 'leitung', rules);
  await commands.goal(MATCH_ID, ctx, 'leitung', 'teama', false);
  return { accountId, store, clock };
}

type FetchConfirmed = ConstructorParameters<typeof MatchEngine>[0]['fetchConfirmed'];

/** `fetchConfirmed` liefert in diesen Tests IMMER eine gueltige Struktur (`runCatchUp` destrukturiert
 * `{ events, newWatermark }`), nie ein nacktes `vi.fn()` ohne Rueckgabe. */
const emptyServer: FetchConfirmed = () => Promise.resolve({ events: [], newWatermark: 0 });

async function makeFreshContext(
  store: LocalMatchStore,
  clock: ClockSync,
  accountId: string,
  fetchConfirmed: FetchConfirmed = emptyServer,
): Promise<MatchEngineContextValue> {
  const engine = new MatchEngine({
    store, clock, sender: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() },
    fetchConfirmed, now: () => 1_790_000_000_000,
  });
  await engine.start(accountId);
  return {
    engine, store, clock,
    sender: { kick: vi.fn().mockResolvedValue(undefined) },
    accountId,
  } as unknown as MatchEngineContextValue;
}

describe('loadEngineEventsForExport (F3b2, M8/U1)', () => {
  beforeEach(() => {
    mockIsSupabaseConfigured.current = false;
    mockFetchEngineMatchIds.mockReset();
  });

  it('Export direkt nach App-Start (Cockpit nie geoeffnet) enthaelt das Engine-Tor', async () => {
    const { accountId, store, clock } = await makeStoreWithGoal();
    const freshContext = await makeFreshContext(store, clock, accountId);

    const result = await loadEngineEventsForExport(tournament(), freshContext);

    const events = result.get(MATCH_ID);
    expect(events).toBeDefined();
    expect(events?.some((e) => e.type === 'GOAL')).toBe(true);
  });

  it('nutzt ensureMatch (Mutationsprobe: ohne ensureMatch bleibt die Karte leer)', async () => {
    const { accountId, store, clock } = await makeStoreWithGoal();
    const freshContext = await makeFreshContext(store, clock, accountId);
    const ensureSpy = vi.spyOn(freshContext.engine, 'ensureMatch');

    await loadEngineEventsForExport(tournament(), freshContext);

    expect(ensureSpy).toHaveBeenCalledWith(MATCH_ID, { matchId: MATCH_ID, teamAId: 'teama', teamBId: 'teamb' }, 'tour-export');
  });

  it('Lauf schlaegt fehl (Sammelabfrage wirft) -> die Funktion wirft, kein stiller Teil-Export', async () => {
    mockIsSupabaseConfigured.current = true;
    mockFetchEngineMatchIds.mockRejectedValue(new Error('Netz weg'));
    const { accountId, store, clock } = await makeStoreWithGoal();
    const freshContext = await makeFreshContext(store, clock, accountId);

    await expect(loadEngineEventsForExport(tournament(), freshContext)).rejects.toThrow('Netz weg');
  });

  it('Gegenbeispiel: Lauf erfolgreich (Supabase konfiguriert, Sammelabfrage liefert) -> Export enthaelt Ereignisse', async () => {
    mockIsSupabaseConfigured.current = true;
    mockFetchEngineMatchIds.mockResolvedValue(new Set([MATCH_ID]));
    const { accountId, store, clock } = await makeStoreWithGoal();
    const freshContext = await makeFreshContext(store, clock, accountId);

    const result = await loadEngineEventsForExport(tournament(), freshContext);

    expect(result.get(MATCH_ID)?.some((e) => e.type === 'GOAL')).toBe(true);
  });
  // --- Fixrunde 1, Ruling PC31: Fehlerpolitik ---

  it('Aufgabe 1: catch-up scheitert fuer ein Spiel des Turniers (lastError) -> der Lauf wirft, kein Export', async () => {
    mockIsSupabaseConfigured.current = true;
    mockFetchEngineMatchIds.mockResolvedValue(new Set([MATCH_ID]));
    const { accountId, store, clock } = await makeStoreWithGoal();
    const failingServer: FetchConfirmed = () => Promise.reject(new Error('Server 503'));
    const freshContext = await makeFreshContext(store, clock, accountId, failingServer);

    await expect(loadEngineEventsForExport(tournament(), freshContext)).rejects.toThrow(/Server 503/);
  });

  it('Aufgabe 1 Gegenbeispiel: lastError gehoert zu einem Spiel, das NICHT im Export-Turnier ist -> kein Abbruch', async () => {
    mockIsSupabaseConfigured.current = true;
    mockFetchEngineMatchIds.mockResolvedValue(new Set([MATCH_ID]));
    const OTHER_ID = 'match-other-1';
    const { accountId, store, clock } = await makeStoreWithGoal();
    const selectiveServer: FetchConfirmed = (matchId) =>
      matchId === OTHER_ID
        ? Promise.reject(new Error('anderes Turnier kaputt'))
        : Promise.resolve({ events: [], newWatermark: 0 });
    const freshContext = await makeFreshContext(store, clock, accountId, selectiveServer);
    const otherCtx = { matchId: OTHER_ID, teamAId: 'x', teamBId: 'y' };
    await freshContext.engine.ensureMatch(OTHER_ID, otherCtx);
    freshContext.engine.markEngineMatches([OTHER_ID]);
    await freshContext.engine.catchUp(OTHER_ID);
    expect(freshContext.engine.status(OTHER_ID).lastError).toBe('anderes Turnier kaputt');

    const result = await loadEngineEventsForExport(tournament(), freshContext);

    expect(result.get(MATCH_ID)?.some((e) => e.type === 'GOAL')).toBe(true);
  });

  it('Aufgabe 2: Tor liegt NUR auf dem Server (lokaler Store leer) -> der Lauf holt es per catch-up in den Export', async () => {
    mockIsSupabaseConfigured.current = true;
    mockFetchEngineMatchIds.mockResolvedValue(new Set([MATCH_ID]));
    // Ereignisse eines anderen Kontos "spielen" und als Server-Ereignisse mit seq ausliefern.
    const origin = await makeStoreWithGoal();
    const serverEvents = (await new LocalMatchStore().load(origin.accountId, MATCH_ID))?.pending ?? [];
    expect(serverEvents.length).toBeGreaterThan(0);
    const server: FetchConfirmed = () =>
      Promise.resolve({
        events: serverEvents.map((event, index) => ({ ...event, seq: index + 1 })),
        newWatermark: serverEvents.length,
      });
    const emptyAccountId = `acc-export-server-only-${(accountCounter += 1)}`;
    const freshContext = await makeFreshContext(new LocalMatchStore(), origin.clock, emptyAccountId, server);
    // Vorbedingung: lokal gibt es nichts.
    expect(await freshContext.store.load(emptyAccountId, MATCH_ID)).toBeNull();

    const result = await loadEngineEventsForExport(tournament(), freshContext);

    expect(result.get(MATCH_ID)?.some((e) => e.type === 'GOAL')).toBe(true);
  });

  it('Aufgabe 3: Gast offline -- keine Sammelabfrage, kein catch-up, Export gelingt mit den lokalen Ereignissen', async () => {
    mockIsSupabaseConfigured.current = true;
    mockFetchEngineMatchIds.mockRejectedValue(new Error('offline'));
    const { accountId, store, clock } = await makeStoreWithGoal('guest');
    const fetchConfirmed = vi.fn<FetchConfirmed>(() => Promise.reject(new Error('offline')));
    const freshContext = await makeFreshContext(store, clock, accountId, fetchConfirmed);

    const result = await loadEngineEventsForExport(tournament(), freshContext);

    expect(mockFetchEngineMatchIds).not.toHaveBeenCalled();
    expect(fetchConfirmed).not.toHaveBeenCalled();
    expect(result.get(MATCH_ID)?.some((e) => e.type === 'GOAL')).toBe(true);
  });

  it('Aufgabe 3 Gegenbeispiel: angemeldet + Sammelabfrage wirft -> der Export bricht ab', async () => {
    mockIsSupabaseConfigured.current = true;
    mockFetchEngineMatchIds.mockRejectedValue(new Error('offline'));
    const { accountId, store, clock } = await makeStoreWithGoal();
    const freshContext = await makeFreshContext(store, clock, accountId);

    await expect(loadEngineEventsForExport(tournament(), freshContext)).rejects.toThrow('offline');
    expect(mockFetchEngineMatchIds).toHaveBeenCalledTimes(1);
  });

  // --- Fixrunde 2, I1: lastError nur fuer in diesem Lauf nachgeladene Spiele ---

  /** Ein zweites Turnierspiel ohne lokale Ereignisse, dessen frueherer catch-up scheiterte -- wie
   * `useEngineMatchReadiness` (tolerant, ohne `markEngineMatches`). */
  async function contextWithStaleError(): Promise<MatchEngineContextValue> {
    const { accountId, store, clock } = await makeStoreWithGoal();
    const server: FetchConfirmed = (matchId) =>
      matchId === IDLE_MATCH_ID
        ? Promise.reject(new Error('Server 503'))
        : Promise.resolve({ events: [], newWatermark: 0 });
    const freshContext = await makeFreshContext(store, clock, accountId, server);
    await freshContext.engine.ensureMatch(IDLE_MATCH_ID, { matchId: IDLE_MATCH_ID, teamAId: 'teamb', teamBId: 'teama' }, 'tour-export');
    await freshContext.engine.catchUp(IDLE_MATCH_ID);
    expect(freshContext.engine.status(IDLE_MATCH_ID).lastError).toBe('Server 503');
    return freshContext;
  }

  it('I1: alter lastError an einem Spiel, das NICHT nachgeladen wird (nicht gemeldet, lokal leer) -> kein Abbruch', async () => {
    mockIsSupabaseConfigured.current = true;
    mockFetchEngineMatchIds.mockResolvedValue(new Set([MATCH_ID]));
    const freshContext = await contextWithStaleError();

    const result = await loadEngineEventsForExport(tournament(true), freshContext);

    expect(result.get(MATCH_ID)?.some((e) => e.type === 'GOAL')).toBe(true);
  });

  it('I1 Gegenbeispiel: dasselbe Spiel in engineMatchIds und der Server scheitert weiter -> Abbruch', async () => {
    mockIsSupabaseConfigured.current = true;
    mockFetchEngineMatchIds.mockResolvedValue(new Set([MATCH_ID, IDLE_MATCH_ID]));
    const freshContext = await contextWithStaleError();

    await expect(loadEngineEventsForExport(tournament(true), freshContext)).rejects.toThrow(/Server 503/);
  });
});
