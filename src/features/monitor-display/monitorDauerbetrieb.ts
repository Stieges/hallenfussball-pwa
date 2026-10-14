/**
 * Monitor-Dauerbetrieb (B-17): Regeln für Tasten, Mauszeiger, Vollbild und Browser-Quelle.
 *
 * React-frei. Die Hooks dazu liegen in useMonitorDauerbetrieb.ts.
 *
 * @see docs/anforderungen/2026-10-03_monitor-einrichten.md (@ME-002, @ME-003, @ME-005, @ME-006, @ME-022)
 */

/** Der Mauszeiger verschwindet nach so vielen Millisekunden ohne Bewegung (@ME-002: „nach wenigen Sekunden“). */
export const MAUSZEIGER_RUHE_MS = 3_000;

/** Taste für Vollbild (@ME-002). Ohne Strg/Cmd/Alt. */
export const VOLLBILD_TASTE = 'f';

/** Der Hinweis zur Energiespar-Einstellung bleibt so lange in der Ecke, dann verschwindet er (@ME-006). */
export const WAKE_LOCK_HINWEIS_MS = 10_000;

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
]);

/** Soll die Seite diese Taste abfangen (Standardaktion unterdrücken), damit sie nichts auslöst? */
export function istAbgefangeneTaste(key: string): boolean {
  return ABGEFANGENE_TASTEN.has(key);
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
