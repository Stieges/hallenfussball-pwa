/**
 * B-07a, Schritt 0 + Kaskade: der Stapel `unskip + enterResult` geht mit echtem Store, echter
 * Anzeige (`MatchEngine`) und echtem `OutboxSender` (Server gemockt) in EINEM Aufruf zum Server;
 * lehnt der Server das `UNSKIP` ab, nimmt er den Rest mit (@FU-093, R12) -- das Spiel bleibt abgesetzt.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClockSync } from '../ClockSync';
import { MatchCommands } from '../MatchCommands';
import { MatchEngine, type EngineSender } from '../MatchEngine';
import { ctx } from './fixtures';
import { idsIn, makeHarness, rejectedIn, resultOf, success } from './outboxHarness';

const NOW = 1_790_000_000_000;
const SCORES = { teamA: 3, teamB: 1 };

function fakeSender(): EngineSender {
  return { start: vi.fn(async () => undefined), stop: vi.fn() };
}

describe('Stapel unskip + enterResult ueber Ausgang und Sender (@FU-093)', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function setup() {
    const h = makeHarness();
    const clock = new ClockSync(() => Promise.resolve(NOW), () => NOW, { get: () => null, set: () => undefined });
    const engine = new MatchEngine({ store: h.store, clock, sender: fakeSender(), fetchConfirmed: vi.fn(), now: () => NOW });
    await engine.start('acc');
    await engine.ensureMatch(ctx.matchId, ctx);
    await h.sender.start('acc');
    const kicks: Promise<void>[] = [];
    const pendingAtKick: string[][] = [];
    const kick = vi.fn((matchId?: string) => {
      kicks.push(h.store.load('acc', ctx.matchId).then((copy) => void pendingAtKick.push((copy?.pending ?? []).map((e) => e.type))));
      const sent = h.sender.kick(matchId);
      kicks.push(sent);
      return sent;
    });
    const commands = new MatchCommands({ engine, store: h.store, sender: { kick }, accountId: 'acc' });
    return { h, engine, commands, kicks, pendingAtKick, kick };
  }

  it('@FU-093 ein kick, ein Server-Aufruf mit UNSKIP und RESULT_ENTRY in dieser Reihenfolge', async () => {
    const { h, commands, kicks, kick } = await setup();
    await commands.skip(ctx.matchId, ctx, 'leitung');
    await Promise.all(kicks.splice(0));
    h.api.mockClear();
    kick.mockClear();

    const id = await commands.unskipAndEnterResult(ctx.matchId, ctx, 'leitung', SCORES);
    await Promise.all(kicks);

    expect(kick).toHaveBeenCalledTimes(1);
    expect(h.api).toHaveBeenCalledTimes(1);
    const sent = h.api.mock.calls[0][1];
    expect(sent.map((event) => event.type)).toEqual(['UNSKIP', 'RESULT_ENTRY']);
    expect(sent[1].id).toBe(id);
  });

  it('@FU-093 beide Eintraege liegen pending im Store, BEVOR der kick laeuft', async () => {
    const { commands, kicks, pendingAtKick } = await setup();
    await commands.skip(ctx.matchId, ctx, 'leitung');
    await Promise.all(kicks.splice(0));
    pendingAtKick.length = 0;

    await commands.unskipAndEnterResult(ctx.matchId, ctx, 'leitung', SCORES);
    await Promise.all(kicks);

    expect(pendingAtKick).toEqual([['UNSKIP', 'RESULT_ENTRY']]);
  });

  it('@FU-093 Gegenbeispiel: lehnt der Server das UNSKIP ab, ist auch RESULT_ENTRY abgelehnt, Spiel bleibt abgesetzt', async () => {
    const { h, engine, commands, kicks } = await setup();
    await commands.skip(ctx.matchId, ctx, 'leitung');
    await Promise.all(kicks.splice(0));
    h.api.mockClear();
    // Mehrgeraete-Fall: auf dem Server ist das Spiel nicht abgesetzt, UNSKIP ist dort unzulaessig.
    h.api.mockImplementation(async (_matchId, events) =>
      success(
        events.map((event, index) =>
          index === 0
            ? resultOf(event.id, 'rejected', 'INVALID_TRANSITION')
            : resultOf(event.id, 'rejected', 'DEPENDS_ON_REJECTED'),
        ),
      ),
    );

    await commands.unskipAndEnterResult(ctx.matchId, ctx, 'leitung', SCORES);
    await Promise.all(kicks);

    expect(h.api).toHaveBeenCalledTimes(1);
    const rejected = await rejectedIn(h, 'acc', ctx.matchId);
    expect(rejected.map(([, code]) => code)).toEqual(['INVALID_TRANSITION', 'DEPENDS_ON_REJECTED']);
    expect(await idsIn(h, 'acc', ctx.matchId, 'pending')).toEqual([]);
    await engine.notifyStoreChange(ctx.matchId);
    expect(engine.view(ctx.matchId)?.result.state.status).toBe('skipped');
  });
});
