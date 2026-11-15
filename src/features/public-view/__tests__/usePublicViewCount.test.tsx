/**
 * @RZ-024 @RZ-025 @RZ-026 @RZ-027 @RZ-028 Die Zuschauer-Seite zählt sich selbst (Hook): Kanal und Gerät aus dem Öffnen, ein Aufruf je
 * Laden, jede Minute ein Lebenszeichen nur bei sichtbarer Seite, nichts auf dem Gerät, nichts bei „nicht geladen“.
 * Beispielzeilen und Wortlaut aus docs/anforderungen/2026-09-26_reichweite-zuschauersicht.md.
 */
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { usePublicViewCount } from '../usePublicViewCount';
import type { ViewCountArgs, ViewCountTransport } from '../../../core/viewCount/publicViewCount';

let sichtbar = true;
let breite = 390;
let standalone = false;
let navStandalone: boolean | undefined;

function Sonde({ code = 'NIKO26', geladen, transport }: { code?: string; geladen: boolean; transport: ViewCountTransport | null }) {
  usePublicViewCount(code, geladen, { transport });
  const l = useLocation();
  return <span data-testid="ort">{`${l.pathname}${l.search}`}</span>;
}

const zeige = (adresse: string, transport: ViewCountTransport | null, geladen = true, strict = false) => {
  const baum = (g: boolean) => (
    <MemoryRouter initialEntries={[adresse]}><Sonde geladen={g} transport={transport} /></MemoryRouter>
  );
  const r = render(strict ? <StrictMode>{baum(geladen)}</StrictMode> : baum(geladen));
  return { ...r, setzeGeladen: (g: boolean) => r.rerender(strict ? <StrictMode>{baum(g)}</StrictMode> : baum(g)) };
};

const ort = (): string => screen.getByTestId('ort').textContent ?? '';
const anzeigeAus = (): ViewCountArgs[] => [];
let gesendet: ViewCountArgs[] = anzeigeAus();
const transport: ViewCountTransport = (args) => { gesendet.push(args); return Promise.resolve(null); };
const vergehen = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
  vi.useFakeTimers();
  gesendet = anzeigeAus();
  sichtbar = true; breite = 390; standalone = false; navStandalone = undefined;
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (sichtbar ? 'visible' : 'hidden') });
  Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => breite });
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: (q: string) => ({ matches: standalone && q === '(display-mode: standalone)' }) });
  Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => navStandalone });
});
afterEach(() => { vi.useRealTimers(); });

describe('@RZ-024 Jedes Öffnen wird als Summe gezählt – Beispielzeilen', () => {
  const zeilen: Array<[string, string, () => void, string, string, boolean]> = [
    ['/live/NIKO26?k=q', 'Handy im Browser', () => undefined, 'qr', 'handy', false],
    ['/live/NIKO26?k=l', 'Laptop im Browser', () => { breite = 1440; }, 'link', 'gross', false],
    ['/live/NIKO26', 'Handy, App vom Startbildschirm', () => { standalone = true; }, 'direkt', 'handy', true],
    ['/live/NIKO26?k=irgendwas', 'Tablet im Browser', () => { breite = 820; }, 'direkt', 'tablet', false],
    ['/live/NIKO26', 'iPhone-App über navigator.standalone', () => { navStandalone = true; }, 'direkt', 'handy', true],
  ];
  it.each(zeilen)('%s auf %s → Kanal %s, Geräteart %s, installiert %s', (adresse, _geraet, vorbereiten, kanal, art, installiert) => {
    vorbereiten();
    zeige(adresse, transport);
    expect(gesendet).toEqual([{ p_share_code: 'NIKO26', p_art: 'aufruf', p_kanal: kanal, p_geraet: art, p_installiert: installiert }]);
  });

  it('der Zusatz „k=…“ steht danach nicht mehr in der Adresszeile, andere Teile bleiben', () => {
    zeige('/live/NIKO26?g=A&k=q&tab=standings', transport);
    expect(ort()).toBe('/live/NIKO26?g=A&tab=standings');
    expect(gesendet[0].p_kanal).toBe('qr');
  });

  it('Gegenbeispiel: ohne Zusatz bleibt die Adresse unverändert', () => {
    zeige('/live/NIKO26?g=A', transport);
    expect(ort()).toBe('/live/NIKO26?g=A');
  });

  it('genau ein Aufruf je Laden: Doppel-Render (StrictMode) und erneutes Rendern zählen nicht doppelt', async () => {
    const { setzeGeladen } = zeige('/live/NIKO26?k=q', transport, true, true);
    setzeGeladen(true);
    setzeGeladen(true);
    await vergehen(0);
    expect(gesendet.filter((a) => a.p_art === 'aufruf')).toHaveLength(1);
  });

  it('der Kanal bleibt auch nach dem Entfernen des Zusatzes erhalten (Lebenszeichen tragen ihn)', async () => {
    zeige('/live/NIKO26?k=l', transport);
    await vergehen(60_000);
    expect(gesendet.map((a) => [a.p_art, a.p_kanal])).toEqual([['aufruf', 'link'], ['lebenszeichen', 'link']]);
  });
});

