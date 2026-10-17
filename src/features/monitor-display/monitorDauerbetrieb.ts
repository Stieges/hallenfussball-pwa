/**
 * Monitor-Dauerbetrieb (B-17): Regeln für Tasten, Mauszeiger, Vollbild und Browser-Quelle.
 *
 * React-frei. Die Hooks dazu liegen in useMonitorDauerbetrieb.ts.
 *
 * @see docs/anforderungen/2026-10-03_monitor-einrichten.md (@ME-002, @ME-003, @ME-005, @ME-006, @ME-022)
 */

import type { WakeLockStatus } from '../../hooks/useWakeLock';
import { SPIELPLAN_FALLBACK_SLIDE } from './slideProgramme';

/** Der Mauszeiger verschwindet nach so vielen Millisekunden ohne Bewegung (@ME-002: „nach wenigen Sekunden“). */
export const MAUSZEIGER_RUHE_MS = 3_000;

/** Taste für Vollbild (@ME-002). Ohne Strg/Cmd/Alt. */
export const VOLLBILD_TASTE = 'f';

/** Der Hinweis zur Energiespar-Einstellung bleibt so lange in der Ecke, dann verschwindet er (@ME-006). */
export const WAKE_LOCK_HINWEIS_MS = 10_000;

/**
 * Folien, auf denen der Hinweis stehen darf (@ME-006): die Ersatzfolien, solange kein Folienprogramm eingerichtet ist
 * (Zuschauer-QR bei öffentlichem Turnier, sonst Spielplan), und eine QR-Folie aus dem Programm. Nicht auf Text-, Spielplan-,
 * Tabellen-, Sponsor- und Live-Folien des Programms. `programm` sind die darstellbaren Folien des Monitors: nur was zu ihnen
 * gehört, zählt (der Rückfall einer Live-Folie ohne Spiel gehört nicht dazu, dort ist ein Programm eingerichtet).
 */
export function istHinweisFolie(folie: { type: string } | null, programm: readonly unknown[]): boolean {
  if (folie === null || !programm.includes(folie)) { return false; }
  return folie.type === 'qr-code' || folie === SPIELPLAN_FALLBACK_SLIDE;
}

/**
 * Braucht der Zustand der Zusage den Hinweis? Ja bei Ablehnung, fehlender Schnittstelle und 5 s ohne Antwort
 * (@ME-006). Eine später zurückgenommene Zusage (`released`) zeigt am Monitor nichts, das sieht nur die Verwaltung.
 */
export function wakeLockHinweisNoetig(status: WakeLockStatus): boolean {
  return status === 'denied' || status === 'unsupported' || status === 'noAnswer';
}

/**
 * Tasten, die die Monitor-Seite nie verlassen oder ungewollt anhalten (@ME-003, @ME-022).
 * Escape ist dabei nur ein Eintrag: Es beendet ausschließlich das Vollbild, und das macht der Browser selbst.
 * Die Seite selbst reagiert auf Escape nicht (kein Zurückspringen zur Startseite).
 */
const ABGEFANGENE_TASTEN: ReadonlySet<string> = new Set([
  'Escape',
  'Backspace',
  ' ',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  // Zurück/Vor auf Fernbedienungen und Maustasten (B-17 Fixrunde 2)
  'BrowserBack',
  'BrowserForward',
]);

/** Mac-Weg zurück und vor: Cmd+[ und Cmd+] (B-17 Fixrunde 2). */
const MAC_NAVIGATION_TASTEN: ReadonlySet<string> = new Set(['[', ']']);

/** Soll die Seite diese Taste abfangen (Standardaktion unterdrücken), damit sie nichts auslöst? */
export function istAbgefangeneTaste(key: string): boolean {
  return ABGEFANGENE_TASTEN.has(key);
}

/**
 * Fängt den Tastendruck ab, der die Seite verlassen würde: die Liste oben, dazu Cmd+[ und Cmd+].
 * Cmd+F, Strg+F und andere Kombinationen gehören weiter dem Browser.
 */
export function istAbgefangenerTastendruck(e: Pick<KeyboardEvent, 'key' | 'metaKey'>): boolean {
  if (istAbgefangeneTaste(e.key)) { return true; }
  return e.metaKey && MAC_NAVIGATION_TASTEN.has(e.key);
}

/** Taste für die Cache-Anzeige (@ME-021): „c“ ohne Strg/Cmd/Alt und ohne Autowiederholung. */
export const CACHE_TASTE = 'c';

export function istCacheTaste(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'repeat'>): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) { return false; }
  return e.key.toLowerCase() === CACHE_TASTE;
}

/**
 * Ist das Ziel ein Eingabefeld? Dort gehören Tasten dem Feld, nicht der Seite (B-17 Review M1).
 */
export function istEingabeZiel(ziel: EventTarget | null): boolean {
  if (!(ziel instanceof HTMLElement)) { return false; }
  if (ziel.isContentEditable || ziel.getAttribute('contenteditable') === 'true') { return true; }
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(ziel.tagName);
}

/** Löst eine Taste das Vollbild aus? Mit Strg, Cmd oder Alt bleibt sie dem Browser (z. B. Suche). */
export function istVollbildTaste(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'repeat'>): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) { return false; }
  return e.key.toLowerCase() === VOLLBILD_TASTE;
}

/**
 * Läuft die Seite als Browser-Quelle der Übertragungs-Software? Dort erscheint kein Hinweis, denn der Rechner
 * steuert den Bildschirm selbst (@ME-006). Erkennung: die feste Adresse `/tv` (B-21, Hash-Router) oder eine
 * OBS-Kennung im User-Agent. Vorläufig, bis die Adresse `/tv` gebaut ist.
 */
export function istBrowserQuelle(hash: string, userAgent: string): boolean {
  return /^#\/tv\/?$/.test(hash) || /\bOBS\b/i.test(userAgent);
}
