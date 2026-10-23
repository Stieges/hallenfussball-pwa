/**
 * usePublicTournament im Takt (B-15): Tor → Zuschauer ≤ 10 s, nur bei echter Änderung neu rechnen, ohne Netz bleibt der Stand
 * mit Hinweis, Stand vom selben Tag überlebt das Neuladen (@ZM-021, @ZM-024, @ZM-030, @ZM-032, @ZM-033, @ZM-035, @ZM-036,
 * @ZM-037, @ZM-109, @ZM-110, @ZM-111). Fake-Timer; die Quelle ist ein Stub der Schnittstelle `PublicTournamentSource`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { buildLiveViewTournament, SHARE_CODE } from '../../../screens/__tests__/liveViewFixture';
import { usePublicTournament } from '../usePublicTournament';
import type { PublicFetchResult, PublicTournamentSource } from '../publicSource';
import { contentVersionOf } from '../publicVersion';
import type { StandStorage } from '../publicStandStore';
import { createLegacyPublicSource } from '../legacyPublicSource';

const TAKT = 10_000;
/** 10.10.2026 14:32 Ortszeit des Turniers (Europe/Berlin, Sommerzeit) */
const AT_1432 = new Date('2026-10-10T12:32:00Z');

function memoryStorage(initial: Record<string, string> = {}): StandStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

/** Quelle mit skriptgesteuerten Antworten: `reply` ist die nächste Antwort; ein Eintrag in `replies` geht davor. */
function scripted(start: PublicFetchResult | (() => Promise<PublicFetchResult>)) {
  const state: { reply: PublicFetchResult | (() => Promise<PublicFetchResult>); queue: PublicFetchResult[] } = { reply: start, queue: [] };
  const calls: Array<string | null> = [];
  const source: PublicTournamentSource = {
    kind: 'legacy',
    pollIntervalMs: TAKT,
    nowMs: () => Date.now(),
    fetch: vi.fn((_code: string, since: string | null) => {
      calls.push(since);
      const next = state.queue.shift() ?? state.reply;
      return typeof next === 'function' ? next() : Promise.resolve(next);
    }),
  };
  return { source, state, calls };
}

const fullOf = (tournament: Tournament): PublicFetchResult => ({ kind: 'full', version: contentVersionOf(tournament), tournament });
const withScore = (tournament: Tournament, scoreA: number): Tournament => ({
  ...tournament,
  matches: tournament.matches.map((m) => (m.matchNumber === 7 ? { ...m, scoreA } : m)),
});
const scoreOf = (tournament: Tournament | null, matchNumber: number): number | undefined => tournament?.matches.find((m) => m.matchNumber === matchNumber)?.scoreA;

