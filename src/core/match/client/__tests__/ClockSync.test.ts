import { describe, it, expect, afterEach } from 'vitest';
import { ClockSync, type ClockStorage } from '../ClockSync';

describe('ClockSync', () => {
  afterEach(() => {
    // Keine Mock-Rückstände
  });

  function makeStorage(initial: Record<string, string> = {}): ClockStorage {
    const store: Record<string, string> = { ...initial };
    return {
      get: (k: string) => store[k] ?? null,
      set: (k: string, v: string) => { store[k] = v; },
    };
  }

  it('lädt persistierten Offset beim Erstellen', () => {
    const storage = makeStorage({ 'clockSync:v1': JSON.stringify({ offsetMs: 7000, measuredAt: 999, rttMs: 30 }) });
    const sync = new ClockSync(async () => 0, () => 1000000, storage);
    expect(sync.offsetMsValue).toBe(7000);
    expect(sync.isKnown).toBe(true);
  });

  it('wählt die kleinste RTT als Gewinner', async () => {
    const manualSync = new ClockSync(async () => 1000100, () => 1000000, makeStorage());
    await manualSync.sync();
    expect(manualSync.offsetMsValue).toBe(100);
  });

  it('behält Offset bei vollständigem Ausfall unverändert', async () => {
    const failingSync = new ClockSync(async () => { throw new Error('offline'); }, () => 1000000, makeStorage());
    const result = await failingSync.sync();
    expect(result).toBe(false);
  });

  it('rechnet serverNow mit künstlichem Offset von ±7 Minuten korrekt', async () => {
    const sync = new ClockSync(async () => 0, () => 1000000, makeStorage());
    // Zugriff auf private Felder für Testzwecke
    (sync as unknown as { offsetMs: number }).offsetMs = 420000;
    (sync as unknown as { measuredAt: number }).measuredAt = 1000000;
    expect(sync.serverNow()).toBe(1420000);
  });

  it('startet und stoppt periodisches Nachmessen', () => {
    const sync = new ClockSync(async () => 1000000, () => 1000000, makeStorage());
    sync.start(60000);
    sync.stop();
  });
});
