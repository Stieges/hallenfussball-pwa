/**
 * Monitor-Seite im Dauerbetrieb (B-17): Mauszeiger, Vollbild-Taste, Tasten, Wake-Lock-Hinweis.
 * Gegenbeispiele: Escape und Leertaste verlassen die Seite nicht; der Hinweis erscheint nie in der Browser-Quelle.
 * Szenarien: @ME-002, @ME-003, @ME-005, @ME-006, @ME-022.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import deMonitor from '../../../i18n/locales/de/monitor.json';
import enMonitor from '../../../i18n/locales/en/monitor.json';
import { attachMonitor, buildTournament, slide, withMonitor } from './monitorFixture';

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

function monitorTurnier(): Tournament {
  return attachMonitor(buildTournament(), withMonitor({
    slides: [slide('custom-text', { headline: 'Folie A' }), slide('custom-text', { headline: 'Folie B' })],
  }));
}

function wakeLockUnterstuetzt(): ReturnType<typeof vi.fn> {
  const request = vi.fn().mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn(), removeEventListener: vi.fn() });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  return request;
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
  const wurzel = (): HTMLElement => container.firstElementChild as HTMLElement;
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

describe('Tasten verlassen die Seite nicht (@ME-003, @ME-022)', () => {
  it('Escape: die Seite bleibt offen, zeigt weiter die Folie, und nichts springt zur Startseite', async () => {
    const { onBack } = seite();
    await vorspulen(0);
    const e = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    act(() => { window.dispatchEvent(e); });
    expect(onBack).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(true);
    expect(screen.getByText('Folie A')).toBeInTheDocument();
  });

  it('Escape im Vollbild: die Seite beendet nur das Vollbild und bleibt offen', async () => {
    Object.defineProperty(document, 'fullscreenElement', { value: document.documentElement, configurable: true });
    const { onBack } = seite();
    await vorspulen(0);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByText('Folie A')).toBeInTheDocument();
    Reflect.deleteProperty(document, 'fullscreenElement');
  });

  it('Leertaste hält die Folie an, verlässt die Seite aber nicht', async () => {
    const { onBack } = seite();
    await vorspulen(0);
    const e = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    act(() => { window.dispatchEvent(e); });
    expect(onBack).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(true);
    expect(screen.getByTestId('monitor-pause-indicator')).toBeInTheDocument();
  });

  it('Backspace und Pfeiltasten verlassen die Seite nicht', async () => {
    const { onBack } = seite();
    await vorspulen(0);
    for (const key of ['Backspace', 'ArrowRight', 'ArrowLeft']) {
      const e = new KeyboardEvent('keydown', { key, cancelable: true });
      act(() => { window.dispatchEvent(e); });
      expect(e.defaultPrevented, key).toBe(true);
    }
    expect(onBack).not.toHaveBeenCalled();
  });
});

describe('Bildschirm bleibt an, Hinweis nur im normalen Browser (@ME-005, @ME-006)', () => {
  it('ohne Wake Lock erscheint der Hinweis einmal und verschwindet nach 10 Sekunden', async () => {
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

  it('der Hinweis blockiert nicht: das Folienprogramm läuft weiter', async () => {
    wakeLockFehlt();
    seite();
    await vorspulen(0);
    expect(screen.getByText('Folie A')).toBeInTheDocument();
  });
});

describe('Hinweis-Text in beiden Sprachen (@ME-006, i18n)', () => {
  it('DE und EN haben den Schlüssel dauerbetrieb.wakeLockHint mit Text', () => {
    expect(deMonitor.dauerbetrieb.wakeLockHint).toMatch(/Energiespar/);
    expect(enMonitor.dauerbetrieb.wakeLockHint).toMatch(/power-saving/);
  });
});