async function advance(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AT_1432);
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Tor → Zuschauer ohne Neuladen', () => {
  it('@ZM-021 Tom trägt in Spiel 7 ein Tor ein: nach höchstens 10 Sekunden steht der neue Stand da, vorher der alte', async () => {
    const vorher = buildLiveViewTournament();
    const nachher = withScore(vorher, 2);
    const { source, state } = scripted(fullOf(vorher));
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, source, { storage: null }));
    await advance(0);
    expect(result.current.loadingState).toBe('success');
    expect(scoreOf(result.current.tournament, 7)).toBe(1);

    state.reply = fullOf(nachher); // das Tor fällt auf dem Server
    await advance(TAKT - 1);
    expect(scoreOf(result.current.tournament, 7)).toBe(1);
    await advance(1);
    expect(scoreOf(result.current.tournament, 7)).toBe(2);
  });

  it('@ZM-024 ein zurückgenommenes Tor verschwindet bei den Zuschauern nach höchstens 10 Sekunden', async () => {
    const mitTor = withScore(buildLiveViewTournament(), 2);
    const ohneTor = withScore(mitTor, 1);
    const { source, state } = scripted(fullOf(mitTor));
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, source, { storage: null }));
    await advance(0);
    expect(scoreOf(result.current.tournament, 7)).toBe(2);
    state.reply = fullOf(ohneTor);
    await advance(TAKT);
    expect(scoreOf(result.current.tournament, 7)).toBe(1);
  });

  it('@ZM-021 Clara trägt in Spiel 8 ein Tor ein: Spiel 7 bleibt unverändert', async () => {
    const vorher = buildLiveViewTournament();
    const nachher = { ...vorher, matches: vorher.matches.map((m) => (m.matchNumber === 8 ? { ...m, scoreB: 1, matchStatus: 'running' as const } : m)) };
    const { source, state } = scripted(fullOf(vorher));
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, source, { storage: null }));
    await advance(0);
    state.reply = fullOf(nachher);
    await advance(TAKT);
    expect(result.current.tournament?.matches.find((m) => m.matchNumber === 8)?.scoreB).toBe(1);
    expect(scoreOf(result.current.tournament, 7)).toBe(1);
  });

  it('@ZM-021 Delta: eine Änderung auf den gehaltenen Stand, ohne das Turnier neu zu laden', async () => {
    const vorher = buildLiveViewTournament();
    const changed = { ...vorher.matches.find((m) => m.matchNumber === 7)!, scoreA: 2 };
    const { source, state, calls } = scripted({ kind: 'full', version: '10', tournament: vorher });
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, source, { storage: null }));
    await advance(0);
    state.reply = { kind: 'delta', version: '11', baseVersion: '10', delta: { matches: [changed], removedMatchIds: [] } };
    await advance(TAKT);
    expect(scoreOf(result.current.tournament, 7)).toBe(2);
    expect(result.current.tournament?.matches).toHaveLength(vorher.matches.length);
    expect(calls).toEqual([null, '10']);
  });

  it('@ZM-021 Gegenbeispiel: eine Änderung, die nicht auf den Stand passt (falsche Basis), lädt einmal ganz', async () => {
    const vorher = buildLiveViewTournament();
    const nachher = withScore(vorher, 2);
    const { source, state, calls } = scripted({ kind: 'full', version: '10', tournament: vorher });
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, source, { storage: null }));
    await advance(0);
    state.queue.push({ kind: 'delta', version: '15', baseVersion: '14', delta: { matches: [], removedMatchIds: [] } });
    state.reply = { kind: 'full', version: '15', tournament: nachher };
    await advance(TAKT);
    expect(calls).toEqual([null, '10', null]);
    expect(scoreOf(result.current.tournament, 7)).toBe(2);
  });
});

describe('nur bei echter Änderung neu rechnen', () => {
  it('@ZM-021 gleiche Version: Spielplan, Tabellen und Turnier bleiben dieselben Objekte, die Quelle bekommt die Version', async () => {
    const t = buildLiveViewTournament();
    const first = scripted({ kind: 'full', version: '10', tournament: t });
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, first.source, { storage: null }));
    await advance(0);
    const { schedule, standings, tournament } = result.current;
    first.state.reply = { kind: 'unchanged', version: '10' };
    await advance(3 * TAKT);
    expect(result.current.schedule).toBe(schedule);
    expect(result.current.standings).toBe(standings);
    expect(result.current.tournament).toBe(tournament);
    expect(first.calls).toEqual([null, '10', '10', '10']);
  });

  it('@ZM-021 Adapter (a): jeder Abruf liefert den ganzen Inhalt, gerechnet wird nur bei geändertem Inhalt', async () => {
    const t = buildLiveViewTournament();
    const lookup = { getByShareCode: vi.fn().mockImplementation(() => Promise.resolve(structuredClone(t))) };
    const source = createLegacyPublicSource(lookup, { clock: { nowMs: () => Date.now() }, pollIntervalMs: TAKT });
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, source, { storage: null }));
    await advance(0);
    const schedule = result.current.schedule;
    await advance(3 * TAKT);
    expect(lookup.getByShareCode).toHaveBeenCalledTimes(4);
    expect(result.current.schedule).toBe(schedule);

    lookup.getByShareCode.mockImplementation(() => Promise.resolve(withScore(structuredClone(t), 2)));
    await advance(TAKT);
    expect(result.current.schedule).not.toBe(schedule);
    expect(scoreOf(result.current.tournament, 7)).toBe(2);
  });
});

