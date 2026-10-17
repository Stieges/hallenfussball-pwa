/**
 * Testgerüst B-08a: echte `MatchEngine` + `MatchCommands` über einen gemeinsamen `LocalMatchStore`
 * (fake-indexeddb). Die Zeit steuert der Test über `Date` (`vi.useFakeTimers({ toFake: ['Date'] })`
 * + `zu(ms)`); `Gerät B` ist eine zweite Engine auf demselben Store, die nur den Log liest.
 */
import 'fake-indexeddb/auto';
import { vi } from 'vitest';
import type { MatchContext, MatchRules } from '../../../core/match';
import { ClockSync, LocalMatchStore, MatchCommands, MatchEngine } from '../../../core/match/client';

export const T0 = 1_790_000_000_000;

/** Zwei Abschnitte zu je 6 Minuten, 1 Minute Pause (Pflichttest GB5, B-08a). */
export const REGEL_2X6: MatchRules = {
  sections: 2,
  sectionSeconds: 360,
  breakSeconds: 60,
  knockout: false,
  tiebreak: null,
  overtimeSeconds: 180,
  shootersPerTeam: 5,
  suddenDeathAfter: 6,
  penaltySeconds: 120,
};

/** Zwei Abschnitte zu je 10 Minuten (Gherkin @FU-073, @FU-074). */
export const REGEL_2X10: MatchRules = { ...REGEL_2X6, sectionSeconds: 600, overtimeSeconds: 180 };

/** Zu einem Zeitpunkt in ms seit `T0` springen (Gerät gesperrt = nichts rendern, nur Zeit vergeht). */
export function zu(ms: number): void {
  vi.setSystemTime(T0 + ms);
}

export interface Geraet {
  engine: MatchEngine;
  commands: MatchCommands;
}

/** Ein Gerät mit eigener Engine auf dem übergebenen Store. */
export async function geraetAuf(store: LocalMatchStore, accountId: string): Promise<Geraet> {
  const clock = new ClockSync(
    () => Promise.resolve(Date.now()),
    () => Date.now(),
    { get: () => null, set: () => undefined },
  );
  const engine = new MatchEngine({
    store,
    clock,
    sender: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() },
    fetchConfirmed: vi.fn(),
    now: () => Date.now(),
  });
  await engine.start(accountId);
  const sender = { kick: vi.fn().mockResolvedValue(undefined) };
  const commands = new MatchCommands({ engine, store, sender, accountId });
  return { engine, commands };
}

export interface EngineSpiel {
  matchId: string;
  ctx: MatchContext;
  store: LocalMatchStore;
  accountId: string;
  /** Gerät A: schreibt die Ereignisse. */
  a: Geraet;
}

let zaehler = 0;

/** Spiel mit Teams `teama`/`teamb` anlegen (ohne Anpfiff). */
export async function spielAnlegen(): Promise<EngineSpiel> {
  zaehler += 1;
  const matchId = `phase-spiel-${zaehler}`;
  const accountId = `acc-phase-${zaehler}`;
  const ctx: MatchContext = { matchId, teamAId: 'teama', teamBId: 'teamb' };
  const store = new LocalMatchStore();
  const a = await geraetAuf(store, accountId);
  await a.engine.ensureMatch(matchId, ctx);
  return { matchId, ctx, store, accountId, a };
}

/** Gerät B: zweite Engine auf demselben Log, neu geladen (kein Ereignis-Schreiben). */
export async function geraetBNeuLaden(spiel: EngineSpiel): Promise<Geraet> {
  const b = await geraetAuf(spiel.store, spiel.accountId);
  await b.engine.notifyStoreChange(spiel.matchId);
  return b;
}
