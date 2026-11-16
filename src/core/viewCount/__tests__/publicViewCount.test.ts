/**
 * @RZ-024 @RZ-025 @RZ-026 Zuschauer-Seite zählen: Kanal, Geräteart, „installiert“ und das störungsfreie Senden
 * (docs/anforderungen/2026-09-26_reichweite-zuschauersicht.md, Beispielzeilen und Wortlaut aus dem Gherkin).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  channelFromParam, deviceClassFromEnvironment, deviceClassFromScreen, isInstalledApp, sendViewCount, VIEW_COUNT_TIMEOUT_MS,
  type ViewCountArgs, type ViewCountTransport,
} from '../publicViewCount';

const ARGS: ViewCountArgs = { p_share_code: 'NIKO26', p_art: 'aufruf', p_kanal: 'qr', p_geraet: 'handy', p_installiert: false };

describe('@RZ-024 Kanal aus dem Adresszusatz', () => {
  it.each([
    ['q', 'qr'],
    ['l', 'link'],
    [null, 'direkt'],
    ['irgendwas', 'direkt'],
    ['', 'direkt'],
    ['Q', 'direkt'],
  ] as const)('k=%s → %s', (zusatz, kanal) => {
    expect(channelFromParam(zusatz)).toBe(kanal);
  });
});

describe('@RZ-024 Geräteart aus der Hauptbedienung und der kürzeren Bildschirmseite', () => {
  // Regel: feiner Zeiger (Maus/Touchpad) → groß, auch bei hoher Skalierung; sonst kürzere Seite < 600 → Handy;
  // sonst grober Zeiger (Finger) → Tablet; weder fein noch grob (TV, Kiosk, unbekannt) und ≥ 600 → groß (kein Touch-Gerät).
  const umgebung = (breite: number, hoehe: number, zeiger: 'fine' | 'coarse' | 'keiner') => ({
    screenWidth: breite,
    screenHeight: hoehe,
    matchMedia: (q: string) => ({ matches: (zeiger === 'fine' && q === '(pointer: fine)') || (zeiger === 'coarse' && q === '(pointer: coarse)') }),
  });
  // [Gerät, Breite, Höhe, Hauptbedienung, Geräteart]
  it.each([
    ['iPhone hoch', 390, 844, 'coarse', 'handy'],
    ['iPhone quer', 844, 390, 'coarse', 'handy'],
    ['großes Android hoch', 412, 915, 'coarse', 'handy'],
    ['großes Android quer', 915, 412, 'coarse', 'handy'],
    ['iPad hoch', 768, 1024, 'coarse', 'tablet'],
    ['iPad quer', 1024, 768, 'coarse', 'tablet'],
    ['iPad Air hoch', 820, 1180, 'coarse', 'tablet'],
    ['iPad Air quer', 1180, 820, 'coarse', 'tablet'],
    ['Laptop 1280×720 mit Maus', 1280, 720, 'fine', 'gross'],
    ['Laptop 1366×768 mit Maus', 1366, 768, 'fine', 'gross'],
    ['Windows-Laptop 150 % Skalierung 853×533', 853, 533, 'fine', 'gross'],
    ['Windows-Laptop 200 % Skalierung 960×540', 960, 540, 'fine', 'gross'],
    ['Desktop 1920×1080', 1920, 1080, 'fine', 'gross'],
    ['weder fein noch grob, kürzere Seite 539 (z. B. kleines Gerät ohne Angabe)', 960, 539, 'keiner', 'handy'],
    ['weder fein noch grob, kürzere Seite 600 (z. B. TV, Kiosk)', 1920, 1080, 'keiner', 'gross'],
  ] as const)('%s (%i×%i, Bedienung: %s) → %s', (_geraet, breite, hoehe, zeiger, art) => {
    expect(deviceClassFromEnvironment(umgebung(breite, hoehe, zeiger))).toBe(art);
  });

  it('Grenze: kürzere Seite 599 → Handy, 600 → nach Zeiger; feiner Zeiger schlägt die Seite', () => {
    expect(deviceClassFromScreen(599, 'coarse')).toBe('handy');
    expect(deviceClassFromScreen(599, 'unknown')).toBe('handy');
    expect(deviceClassFromScreen(599, 'fine')).toBe('gross');
    expect(deviceClassFromScreen(600, 'coarse')).toBe('tablet');
    expect(deviceClassFromScreen(600, 'unknown')).toBe('gross');
    expect(deviceClassFromScreen(600, 'fine')).toBe('gross');
  });

  it('Gegenbeispiel: nichts lesbar (keine Maße, werfende matchMedia) → groß, kein Fehler', () => {
    expect(deviceClassFromEnvironment({})).toBe('gross');
    expect(deviceClassFromEnvironment({ screenWidth: 800, screenHeight: 1200, matchMedia: () => { throw new Error('x'); } })).toBe('gross');
    expect(deviceClassFromEnvironment({ screenWidth: 390, screenHeight: 844, matchMedia: () => { throw new Error('x'); } })).toBe('handy');
  });
});

describe('@RZ-024 „installiert“ nur bei Start vom Startbildschirm', () => {
  it('Anzeigeart standalone → ja', () => {
    expect(isInstalledApp({ matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' }) })).toBe(true);
  });
  it('iOS navigator.standalone → ja', () => {
    expect(isInstalledApp({ navigatorStandalone: true })).toBe(true);
  });
  it('Gegenbeispiel: Browser-Tab, fehlende oder werfende matchMedia → nein', () => {
    expect(isInstalledApp({ matchMedia: () => ({ matches: false }) })).toBe(false);
    expect(isInstalledApp({ navigatorStandalone: false })).toBe(false);
    expect(isInstalledApp({})).toBe(false);
    expect(isInstalledApp({ matchMedia: () => { throw new Error('kaputt'); } })).toBe(false);
  });
});

describe('@RZ-026 Das Zählen stört nie', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('Server antwortet nicht: nach 10 Sekunden ist die Sendung beendet und abgebrochen, ohne Fehler', async () => {
    let signal: AbortSignal | undefined;
    const transport: ViewCountTransport = (_args, s) => { signal = s; return new Promise(() => undefined); };
    let fertig = false;
    void sendViewCount(transport, ARGS).then(() => { fertig = true; });
    await vi.advanceTimersByTimeAsync(VIEW_COUNT_TIMEOUT_MS - 1);
    expect(fertig).toBe(false);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(fertig).toBe(true);
    expect(signal?.aborted).toBe(true);
  });

  it('Server lehnt ab oder wirft: verschluckt, genau ein Versuch, kein Wiederholen', async () => {
    const wirft = vi.fn<ViewCountTransport>(() => Promise.reject(new Error('404')));
    await expect(sendViewCount(wirft, ARGS)).resolves.toBeUndefined();
    const sofort = vi.fn<ViewCountTransport>(() => { throw new Error('synchron'); });
    await expect(sendViewCount(sofort, ARGS)).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(5 * VIEW_COUNT_TIMEOUT_MS);
    expect(wirft).toHaveBeenCalledTimes(1);
    expect(sofort).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: schnelle Antwort bricht nichts ab und räumt den Zeitgeber auf', async () => {
    let signal: AbortSignal | undefined;
    await sendViewCount((_a, s) => { signal = s; return Promise.resolve({ ok: true }); }, ARGS);
    expect(vi.getTimerCount()).toBe(0);
    expect(signal?.aborted).toBe(false);
  });

  it('der Sender gibt die Felder unverändert weiter – genau fünf', async () => {
    const transport = vi.fn<ViewCountTransport>(() => Promise.resolve(null));
    await sendViewCount(transport, ARGS);
    expect(transport.mock.calls[0][0]).toEqual(ARGS);
    expect(Object.keys(transport.mock.calls[0][0]).sort()).toEqual(['p_art', 'p_geraet', 'p_installiert', 'p_kanal', 'p_share_code']);
  });
});
