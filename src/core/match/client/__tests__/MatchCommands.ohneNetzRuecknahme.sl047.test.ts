/**
 * @SL-047 Ohne Netz zurückgenommen, kommt die Rücknahme mit dem Tor an.
 * Gegeben Toms Tablet hat kein Netz, Tom hat ein Tor für FC Nord eingetragen und gleich wieder zurückgenommen.
 * Wenn Toms Tablet wieder Netz hat, dann zeigt der Hallenmonitor von Feld 1 den Stand ohne dieses Tor.
 *
 * Echte Teile: LocalMatchStore (fake-indexeddb), MatchEngine, MatchCommands, OutboxSender. Gefälscht ist nur das Netz
 * (`api.appendMatchEvents`): ohne Netz wirft es einen Netzfehler, mit Netz nimmt es alles an und führt wie der Server
 * ein Protokoll. Was der Hallenmonitor zeigt, ist der Stand, den `reduceMatch` aus diesem Server-Protokoll rechnet.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { effectiveScoreFor, reduceMatch, type EngineEvent } from '../../';
import { MatchCommands } from '../MatchCommands';
import { MatchEngine } from '../MatchEngine';
import { ClockSync } from '../ClockSync';
import { ctx, RULES } from './fixtures';
import { acceptAll, idsIn, makeHarness, networkError, type Harness } from './outboxHarness';

const NOW = 1_790_000_000_000;
const KONTO = 'acc-sl047';

interface Aufbau {
  h: Harness;
  commands: MatchCommands;
  netz: { an: boolean };
  /** Alles, was beim „Server“ angekommen ist, in der Reihenfolge des Eintreffens. */
  server: EngineEvent[];
}

async function aufbau(): Promise<Aufbau> {
  const h = makeHarness();
  const netz = { an: false };
  const server: EngineEvent[] = [];
  h.api.mockImplementation(async (_matchId, events) => {
    if (!netz.an) { throw networkError(); }
    server.push(...(events as unknown as EngineEvent[]));
    return acceptAll(events);
  });
  const clock = new ClockSync(() => Promise.resolve(NOW), () => NOW, { get: () => null, set: () => undefined });
  const engine = new MatchEngine({ store: h.store, clock, sender: { start: vi.fn(async () => undefined), stop: vi.fn() }, fetchConfirmed: vi.fn(), now: () => NOW });
  await engine.start(KONTO);
  await engine.ensureMatch(ctx.matchId, ctx);
  await h.sender.start(KONTO);
  const commands = new MatchCommands({ engine, store: h.store, sender: h.sender, accountId: KONTO });
  await commands.start(ctx.matchId, ctx, 'leitung', RULES);
  return { h, commands, netz, server };
}

async function tor(commands: MatchCommands, h: Harness): Promise<string> {
  await commands.goal(ctx.matchId, ctx, 'leitung', ctx.teamAId, false);
  const kopie = await h.store.load(KONTO, ctx.matchId);
  return kopie!.pending.filter((e) => e.type === 'GOAL').at(-1)!.id;
}

const standAmServer = (server: EngineEvent[]): { heim: number; gast: number } => {
  const { state } = reduceMatch(server, ctx);
  return { heim: effectiveScoreFor(state, ctx.teamAId), gast: effectiveScoreFor(state, ctx.teamBId) };
};

describe('@SL-047 Ohne Netz zurückgenommen, kommt die Rücknahme mit dem Tor an', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('@SL-047 Tor und Rücknahme ohne Netz → mit Netz kommen beide in dieser Reihenfolge an, der Server-Stand ist 0:0', async () => {
    const { h, commands, netz, server } = await aufbau();
    const torId = await tor(commands, h);
    await commands.retract(ctx.matchId, ctx, 'leitung', torId);
    await h.settle();

    // ohne Netz: nichts ist angekommen, alles wartet im Ausgang
    expect(server).toEqual([]);
    expect(await idsIn(h, KONTO, ctx.matchId, 'pending')).toHaveLength(3);

    netz.an = true;
    await h.sender.kick();
    await h.tick(60_000);

    expect(server.map((e) => e.type)).toEqual(['MATCH_START', 'GOAL', 'RETRACT']);
    expect(server.find((e) => e.type === 'RETRACT')?.targetId).toBe(torId);
    expect(await idsIn(h, KONTO, ctx.matchId, 'pending')).toEqual([]);
    expect(standAmServer(server)).toEqual({ heim: 0, gast: 0 });
  });

  it('@SL-047 Gegenbeispiel: ohne die Rücknahme kommt das Tor an, der Server-Stand ist 1:0', async () => {
    const { h, commands, netz, server } = await aufbau();
    await tor(commands, h);
    await h.settle();

    netz.an = true;
    await h.sender.kick();
    await h.tick(60_000);

    expect(server.map((e) => e.type)).toEqual(['MATCH_START', 'GOAL']);
    expect(standAmServer(server)).toEqual({ heim: 1, gast: 0 });
  });

  it('@SL-047 Gegenbeispiel: solange das Netz fehlt, zeigt der Server weder Tor noch Rücknahme', async () => {
    const { h, commands, server } = await aufbau();
    const torId = await tor(commands, h);
    await commands.retract(ctx.matchId, ctx, 'leitung', torId);
    await h.tick(60_000);

    expect(server).toEqual([]);
    expect(await idsIn(h, KONTO, ctx.matchId, 'pending')).toHaveLength(3);
  });
});
