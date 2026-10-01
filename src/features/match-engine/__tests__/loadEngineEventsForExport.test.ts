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

function tournament(): Tournament {
  return {
    id: 'tour-export',
    matches: [{ id: MATCH_ID, teamA: 'teama', teamB: 'teamb', round: 1, field: 1, matchNumber: 1 }],
    teams: [{ id: 'teama', name: 'Heim' }, { id: 'teamb', name: 'Gast' }],
    groupPhaseGameDuration: 20,
  } as unknown as Tournament;
}

let accountCounter = 0;

async function makeStoreWithGoal() {
  const accountId = `acc-export-${(accountCounter += 1)}`;
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

async function makeFreshContext(store: LocalMatchStore, clock: ClockSync, accountId: string): Promise<MatchEngineContextValue> {
  const engine = new MatchEngine({
    store, clock, sender: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() },
    fetchConfirmed: vi.fn(), now: () => 1_790_000_000_000,
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
});