describe('langsames Netz', () => {
  it('@ZM-022:teil Hallen-WLAN mit 300 ms Verzögerung und Mobilfunk mit 3 Sekunden Antwortzeit: kein Hinweis „keine Verbindung“, das Tor steht nach Takt plus Antwortzeit da', async () => {
    const vorher = buildLiveViewTournament();
    const nachher = withScore(vorher, 2);
    const { source, state } = scripted(fullOf(vorher));
    const langsam = (reply: PublicFetchResult): (() => Promise<PublicFetchResult>) => () => new Promise((resolve) => { setTimeout(() => { resolve(reply); }, 3000); });
    state.reply = langsam(fullOf(vorher));
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, source, { storage: null }));
    await advance(3000);
    expect(scoreOf(result.current.tournament, 7)).toBe(1);

    state.reply = langsam(fullOf(nachher));
    await advance(TAKT + 3000);
    expect(scoreOf(result.current.tournament, 7)).toBe(2);
    expect(result.current.connectionHint).toBeNull();
    // 20 Sekunden und länger zwischen zwei Erfolgen gibt es hier nie: die Abstände sind Takt plus Antwortzeit
    await advance(5 * TAKT);
    expect(result.current.connectionHint).toBeNull();
  });
});

describe('Hintergrund und Rückkehr', () => {
  function setVisibility(state: 'visible' | 'hidden'): void {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  it('@ZM-029 @ZM-030 gesperrt von 14:20 bis 14:41: kein Abruf; nach dem Entsperren steht der aktuelle Stand nach höchstens 10 Sekunden da', async () => {
    const vorher = buildLiveViewTournament();
    const nachher = withScore(vorher, 3);
    const { source, state } = scripted(fullOf(vorher));
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, source, { storage: null }));
    await advance(0);
    expect(source.fetch).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    state.reply = fullOf(nachher);
    await advance(21 * 60 * 1000);
    expect(source.fetch).toHaveBeenCalledTimes(1);
    expect(scoreOf(result.current.tournament, 7)).toBe(1);

    setVisibility('visible');
    await advance(TAKT);
    expect(scoreOf(result.current.tournament, 7)).toBe(3);
  });
});

