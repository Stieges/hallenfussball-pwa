/**
 * Wachhalten-Hinweis der Monitor-Seite (B-48a, Variante B): „Bildschirm kann ausgehen – Energiesparen prüfen“ @ME-006, Gegenbeispiele @ME-006 und @ME-064 (Verwaltung, nicht hier).
 * Der Hinweis erscheint nur beim Start auf Folien ohne laufendes Spiel, 10 Sekunden lang, als Ecke oben rechts; startet
 * während der 10 Sekunden ein Spiel, verschwindet er sofort. Nie auf der Live-Folie mit Spiel, nie in der Browser-Quelle,
 * nie nach einer Zusage.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import deMonitor from '../../../i18n/locales/de/monitor.json';
import enMonitor from '../../../i18n/locales/en/monitor.json';
import { attachMonitor, buildTournament, slide, withMonitor } from './monitorFixture';
import { monitorThemes } from '../../../design-tokens';
import { getContrastRatio } from '../../../design-tokens/display';
import {
  monitorTurnier,
  wakeLockUnterstuetzt,
  wakeLockFehlt,
  wakeLockHaengt,
  wakeLockAbgelehnt,
  vorspulen,
  seite,
  hinweis,
  alsRgb,
} from './wachhaltenFixture';

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
});

describe('Browser-Quelle und Zusage: nie ein Hinweis (@ME-006)', () => {
  it('Gegenbeispiel: in der Browser-Quelle (/tv) erscheint auch nach 5 Sekunden ohne Antwort kein Hinweis', async () => {
    wakeLockHaengt();
    window.history.replaceState(null, '', '/#/tv');
    seite();
    await vorspulen(0);
    await vorspulen(6_000);
    expect(hinweis()).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: in der Browser-Quelle mit OBS-Kennung im Benutzeragenten erscheint kein Hinweis', async () => {
    const original = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', { value: `${original} OBS/30.0`, configurable: true });
    try {
      wakeLockAbgelehnt();
      seite();
      await vorspulen(0);
      await vorspulen(6_000);
      expect(hinweis()).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, 'userAgent', { value: original, configurable: true });
    }
  });

  it.each(['dark', 'light'] as const)('Thema „%s“: die Ecke trägt Farben und Rahmen dieses Themas, das Symbol hält 3 : 1', async (thema) => {
    wakeLockAbgelehnt();
    localGet.mockResolvedValue(attachMonitor(buildTournament(), withMonitor({ theme: thema, slides: [slide('qr-code', {}, 30)] })));
    seite();
    await vorspulen(0);
    const farben = monitorThemes[thema];
    expect(hinweis()?.style.color).toBe(alsRgb(farben.text));
    const symbol = hinweis()?.querySelector('svg') as SVGElement;
    const symbolHex = [farben.warningSymbol].find((c) => symbol.style.color === alsRgb(c));
    expect(symbolHex, 'Symbolfarbe aus dem Thema').toBeDefined();
    expect(getContrastRatio(symbolHex!, farben.background), 'Symbol mindestens 3 : 1').toBeGreaterThanOrEqual(3);
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
    expect(hinweis()).toBeInTheDocument();

    act(() => { window.dispatchEvent(new Event('pointerdown')); });
    await vorspulen(0);
    expect(request).toHaveBeenCalledTimes(2);
    expect(hinweis()).not.toBeInTheDocument();
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

describe('W4 und Wortlaut (@ME-006, i18n)', () => {
  it('der Hinweis erscheint nach Ablauf nie wieder, auch nicht nach Lade- oder Fehlerzustand', async () => {
    wakeLockAbgelehnt();
    seite();
    await vorspulen(0);
    await vorspulen(10_000);
    expect(hinweis()).not.toBeInTheDocument();

    localGet.mockResolvedValue(null);
    await vorspulen(30_000);
    expect(screen.getByTestId('monitor-error-state')).toBeInTheDocument();

    localGet.mockResolvedValue(monitorTurnier());
    await vorspulen(30_000);
    expect(hinweis()).not.toBeInTheDocument();
  });

  it('@ME-006 Wortlaut: der deutsche Hinweis ist der Text des Szenarios, eine Zeile', () => {
    expect(deMonitor.dauerbetrieb.wakeLockHint).toBe('Bildschirm kann ausgehen – Energiesparen prüfen');
    expect(deMonitor.dauerbetrieb.wakeLockHint).not.toMatch(/\n/);
  });

  it('DE und EN haben den Schlüssel dauerbetrieb.wakeLockHint mit Text, EN sinngemäß', () => {
    expect(deMonitor.dauerbetrieb.wakeLockHint).toMatch(/Energiesparen/);
    expect(enMonitor.dauerbetrieb.wakeLockHint).toBe('Screen may turn off – check power saving');
  });
});
