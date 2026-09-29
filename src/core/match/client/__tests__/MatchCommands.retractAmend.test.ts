/**
 * C3b-1 (Plan §2 C3b-1 Nr. 2, §8 Zeilen 23): `MatchCommands.retract/amend` und der Umschlag
 * (teamId null, targetId gesetzt) inkl. Kaskade bei abgelehntem Ziel (DEPENDS_ON_REJECTED).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalMatchStore } from '../LocalMatchStore';
import { ClockSync } from '../ClockSync';
import { MatchEngine, type EngineSender } from '../MatchEngine';
import { MatchCommands, MatchCommandRejectedError } from '../MatchCommands';
import { buildResolution, DEPENDS_ON_REJECTED } from '../outboxResolution';
import { applyResolution, type MatchCopy } from '../matchCopy';
import { ctx, RULES } from './fixtures';

const NOW = 1_790_000_000_000;

function fakeSender(): EngineSender {
  return { start: vi.fn(async () => undefined), stop: vi.fn() };
}

function fakeClock(now: number): ClockSync {
  const storage = { get: () => null, set: () => undefined };
  return new ClockSync(() => Promise.resolve(now), () => now, storage);
}

async function setup(accountId: string, store: LocalMatchStore) {
  const engine = new MatchEngine({
    store,
    clock: fakeClock(NOW),
    sender: fakeSender(),
    fetchConfirmed: vi.fn(),
    now: () => NOW,
  });
  await engine.start(accountId);
  await engine.ensureMatch(ctx.matchId, ctx);
  const commands = new MatchCommands({ engine, store, sender: { kick: vi.fn(async () => undefined) }, accountId });
  await commands.start(ctx.matchId, ctx, 'leitung', RULES);
  await commands.goal(ctx.matchId, ctx, 'helper', ctx.teamAId, false, { playerNumber: 9 });
  const copy = await store.load(accountId, ctx.matchId);
  const goalId = copy!.pending.find((e) => e.type === 'GOAL')!.id;
  return { commands, goalId };
}

describe('MatchCommands.retract/amend (C3b-1)', () => {
  let store: LocalMatchStore;

  beforeEach(() => {
    store = new LocalMatchStore();
  });

  it('retract(): baut RETRACT mit targetId, ohne teamId, leerer Payload', async () => {
    const { commands, goalId } = await setup('acc-retract', store);

    await commands.retract(ctx.matchId, ctx, 'helper', goalId);

    const copy = await store.load('acc-retract', ctx.matchId);
    const event = copy!.pending.find((e) => e.type === 'RETRACT')!;
    expect(event.targetId).toBe(goalId);
    expect(event.teamId).toBeNull();
    expect(event.payload).toEqual({});
    expect(event.actor).toBe('helper');
  });

  it('retract(): unbekanntes Ziel wird lokal abgewiesen, nichts gespeichert', async () => {
    const { commands } = await setup('acc-retract-bad', store);

    await expect(commands.retract(ctx.matchId, ctx, 'helper', 'gibt-es-nicht')).rejects.toThrow(
      MatchCommandRejectedError,
    );

    const copy = await store.load('acc-retract-bad', ctx.matchId);
    expect(copy!.pending.some((e) => e.type === 'RETRACT')).toBe(false);
  });

  it('amend(): gesetzte Nummer -> Payload { playerNumber }, kein clear, kein incomplete', async () => {
    const { commands, goalId } = await setup('acc-amend-set', store);

    await commands.amend(ctx.matchId, ctx, 'helper', goalId, { playerNumber: 7 }, []);

    const copy = await store.load('acc-amend-set', ctx.matchId);
    const event = copy!.pending.find((e) => e.type === 'AMEND')!;
    expect(event.targetId).toBe(goalId);
    expect(event.teamId).toBeNull();
    expect(event.payload).toEqual({ playerNumber: 7 });
  });

  it('amend(): geleertes Feld -> Payload { clear: [playerNumber] }', async () => {
    const { commands, goalId } = await setup('acc-amend-clear', store);

    await commands.amend(ctx.matchId, ctx, 'helper', goalId, {}, ['playerNumber']);

    const copy = await store.load('acc-amend-clear', ctx.matchId);
    const event = copy!.pending.find((e) => e.type === 'AMEND')!;
    expect(event.payload).toEqual({ clear: ['playerNumber'] });
  });

  it('amend(): ohne Feld und ohne clear wird lokal abgewiesen (INVALID_PAYLOAD)', async () => {
    const { commands, goalId } = await setup('acc-amend-empty', store);

    await expect(commands.amend(ctx.matchId, ctx, 'helper', goalId, {}, [])).rejects.toThrow(
      MatchCommandRejectedError,
    );
  });

  it('DEPENDS_ON_REJECTED: RETRACT (teamId null) auf ein abgelehntes Tor kaskadiert mit der Ziel-Id', () => {
    const goal = { id: 'g1', type: 'GOAL' as const, actor: 'helper' as const, at: 2, section: 1, clockMs: 0, teamId: ctx.teamAId, targetId: null, payload: {} };
    const retract = { id: 'r1', type: 'RETRACT' as const, actor: 'helper' as const, at: 3, section: 1, clockMs: 0, teamId: null, targetId: 'g1', payload: {} };
    const amend = { id: 'a1', type: 'AMEND' as const, actor: 'helper' as const, at: 4, section: 1, clockMs: 0, teamId: null, targetId: 'g1', payload: { playerNumber: 5 } };
    const { resolution } = buildResolution(
      [goal],
      [{ id: 'g1', status: 'rejected' as const, code: 'INVALID_TRANSITION' }],
      4711,
    );
    const copy: MatchCopy = {
      formatVersion: 2, accountId: 'acc', matchId: 'm', ctx, confirmed: [], watermarkSeq: 0,
      acked: [], pending: [goal, retract, amend], rejected: [], review: [], updatedAt: 0,
    };

    applyResolution(copy, resolution);

    const byId = new Map(copy.rejected.map((entry) => [entry.event.id, entry]));
    expect(byId.get('r1')?.code).toBe(DEPENDS_ON_REJECTED);
    expect(byId.get('r1')?.detail).toEqual({ dependsOnEventId: 'g1' });
    expect(byId.get('a1')?.code).toBe(DEPENDS_ON_REJECTED);
    expect(byId.get('a1')?.detail).toEqual({ dependsOnEventId: 'g1' });
    expect(copy.pending).toEqual([]);
  });
});
