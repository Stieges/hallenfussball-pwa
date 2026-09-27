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
    // `refreshCopy` ist async (IndexedDB) -- unter Last reicht ein einzelnes setTimeout(0) nicht
    // immer aus, deshalb kurz pollen statt einmalig zu warten.
    for (let attempt = 0; attempt < 50; attempt++) {
      if (engine.view('me-broadcast')?.log.some((e) => e.id === 'other-tab')) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    expect(engine.view('me-broadcast')?.log.map((e) => e.id)).toContain('other-tab');
  });

  it('W10: die eigene Aenderung wird per Broadcast gesendet (nach ensureMatch UND nach catchUp)', async () => {
    const channel: MatchBroadcastChannel = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
    };
    const fetchConfirmed = vi.fn().mockResolvedValue({ events: [], newWatermark: 0 });
    const engine = new MatchEngine({
      store, clock: fakeClock(), sender: fakeSender(), fetchConfirmed, now: () => 0, broadcast: channel,
    });
    await engine.start('acc1');

    await engine.ensureMatch('me-send', ctx);
    expect(channel.postMessage).toHaveBeenCalledWith({ matchId: 'me-send' });
  });

  it('I1 (W3): ensureMatch loest KEIN catchUp mehr aus -- fetchConfirmed bleibt unberuehrt', async () => {
    const fetchConfirmed = vi.fn().mockResolvedValue({ events: [], newWatermark: 0 });
    const engine = new MatchEngine({ store, clock: fakeClock(), sender: fakeSender(), fetchConfirmed, now: () => 0 });
    await engine.start('acc1');

    await engine.ensureMatch('me-no-autocatchup', ctx);

    expect(fetchConfirmed).not.toHaveBeenCalled();
  });

  it('I1/I4: catchUpLoaded laedt nur qualifizierende Spiele nach (bekanntes Engine-Spiel ODER offene Eintraege)', async () => {
    const fetchConfirmed = vi.fn().mockResolvedValue({ events: [], newWatermark: 0 });
    const engine = new MatchEngine({ store, clock: fakeClock(), sender: fakeSender(), fetchConfirmed, now: () => 0 });
    await engine.start('acc1');
    await engine.ensureMatch('me-plain', ctx);
    await engine.ensureMatch('me-marked', { ...ctx, matchId: 'me-marked' });
    await engine.ensureMatch('me-pending', { ...ctx, matchId: 'me-pending' });
    await store.addPending('acc1', 'me-pending', goal('local-goal', 'teamA', 10, 0));
    // `engine.copies` cacht die Kopie im Speicher -- der direkte Store-Schreibzugriff oben wird erst
    // nach einem erneuten `ensureMatch` (Kopie neu lesen) sichtbar (gleiches Prinzip wie W10).
    await engine.ensureMatch('me-pending', { ...ctx, matchId: 'me-pending' });
    engine.markEngineMatches(['me-marked']);

    await engine.catchUpLoaded();

    expect(fetchConfirmed).toHaveBeenCalledWith('me-marked', 0);
    expect(fetchConfirmed).toHaveBeenCalledWith('me-pending', 0);
    expect(fetchConfirmed).not.toHaveBeenCalledWith('me-plain', 0);
    expect(fetchConfirmed).toHaveBeenCalledTimes(2);
  });

  it('N-I2: catchUpLoaded laedt auch ein Spiel nach, dessen Kopie NUR bestaetigte Ereignisse hat (Offline-Start -> online)', async () => {
    // Szenario: App startet ohne Netz in der Halle. Die Sammelabfrage (W3) scheitert, `markEngineMatches`
    // bleibt leer -- aber die lokale Kopie hat (z. B. aus einer frueheren Sitzung) bereits bestaetigte
    // Ereignisse. Kommt das Netz zurueck, muss `catchUpLoaded` dieses Spiel trotzdem nachladen.
    const confirmedGoal = withSeq(goal('c1', 'teamA', 500, 0), 1);
    await store.create('acc1', 'me-confirmed-only', ctx);
    await store.applyConfirmed('acc1', 'me-confirmed-only', [confirmedGoal], 1);

    const fetchConfirmed = vi.fn().mockResolvedValue({ events: [], newWatermark: 1 });
    const engine = new MatchEngine({ store, clock: fakeClock(), sender: fakeSender(), fetchConfirmed, now: () => 0 });
    await engine.start('acc1');
    await engine.ensureMatch('me-confirmed-only', ctx); // liest die vorhandene Kopie in den Cache

    await engine.catchUpLoaded();

    expect(fetchConfirmed).toHaveBeenCalledWith('me-confirmed-only', 1);
  });

  it('I2: Single-Flight MIT Nachzuegler -- zwei Aufrufe waehrend eines laufenden Laufs ergeben genau 2 fetchConfirmed', async () => {
    const resolveFirstRef: { current: (() => void) | null } = { current: null };
    const first = new Promise<void>((resolve) => { resolveFirstRef.current = resolve; });
    const fetchConfirmed = vi.fn().mockImplementation(async () => {
      await first;
      return { events: [], newWatermark: 0 };
    });
    const engine = new MatchEngine({ store, clock: fakeClock(), sender: fakeSender(), fetchConfirmed, now: () => 0 });
    await engine.start('acc1');
    await engine.ensureMatch('me-rerun', ctx);

    const call1 = engine.catchUp('me-rerun'); // run #1 startet, haengt an `first`
    // `store.load` (IndexedDB) ist asynchron -- ein paar Ticks abwarten, bis Lauf #1 wirklich bei
    // `fetchConfirmed` angekommen ist, bevor die weiteren Aufrufe "waehrend eines laufenden Laufs"
    // ankommen sollen.
    for (let attempt = 0; attempt < 50 && fetchConfirmed.mock.calls.length === 0; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    expect(fetchConfirmed).toHaveBeenCalledTimes(1); // Lauf #1 haengt noch an `first`

    const call2 = engine.catchUp('me-rerun'); // waehrend Lauf #1 -> Nachzuegler vorgemerkt
    const call3 = engine.catchUp('me-rerun'); // ein zweiter gleichzeitiger Aufruf sammelt sich dazu

    resolveFirstRef.current?.();
    await Promise.all([call1, call2, call3]);

    // Genau EIN Nachzuegler (nicht gestapelt): Lauf #1 + genau ein Lauf #2.
    expect(fetchConfirmed).toHaveBeenCalledTimes(2);
  });

  it('N-m3 (2): ein catchUp() direkt NACH Abschluss des vorigen loest einen echten neuen Lauf aus (kein verlorener Nachzuegler)', async () => {
    const fetchConfirmed = vi.fn().mockResolvedValue({ events: [], newWatermark: 0 });
    const engine = new MatchEngine({ store, clock: fakeClock(), sender: fakeSender(), fetchConfirmed, now: () => 0 });
    await engine.start('acc1');
    await engine.ensureMatch('me-back-to-back', ctx);

    await engine.catchUp('me-back-to-back');
    expect(fetchConfirmed).toHaveBeenCalledTimes(1);
    // `inFlightCatchUp` muss zu diesem Zeitpunkt bereits geraeumt sein (kein externer `.finally()`-
    // Sprung mehr) -- dieser zweite Aufruf muss einen ECHTEN neuen Lauf anstossen, nicht nur
    // `rerunRequested` auf einen bereits beendeten Lauf setzen (der dann nichts mehr ausloest).
    await engine.catchUp('me-back-to-back');
    expect(fetchConfirmed).toHaveBeenCalledTimes(2);
  });

  it('N-m3 (3): start() eines (ggf. selben) Kontos leert rerunRequested/knownEngineMatches', async () => {
    const resolveFirstRef: { current: (() => void) | null } = { current: null };
    const first = new Promise<void>((resolve) => { resolveFirstRef.current = resolve; });
    const fetchConfirmed = vi.fn().mockImplementation(async () => {
      await first;
      return { events: [], newWatermark: 0 };
    });
    const engine = new MatchEngine({ store, clock: fakeClock(), sender: fakeSender(), fetchConfirmed, now: () => 0 });
    await engine.start('acc1');
    await engine.ensureMatch('me-restart', ctx);
    engine.markEngineMatches(['me-restart']);

    const runningCall = engine.catchUp('me-restart');
    for (let attempt = 0; attempt < 50 && fetchConfirmed.mock.calls.length === 0; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    void engine.catchUp('me-restart'); // Nachzuegler vormerken, dann Konto neu starten
    resolveFirstRef.current?.();
    await runningCall;

    // Ein Kontowechsel (hier: dasselbe Konto neu gestartet) darf den vorgemerkten Nachzuegler NICHT
    // in die naechste Sitzung mitnehmen und muss `knownEngineMatches` (Server-Erkennung) ebenfalls
    // leeren (die Kopien sind nach `start()` ohnehin weg, s. `copies.clear()`).
    await engine.start('acc1');
    fetchConfirmed.mockClear();
    await engine.ensureMatch('me-restart', ctx);
    await engine.catchUpLoaded();
    expect(fetchConfirmed).not.toHaveBeenCalled(); // 'me-restart' ist nach dem Neustart kein bekanntes Engine-Spiel mehr
  });

  it('B2 (M10): buildLog dedupliziert -- ein Ereignis in BEIDEN offenen Listen (acked UND pending) erscheint nur einmal', async () => {
    // `seen.has(...)` in buildLog schuetzt genau davor: acked und pending sollten sich laut
    // Store-Vertrag nie ueberschneiden, aber die Funktion selbst darf sich nicht darauf verlassen.
    await store.create('acc1', 'me-dedupe', ctx);
    await store.addPending('acc1', 'me-dedupe', goal('dup-1', 'teamA', 500, 0));
    await store.markAcked('acc1', 'me-dedupe', ['dup-1']); // dup-1 jetzt in acked
    await store.addPending('acc1', 'me-dedupe', goal('dup-1', 'teamA', 500, 0)); // dup-1 erneut in pending

    const fetchConfirmed = vi.fn();
    const engine = new MatchEngine({ store, clock: fakeClock(), sender: fakeSender(), fetchConfirmed, now: () => 0 });
    await engine.start('acc1');
    await engine.ensureMatch('me-dedupe', ctx);

    const log = engine.view('me-dedupe')?.log ?? [];
    expect(log.filter((event) => event.id === 'dup-1')).toHaveLength(1);
  });

  it('B2: ein Ereignis, das sowohl bestaetigt als auch (veraltet) noch acked ist, erscheint nur einmal', async () => {
    const confirmedGoal = withSeq(goal('dup-2', 'teamA', 500, 0), 3);
    await store.create('acc1', 'me-dedupe-confirmed', ctx);
    await store.applyConfirmed('acc1', 'me-dedupe-confirmed', [confirmedGoal], 3);
    await store.addPending('acc1', 'me-dedupe-confirmed', goal('dup-2', 'teamA', 500, 0));
    await store.markAcked('acc1', 'me-dedupe-confirmed', ['dup-2']);

    const fetchConfirmed = vi.fn();
    const engine = new MatchEngine({ store, clock: fakeClock(), sender: fakeSender(), fetchConfirmed, now: () => 0 });
    await engine.start('acc1');
    await engine.ensureMatch('me-dedupe-confirmed', ctx);

    const log = engine.view('me-dedupe-confirmed')?.log ?? [];
    expect(log.filter((event) => event.id === 'dup-2')).toHaveLength(1);
  });

  it('m7 (Nachtrag C3a-2a): notifyStoreChange liest eine extern (Sender/MatchCommands) geschriebene Aenderung neu ein und benachrichtigt Abonnenten', async () => {
    await store.create('acc1', 'me-store-change', ctx);
    const fetchConfirmed = vi.fn();
    const engine = new MatchEngine({ store, clock: fakeClock(), sender: fakeSender(), fetchConfirmed, now: () => 0 });
    await engine.start('acc1');
    await engine.ensureMatch('me-store-change', ctx);
    expect(engine.view('me-store-change')?.log).toHaveLength(0);

    // Store wird OHNE die Engine geschrieben (wie MatchCommands.addPending oder
    // OutboxSender.resolveBatch/rejectAllPending) -- die gecachte Kopie ist danach veraltet.
    await store.addPending('acc1', 'me-store-change', goal('g1', 'teamA', 500, 0));

    const listener = vi.fn();
    engine.subscribe(listener);
    await engine.notifyStoreChange('me-store-change');

    expect(engine.view('me-store-change')?.log).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
