/**
 * Monitor-Seite im Dauerbetrieb (B-17 + Fixrunde 1): Mauszeiger, Vollbild-Taste, Tasten, Hinweis, Bildrand.
 * Szenarien: @ME-002, @ME-003, @ME-005, @ME-006, @ME-019, @ME-020, @ME-021, @ME-022, @ZM-130.
 * Gegenbeispiele: Leertaste und Pfeile wirken nicht (@ME-022); Escape verlässt die Seite nicht; der Hinweis erscheint
 * nie in der Browser-Quelle und höchstens einmal je Seite.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { PERFORMANCE_PROFILES } from '../../../types/monitor';
import deMonitor from '../../../i18n/locales/de/monitor.json';
import enMonitor from '../../../i18n/locales/en/monitor.json';
import { attachMonitor, buildTournament, slide, withMonitor } from './monitorFixture';
import { SlideRenderer } from '../slides/SlideRenderer';

const { supabaseGet, localGet } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({}) })), rpc: vi.fn().mockResolvedValue({ error: null }) },
}));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { get: supabaseGet }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: localGet }; }),
}));
vi.mock('qrcode.react', async () => {
  const React = await import('react');
  return {
    QRCodeSVG: ({ value }: { value: string }) => React.createElement('svg', { 'data-testid': 'qr-code', 'data-value': value }),
  };
});
vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({
    liveMatches: new Map(), runningMatches: [], pausedMatches: [], runningMatchIds: new Set<string>(),
    getMatchById: () => undefined, lastGoalEvent: null, clearLastGoalEvent: vi.fn(),
    lastCardEvent: null, clearLastCardEvent: vi.fn(), calculateElapsedSeconds: () => 0,
  }),
}));

import { MonitorDisplayPage } from '../MonitorDisplayPage';

/** Die Test-Umgebung liefert den Schlüssel als Text (src/test/setup.ts); der DE/EN-Wortlaut steht im JSON-Test unten. */
const HINWEIS = 'monitor:dauerbetrieb.wakeLockHint';

function monitorTurnier(overscanPx?: number, folien = [
  slide('custom-text', { headline: 'Folie A' }, 4),
  slide('custom-text', { headline: 'Folie B' }),
]): Tournament {
  return attachMonitor(buildTournament(), withMonitor({ slides: folien, ...(overscanPx !== undefined ? { overscanPx } : {}) }));
}

function wakeLockUnterstuetzt(): void {
  const request = vi.fn().mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn(), removeEventListener: vi.fn() });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
}

function wakeLockFehlt(): void {
  Reflect.deleteProperty(navigator, 'wakeLock');
}

async function vorspulen(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

/** Rendert die Seite. `wurzel()` liefert den Rahmen der geladenen Seite (erst nach dem Laden gültig). */
function seite(onBack = vi.fn()) {
  const { container } = render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={onBack} />);
  const wurzel = (): HTMLElement => container.querySelector('[lang="de"] > div')!;
  return { onBack, wurzel };
}

beforeEach(() => {
  vi.clearAllMocks();
  supabaseGet.mockResolvedValue(null);
  localGet.mockResolvedValue(monitorTurnier());
  wakeLockUnterstuetzt();
  window.history.replaceState(null, '', '/#/display/tour-1/mon-1');
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
  wakeLockFehlt();
  Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
  Reflect.deleteProperty(document, 'fullscreenElement');
});

describe('Mauszeiger (@ME-002)', () => {
  it('blendet den Mauszeiger nach Ruhe aus', async () => {
    const { wurzel } = seite();
    await vorspulen(0);
    expect(wurzel().style.cursor).not.toBe('none');
    await vorspulen(3_000);
    expect(wurzel().style.cursor).toBe('none');
  });

  it('Gegenbeispiel: eine Mausbewegung zeigt den Mauszeiger wieder', async () => {
    const { wurzel } = seite();
    await vorspulen(3_000);
    expect(wurzel().style.cursor).toBe('none');
    fireEvent.mouseMove(window);
    expect(wurzel().style.cursor).not.toBe('none');
  });
});

describe('Vollbild per Taste „f“ (@ME-002)', () => {
  it('„f“ fordert das Vollbild der Seite an', async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, 'requestFullscreen', { value: request, configurable: true });
    seite();
    await vorspulen(0);
    fireEvent.keyDown(window, { key: 'f' });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: Strg+f lässt dem Browser die Suche und fordert kein Vollbild an', async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, 'requestFullscreen', { value: request, configurable: true });
    seite();
    await vorspulen(0);
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    expect(request).not.toHaveBeenCalled();
  });
});