describe('ohne Netz bleibt der letzte Stand', () => {
  async function mitStandUmGeradeNochErreichbar() {
    const t = buildLiveViewTournament();
    const scriptedSource = scripted(fullOf(t));
    const hook = renderHook(() => usePublicTournament(SHARE_CODE, scriptedSource.source, { storage: null }));
    await advance(0);
    return { ...scriptedSource, ...hook, t };
  }

  it('@ZM-032 @ZM-109 nach dem Ausfall steht Spiel 7 weiter mit 1:0 da, nie „nicht gefunden“, der Zustand bleibt „success“', async () => {
    const { result, state } = await mitStandUmGeradeNochErreichbar();
    state.reply = { kind: 'unreachable' };
    await advance(5 * TAKT);
    expect(result.current.loadingState).toBe('success');
    expect(scoreOf(result.current.tournament, 7)).toBe(1);
  });

  it.each([
    ['14:32:10', 10, false],
    ['14:32:19', 19, false],
    ['14:32:20', 20, true],
  ] as const)('@ZM-033 um %s: Hinweis „keine Verbindung“ sichtbar = %s', async (_uhrzeit, sekunden, sichtbar) => {
    const { result, state } = await mitStandUmGeradeNochErreichbar();
    state.reply = { kind: 'unreachable' };
    await advance(sekunden * 1000);
    expect(result.current.connectionHint !== null).toBe(sichtbar);
  });

  it('@ZM-032 @ZM-111 der Hinweis nennt die Ortszeit des letzten Abrufs „14:32“, auch wenn das Gerät in einer anderen Zeitzone steht', async () => {
    const previous = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      const { result, state } = await mitStandUmGeradeNochErreichbar();
      state.reply = { kind: 'unreachable' };
      await advance(30_000);
      expect(result.current.connectionHint).toEqual({ time: '14:32' });
    } finally {
      process.env.TZ = previous;
    }
  });

  it('@ZM-037 kommt das Netz zurück, steht nach höchstens 10 Sekunden Spiel 7 als beendet da und der Hinweis ist weg', async () => {
    const { result, state, t } = await mitStandUmGeradeNochErreichbar();
    state.reply = { kind: 'unreachable' };
    await advance(30_000);
    expect(result.current.connectionHint).not.toBeNull();

    const beendet = { ...t, matches: t.matches.map((m) => (m.matchNumber === 7 ? { ...m, scoreA: 3, scoreB: 1, matchStatus: 'finished' as const } : m)) };
    state.reply = fullOf(beendet);
    await advance(TAKT);
    expect(result.current.connectionHint).toBeNull();
    expect(result.current.tournament?.matches.find((m) => m.matchNumber === 7)?.matchStatus).toBe('finished');
  });

  it('@ZM-109 Gegenbeispiel: nur eine sichere Antwort „nicht gefunden“ zeigt „nicht gefunden“', async () => {
    const { result, state } = await mitStandUmGeradeNochErreichbar();
    state.reply = { kind: 'not-found' };
    await advance(TAKT);
    expect(result.current.loadingState).toBe('not-found');
    expect(result.current.tournament).toBeNull();
  });

  it('@ZM-109 eine hängende Anfrage gilt nach 8 Sekunden als nicht erreichbar und hält den Takt nicht an', async () => {
    const { result, state } = await mitStandUmGeradeNochErreichbar();
    state.reply = () => new Promise<PublicFetchResult>(() => undefined);
    await advance(TAKT + 9000);
    expect(result.current.loadingState).toBe('success');
    state.reply = fullOf(withScore(buildLiveViewTournament(), 2));
    await advance(TAKT);
    expect(scoreOf(result.current.tournament, 7)).toBe(2);
  });

  it('@ZM-109 ohne Stand und ohne Antwort: „Fehler beim Laden“ (nicht „nicht gefunden“); danach holt sich die Seite den Stand von selbst', async () => {
    const t = buildLiveViewTournament();
    const { source, state } = scripted({ kind: 'unreachable' });
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, source, { storage: null }));
    await advance(0);
    expect(result.current.loadingState).toBe('error');
    state.reply = fullOf(t);
    await advance(TAKT);
    expect(result.current.loadingState).toBe('success');
    expect(result.current.errorMessage).toBeNull();
  });
});

