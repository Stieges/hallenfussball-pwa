/**
 * @RZ-033 @RZ-034 @RZ-035 @RZ-036 Die Zuschauer-Seite sendet eine überstandene Netzstörung genau einmal über denselben Weg wie ihre übrigen
 * Zählmeldungen (eigener Aufruf, ohne Warten, Fehler verschluckt, nie wiederholt). Wortlaut aus
 * docs/anforderungen/2026-09-26_reichweite-zuschauersicht.md.
 */
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { usePublicViewCount } from '../usePublicViewCount';
import { usePublicTournament } from '../usePublicTournament';
import type { RecoveredOutage } from '../../../core/viewCount/publicOutage';
import type { ViewCountArgs, ViewCountTransport } from '../../../core/viewCount/publicViewCount';
import type { PublicFetchResult, PublicTournamentSource } from '../publicSource';
import type { StandStorage } from '../publicStandStore';
import { buildLiveViewTournament, SHARE_CODE } from '../../../screens/__tests__/liveViewFixture';

let gesendet: ViewCountArgs[] = [];
const transport: ViewCountTransport = (args) => { gesendet.push(args); return Promise.resolve(null); };
const vergehen = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const kurz = (id: number, code = 'NIKO26'): RecoveredOutage => ({ id, shareCode: code, kind: 'stoerung_kurz' });
const lang = (id: number, code = 'NIKO26'): RecoveredOutage => ({ id, shareCode: code, kind: 'stoerung_lang' });
const stoerungen = (): ViewCountArgs[] => gesendet.filter((a) => a.p_art === 'stoerung_kurz' || a.p_art === 'stoerung_lang');

function Sonde({ outages, via = transport, adresse }: { outages: readonly RecoveredOutage[]; via?: ViewCountTransport | null; adresse?: string }) {
  usePublicViewCount('NIKO26', true, { transport: via, outages });
  return <span data-adresse={adresse} />;
}
const zeige = (outages: readonly RecoveredOutage[], adresse = '/live/NIKO26?k=q', via: ViewCountTransport | null = transport, strict = false) => {
  const baum = (o: readonly RecoveredOutage[]) => <MemoryRouter initialEntries={[adresse]}><Sonde outages={o} via={via} /></MemoryRouter>;
  const r = render(strict ? <StrictMode>{baum(outages)}</StrictMode> : baum(outages));
  return { ...r, setze: (o: readonly RecoveredOutage[]) => r.rerender(strict ? <StrictMode>{baum(o)}</StrictMode> : baum(o)) };
};

beforeEach(() => {
  vi.useFakeTimers();
  gesendet = [];
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  Object.defineProperty(window, 'screen', { configurable: true, value: { width: 390, height: 844 } });
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: (q: string) => ({ matches: q === '(pointer: coarse)' }) });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('@RZ-033 Die überstandene Störung wird genau einmal gesendet', () => {
  it('kurze und lange Störung gehen mit den fünf Feldern der übrigen Meldungen (Kanal und Gerät des Öffnens) hinaus', () => {
    const { setze } = zeige([]);
    setze([kurz(1)]);
    setze([kurz(1), lang(2)]);
    expect(stoerungen()).toEqual([
      { p_share_code: 'NIKO26', p_art: 'stoerung_kurz', p_kanal: 'qr', p_geraet: 'handy', p_installiert: false },
      { p_share_code: 'NIKO26', p_art: 'stoerung_lang', p_kanal: 'qr', p_geraet: 'handy', p_installiert: false },
    ]);
  });

  it('genau einmal: erneutes Rendern, gleiche Liste, StrictMode-Doppelaufruf senden nicht noch einmal', async () => {
    const { setze } = zeige([kurz(1)], '/live/NIKO26', transport, true);
    setze([kurz(1)]);
    setze([kurz(1)]);
    await vergehen(0);
    expect(stoerungen()).toHaveLength(1);
  });

  it('eine Störung, die schon beim Rendern in der Liste steht, wird gesendet; eine zweite später ebenfalls (zwei Störungen = zwei Meldungen)', () => {
    const { setze } = zeige([kurz(1)]);
    expect(stoerungen().map((a) => a.p_art)).toEqual(['stoerung_kurz']);
    setze([kurz(1), kurz(2)]);
    expect(stoerungen().map((a) => a.p_art)).toEqual(['stoerung_kurz', 'stoerung_kurz']);
  });

  it('die Meldung geht für das Turnier hinaus, in dem die Störung stattfand (Wechsel des Codes)', () => {
    zeige([kurz(1, 'ALT111')]);
    expect(stoerungen().map((a) => a.p_share_code)).toEqual(['ALT111']);
  });

  it('die Störungsmeldung ersetzt weder den Aufruf noch das Lebenszeichen', async () => {
    zeige([lang(1)]);
    await vergehen(60_000);
    expect(gesendet.map((a) => a.p_art)).toEqual(['aufruf', 'stoerung_lang', 'lebenszeichen']);
  });
});

