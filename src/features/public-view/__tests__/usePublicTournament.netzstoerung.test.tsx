/**
 * @RZ-033 @RZ-034 @RZ-035 Die Zuschauer-Seite merkt sich überstandene Netzstörungen (nur im Arbeitsspeicher) und meldet jede genau einmal:
 * kurz (ein gescheiterter Abruf), lang (mindestens zwei gescheiterte Abrufe in Folge, Stand 2026-11-17). Szenarien aus docs/anforderungen/2026-09-26_reichweite-zuschauersicht.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { buildLiveViewTournament, SHARE_CODE } from '../../../screens/__tests__/liveViewFixture';
import { usePublicTournament } from '../usePublicTournament';
import type { PublicFetchResult, PublicTournamentSource } from '../publicSource';
import { saveContact, saveStand, type StandStorage } from '../publicStandStore';

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
  const state: { next: PublicFetchResult | null | 'haengt'; version: string } = { next: { kind: 'unreachable' }, version: 'v1' };
  const fetch = vi.fn((_code: string, _since: string | null): Promise<PublicFetchResult> => {
    if (state.next === 'haengt') { return new Promise<PublicFetchResult>(() => undefined); }
    return state.next === null ? Promise.reject(new Error('Netz weg')) : Promise.resolve(state.next);
  });
  const source: PublicTournamentSource = { kind: 'rpc', pollIntervalMs, nowMs: () => Date.now(), fetch };
  return {
    source, fetch,
    fehlschlag: () => { state.next = { kind: 'unreachable' }; },
    erfolg: () => { state.version = `v${state.version.slice(1) === '1' ? 2 : 1}`; state.next = { kind: 'full', version: state.version, tournament: TOURNAMENT }; },
    unveraendert: () => { state.next = { kind: 'unchanged', version: state.version }; },
    nichtGefunden: () => { state.next = { kind: 'not-found' }; },
    wirft: () => { state.next = null; },
    haengt: () => { state.next = 'haengt'; },
  };
}

const vergehen = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T12:32:00Z'));
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

/** Seite öffnen (Erfolg), dann `fehlschlaege` Abrufe in Folge scheitern (je 10 s Takt), dann gelingt der nächste Abruf. */
async function stoerung(fehlschlaege: number, quelle = scriptedSource(), code = SHARE_CODE) {
  const storage = memoryStorage();
  quelle.erfolg();
  const hook = renderHook((p: { code: string }) => usePublicTournament(p.code, quelle.source, { storage }), { initialProps: { code } });
  await vergehen(0);
  quelle.fehlschlag();
  for (let i = 0; i < fehlschlaege; i += 1) {
    await vergehen(10_000);
    await act(async () => { await hook.result.current.refresh(); });
  }
  await vergehen(10_000);
  quelle.erfolg();
  await act(async () => { await hook.result.current.refresh(); });
  return { hook, quelle, storage };
}

type Schritt = 'fehl' | 'wirft' | 'ganz' | 'gleich' | 'weg';

/** Spielt Abrufe nacheinander ab (je ein von Hand ausgelöster Abruf, 10 s dazwischen) und sammelt jede neu gemeldete Störung. */
async function folge(schritte: Schritt[], quelle = scriptedSource()) {
  quelle.erfolg();
  const hook = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage: memoryStorage() }));
  await vergehen(0);
  const gemeldet: Array<{ id: number; kind: string }> = [];
  for (const schritt of schritte) {
    quelle[{ fehl: 'fehlschlag', wirft: 'wirft', ganz: 'erfolg', gleich: 'unveraendert', weg: 'nichtGefunden' }[schritt] as 'fehlschlag'] ();
    await vergehen(10_000);
    await act(async () => { await hook.result.current.refresh(); });
    const aktuell = hook.result.current.recoveredOutage;
    if (aktuell !== null && !gemeldet.some((g) => g.id === aktuell.id)) { gemeldet.push({ id: aktuell.id, kind: aktuell.kind }); }
  }
  return { hook, quelle, gemeldet };
}