describe('@RZ-025 Solange die Seite sichtbar ist, meldet sie sich jede Minute', () => {
  it('nach 5 Minuten sichtbar: 5 Lebenszeichen', async () => {
    zeige('/live/NIKO26', transport);
    await vergehen(5 * 60_000);
    expect(gesendet.filter((a) => a.p_art === 'lebenszeichen')).toHaveLength(5);
  });

  it('Gegenbeispiel: im Hintergrund oder bei gesperrtem Handy kommt kein Lebenszeichen, danach geht es weiter', async () => {
    zeige('/live/NIKO26', transport);
    sichtbar = false;
    await vergehen(3 * 60_000);
    expect(gesendet.filter((a) => a.p_art === 'lebenszeichen')).toHaveLength(0);
    sichtbar = true;
    await vergehen(2 * 60_000);
    expect(gesendet.filter((a) => a.p_art === 'lebenszeichen')).toHaveLength(2);
  });

  it('beim Schließen der Seite ist der Zeitgeber weg', async () => {
    const { unmount } = zeige('/live/NIKO26', transport);
    await vergehen(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await vergehen(3 * 60_000);
    expect(gesendet.filter((a) => a.p_art === 'lebenszeichen')).toHaveLength(0);
  });
});

describe('@RZ-028 Gezählt wird nur eine erfolgreich geladene Zuschauer-Seite', () => {
  it('„nicht gefunden“, Fehler oder Laden: weder Aufruf noch Lebenszeichen, der Zusatz wird trotzdem entfernt', async () => {
    zeige('/live/NIKO26?k=q', transport, false);
    await vergehen(3 * 60_000);
    expect(gesendet).toEqual([]);
    expect(ort()).toBe('/live/NIKO26');
  });

  it('erst wenn das Turnier geladen ist, kommt der Aufruf – mit dem beim Öffnen gelesenen Kanal', async () => {
    const { setzeGeladen } = zeige('/live/NIKO26?k=q', transport, false);
    await vergehen(1000);
    setzeGeladen(true);
    expect(gesendet).toEqual([{ p_share_code: 'NIKO26', p_art: 'aufruf', p_kanal: 'qr', p_geraet: 'handy', p_installiert: false }]);
  });

  it('ohne Versandweg (lokaler Modus ohne Supabase) tut die Zählung nichts, der Zusatz geht trotzdem', async () => {
    zeige('/live/NIKO26?k=q', null);
    await vergehen(2 * 60_000);
    expect(ort()).toBe('/live/NIKO26');
  });
});

describe('@RZ-026 Das Zählen stört nie', () => {
  it('Server antwortet nicht oder lehnt ab: kein Fehler, keine Ausgabe, kein Wiederholen', async () => {
    const aus = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const hängt = vi.fn<ViewCountTransport>(() => new Promise(() => undefined));
    zeige('/live/NIKO26', hängt);
    await vergehen(15_000);
    expect(hängt).toHaveBeenCalledTimes(1);
    const lehntAb = vi.fn<ViewCountTransport>(() => Promise.reject(new Error('404')));
    zeige('/live/NIKO27', lehntAb);
    await vergehen(15_000);
    expect(lehntAb).toHaveBeenCalledTimes(1);
    expect(aus).not.toHaveBeenCalled();
    aus.mockRestore();
  });
});

describe('@RZ-027 Auf dem Gerät bleibt für die Zählung nichts zurück', () => {
  it('Öffnen, eine Minute offen, Schließen: kein Schreiben und kein Lesen in Speicher, Cookies oder Datenbank des Browsers', async () => {
    const cookieSet = vi.fn();
    const cookieGet = vi.spyOn(document, 'cookie', 'get').mockImplementation(() => '');
    vi.spyOn(document, 'cookie', 'set').mockImplementation(cookieSet);
    const speicher = [
      vi.spyOn(Storage.prototype, 'getItem'), vi.spyOn(Storage.prototype, 'setItem'),
      vi.spyOn(Storage.prototype, 'removeItem'), vi.spyOn(Storage.prototype, 'key'),
    ];
    const lokal = [vi.spyOn(window.localStorage, 'getItem'), vi.spyOn(window.localStorage, 'setItem'),
      vi.spyOn(window.sessionStorage, 'getItem'), vi.spyOn(window.sessionStorage, 'setItem')];
    const idb = { open: vi.fn() };
    vi.stubGlobal('indexedDB', idb);
    const { unmount } = zeige('/live/NIKO26?k=q', transport);
    await vergehen(60_000);
    unmount();
    for (const s of [...speicher, ...lokal]) { expect(s).not.toHaveBeenCalled(); }
    expect(cookieSet).not.toHaveBeenCalled();
    expect(cookieGet).not.toHaveBeenCalled();
    expect(idb.open).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('die Meldung trägt kein Gerätekennzeichen, keinen Browser-String und keine Zeit', () => {
    zeige('/live/NIKO26?k=q', transport);
    const felder = Object.keys(gesendet[0]).sort();
    expect(felder).toEqual(['p_art', 'p_geraet', 'p_installiert', 'p_kanal', 'p_share_code']);
    expect(JSON.stringify(gesendet[0])).not.toMatch(/Mozilla|userAgent|\d{4}-\d{2}-\d{2}T/);
  });
});
