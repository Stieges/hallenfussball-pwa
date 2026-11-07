/**
 * Lautstärke je Ton und Stumm je Gerät (H3b-1, @HT-023): in `localStorage` unter `hallenton:lautstaerke` (JSON
 * `{ abpfiff, halbzeit }` in Prozent) und `hallenton:stumm`, nicht turnierweit. Ohne Speicher (privates Fenster, gesperrt)
 * gelten 100 % und nicht stumm; nichts wirft.
 */
export type TonArt = 'abpfiff' | 'halbzeit';

export const LAUTSTAERKE_SCHLUESSEL = 'hallenton:lautstaerke';
export const STUMM_SCHLUESSEL = 'hallenton:stumm';

export interface Speicher { getItem(schluessel: string): string | null; setItem(schluessel: string, wert: string): void }

export function lies(speicher: Speicher | null, schluessel: string): string | null {
  try {
    return speicher?.getItem(schluessel) ?? null;
  } catch {
    return null;
  }
}

export function schreib(speicher: Speicher | null, schluessel: string, wert: string): void {
  try {
    speicher?.setItem(schluessel, wert);
  } catch {
    // privates Fenster oder voll: die Einstellung gilt bis zum Neuladen
  }
}

function gueltigeProzent(wert: unknown): number | null {
  return typeof wert === 'number' && Number.isFinite(wert) && wert >= 0 && wert <= 100 ? wert : null;
}

export function gespeicherteLautstaerke(speicher: Speicher | null): Record<TonArt, number> {
  let roh: unknown;
  try {
    roh = JSON.parse(lies(speicher, LAUTSTAERKE_SCHLUESSEL) ?? 'null');
  } catch {
    roh = null;
  }
  const werte = roh && typeof roh === 'object' ? (roh as Partial<Record<TonArt, unknown>>) : {};
  return { abpfiff: gueltigeProzent(werte.abpfiff) ?? 100, halbzeit: gueltigeProzent(werte.halbzeit) ?? 100 };
}

/** `localStorage` des Browsers; `null`, wenn der Zugriff gesperrt ist. */
export function browserSpeicher(): Speicher | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