describe('@RZ-033 Eine überstandene Netzstörung wird gemeldet (Beispieltabelle)', () => {
  it.each([
    ['so lange, dass genau ein Abruf scheitert', 1, 'stoerung_kurz'],
    ['so lange, dass zwei Abrufe hintereinander scheitern', 2, 'stoerung_lang'],
    ['45 Sekunden (vier oder fünf Abrufe hintereinander)', 5, 'stoerung_lang'],
    ['45 Sekunden mit vier Abrufen hintereinander', 4, 'stoerung_lang'],
  ] as const)('%s → genau eine Meldung „%s“ für dieses Turnier', async (_dauer, fehlschlaege, art) => {
    const { hook } = await stoerung(fehlschlaege);
    expect(hook.result.current.loadingState).toBe('success');
    expect(hook.result.current.recoveredOutage).toEqual({ id: 1, shareCode: SHARE_CODE, kind: art });
  });

  it('ein einzelner Abruf hängt 30 Sekunden und scheitert dann (Zeitüberschreitung) → kurze Störung, nie lang', async () => {
    const quelle = scriptedSource();
    quelle.erfolg();
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage: memoryStorage() }));
    await vergehen(0);
    quelle.haengt();
    let fertig = false;
    act(() => { void result.current.refresh().then(() => { fertig = true; }); });
    await vergehen(30_000);
    expect(fertig).toBe(true);
    expect(result.current.connectionHint).not.toBeNull();
    quelle.erfolg();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.recoveredOutage).toEqual({ id: 1, shareCode: SHARE_CODE, kind: 'stoerung_kurz' });
  });

  it('Gegenbeispiel Zeit: ein einzelner Fehlschlag bleibt kurz, auch wenn danach Minuten vergehen, bis der nächste Abruf gelingt', async () => {
    const quelle = scriptedSource();
    quelle.erfolg();
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage: memoryStorage() }));
    await vergehen(0);
    quelle.fehlschlag();
    await act(async () => { await result.current.refresh(); });
    await vergehen(5 * 60_000);
    quelle.erfolg();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.recoveredOutage?.kind).toBe('stoerung_kurz');
  });

  it('Gegenbeispiel Zähler: Fehlschlag, Erfolg, Fehlschlag, Erfolg → zwei kurze Störungen, keine lange', async () => {
    const { gemeldet } = await folge(['fehl', 'ganz', 'fehl', 'ganz']);
    expect(gemeldet).toEqual([{ id: 1, kind: 'stoerung_kurz' }, { id: 2, kind: 'stoerung_kurz' }]);
  });

  it('Fehlschlag, Fehlschlag, Erfolg, Fehlschlag, Erfolg → eine lange, danach eine kurze (der Zähler beginnt nach dem Erfolg von vorn)', async () => {
    const { gemeldet } = await folge(['fehl', 'fehl', 'ganz', 'fehl', 'ganz']);
    expect(gemeldet).toEqual([{ id: 1, kind: 'stoerung_lang' }, { id: 2, kind: 'stoerung_kurz' }]);
  });

  it('mehrere Fehlschläge in Folge (Ausnahme, „nicht erreichbar“) sind EINE Störung, lang ab dem zweiten', async () => {
    const { gemeldet } = await folge(['wirft', 'fehl', 'fehl', 'ganz']);
    expect(gemeldet).toEqual([{ id: 1, kind: 'stoerung_lang' }]);
  });

  it('genau einmal: weitere gelungene Abrufe nach der Störung melden nichts mehr', async () => {
    const { hook, quelle } = await stoerung(1);
    for (let i = 0; i < 3; i += 1) {
      await vergehen(10_000);
      await act(async () => { await hook.result.current.refresh(); });
    }
    quelle.unveraendert();
    await act(async () => { await hook.result.current.refresh(); });
    expect(hook.result.current.recoveredOutage?.id).toBe(1);
  });

  it('zwei getrennte Störungen sind zwei Meldungen mit fortlaufender Kennung; gehalten wird nur die letzte (keine wachsende Liste)', async () => {
    const { hook, quelle } = await stoerung(1);
    expect(hook.result.current.recoveredOutage).toEqual({ id: 1, shareCode: SHARE_CODE, kind: 'stoerung_kurz' });
    await vergehen(30_000);
    quelle.fehlschlag();
    for (let i = 0; i < 2; i += 1) {
      await vergehen(10_000);
      await act(async () => { await hook.result.current.refresh(); });
    }
    quelle.erfolg();
    await act(async () => { await hook.result.current.refresh(); });
    expect(hook.result.current.recoveredOutage).toEqual({ id: 2, shareCode: SHARE_CODE, kind: 'stoerung_lang' });
    expect(Array.isArray(hook.result.current.recoveredOutage)).toBe(false);
  });

  it('„nichts Neues“ ist ein Erfolg: Fehlschlag, „nichts Neues“ → kurz; Fehlschlag, Fehlschlag, „nichts Neues“ → lang', async () => {
    expect((await folge(['fehl', 'gleich'])).gemeldet).toEqual([{ id: 1, kind: 'stoerung_kurz' }]);
    expect((await folge(['fehl', 'fehl', 'gleich'])).gemeldet).toEqual([{ id: 1, kind: 'stoerung_lang' }]);
  });

  it('„nichts Neues“ zwischen zwei Fehlschlägen unterbricht die Folge: zwei kurze Störungen', async () => {
    expect((await folge(['fehl', 'gleich', 'fehl', 'gleich'])).gemeldet).toEqual([
      { id: 1, kind: 'stoerung_kurz' }, { id: 2, kind: 'stoerung_kurz' },
    ]);
  });

  it('„Turnier nicht gefunden“ beendet die Folge ohne Meldung und setzt den Zähler zurück', async () => {
    const { hook, quelle } = await folge(['fehl', 'weg']);
    expect(hook.result.current.recoveredOutage).toBeNull();
    quelle.fehlschlag();
    await vergehen(10_000);
    await act(async () => { await hook.result.current.refresh(); });
    quelle.erfolg();
    await vergehen(10_000);
    await act(async () => { await hook.result.current.refresh(); });
    // wäre der Zähler aus der Folge davor erhalten geblieben, wäre dies „lang“
    expect(hook.result.current.recoveredOutage?.kind).toBe('stoerung_kurz');
  });

  it('von Hand ausgelöster Abruf (refresh), „online“-Ereignis und Rückkehr in den Vordergrund zählen wie ein Takt-Abruf', async () => {
    const quelle = scriptedSource(10_000);
    quelle.erfolg();
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage: memoryStorage() }));
    await vergehen(0);
    quelle.fehlschlag();
    await vergehen(10_000); // Takt: Fehlschlag 1
    await act(async () => { window.dispatchEvent(new Event('online')); await vi.advanceTimersByTimeAsync(0); }); // Fehlschlag 2
    quelle.erfolg();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.recoveredOutage?.kind).toBe('stoerung_lang');
  });

  it('ein Durchlauf mit zwei Versuchen („Änderung passt nicht“, dann ganzer Abruf scheitert) zählt als EIN Fehlschlag → kurz', async () => {
    const quelle = scriptedSource();
    quelle.erfolg();
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage: memoryStorage() }));
    await vergehen(0);
    const antworten: PublicFetchResult[] = [
      { kind: 'delta', version: 'vX', baseVersion: 'nicht-die-gehaltene', delta: { matches: [], removedMatchIds: [] } },
      { kind: 'unreachable' },
    ];
    quelle.fetch.mockImplementationOnce(() => Promise.resolve(antworten[0])).mockImplementationOnce(() => Promise.resolve(antworten[1]));
    await act(async () => { await result.current.refresh(); });
    expect(quelle.fetch).toHaveBeenCalledTimes(3);
    expect(quelle.fetch.mock.calls[2][1]).toBeNull();
    quelle.erfolg();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.recoveredOutage?.kind).toBe('stoerung_kurz');
  });

  it('ein Durchlauf mit zwei Versuchen, der zum Erfolg führt („Änderung passt nicht“, dann ganzer Abruf gelingt), ist keine Störung', async () => {
    const quelle = scriptedSource();
    quelle.erfolg();
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage: memoryStorage() }));
    await vergehen(0);
    quelle.fetch.mockImplementationOnce(() => Promise.resolve({
      kind: 'delta', version: 'vX', baseVersion: 'nicht-die-gehaltene', delta: { matches: [], removedMatchIds: [] },
    }));
    await act(async () => { await result.current.refresh(); });
    expect(result.current.recoveredOutage).toBeNull();
  });

  it('überholte Antwort (Code gewechselt, alter Abruf scheitert erst danach) zählt nicht: danach ein Fehlschlag und Erfolg → kurz', async () => {
    const quelle = scriptedSource();
    quelle.erfolg();
    const hook = renderHook((p: { code: string }) => usePublicTournament(p.code, quelle.source, { storage: memoryStorage() }), { initialProps: { code: 'AAA111' } });
    await vergehen(0);
    let ende: (r: PublicFetchResult) => void = () => undefined;
    quelle.fetch.mockImplementationOnce(() => new Promise<PublicFetchResult>((resolve) => { ende = resolve; }));
    let alt: Promise<void> = Promise.resolve();
    act(() => { alt = hook.result.current.refresh(); });
    hook.rerender({ code: 'BBB222' });
    await act(async () => { ende({ kind: 'unreachable' }); await alt; });
    // der überholte Fehlschlag darf keinen Zähler hinterlassen
    quelle.fehlschlag();
    await act(async () => { await hook.result.current.refresh(); });
    quelle.erfolg();
    await act(async () => { await hook.result.current.refresh(); });
    expect(hook.result.current.recoveredOutage?.kind).toBe('stoerung_kurz');
  });

  it('Störung schon beim ersten Laden: ein Fehlschlag → kurz, zwei → lang (kein Erfolg davor)', async () => {
    const lauf = async (fehlschlaege: number) => {
      const quelle = scriptedSource();
      const { result } = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage: memoryStorage() }));
      await vergehen(0);
      expect(result.current.loadingState).toBe('error');
      for (let i = 1; i < fehlschlaege; i += 1) {
        await vergehen(10_000);
        await act(async () => { await result.current.refresh(); });
      }
      quelle.erfolg();
      await act(async () => { await result.current.refresh(); });
      expect(result.current.loadingState).toBe('success');
      return result.current.recoveredOutage;
    };
    expect(await lauf(1)).toEqual({ id: 1, shareCode: SHARE_CODE, kind: 'stoerung_kurz' });
    expect(await lauf(2)).toEqual({ id: 1, shareCode: SHARE_CODE, kind: 'stoerung_lang' });
  });

  it('Seite im Hintergrund: der Takt ruht, die Störung bleibt offen und zählt nach der Rückkehr weiter (Fehlschlag davor + Fehlschlag danach → lang)', async () => {
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
    expect(result.current.recoveredOutage).toBeNull();
    sichtbar = true;
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(0); }); // Fehlschlag 2
    quelle.erfolg();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.recoveredOutage?.kind).toBe('stoerung_lang');
  });

  it('ein Sprung der Geräteuhr ändert nichts: ein Fehlschlag bleibt kurz, zwei bleiben lang', async () => {
    const quelle = scriptedSource();
    quelle.erfolg();
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage: memoryStorage() }));
    await vergehen(0);
    quelle.fehlschlag();
    await act(async () => { await result.current.refresh(); });
    vi.setSystemTime(new Date(Date.now() + 3_600_000));
    quelle.erfolg();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.recoveredOutage?.kind).toBe('stoerung_kurz');
    quelle.fehlschlag();
    await act(async () => { await result.current.refresh(); });
    vi.setSystemTime(new Date(Date.now() - 3_600_000));
    await act(async () => { await result.current.refresh(); });
    quelle.erfolg();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.recoveredOutage).toEqual({ id: 2, shareCode: SHARE_CODE, kind: 'stoerung_lang' });
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
    expect(result.current.recoveredOutage).toBeNull();
  });

  it('„Turnier nicht gefunden“ ist keine Störung: weder als Antwort allein noch als Ende einer Folge gescheiterter Abrufe', async () => {
    const quelle = scriptedSource();
    quelle.nichtGefunden();
    const einzeln = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage: memoryStorage() }));
    await vergehen(0);
    expect(einzeln.result.current.loadingState).toBe('not-found');
    expect(einzeln.result.current.recoveredOutage).toBeNull();

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
    expect(result.current.recoveredOutage).toBeNull();
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
    expect(result.current.recoveredOutage).toBeNull();
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
    expect(zweite.result.current.recoveredOutage).toBeNull();
  });

  it('auch nach überstandener Störung steht nichts davon im Speicher, in Cookies oder in der Datenbank des Browsers', async () => {
    const cookieSet = vi.fn();
    vi.spyOn(document, 'cookie', 'set').mockImplementation(cookieSet);
    const idb = { open: vi.fn() };
    vi.stubGlobal('indexedDB', idb);
    const lokal = vi.spyOn(Storage.prototype, 'setItem');
    const { storage, hook } = await stoerung(5);
    expect(hook.result.current.recoveredOutage?.id).toBe(1);
    const alle = [...storage.schreibzugriffe, ...lokal.mock.calls.map((c) => c.join('='))];
    expect(alle.filter((s) => /st(oe|ö)rung|outage|kurz|lang/i.test(s))).toEqual([]);
    expect(cookieSet).not.toHaveBeenCalled();
    expect(idb.open).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('@RZ-033 Wechsel des Codes', () => {
  it('die Störung zählt für das Turnier, in dem sie stattfand; eine offene Störung geht nicht auf das neue Turnier über', async () => {
    const { hook, quelle } = await stoerung(1, scriptedSource(), 'AAA111');
    expect(hook.result.current.recoveredOutage).toEqual({ id: 1, shareCode: 'AAA111', kind: 'stoerung_kurz' });

    quelle.fehlschlag();
    await act(async () => { await hook.result.current.refresh(); });
    await vergehen(45_000);
    hook.rerender({ code: 'BBB222' });
    quelle.erfolg();
    await act(async () => { await hook.result.current.refresh(); });
    await vergehen(0);
    expect(hook.result.current.recoveredOutage).toEqual({ id: 1, shareCode: 'AAA111', kind: 'stoerung_kurz' });
  });
});

describe('@RZ-033 Ein wiederhergestellter Stand ist kein Abruf dieser Sitzung', () => {
  it('Stand vom selben Tag vom Gerät, erster Abruf scheitert, zweiter gelingt → kurz; ein gelungener erster Abruf meldet nichts', async () => {
    const storage = memoryStorage();
    const jetzt = Date.now();
    saveStand(storage, SHARE_CODE, { source: 'rpc', version: 'v1', day: '2026-10-10', tournament: TOURNAMENT });
    saveContact(storage, SHARE_CODE, { atMs: jetzt - 3 * 3_600_000, deviceMs: jetzt - 3 * 3_600_000 });
    const quelle = scriptedSource();
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, quelle.source, { storage }));
    await vergehen(0);
    expect(result.current.tournament).not.toBeNull();
    expect(result.current.recoveredOutage).toBeNull();
    quelle.erfolg();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.recoveredOutage?.kind).toBe('stoerung_kurz');
  });
});