describe('Tasten ohne Wirkung und ohne Verlassen der Seite (@ME-022, @ME-003)', () => {
  // Record monitor-einrichten Z. 175–177: „Leertaste und Pfeiltasten halten das Folienprogramm nicht mehr an und
  // schalten nicht weiter.“ Vorher hielt die Leertaste an und schalteten die Pfeile weiter (Gegenbeispiel zum Soll).

  it('Escape: die Seite bleibt offen, zeigt weiter die Folie, und nichts springt zur Startseite', async () => {
    const { onBack } = seite();
    await vorspulen(0);
    const e = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    act(() => { window.dispatchEvent(e); });
    expect(onBack).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(true);
    expect(screen.getByText('Folie A')).toBeInTheDocument();
  });

  it('Escape bei gesetztem fullscreenElement: die Seite bleibt offen (der Browser beendet nur das Vollbild)', async () => {
    Object.defineProperty(document, 'fullscreenElement', { value: document.documentElement, configurable: true });
    const { onBack } = seite();
    await vorspulen(0);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByText('Folie A')).toBeInTheDocument();
  });

  it('Leertaste verlässt die Seite nicht, hält nichts an und zeigt kein Pausen-Badge', async () => {
    const { onBack } = seite();
    await vorspulen(0);
    const e = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    act(() => { window.dispatchEvent(e); });
    expect(onBack).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(true);
    expect(screen.queryByTestId('monitor-pause-indicator')).not.toBeInTheDocument();
    await vorspulen(4_000);
    expect(screen.getByText('Folie B')).toBeInTheDocument();
  });

  it('Backspace und Pfeiltasten verlassen die Seite nicht und schalten nicht weiter', async () => {
    const { onBack } = seite();
    await vorspulen(0);
    for (const key of ['Backspace', 'ArrowRight', 'ArrowLeft']) {
      const e = new KeyboardEvent('keydown', { key, cancelable: true });
      act(() => { window.dispatchEvent(e); });
      expect(e.defaultPrevented, key).toBe(true);
    }
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByText('Folie A')).toBeInTheDocument();
  });

  it('Gegenbeispiel: in einem Eingabefeld gehören Leertaste und Pfeile dem Feld, „f“ löst kein Vollbild aus', async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, 'requestFullscreen', { value: request, configurable: true });
    seite();
    await vorspulen(0);
    const feld = document.createElement('input');
    document.body.appendChild(feld);
    const leer = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
    act(() => { feld.dispatchEvent(leer); });
    expect(leer.defaultPrevented).toBe(false);
    fireEvent.keyDown(feld, { key: 'f' });
    expect(request).not.toHaveBeenCalled();
    feld.remove();
  });
});

describe('Taste „c“: Cache-Anzeige (@ME-021)', () => {
  it('„c“ blendet die Anzeige ein, ein zweiter Druck blendet sie aus', async () => {
    seite();
    await vorspulen(0);
    expect(screen.queryByTestId('monitor-cache-indicator')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'c' });
    expect(screen.getByTestId('monitor-cache-indicator')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'c' });
    expect(screen.queryByTestId('monitor-cache-indicator')).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: Strg+c, Cmd+c, Alt+c und gehaltenes „c“ schalten die Anzeige nicht um', async () => {
    seite();
    await vorspulen(0);
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'c', metaKey: true });
    fireEvent.keyDown(window, { key: 'c', altKey: true });
    fireEvent.keyDown(window, { key: 'c', repeat: true });
    expect(screen.queryByTestId('monitor-cache-indicator')).not.toBeInTheDocument();
  });
});

/** Die Anfrage zum Anlassen bleibt unbeantwortet (LG webOS). */
function wakeLockHaengt(): void {
  const request = vi.fn().mockReturnValue(new Promise(() => undefined));
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
}

function wakeLockAbgelehnt(): void {
  const request = vi.fn().mockRejectedValue(Object.assign(new Error('nicht erlaubt'), { name: 'NotAllowedError' }));
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
}

/**
 * @ME-006, Beispielzeilen wörtlich: „der Browser lässt das Anlassen des Bildschirms nicht zu“ und „der Browser
 * beantwortet die Anfrage zum Anlassen des Bildschirms 5 Sekunden lang weder mit Ja noch mit Nein“.
 */
const LAGEN: ReadonlyArray<readonly [string, () => void, number]> = [
  ['der Browser lässt das Anlassen des Bildschirms nicht zu', wakeLockAbgelehnt, 0],
  ['der Browser beantwortet die Anfrage 5 Sekunden lang weder mit Ja noch mit Nein', wakeLockHaengt, 5_000],
];

