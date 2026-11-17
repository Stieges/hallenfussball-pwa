/**
 * @RZ-033 @RZ-034 @RZ-035 Die Zuschauer-Seite merkt sich überstandene Netzstörungen (nur im Arbeitsspeicher) und meldet jede genau einmal:
 * kurz (unter 20 s ohne gelungenen Abruf), lang (ab 20 s). Szenarien aus docs/anforderungen/2026-09-26_reichweite-zuschauersicht.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { buildLiveViewTournament, SHARE_CODE } from '../../../screens/__tests__/liveViewFixture';
import { usePublicTournament } from '../usePublicTournament';
import { CONNECTION_HINT_AFTER_MS } from '../useConnectionHint';
import type { PublicFetchResult, PublicTournamentSource } from '../publicSource';
import type { StandStorage } from '../publicStandStore';

const TOURNAMENT = buildLiveViewTournament();

function memoryStorage(): StandStorage & { schreibzugriffe: string[] } {
  const data = new Map<string, string>();
  const schreibzugriffe: string[] = [];
  return {
    schreibzugriffe,
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { schreibzugriffe.push(`${key}=${value}`); data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

/** Quelle, deren nächste Antwort der Test vorgibt; `null` = der Abruf scheitert mit einer Ausnahme. */
function scriptedSource(pollIntervalMs: number | null = null) {
  const state: { next: PublicFetchResult | null; version: string } = { next: { kind: 'unreachable' }, version: 'v1' };
  const fetch = vi.fn((_code: string, _since: string | null): Promise<PublicFetchResult> =>
    state.next === null ? Promise.reject(new Error('Netz weg')) : Promise.resolve(state.next));
  const source: PublicTournamentSource = { kind: 'rpc', pollIntervalMs, nowMs: () => Date.now(), fetch };
  return {
    source, fetch,
    fehlschlag: () => { state.next = { kind: 'unreachable' }; },
    erfolg: () => { state.version = `v${state.version.slice(1) === '1' ? 2 : 1}`; state.next = { kind: 'full', version: state.version, tournament: TOURNAMENT }; },
    unveraendert: () => { state.next = { kind: 'unchanged', version: state.version }; },
    nichtGefunden: () => { state.next = { kind: 'not-found' }; },
    wirft: () => { state.next = null; },
  };
}

const vergehen = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T12:32:00Z'));
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

/** Seite öffnen (Erfolg), dann `ausfall` ms lang scheitern, dann gelingt der nächste Abruf. */
async function stoerung(ausfall: number, quelle = scriptedSource(), code = SHARE_CODE) {
  const storage = memoryStorage();
  quelle.erfolg();
  const hook = renderHook((p: { code: string }) => usePublicTournament(p.code, quelle.source, { storage }), { initialProps: { code } });
  await vergehen(0);
  quelle.fehlschlag();
  await act(async () => { await hook.result.current.refresh(); });
  await vergehen(ausfall);
  quelle.erfolg();
  await act(async () => { await hook.result.current.refresh(); });
  return { hook, quelle, storage };
}

