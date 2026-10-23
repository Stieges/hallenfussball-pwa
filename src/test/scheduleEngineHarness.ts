/**
 * Testgerüst A-08f3e2/e3 (nur Testumgebung): echter `LocalMatchStore` + `MatchEngine` + `OutboxSender`
 * (Server-RPC gemockt, Standard: alles angenommen) als `MatchEngineContextValue`, dazu ein Turnier mit
 * Gruppe A (Spiel 7, 9) und Halbfinale 1 -- Werte aus den Gherkin-Szenarien @FU-080/-082/-093/-094.
 */
import 'fake-indexeddb/auto';
import { vi, type Mock } from 'vitest';
import { ClockSync, LocalMatchStore, MatchEngine, OutboxSender, type OutboxApi } from '../core/match/client';
import type { EngineEventWithSeq } from '../core/match/client';
import type { MatchEngineContextValue } from '../features/match-engine/matchEngineContextInstance';
import type { Match, Team, Tournament } from '../types/tournament';
import { createMockMatch, createMockTournament } from './factories';
import { groupRank, slots, testUuid, vs } from './matchSlotFixtures';
import { pendingSlot, teamSlot } from '../core/models/matchSlot';
import { acceptAll, networkError } from '../core/match/client/__tests__/outboxHarness';

export const NOW = 1_790_000_000_000;
export const FC_NORD = testUuid(71);
export const SV_SUED = testUuid(72);
export const HEIM = testUuid(73);
export const GAST = testUuid(74);

const teams: Team[] = [
  { id: FC_NORD, name: 'FC Nord', group: 'A' },
  { id: SV_SUED, name: 'SV Süd', group: 'A' },
  { id: HEIM, name: 'Heimteam', group: 'B' },
  { id: GAST, name: 'Auswärtsteam', group: 'B' },
];

export const SPIEL_7 = 'spiel-7';
export const SPIEL_9 = 'spiel-9';
export const HALBFINALE_1 = 'halbfinale-1';
export const FINALE = 'finale';

export function scheduleTournament(overrides: Record<string, Partial<Match>> = {}, extraMatches: Match[] = []): Tournament {
  const matches: Match[] = [
    createMockMatch({ id: SPIEL_7, matchNumber: 7, group: 'A', phase: 'groupStage', ...vs(FC_NORD, SV_SUED), matchStatus: 'scheduled' }),
    createMockMatch({ id: SPIEL_9, matchNumber: 9, group: 'A', phase: 'groupStage', ...vs(SV_SUED, FC_NORD), matchStatus: 'scheduled' }),
    createMockMatch({ id: HALBFINALE_1, matchNumber: 11, group: undefined, phase: 'semifinal', isFinal: true, ...vs(HEIM, GAST), matchStatus: 'scheduled' }),
  ].concat(extraMatches).map((match) => ({ ...match, ...overrides[match.id] }));
  return createMockTournament({ id: 'T', ownerId: 'olli', teams, numberOfTeams: 4, matches, finalsConfig: { preset: 'none', tiebreaker: 'shootout' } });
}

/** H-2: Finale „Erster gegen Zweiter Gruppe A“ -- wird besetzt, sobald Gruppe A fertig ist. */
export function finaleAusGruppeA(): Match {
  return createMockMatch({ id: FINALE, matchNumber: 12, group: undefined, phase: 'final', isFinal: true, ...slots(groupRank('A', 1), groupRank('A', 2)), matchStatus: 'scheduled' });
}

/** GA4 A-13c: Kennung von Halbfinale 1 für die Herkunft „Sieger Halbfinale 1“ (Herkunft aus einem Spiel, nicht aus einer Gruppe). */
export const HF1_ID = '00000000-0000-4000-8000-0000000025a1';

/** A-13c: Finale „Sieger Halbfinale 1 gegen FC Nord“ -- wird mit dem Ergebnis von Halbfinale 1 besetzt (`HF1_ID` als Kennung setzen). */
export function finaleAusHalbfinale1(): Match {
  const source = { kind: 'matchResult' as const, matchId: HF1_ID, role: 'winner' as const };
  return createMockMatch({ id: FINALE, matchNumber: 12, group: undefined, phase: 'final', isFinal: true, slotA: pendingSlot(source), originA: source, slotB: teamSlot(FC_NORD), matchStatus: 'scheduled' });
}

export interface ScheduleEngine {
  value: MatchEngineContextValue;
  engine: MatchEngine;
  store: LocalMatchStore;
  sender: OutboxSender;
  api: Mock<OutboxApi['appendMatchEvents']>;
  fetchConfirmed: Mock<(matchId: string, watermark: number) => Promise<{ events: EngineEventWithSeq[]; newWatermark: number }>>;
}

let counter = 0;

/** `accountId: 'guest'` = Gast (lokal bestätigt, kein Sender-Aufruf). Sonst eigenes Konto je Aufruf (fake-indexeddb teilt sich). */
export async function makeScheduleEngine(accountId?: string, options: { offline?: boolean; deviceId?: string } = {}): Promise<ScheduleEngine> {
  const id = accountId ?? `olli-${(counter += 1)}`;
  const store = new LocalMatchStore();
  const clock = new ClockSync(() => Promise.resolve(NOW), () => NOW, { get: () => null, set: () => undefined });
  // offline: jeder Aufruf scheitert am Netz, Einträge bleiben `pending` (schon beim Start des Senders).
  const api = vi.fn<OutboxApi['appendMatchEvents']>(options.offline ? () => Promise.reject(networkError()) : async (_matchId, events) => acceptAll(events));
  const fetchConfirmed = vi.fn(async (_matchId: string, watermark: number) => ({ events: [] as EngineEventWithSeq[], newWatermark: watermark }));
  let engineRef: MatchEngine | null = null;
  const sender = new OutboxSender({
    store,
    api: { appendMatchEvents: api },
    clientFormat: 3,
    ...(options.deviceId !== undefined ? { deviceId: options.deviceId } : {}), // B-49: Geräte-ID wie im MatchEngineProvider
    timers: { setTimeout: (callback, ms) => setTimeout(callback, ms), clearTimeout: (handle) => { clearTimeout(handle); } },
    now: () => NOW,
    requestCatchUp: () => undefined,
    notifyStoreChange: (matchId) => { engineRef?.notifyStoreChange(matchId).catch(() => undefined); },
  });
  const engine = new MatchEngine({ store, clock, sender, fetchConfirmed, now: () => NOW });
  engineRef = engine;
  await engine.start(id);
  const value = { engine, store, clock, sender, accountId: id };
  return { value, engine, store, sender, api, fetchConfirmed };
}

/** Lässt angestoßene Arbeit (Sender, IndexedDB, Benachrichtigungen) zu Ende laufen. */
export async function settle(rounds = 30): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}
