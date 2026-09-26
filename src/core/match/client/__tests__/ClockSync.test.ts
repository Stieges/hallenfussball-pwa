import { describe, it, expect, vi, afterEach } from 'vitest';
import { ClockSync, type ClockStorage } from '../ClockSync';

function makeStorage(initial: Record<string, string> = {}): ClockStorage & { dump: () => Record<string, string> } {
  const store: Record<string, string> = { ...initial };
  return {
    get: (k: string) => store[k] ?? null,
    set: (k: string, v: string) => {
      store[k] = v;
    },
    dump: () => ({ ...store }),
  };
}

/** Liefert `now`-Werte nacheinander aus einer Warteschlange (letzter Wert wiederholt sich). */
function scriptedNow(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return value;
  };
}

describe('ClockSync', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('laedt persistierten Offset beim Erstellen', () => {
    const storage = makeStorage({ 'clockSync:v1': JSON.stringify({ offsetMs: 7000, measuredAt: 999, rttMs: 30 }) });
    const sync = new ClockSync(async () => 0, () => 1000000, storage);
    expect(sync.offsetMs).toBe(7000);
    expect(sync.measuredAt).toBe(999);
    expect(sync.isKnown).toBe(true);
  });

  it('ignoriert defekten Speicherinhalt', () => {
    const storage = makeStorage({ 'clockSync:v1': '{ kaputt' });
    const sync = new ClockSync(async () => 0, () => 1000000, storage);
    expect(sync.offsetMs).toBe(0);
    expect(sync.isKnown).toBe(false);
  });

  it('waehlt die Messung mit der kleinsten RTT (nicht die letzte)', async () => {
    // Messung 1: RTT 100 (t0=0, t1=100), Messung 2: RTT 10 (t0=200, t1=210), Messung 3: RTT 100 (t0=300, t1=400).
    // Serverzeit je Messung konstant 10000: Offset1 = 9950, Offset2 = 9795, Offset3 = 9650.
    // Gewinner ist Messung 2 (kleinste RTT) -> offset 9795, nicht 9650 (letzte Messung).
    const sync = new ClockSync(async () => 10000, scriptedNow([0, 100, 200, 210, 300, 400, 410]), makeStorage());
    const ok = await sync.sync();
    expect(ok).toBe(true);
    expect(sync.offsetMs).toBe(9795);
  });

  it('verwendet die uebrigen Messungen bei Teilausfall', async () => {
    let call = 0;
    const fetchServerTime = vi.fn(async () => {
      call += 1;
      if (call === 2) {
        throw new Error('einzelner Timeout');
      }
      return 10000;
    });
    // Messung 1: RTT 20 -> Offset 9990; Messung 2 faellt aus; Messung 3: RTT 200 -> Offset 9900.
    const sync = new ClockSync(fetchServerTime, scriptedNow([0, 20, 100, 100, 200, 400, 410]), makeStorage());
    const ok = await sync.sync();
    expect(ok).toBe(true);
    expect(fetchServerTime).toHaveBeenCalledTimes(3);
    expect(sync.offsetMs).toBe(9990);
    expect(sync.isKnown).toBe(true);
  });

  it('behält Offset und Speicher bei vollstaendigem Ausfall unveraendert', async () => {
    const storage = makeStorage({ 'clockSync:v1': JSON.stringify({ offsetMs: 555, measuredAt: 7, rttMs: 3 }) });
    const sync = new ClockSync(
      async () => {
        throw new Error('offline');
      },
      () => 1000000,
      storage,
    );
    const ok = await sync.sync();
    expect(ok).toBe(false);
    expect(sync.offsetMs).toBe(555);
    expect(storage.dump()['clockSync:v1']).toBe(JSON.stringify({ offsetMs: 555, measuredAt: 7, rttMs: 3 }));
  });

  it('speichert Offset, Messzeit und RTT nach sync() unter clockSync:v1', async () => {
    // Messung 1: RTT 20 (0->20), Messung 2: RTT 10 (50->60), Messung 3: RTT 30 (100->130);
    // kleinste RTT = 10 -> offset 10000 - (50 + 5) = 9945, gemessen bei now() = 1000.
    const storage = makeStorage();
    const sync = new ClockSync(async () => 10000, scriptedNow([0, 20, 50, 60, 100, 130, 1000]), storage);
    await sync.sync();
    const raw = storage.dump()['clockSync:v1'];
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw) as { offsetMs: number; measuredAt: number; rttMs: number };
    expect(parsed.offsetMs).toBe(9945);
    expect(parsed.measuredAt).toBe(1000);
    expect(parsed.rttMs).toBe(10);
  });

  it('rechnet serverNow mit kuenstlichem Offset von +7 Minuten', async () => {
    // Geraet 7 min zurueck: now=1000000, Server=1420000 -> offset 420000, serverNow = now + offset.
    const sync = new ClockSync(async () => 1420000, () => 1000000, makeStorage());
    await sync.sync();
    expect(sync.offsetMs).toBe(420000);
    expect(sync.serverNow()).toBe(1420000);
  });

  it('rechnet serverNow mit kuenstlichem Offset von -7 Minuten', async () => {
    // Geraet 7 min voraus: now=1420000, Server=1000000 -> offset -420000.
    const sync = new ClockSync(async () => 1000000, () => 1420000, makeStorage());
    await sync.sync();
    expect(sync.offsetMs).toBe(-420000);
    expect(sync.serverNow()).toBe(1000000);
  });

  it('startet und stoppt periodisches Nachmessen ueber den Intervall-Timer', async () => {
    vi.useFakeTimers();
    const fetchServerTime = vi.fn(async () => 5000);
    const sync = new ClockSync(fetchServerTime, () => 1000, makeStorage());
    sync.start(60000);
    await vi.advanceTimersByTimeAsync(59999);
    expect(fetchServerTime).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchServerTime).toHaveBeenCalledTimes(3);
    sync.stop();
    await vi.advanceTimersByTimeAsync(120000);
    expect(fetchServerTime).toHaveBeenCalledTimes(3);
  });

  it('verhindert parallele sync()-Messungen (eine Messreihe fuer beide Aufrufer)', async () => {
    let call = 0;
    const fetchServerTime = vi.fn(async () => {
      call += 1;
      return 1000 + call;
    });
    const sync = new ClockSync(fetchServerTime, () => 1000, makeStorage());
    const [first, second] = await Promise.all([sync.sync(), sync.sync()]);
    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(fetchServerTime).toHaveBeenCalledTimes(3);
  });
});
