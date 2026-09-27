import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalMatchStore } from '../LocalMatchStore';
import { ClockSync } from '../ClockSync';
import { MatchEngine, type EngineSender, type MatchBroadcastChannel } from '../MatchEngine';
import type { EngineEventWithSeq } from '../catchUp';
import { ctx, withSeq, goal } from './fixtures';

function fakeSender(): EngineSender & { starts: string[]; stops: number } {
  const calls = { starts: [] as string[], stops: 0 };
  return {
    starts: calls.starts,
    get stops() {
      return calls.stops;
    },
    async start(accountId: string) {
      calls.starts.push(accountId);
    },
    stop() {
      calls.stops += 1;
    },
  };
}

function fakeClock(): ClockSync {
  const storage = { get: () => null, set: () => undefined };
  return new ClockSync(() => Promise.resolve(1_790_000_000_000), () => 1_790_000_000_000, storage);
}

describe('MatchEngine', () => {
  let store: LocalMatchStore;

  beforeEach(() => {
    store = new LocalMatchStore();
  });

  it('start/stop/Kontowechsel: startet den Sender je Konto, stop loescht nichts', async () => {
    const sender = fakeSender();
    const engine = new MatchEngine({
      store,
      clock: fakeClock(),
      sender,
      fetchConfirmed: vi.fn(),
      now: () => 0,
    });

    await engine.start('acc-a');
    await engine.ensureMatch('me-switch', ctx);
    expect(sender.starts).toEqual(['acc-a']);

    engine.stop();
    expect(sender.stops).toBe(1);
    const copy = await store.load('acc-a', 'me-switch');
    expect(copy).not.toBeNull();

    await engine.start('acc-b');
    expect(sender.starts).toEqual(['acc-a', 'acc-b']);
    expect(engine.view('me-switch')).toBeNull(); // Kontowechsel: Cache je Konto, keine Karteileiche aus acc-a
  });

  it('ensureMatch ist idempotent (create legt einmal an, zweiter Aufruf aendert ctx nicht still)', async () => {
    const fetchConfirmed = vi.fn().mockResolvedValue({ events: [], newWatermark: 0 });
    const engine = new MatchEngine({ store, clock: fakeClock(), sender: fakeSender(), fetchConfirmed, now: () => 0 });
    await engine.start('guest');
    await engine.ensureMatch('me-idempotent', ctx);
    await engine.ensureMatch('me-idempotent', ctx);
    const copies = await store.forAccount('guest');
    expect(copies).toHaveLength(1);
  });

  it('catchUp bewegt den Wasserstand nur ueber applyConfirmed', async () => {
    const events: EngineEventWithSeq[] = [withSeq(goal('g1', 'teamA', 1000, 0), 1)];
    const fetchConfirmed = vi.fn().mockResolvedValue({ events, newWatermark: 1 });
    const engine = new MatchEngine({ store, clock: fakeClock(), sender: fakeSender(), fetchConfirmed, now: () => 0 });
    await engine.start('acc1');
    await engine.ensureMatch('me-catchup', ctx);
    await engine.catchUp('me-catchup');

    const copy = await store.load('acc1', 'me-catchup');
    expect(copy?.watermarkSeq).toBe(1);
    expect(copy?.confirmed.map((e) => e.id)).toEqual(['g1']);
    expect(fetchConfirmed).toHaveBeenCalledWith('me-catchup', 0);
  });

  it('catchUp-Fehler setzt Status, laesst die Kopie unveraendert', async () => {
    const fetchConfirmed = vi.fn().mockRejectedValue(new Error('Netz weg'));
    const engine = new MatchEngine({ store, clock: fakeClock(), sender: fakeSender(), fetchConfirmed, now: () => 0 });
    await engine.start('acc1');
    await engine.ensureMatch('me-error', ctx);
    const before = await store.load('acc1', 'me-error');

    await engine.catchUp('me-error');

    const after = await store.load('acc1', 'me-error');
    expect(after).toEqual(before);
    expect(engine.status('me-error').lastError).toBe('Netz weg');
  });

  it('needsFullReload: genau ein resetConfirmed je Stand, danach divergent statt Endlosschleife', async () => {
    // Bestaetigte Karte + ein acked-Eintrag, der lokal nie anwendbar wird (Ziel existiert nie) ->
    // needsFullReload bleibt nach dem Reset-Versuch bestehen (V3-Pfad in view.ts:123).
    const confirmedGoal = withSeq(goal('c1', 'teamA', 500, 0), 5);
    await store.create('acc1', 'me-reload', ctx);
    await store.applyConfirmed('acc1', 'me-reload', [confirmedGoal], 5);
    await store.addPending('acc1', 'me-reload', {
      id: 'a1', type: 'RETRACT', at: 600, actor: 'leitung', section: 1, clockMs: null, targetId: 'unbekannt', payload: {},
    });
    await store.markAcked('acc1', 'me-reload', ['a1']);

    // Der Server liefert bei jedem Nachladen (egal ab welchem Wasserstand) dieselbe bestaetigte
    // Karte zurueck -- realistisch fuer "Reset bringt denselben Stand wieder".
    const fetchConfirmed = vi.fn().mockResolvedValue({ events: [confirmedGoal], newWatermark: 5 });
    const engine = new MatchEngine({ store, clock: fakeClock(), sender: fakeSender(), fetchConfirmed, now: () => 0 });
    await engine.start('acc1');

    await engine.catchUp('me-reload');
    expect(engine.status('me-reload').divergent).toBe(true);
    const fromZeroCallsAfterFirst = fetchConfirmed.mock.calls.filter(([, watermark]) => watermark === 0).length;
    expect(fromZeroCallsAfterFirst).toBe(1);

    // Ein weiterer Aufruf darf KEINEN zweiten Reset-Versuch ausloesen.
    await engine.catchUp('me-reload');
    expect(engine.status('me-reload').divergent).toBe(true);
    const fromZeroCallsTotal = fetchConfirmed.mock.calls.filter(([, watermark]) => watermark === 0).length;
    expect(fromZeroCallsTotal).toBe(1);
  });

  it('subscribe feuert bei jeder Aenderung einer Kopie', async () => {
    const fetchConfirmed = vi.fn().mockResolvedValue({ events: [], newWatermark: 0 });
    const engine = new MatchEngine({ store, clock: fakeClock(), sender: fakeSender(), fetchConfirmed, now: () => 0 });
    await engine.start('acc1');
    const listener = vi.fn();
    engine.subscribe(listener);

    await engine.ensureMatch('me-subscribe', ctx);
    expect(listener).toHaveBeenCalled();
    listener.mockClear();

    await engine.catchUp('me-subscribe');
    expect(listener).toHaveBeenCalled();
  });

  it('Gast: keine Netzaufrufe (fetchConfirmed wird nie gerufen)', async () => {
    const fetchConfirmed = vi.fn();
    const engine = new MatchEngine({ store, clock: fakeClock(), sender: fakeSender(), fetchConfirmed, now: () => 0 });
    await engine.start('guest');
    await engine.ensureMatch('me-guest', ctx);
    await engine.catchUp('me-guest');
    expect(fetchConfirmed).not.toHaveBeenCalled();
  });

  it('W10: fremde Broadcast-Nachricht laedt die Kopie des Spiels neu', async () => {
    const handlerRef: { current: ((event: { data: { matchId: string } }) => void) | null } = { current: null };
    const channel: MatchBroadcastChannel = {
      postMessage: vi.fn(),
      addEventListener: (_type, listener) => {
        handlerRef.current = listener;
      },
    };
    const fetchConfirmed = vi.fn().mockResolvedValue({ events: [], newWatermark: 0 });
    const engine = new MatchEngine({
      store,
      clock: fakeClock(),
      sender: fakeSender(),
      fetchConfirmed,
      now: () => 0,
      broadcast: channel,
    });
    await engine.start('acc1');
    await engine.ensureMatch('me-broadcast', ctx);

    // Ein anderer Tab schreibt direkt in den Store (z. B. ueber die eigene MatchEngine-Instanz).
    await store.addPending('acc1', 'me-broadcast', goal('other-tab', 'teamA', 10, 0));
    expect(engine.view('me-broadcast')?.log.map((e) => e.id)).not.toContain('other-tab');

    expect(handlerRef.current).not.toBeNull();
    handlerRef.current?.({ data: { matchId: 'me-broadcast' } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(engine.view('me-broadcast')?.log.map((e) => e.id)).toContain('other-tab');
  });
});
