import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalMatchStore, LocalStoreFullError } from '../LocalMatchStore';
import { ClockSync } from '../ClockSync';
import { MatchEngine, type EngineSender } from '../MatchEngine';
import { MatchCommands, MatchCommandRejectedError } from '../MatchCommands';
import { ctx, RULES } from './fixtures';

function fakeSender(): EngineSender {
  return { start: vi.fn(async () => undefined), stop: vi.fn() };
}

function fakeClock(now: number): ClockSync {
  const storage = { get: () => null, set: () => undefined };
  return new ClockSync(() => Promise.resolve(now), () => now, storage);
}

async function makeEngine(now: number, accountId: string, store: LocalMatchStore) {
  const engine = new MatchEngine({
    store,
    clock: fakeClock(now),
    sender: fakeSender(),
    fetchConfirmed: vi.fn(),
    now: () => now,
  });
  await engine.start(accountId);
  await engine.ensureMatch(ctx.matchId, ctx);
  return engine;
}

// Jeder Test verwendet ein EIGENES Konto: `fake-indexeddb` teilt den Store zwischen Tests
// (kein Reset zwischen `it()`-Bloecken), ein gemeinsames Konto wuerde MATCH_START aus einem
// frueheren Test wiederfinden ("bereits gestartet").
describe('MatchCommands (C3a-2a, RC1)', () => {
  let store: LocalMatchStore;
  const NOW = 1_790_000_000_000;

  beforeEach(() => {
    store = new LocalMatchStore();
  });

  it('start(): baut MATCH_START mit den uebergebenen rules, section 1, clockMs 0', async () => {
    const engine = await makeEngine(NOW, 'acc-start', store);
    const kick = vi.fn(async () => undefined);
    const commands = new MatchCommands({ engine, store, sender: { kick }, accountId: 'acc-start' });

    await commands.start(ctx.matchId, ctx, 'leitung', RULES);

    const copy = await store.load('acc-start', ctx.matchId);
    expect(copy?.pending).toHaveLength(1);
    const event = copy!.pending[0];
    expect(event.type).toBe('MATCH_START');
    expect(event.section).toBe(1);
    expect(event.clockMs).toBe(0);
    expect(event.at).toBe(NOW);
    expect(event.actor).toBe('leitung');
    expect(event.payload.rules).toEqual(RULES);
    expect(event.teamId).toBeNull();
    // id klein (crypto.randomUUID())
    expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(kick).toHaveBeenCalledWith(ctx.matchId);
  });

  it('Reihenfolge: store.addPending laeuft, BEVOR notifyStoreChange/kick aufgerufen werden', async () => {
    const engine = await makeEngine(NOW, 'acc-order', store);
    const calls: string[] = [];
    const originalNotify = engine.notifyStoreChange.bind(engine);
    vi.spyOn(engine, 'notifyStoreChange').mockImplementation(async (matchId: string) => {
      calls.push('notify');
      await originalNotify(matchId);
    });
    const kick = vi.fn(async () => {
      calls.push('kick');
    });
    const originalAddPending = store.addPending.bind(store);
    const addPendingSpy = vi.spyOn(store, 'addPending').mockImplementation(async (...args) => {
      calls.push('store');
      await originalAddPending(...args);
    });
    const commands = new MatchCommands({ engine, store, sender: { kick }, accountId: 'acc-order' });

    await commands.start(ctx.matchId, ctx, 'leitung', RULES);

    expect(addPendingSpy).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['store', 'notify', 'kick']);
  });

  it('Gast (V14): schreibt sofort confirmed per addConfirmedLocal, kein sender.kick', async () => {
    const engine = await makeEngine(NOW, 'guest', store);
    const kick = vi.fn(async () => undefined);
    const commands = new MatchCommands({ engine, store, sender: { kick }, accountId: 'guest' });

    await commands.start(ctx.matchId, ctx, 'leitung', RULES);

    const copy = await store.load('guest', ctx.matchId);
    expect(copy?.confirmed).toHaveLength(1);
    expect(copy?.pending).toHaveLength(0);
    expect(kick).not.toHaveBeenCalled();
  });

  it('lokale Vorpruefung: Tor vor Anpfiff wird abgewiesen, NICHTS gespeichert', async () => {
    const engine = await makeEngine(NOW, 'acc-reject', store);
    const kick = vi.fn(async () => undefined);
    const commands = new MatchCommands({ engine, store, sender: { kick }, accountId: 'acc-reject' });

    await expect(commands.goal(ctx.matchId, ctx, 'leitung', ctx.teamAId, false)).rejects.toThrow(
      MatchCommandRejectedError,
    );

    const copy = await store.load('acc-reject', ctx.matchId);
    expect(copy?.pending).toHaveLength(0);
    expect(kick).not.toHaveBeenCalled();
  });

  it('LocalStoreFullError laeuft durch, notifyStoreChange/kick werden NICHT aufgerufen', async () => {
    const engine = await makeEngine(NOW, 'acc-full', store);
    vi.spyOn(store, 'addPending').mockRejectedValueOnce(new LocalStoreFullError());
    const notifySpy = vi.spyOn(engine, 'notifyStoreChange');
    const kick = vi.fn(async () => undefined);
    const commands = new MatchCommands({ engine, store, sender: { kick }, accountId: 'acc-full' });

    await expect(commands.start(ctx.matchId, ctx, 'leitung', RULES)).rejects.toThrow(LocalStoreFullError);

    expect(notifySpy).not.toHaveBeenCalled();
    expect(kick).not.toHaveBeenCalled();
  });

  it('Tor nach Anpfiff: clockMs aus der laufenden Uhr, GOAL mit teamId + playerNumber', async () => {
    const engine = await makeEngine(NOW, 'acc-goal', store);
    const kick = vi.fn(async () => undefined);
    const commands = new MatchCommands({ engine, store, sender: { kick }, accountId: 'acc-goal' });
    await commands.start(ctx.matchId, ctx, 'leitung', RULES);

    const laterEngine = await makeEngine(NOW + 61_000, 'acc-goal', store);
    const laterCommands = new MatchCommands({ engine: laterEngine, store, sender: { kick }, accountId: 'acc-goal' });
    await laterCommands.goal(ctx.matchId, ctx, 'helper', ctx.teamAId, false, { playerNumber: 9 });

    const copy = await store.load('acc-goal', ctx.matchId);
    const goalEvent = copy!.pending.find((e) => e.type === 'GOAL')!;
    expect(goalEvent.teamId).toBe(ctx.teamAId);
    expect(goalEvent.clockMs).toBe(61_000);
    expect(goalEvent.payload.playerNumber).toBe(9);
    expect(goalEvent.actor).toBe('helper');
  });

  it('Karte: cardType steuert den Ereignistyp (YELLOW_CARD/RED_CARD)', async () => {
    const engine = await makeEngine(NOW, 'acc-card', store);
    const kick = vi.fn(async () => undefined);
    const commands = new MatchCommands({ engine, store, sender: { kick }, accountId: 'acc-card' });
    await commands.start(ctx.matchId, ctx, 'leitung', RULES);
    await commands.card(ctx.matchId, ctx, 'leitung', ctx.teamBId, 'RED_CARD', { playerNumber: 4 });

    const copy = await store.load('acc-card', ctx.matchId);
    const card = copy!.pending.find((e) => e.type === 'RED_CARD')!;
    expect(card.teamId).toBe(ctx.teamBId);
    expect(card.payload.playerNumber).toBe(4);
  });
});