describe('@RZ-033 Eine überstandene Netzstörung wird gemeldet', () => {
  it.each([
    ['10 Sekunden', 10_000, 'stoerung_kurz'],
    ['45 Sekunden', 45_000, 'stoerung_lang'],
  ] as const)('Abrufe scheitern %s lang, der nächste gelingt → genau eine Meldung „%s“ für dieses Turnier', async (_dauer, ms, art) => {
    const { hook } = await stoerung(ms);
    expect(hook.result.current.loadingState).toBe('success');
    expect(hook.result.current.recoveredOutages).toEqual([{ id: 1, shareCode: SHARE_CODE, kind: art }]);
  });

  it('Grenze 20 Sekunden = Frist des Hinweises „keine Verbindung“: 19,999 s kurz, 20 s lang (Gegenbeispiel auf beiden Seiten)', async () => {
    expect(CONNECTION_HINT_AFTER_MS).toBe(20_000);
    expect((await stoerung(CONNECTION_HINT_AFTER_MS - 1)).hook.result.current.recoveredOutages.map((o) => o.kind)).toEqual(['stoerung_kurz']);
    expect((await stoerung(CONNECTION_HINT_AFTER_MS)).hook.result.current.recoveredOutages.map((o) => o.kind)).toEqual(['stoerung_lang']);
  });

  it('mehrere Fehlschläge in Folge (Ausnahme, „nicht erreichbar“) sind EINE Störung, gemessen ab dem ersten', async () => {
    const quelle = scriptedSource();
    quelle.erfolg();
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage: memoryStorage() }));
    await vergehen(0);
    quelle.wirft();
    await act(async () => { await result.current.refresh(); });
    await vergehen(8_000);
    quelle.fehlschlag();
    await act(async () => { await result.current.refresh(); });
    await vergehen(8_000);
    await act(async () => { await result.current.refresh(); });
    expect(result.current.recoveredOutages).toEqual([]);
    await vergehen(8_000);
    quelle.erfolg();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.recoveredOutages).toEqual([{ id: 1, shareCode: SHARE_CODE, kind: 'stoerung_lang' }]);
  });

  it('genau einmal: weitere gelungene Abrufe nach der Störung melden nichts mehr', async () => {
    const { hook, quelle } = await stoerung(10_000);
    for (let i = 0; i < 3; i += 1) {
      await vergehen(10_000);
      await act(async () => { await hook.result.current.refresh(); });
    }
    quelle.unveraendert();
    await act(async () => { await hook.result.current.refresh(); });
    expect(hook.result.current.recoveredOutages).toHaveLength(1);
  });

  it('zwei getrennte Störungen sind zwei Meldungen mit fortlaufender Kennung', async () => {
    const { hook, quelle } = await stoerung(5_000);
    await vergehen(30_000);
    quelle.fehlschlag();
    await act(async () => { await hook.result.current.refresh(); });
    await vergehen(60_000);
    quelle.erfolg();
    await act(async () => { await hook.result.current.refresh(); });
    expect(hook.result.current.recoveredOutages).toEqual([
      { id: 1, shareCode: SHARE_CODE, kind: 'stoerung_kurz' },
      { id: 2, shareCode: SHARE_CODE, kind: 'stoerung_lang' },
    ]);
  });

  it('auch „nichts Neues“ beendet die Störung (der Abruf ist gelungen)', async () => {
    const quelle = scriptedSource();
    quelle.erfolg();
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage: memoryStorage() }));
    await vergehen(0);
    quelle.fehlschlag();
    await act(async () => { await result.current.refresh(); });
    await vergehen(3_000);
    quelle.unveraendert();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.recoveredOutages.map((o) => o.kind)).toEqual(['stoerung_kurz']);
  });

  it('Störung schon beim ersten Laden: scheitert das erste Laden und gelingt es später in derselben Sitzung, zählt sie', async () => {
    const quelle = scriptedSource();
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage: memoryStorage() }));
    await vergehen(0);
    expect(result.current.loadingState).toBe('error');
    await vergehen(30_000);
    quelle.erfolg();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.loadingState).toBe('success');
    expect(result.current.recoveredOutages).toEqual([{ id: 1, shareCode: SHARE_CODE, kind: 'stoerung_lang' }]);
  });

  it('Seite im Hintergrund: der Takt ruht, die Störung bleibt offen und zählt nach der Rückkehr mit der verstrichenen Zeit', async () => {
    let sichtbar = true;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (sichtbar ? 'visible' : 'hidden') });
    const quelle = scriptedSource(10_000);
    quelle.erfolg();
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage: memoryStorage() }));
    await vergehen(0);
    quelle.fehlschlag();
    await vergehen(10_000);
    sichtbar = false;
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    const abrufe = quelle.fetch.mock.calls.length;
    await vergehen(120_000);
    expect(quelle.fetch.mock.calls.length).toBe(abrufe);
    expect(result.current.recoveredOutages).toEqual([]);
    quelle.erfolg();
    sichtbar = true;
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.recoveredOutages.map((o) => o.kind)).toEqual(['stoerung_lang']);
  });
});

describe('@RZ-033 Zeitmessung: ein Sprung der Geräteuhr verfälscht die Dauer nicht', () => {
  it('Uhr springt mitten in der Störung um 1 Stunde vor: 5 Sekunden bleiben kurz', async () => {
    const quelle = scriptedSource();
    quelle.erfolg();
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage: memoryStorage() }));
    await vergehen(0);
    quelle.fehlschlag();
    await act(async () => { await result.current.refresh(); });
    vi.setSystemTime(new Date(Date.now() + 3_600_000));
    await vergehen(5_000);
    quelle.erfolg();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.recoveredOutages.map((o) => o.kind)).toEqual(['stoerung_kurz']);
  });

  it('Uhr springt zurück: 30 Sekunden bleiben lang (Gegenbeispiel zum Sprung nach vorn)', async () => {
    const quelle = scriptedSource();
    quelle.erfolg();
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage: memoryStorage() }));
    await vergehen(0);
    quelle.fehlschlag();
    await act(async () => { await result.current.refresh(); });
    vi.setSystemTime(new Date(Date.now() - 3_600_000));
    await vergehen(30_000);
    quelle.erfolg();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.recoveredOutages.map((o) => o.kind)).toEqual(['stoerung_lang']);
  });
});