describe('Stand für das Neuladen ohne Netz', () => {
  const KEY = `publicStand:v1:${SHARE_CODE}`;

  async function ladeNeu(storage: StandStorage, reply: PublicFetchResult) {
    const { source, state } = scripted(reply);
    const hook = renderHook(() => usePublicTournament(SHARE_CODE, source, { storage }));
    await advance(0);
    return { ...hook, source, state };
  }

  it('@ZM-035 am selben Tag: ohne Netz neu geladen zeigt die Seite Spiel 7 mit 2:1 und „Stand von 14:32 – keine Verbindung“', async () => {
    const storage = memoryStorage();
    const t = withScore(buildLiveViewTournament(), 2);
    const online = await ladeNeu(storage, fullOf(t));
    expect(scoreOf(online.result.current.tournament, 7)).toBe(2);
    online.unmount();

    vi.setSystemTime(new Date(AT_1432.getTime() + 8 * 60 * 1000)); // 14:40, neu geladen
    const offline = await ladeNeu(storage, { kind: 'unreachable' });
    expect(offline.result.current.loadingState).toBe('success');
    expect(scoreOf(offline.result.current.tournament, 7)).toBe(2);
    expect(offline.result.current.connectionHint).toEqual({ time: '14:32' });
  });

  it('@ZM-035 Gegenbeispiel: am nächsten Tag zeigt die Seite keinen Stand vom Vortag', async () => {
    const storage = memoryStorage();
    const online = await ladeNeu(storage, fullOf(withScore(buildLiveViewTournament(), 2)));
    online.unmount();

    vi.setSystemTime(new Date('2026-10-11T12:30:00Z'));
    const offline = await ladeNeu(storage, { kind: 'unreachable' });
    expect(offline.result.current.tournament).toBeNull();
    expect(offline.result.current.loadingState).toBe('error');
  });

  it('@ZM-110 am nächsten Tag mit Netz ist der Stand vom Vortag nicht mehr gespeichert, und er enthielt keine Kennung', async () => {
    const storage = memoryStorage();
    const online = await ladeNeu(storage, fullOf(withScore(buildLiveViewTournament(), 2)));
    const stored = storage.getItem(KEY) ?? '';
    expect(stored).not.toBe('');
    expect(stored).not.toMatch(/userId|ownerId|owner_id|deviceId|email/i);
    online.unmount();

    vi.setSystemTime(new Date('2026-10-11T12:30:00Z'));
    const next = await ladeNeu(storage, fullOf(buildLiveViewTournament()));
    // der alte Stand wurde beim Öffnen verworfen, der neue gehört zum neuen Tag
    expect(JSON.parse(storage.getItem(KEY) ?? '{}')).toMatchObject({ day: '2026-10-11' });
    expect(next.result.current.loadingState).toBe('success');
  });

  it('@ZM-110 Stände anderer Turniere vom Vortag werden beim Öffnen aufgeräumt', async () => {
    const storage = memoryStorage({ 'publicStand:v1:OTHER1': JSON.stringify({ source: 'legacy', version: '1', day: '2026-10-09', tournament: { matches: [] } }) });
    await ladeNeu(storage, fullOf(buildLiveViewTournament()));
    expect(storage.getItem('publicStand:v1:OTHER1')).toBeNull();
  });

  it('@ZM-036 wird das Online-Teilen zurückgenommen, verwirft das Handy beim nächsten Kontakt den gespeicherten Stand', async () => {
    const storage = memoryStorage();
    const online = await ladeNeu(storage, fullOf(withScore(buildLiveViewTournament(), 2)));
    expect(storage.getItem(KEY)).not.toBeNull();
    online.state.reply = { kind: 'not-found' };
    await advance(TAKT);
    expect(storage.getItem(KEY)).toBeNull();
    online.unmount();

    const offline = await ladeNeu(storage, { kind: 'unreachable' });
    expect(offline.result.current.tournament).toBeNull();
  });

  it('@ZM-036 Gegenbeispiel: eine Störung verwirft den Stand nicht', async () => {
    const storage = memoryStorage();
    const online = await ladeNeu(storage, fullOf(withScore(buildLiveViewTournament(), 2)));
    online.state.reply = { kind: 'unreachable' };
    await advance(3 * TAKT);
    expect(storage.getItem(KEY)).not.toBeNull();
  });

  it('@ZM-110 der gespeicherte Stand enthält weder Notizen noch Monitor-Zugänge', async () => {
    const storage = memoryStorage();
    const t = { ...withScore(buildLiveViewTournament(), 2), adminNotes: 'Schlüssel unter der Matte', monitors: [{ id: 'm1', accessCode: 'GEHEIM' }] } as unknown as Tournament;
    await ladeNeu(storage, fullOf(t));
    const stored = storage.getItem(KEY) ?? '';
    expect(stored).not.toContain('Schlüssel unter der Matte');
    expect(stored).not.toContain('GEHEIM');
  });

  it('ein Stand eines anderen Adapters wird nicht verwendet (Versionen sind nicht vergleichbar)', async () => {
    const storage = memoryStorage();
    const online = await ladeNeu(storage, fullOf(withScore(buildLiveViewTournament(), 2)));
    online.unmount();
    const { source } = scripted({ kind: 'unreachable' });
    const rpcSource: PublicTournamentSource = { ...source, kind: 'rpc' };
    const hook = renderHook(() => usePublicTournament(SHARE_CODE, rpcSource, { storage }));
    await advance(0);
    expect(hook.result.current.tournament).toBeNull();
  });

  it('ohne Speicher (gesperrt) arbeitet die Seite weiter', async () => {
    const t = buildLiveViewTournament();
    const { source } = scripted(fullOf(t));
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, source, { storage: null }));
    await advance(0);
    expect(result.current.loadingState).toBe('success');
  });
});