describe('@RZ-034 Ohne gescheiterten Abruf wird keine Störung gesendet', () => {
  it('keine Störung in der Liste: Aufruf und Lebenszeichen wie bisher, nie eine Störungsmeldung', async () => {
    zeige([]);
    await vergehen(3 * 60_000);
    expect(stoerungen()).toEqual([]);
    expect(gesendet.map((a) => a.p_art)).toEqual(['aufruf', 'lebenszeichen', 'lebenszeichen', 'lebenszeichen']);
  });
});

describe('@RZ-035 Die Störungsmeldung stört die Seite nie', () => {
  it('Server antwortet nicht oder lehnt ab: kein Fehler, keine Ausgabe, kein Wiederholen, auch beim erneuten Rendern', async () => {
    const aus = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const hängt = vi.fn<ViewCountTransport>(() => new Promise(() => undefined));
    const a = zeige([kurz(1)], '/live/NIKO26', hängt);
    await vergehen(15_000);
    a.setze([kurz(1)]);
    await vergehen(15_000);
    expect(hängt.mock.calls.filter(([args]) => args.p_art === 'stoerung_kurz')).toHaveLength(1);
    const lehntAb = vi.fn<ViewCountTransport>(() => Promise.reject(new Error('404')));
    const b = zeige([lang(1)], '/live/NIKO26', lehntAb);
    await vergehen(15_000);
    b.setze([lang(1)]);
    await vergehen(15_000);
    expect(lehntAb.mock.calls.filter(([args]) => args.p_art === 'stoerung_lang')).toHaveLength(1);
    expect(aus).not.toHaveBeenCalled();
  });

  it('ohne Versandweg (lokaler Modus ohne Supabase) tut die Störungsmeldung nichts und stört nicht', async () => {
    const { setze } = zeige([kurz(1)], '/live/NIKO26', null);
    setze([kurz(1), lang(2)]);
    await vergehen(2 * 60_000);
    expect(gesendet).toEqual([]);
  });

  it('nichts auf dem Gerät: weder Speicher, Cookies noch Datenbank des Browsers', async () => {
    const cookieSet = vi.fn();
    vi.spyOn(document, 'cookie', 'set').mockImplementation(cookieSet);
    const speicher = [vi.spyOn(Storage.prototype, 'getItem'), vi.spyOn(Storage.prototype, 'setItem'), vi.spyOn(Storage.prototype, 'removeItem')];
    const idb = { open: vi.fn() };
    vi.stubGlobal('indexedDB', idb);
    const { setze, unmount } = zeige([]);
    setze([kurz(1), lang(2)]);
    await vergehen(60_000);
    unmount();
    for (const s of speicher) { expect(s).not.toHaveBeenCalled(); }
    expect(cookieSet).not.toHaveBeenCalled();
    expect(idb.open).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('die Meldung trägt nur die fünf bekannten Felder, keine Dauer, keine Zeit, keine Kennung', () => {
    zeige([lang(7)]);
    const felder = Object.keys(stoerungen()[0]).sort();
    expect(felder).toEqual(['p_art', 'p_geraet', 'p_installiert', 'p_kanal', 'p_share_code']);
    expect(JSON.stringify(stoerungen()[0])).not.toMatch(/Mozilla|userAgent|\d{4}-\d{2}-\d{2}T|\b7\b/);
  });
});

describe('@RZ-033 @RZ-035 Zusammenspiel wie in der Zuschauer-Seite: Laden und Zählen', () => {
  const TOURNAMENT = buildLiveViewTournament();
  function speicher(): StandStorage {
    const data = new Map<string, string>();
    return {
      get length() { return data.size; }, key: (i) => [...data.keys()][i] ?? null,
      getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); },
    };
  }
  function quelleMitNetz() {
    const netz = { an: true, version: 1 };
    const fetch = vi.fn((): Promise<PublicFetchResult> => {
      if (!netz.an) { return Promise.resolve({ kind: 'unreachable' }); }
      netz.version += 1;
      return Promise.resolve({ kind: 'full', version: `v${netz.version}`, tournament: TOURNAMENT });
    });
    const source: PublicTournamentSource = { kind: 'rpc', pollIntervalMs: 10_000, nowMs: () => Date.now(), fetch };
    return { netz, source, fetch };
  }
  const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter initialEntries={['/live/ABC123?k=l']}>{children}</MemoryRouter>;
  function seite(source: PublicTournamentSource, via: ViewCountTransport) {
    const store = speicher();
    return renderHook(() => {
      const zustand = usePublicTournament(SHARE_CODE, source, { storage: store });
      usePublicViewCount(SHARE_CODE, zustand.loadingState === 'success', { transport: via, outages: zustand.recoveredOutages });
      return zustand;
    }, { wrapper });
  }

  it('Netz 10 Sekunden weg, dann wieder da: Aufruf beim Laden, danach genau eine „stoerung_kurz“ mit dem Kanal des Öffnens', async () => {
    const { netz, source } = quelleMitNetz();
    const { result } = seite(source, transport);
    await vergehen(0);
    expect(gesendet.map((a) => a.p_art)).toEqual(['aufruf']);
    netz.an = false;
    await vergehen(10_000);
    netz.an = true;
    await vergehen(10_000);
    expect(result.current.loadingState).toBe('success');
    expect(gesendet.map((a) => [a.p_art, a.p_kanal])).toEqual([['aufruf', 'link'], ['stoerung_kurz', 'link']]);
    await vergehen(30_000);
    expect(stoerungen()).toHaveLength(1);
  });

  it('Netz 45 Sekunden weg: eine „stoerung_lang“; der Lade-Pfad wartet nie auf die Meldung (Meldung hängt, Abrufe laufen weiter)', async () => {
    const { netz, source, fetch } = quelleMitNetz();
    const hängt = vi.fn<ViewCountTransport>(() => new Promise(() => undefined));
    const { result } = seite(source, hängt);
    await vergehen(0);
    netz.an = false;
    await vergehen(45_000);
    netz.an = true;
    const vorher = fetch.mock.calls.length;
    await vergehen(30_000);
    expect(hängt.mock.calls.filter(([a]) => a.p_art === 'stoerung_lang')).toHaveLength(1);
    expect(fetch.mock.calls.length).toBeGreaterThan(vorher);
    expect(result.current.loadingState).toBe('success');
  });

  it('Netz die ganze Zeit da: keine Störungsmeldung (Gegenbeispiel)', async () => {
    const { source } = quelleMitNetz();
    seite(source, transport);
    await vergehen(2 * 60_000);
    expect(stoerungen()).toEqual([]);
  });
});
