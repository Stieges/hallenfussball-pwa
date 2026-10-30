/**
 * Serverzeit am Hallenmonitor (R5 PR 2, @ZM-176, @ME-031, Befund C-MONITOR-UHR-RECHNER): Abstand aus `server_now` jeder
 * Antwort von `display_tournament`, Messung mit der kürzesten Laufzeit unter den letzten acht.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MonitorServerClock, SERVER_CLOCK_SAMPLES } from '../monitorServerClock';
import { createMockTournament } from '../../../test/factories';
import type { PublicReply } from '../../../core/repositories/publicPayload';

const { getForDisplay, localGet } = vi.hoisted(() => ({ getForDisplay: vi.fn(), localGet: vi.fn() }));

vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {} }));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getForDisplay }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: localGet }; }),
}));
vi.mock('../localDisplay', () => ({
  withLocalEngineState: async (t: unknown) => Promise.resolve(t),
  subscribeLocalDisplaySignal: () => () => undefined,
  isKnownToServer: () => false,
}));

import { createMonitorSource } from '../monitorDataSource';

const SERVER = Date.UTC(2026, 10, 28, 14, 0, 0);
const SIEBEN_MIN = 7 * 60_000;

beforeEach(() => { vi.clearAllMocks(); });

describe('MonitorServerClock', () => {
  it('@ME-031 die Uhr des Hallen-Rechners geht 7 Minuten nach: jetzt in Serverzeit stimmt trotzdem', () => {
    let geraet = SERVER - SIEBEN_MIN;
    const uhr = new MonitorServerClock(() => geraet);
    uhr.observe(SERVER + 50, geraet, geraet + 100);
    geraet += 100;
    expect(uhr.nowMs()).toBe(SERVER + 100);
  });

  it('nimmt die Antwort mit der kürzesten Laufzeit (eine lange, ungleich verteilte Laufzeit verfälscht den Abstand)', () => {
    const uhr = new MonitorServerClock(() => 0);
    uhr.observe(1_000_000 + 600, 0, 800); // 800 ms unterwegs, Hinweg lang: Abstand 1 000 200 (300 ms daneben)
    uhr.observe(1_000_000 + 25, 0, 50); // 50 ms unterwegs: Abstand 1 000 000
    uhr.observe(1_000_000 + 450, 0, 500);
    expect(uhr.nowMs()).toBe(1_000_000);
  });

  it(`nur die letzten ${SERVER_CLOCK_SAMPLES} Antworten zählen`, () => {
    const uhr = new MonitorServerClock(() => 0);
    uhr.observe(5_000, 0, 10); // beste, aber alt
    for (let i = 0; i < SERVER_CLOCK_SAMPLES; i += 1) { uhr.observe(9_100, 0, 200); }
    expect(uhr.nowMs()).toBe(9_000);
  });

  it('Serverzeit 0 (keine Angabe) und unmögliche Laufzeiten ändern den Abstand nicht', () => {
    const uhr = new MonitorServerClock(() => 1000);
    uhr.observe(0, 900, 1000);
    uhr.observe(Number.NaN, 900, 1000);
    uhr.observe(5000, 1000, 900);
    expect(uhr.nowMs()).toBe(1000);
  });

  it('Turnier nur auf diesem Gerät: Geräteuhr; eine neue Server-Antwort gilt wieder', () => {
    const uhr = new MonitorServerClock(() => 1000);
    uhr.observe(61_000, 1000, 1000);
    uhr.useDeviceClock();
    expect(uhr.nowMs()).toBe(1000);
    uhr.observe(61_000, 1000, 1000);
    expect(uhr.nowMs()).toBe(61_000);
  });
});

describe('createMonitorSource misst die Serverzeit mit jeder Antwort (@ZM-176)', () => {
  const turnier = createMockTournament({ id: 'tour-1', monitors: [] });

  it('volle Antwort mit server_now: nowMs() ist Serverzeit, nicht die Uhr des Rechners (7 Minuten nach)', async () => {
    let geraet = SERVER - SIEBEN_MIN;
    getForDisplay.mockImplementationOnce(async (): Promise<PublicReply> => {
      geraet += 60;
      return Promise.resolve({ kind: 'full', version: 1, serverNowMs: SERVER + 30, tournament: turnier });
    });
    const source = createMonitorSource('tour-1', 'mon-1', { deviceNow: () => geraet });
    await source.fetch(null);
    expect(source.nowMs?.()).toBe(SERVER + 60);
  });

  it('auch „unverändert“ misst mit (wenige Byte, jede Antwort trägt server_now)', async () => {
    let geraet = SERVER - SIEBEN_MIN;
    getForDisplay
      .mockResolvedValueOnce({ kind: 'full', version: 1, serverNowMs: SERVER, tournament: turnier })
      .mockImplementationOnce(async (): Promise<PublicReply> => {
        geraet += 20;
        return Promise.resolve({ kind: 'unchanged', version: 1, serverNowMs: SERVER + 10_010 });
      });
    const source = createMonitorSource('tour-1', 'mon-1', { deviceNow: () => geraet });
    await source.fetch(null);
    geraet += 10_000;
    await source.fetch('1');
    expect(source.nowMs?.()).toBe(SERVER + 10_020);
  });

  it('Turnier nur auf diesem Gerät (Server kennt es nicht): Geräteuhr', async () => {
    getForDisplay.mockResolvedValueOnce({ kind: 'not-found' });
    localGet.mockResolvedValueOnce(turnier);
    const source = createMonitorSource('tour-1', 'mon-1', { deviceNow: () => 4242 });
    await source.fetch(null);
    expect(source.nowMs?.()).toBe(4242);
  });
});
