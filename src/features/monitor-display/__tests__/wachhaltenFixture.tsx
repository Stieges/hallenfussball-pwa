/**
 * Gemeinsame Helfer der Wachhalten-Tests (B-48a, Variante B): Turnier-Fixtures, Wake-Lock-Mocks, Seite rendern.
 * Die Mocks der Datenquellen stehen in den Test-Dateien (vi.mock dort gilt für alle Importe dieser Datei).
 */
import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import type { Tournament } from '../../../types/tournament';
import { attachMonitor, buildTournament, slide, withMonitor } from './monitorFixture';
import { MonitorDisplayPage } from '../MonitorDisplayPage';

/** Die Test-Umgebung liefert den Schlüssel als Text (src/test/setup.ts); der DE/EN-Wortlaut steht im JSON-Test unten. */
export const HINWEIS = 'monitor:dauerbetrieb.wakeLockHint';

/** Zwei Folien ohne Live-Folie: auf ihnen läuft nie ein Spiel, der Hinweis ist also beim Start fällig. */
export function monitorTurnier(folien = [
  slide('custom-text', { headline: 'Folie A' }, 4),
  slide('custom-text', { headline: 'Folie B' }),
]): Tournament {
  return attachMonitor(buildTournament(), withMonitor({ slides: folien }));
}

/** Live-Folie auf Feld 1, auf dem Spiel 7 läuft (Gruppe A), danach eine Textfolie. */
export function liveTurnier(): Tournament {
  return monitorTurnier([
    slide('live', { fieldId: 'field-1' }, 30),
    slide('custom-text', { headline: 'Folie B' }),
  ]);
}

/** Wie liveTurnier, aber Spiel 7 ist noch geplant: beim Start läuft auf Feld 1 nichts. */
export function liveTurnierOhneSpiel(): Tournament {
  const t = liveTurnier();
  return { ...t, matches: t.matches.map(m => (m.id === 'match-7' ? { ...m, matchStatus: 'scheduled' as const } : m)) };
}

export function wakeLockUnterstuetzt(): void {
  const request = vi.fn().mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn(), removeEventListener: vi.fn() });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
}

export function wakeLockFehlt(): void {
  Reflect.deleteProperty(navigator, 'wakeLock');
}

/** Die Anfrage zum Anlassen bleibt unbeantwortet (LG webOS). */
export function wakeLockHaengt(): void {
  const request = vi.fn().mockReturnValue(new Promise(() => undefined));
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
}

export function wakeLockAbgelehnt(): void {
  const request = vi.fn().mockRejectedValue(Object.assign(new Error('nicht erlaubt'), { name: 'NotAllowedError' }));
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
}

export async function vorspulen(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

export function seite() {
  return render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
}

export const hinweis = () => screen.queryByTestId('monitor-wakelock-hint');
export const kopfzeile = () => screen.queryByTestId('live-header');

/**
 * @ME-006, Beispielzeilen wörtlich: „der Browser lässt das Anlassen des Bildschirms nicht zu“ und „der Browser
 * beantwortet die Anfrage zum Anlassen des Bildschirms 5 Sekunden lang weder mit Ja noch mit Nein“.
 */
export const LAGEN: ReadonlyArray<readonly [string, () => void, number]> = [
  ['der Browser lässt das Anlassen des Bildschirms nicht zu', wakeLockAbgelehnt, 0],
  ['der Browser beantwortet die Anfrage 5 Sekunden lang weder mit Ja noch mit Nein', wakeLockHaengt, 5_000],
];

/** Hex-Farbe so, wie jsdom sie im Stil ausgibt (rgb). */
export const alsRgb = (hex: string): string => {
  const el = document.createElement('span');
  el.style.color = hex;
  return el.style.color;
};