describe('Bildschirm bleibt an, Hinweis nur im normalen Browser (@ME-005, @ME-006)', () => {
  it.each(LAGEN)('@ME-006 Lage „%s“: Hinweis oben rechts, nach 10 Sekunden von selbst weg, Folienprogramm läuft', async (_lage, einrichten, wartezeit) => {
    einrichten();
    seite();
    // Die 5 Sekunden laufen ab der Anfrage; die Anfrage stellt die Seite, sobald der Monitor geladen ist.
    await vorspulen(0);
    await vorspulen(wartezeit);
    const hinweis = screen.getByTestId('monitor-wakelock-hint');
    expect(hinweis).toHaveTextContent(HINWEIS);
    // Lage aus dem aufgelösten Stil: oben und rechts, nicht unten (unten steht die Schiedsrichter-Zeile)
    expect(hinweis.style.top).not.toBe('');
    expect(hinweis.style.right).not.toBe('');
    expect(hinweis.style.bottom).toBe('');
    await vorspulen(10_000 - 1);
    expect(screen.getByTestId('monitor-wakelock-hint')).toBeInTheDocument();
    await vorspulen(1);
    expect(screen.queryByTestId('monitor-wakelock-hint')).not.toBeInTheDocument();
    expect(screen.getByText('Folie B')).toBeInTheDocument();
  });

  it('@ME-006 Gegenbeispiel: vor Ablauf der 5 Sekunden ohne Antwort erscheint noch kein Hinweis', async () => {
    wakeLockHaengt();
    seite();
    await vorspulen(0);
    await vorspulen(4_999);
    expect(screen.queryByTestId('monitor-wakelock-hint')).not.toBeInTheDocument();
  });

  it('@ME-006 Gegenbeispiel: antwortet der Browser nach 4,9 Sekunden mit Ja, erscheint nie ein Hinweis', async () => {
    let zusagen: (s: unknown) => void = () => undefined;
    const request = vi.fn().mockReturnValue(new Promise((res) => { zusagen = res; }));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    seite();
    await vorspulen(0);
    await vorspulen(4_900);
    zusagen({ release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn(), removeEventListener: vi.fn() });
    await vorspulen(10_000);
    expect(screen.queryByTestId('monitor-wakelock-hint')).not.toBeInTheDocument();
  });

  it('@ME-006: nimmt der Browser eine Zusage später zurück (release), zeigt der Monitor keinen Hinweis', async () => {
    const sentinel = { release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const request = vi.fn().mockResolvedValue(sentinel);
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    seite();
    await vorspulen(0);
    const freigabe = sentinel.addEventListener.mock.calls.find(([name]) => name === 'release')?.[1] as () => void;
    act(() => { freigabe(); });
    await vorspulen(1_000);
    expect(screen.queryByTestId('monitor-wakelock-hint')).not.toBeInTheDocument();
  });

  it('@ME-006 Gegenbeispiel: in der Browser-Quelle (/tv) erscheint auch nach 5 Sekunden ohne Antwort kein Hinweis', async () => {
    wakeLockHaengt();
    window.history.replaceState(null, '', '/#/tv');
    seite();
    await vorspulen(0);
    await vorspulen(6_000);
    expect(screen.queryByTestId('monitor-wakelock-hint')).not.toBeInTheDocument();
  });

  it('ohne Wake Lock erscheint der Hinweis und verschwindet nach 10 Sekunden', async () => {
    wakeLockFehlt();
    seite();
    await vorspulen(0);
    expect(screen.getByTestId('monitor-wakelock-hint')).toHaveTextContent(HINWEIS);
    await vorspulen(10_000);
    expect(screen.queryByTestId('monitor-wakelock-hint')).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: mit Wake Lock erscheint kein Hinweis', async () => {
    seite();
    await vorspulen(0);
    expect(screen.queryByTestId('monitor-wakelock-hint')).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: in der Browser-Quelle (/tv) erscheint der Hinweis nie', async () => {
    wakeLockFehlt();
    window.history.replaceState(null, '', '/#/tv');
    seite();
    await vorspulen(0);
    expect(screen.queryByTestId('monitor-wakelock-hint')).not.toBeInTheDocument();
    expect(screen.getByText('Folie A')).toBeInTheDocument();
  });

  it('der Hinweis blockiert nicht: Folie B kommt bei sichtbarem Hinweis', async () => {
    wakeLockFehlt();
    seite();
    await vorspulen(0);
    expect(screen.getByText('Folie A')).toBeInTheDocument();
    await vorspulen(4_000);
    expect(screen.getByText('Folie B')).toBeInTheDocument();
    expect(screen.getByTestId('monitor-wakelock-hint')).toBeInTheDocument();
  });

  it('W4: der Hinweis erscheint nach Ablauf nie wieder, auch nicht nach Lade- oder Fehlerzustand', async () => {
    wakeLockFehlt();
    seite();
    await vorspulen(0);
    await vorspulen(10_000);
    expect(screen.queryByTestId('monitor-wakelock-hint')).not.toBeInTheDocument();

    localGet.mockResolvedValue(null);
    await vorspulen(30_000);
    expect(screen.getByTestId('monitor-error-state')).toBeInTheDocument();

    localGet.mockResolvedValue(monitorTurnier());
    await vorspulen(30_000);
    expect(screen.getByText('Folie A')).toBeInTheDocument();
    expect(screen.queryByTestId('monitor-wakelock-hint')).not.toBeInTheDocument();
  });
});

describe('Bildrand je Monitor (@ME-020)', () => {
  const folie = () => slide('custom-text', { headline: 'Rand' });
  const rendere = (overscanPx: number) => render(
    <SlideRenderer
      slide={folie()}
      tournament={buildTournament()}
      performanceSettings={PERFORMANCE_PROFILES.high}
      theme="dark"
      overscanPx={overscanPx}
    />,
  );

  it('ein gesetzter Bildrand wirkt als Innenabstand der Folie', () => {
    const { container } = rendere(60);
    expect((container.firstElementChild as HTMLElement).style.padding).toBe('60px');
  });

  it('Gegenbeispiel: Bildrand 0 lässt keinen Rand stehen', () => {
    const { container } = rendere(0);
    expect((container.firstElementChild as HTMLElement).style.padding).toBe('0px');
  });
});

describe('Vollbild ohne Standard-API und Mac-Navigation (B-17 Fixrunde 2)', () => {
  it('„f“ wirft ohne Vollbild-API nichts', async () => {
    Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
    Reflect.deleteProperty(document.documentElement, 'webkitRequestFullscreen');
    seite();
    await vorspulen(0);
    expect(() => fireEvent.keyDown(window, { key: 'f' })).not.toThrow();
  });

  it('„f“ nutzt den webkit-Rückfall, wenn die Standard-API fehlt', async () => {
    Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
    const webkit = vi.fn();
    Object.defineProperty(document.documentElement, 'webkitRequestFullscreen', { value: webkit, configurable: true });
    seite();
    await vorspulen(0);
    fireEvent.keyDown(window, { key: 'f' });
    expect(webkit).toHaveBeenCalledTimes(1);
    Reflect.deleteProperty(document.documentElement, 'webkitRequestFullscreen');
  });

  it('Cmd+[ verlässt die Seite nicht (Mac-Weg zurück)', async () => {
    const { onBack } = seite();
    await vorspulen(0);
    const e = new KeyboardEvent('keydown', { key: '[', metaKey: true, cancelable: true });
    act(() => { window.dispatchEvent(e); });
    expect(e.defaultPrevented).toBe(true);
    expect(onBack).not.toHaveBeenCalled();
  });
});

describe('Wake Lock nach der ersten Eingabe (B-17 Fixrunde 2)', () => {
  it('schlägt die erste Anfrage fehl, fordert die erste Eingabe sie erneut an und der Hinweis verschwindet', async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(new Error('NotAllowedError'))
      .mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn(), removeEventListener: vi.fn() });
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    seite();
    await vorspulen(0);
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('monitor-wakelock-hint')).toBeInTheDocument();

    act(() => { window.dispatchEvent(new Event('pointerdown')); });
    await vorspulen(0);
    expect(request).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('monitor-wakelock-hint')).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: gelingt die erste Anfrage, gibt es keine zweite', async () => {
    const request = vi.fn().mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn(), removeEventListener: vi.fn() });
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    seite();
    await vorspulen(0);
    act(() => { window.dispatchEvent(new Event('pointerdown')); });
    await vorspulen(0);
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe('Hinweis-Text in beiden Sprachen (@ME-006, i18n)', () => {
  it('DE und EN haben den Schlüssel dauerbetrieb.wakeLockHint mit Text', () => {
    expect(deMonitor.dauerbetrieb.wakeLockHint).toMatch(/Energiespar/);
    expect(enMonitor.dauerbetrieb.wakeLockHint).toMatch(/power-saving/);
  });
});