describe('@RZ-034 Ohne gescheiterten Abruf wird keine Störung gemeldet', () => {
  it('alle Abrufe gelingen (ganz, „nichts Neues“, wieder ganz): keine Meldung', async () => {
    const quelle = scriptedSource();
    quelle.erfolg();
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage: memoryStorage() }));
    await vergehen(0);
    for (const antwort of [quelle.unveraendert, quelle.erfolg, quelle.unveraendert, quelle.unveraendert]) {
      antwort();
      await vergehen(30_000);
      await act(async () => { await result.current.refresh(); });
    }
    expect(result.current.loadingState).toBe('success');
    expect(result.current.recoveredOutages).toEqual([]);
  });

  it('„Turnier nicht gefunden“ ist keine Störung: weder als Antwort allein noch als Ende einer Folge gescheiterter Abrufe', async () => {
    const quelle = scriptedSource();
    quelle.nichtGefunden();
    const einzeln = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage: memoryStorage() }));
    await vergehen(0);
    expect(einzeln.result.current.loadingState).toBe('not-found');
    expect(einzeln.result.current.recoveredOutages).toEqual([]);

    const folge = scriptedSource();
    folge.erfolg();
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, folge.source, { storage: memoryStorage() }));
    await vergehen(0);
    folge.fehlschlag();
    await act(async () => { await result.current.refresh(); });
    await vergehen(30_000);
    folge.nichtGefunden();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.loadingState).toBe('not-found');
    // die Folge ist beendet, ohne Meldung; ein späterer Erfolg meldet nichts nachträglich
    folge.erfolg();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.recoveredOutages).toEqual([]);
  });

  it('noch laufende Störung (kein Erfolg danach): keine Meldung', async () => {
    const quelle = scriptedSource();
    quelle.erfolg();
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage: memoryStorage() }));
    await vergehen(0);
    quelle.fehlschlag();
    for (let i = 0; i < 5; i += 1) {
      await vergehen(10_000);
      await act(async () => { await result.current.refresh(); });
    }
    expect(result.current.recoveredOutages).toEqual([]);
  });
});

describe('@RZ-035 Die Störungsmeldung hinterlässt nichts auf dem Gerät', () => {
  it('Seite während der Störung schließen: nichts gemeldet, nichts gespeichert; beim Neuladen beginnt keine alte Störung', async () => {
    const quelle = scriptedSource();
    quelle.erfolg();
    const storage = memoryStorage();
    const erste = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage }));
    await vergehen(0);
    quelle.fehlschlag();
    await act(async () => { await erste.result.current.refresh(); });
    await vergehen(45_000);
    erste.unmount();
    expect(storage.schreibzugriffe.filter((s) => /st(oe|ö)rung|outage/i.test(s))).toEqual([]);

    quelle.erfolg();
    const zweite = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage }));
    await vergehen(0);
    expect(zweite.result.current.loadingState).toBe('success');
    expect(zweite.result.current.recoveredOutages).toEqual([]);
  });

  it('auch nach überstandener Störung steht nichts davon im Speicher, in Cookies oder in der Datenbank des Browsers', async () => {
    const cookieSet = vi.fn();
    vi.spyOn(document, 'cookie', 'set').mockImplementation(cookieSet);
    const idb = { open: vi.fn() };
    vi.stubGlobal('indexedDB', idb);
    const lokal = vi.spyOn(Storage.prototype, 'setItem');
    const { storage, hook } = await stoerung(45_000);
    expect(hook.result.current.recoveredOutages).toHaveLength(1);
    const alle = [...storage.schreibzugriffe, ...lokal.mock.calls.map((c) => c.join('='))];
    expect(alle.filter((s) => /st(oe|ö)rung|outage|kurz|lang/i.test(s))).toEqual([]);
    expect(cookieSet).not.toHaveBeenCalled();
    expect(idb.open).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('@RZ-033 Wechsel des Codes', () => {
  it('die Störung zählt für das Turnier, in dem sie stattfand; eine offene Störung geht nicht auf das neue Turnier über', async () => {
    const { hook, quelle } = await stoerung(10_000, scriptedSource(), 'AAA111');
    expect(hook.result.current.recoveredOutages).toEqual([{ id: 1, shareCode: 'AAA111', kind: 'stoerung_kurz' }]);

    quelle.fehlschlag();
    await act(async () => { await hook.result.current.refresh(); });
    await vergehen(45_000);
    hook.rerender({ code: 'BBB222' });
    quelle.erfolg();
    await act(async () => { await hook.result.current.refresh(); });
    await vergehen(0);
    expect(hook.result.current.recoveredOutages.map((o) => o.shareCode)).toEqual(['AAA111']);
  });
});
