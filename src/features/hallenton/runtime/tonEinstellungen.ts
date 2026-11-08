/**
 * Lautstärke je Ton und Stumm je Gerät (H3b-1, @HT-023): in `localStorage` unter `hallenton:lautstaerke` (JSON
 * `{ abpfiff, halbzeit, tor }` in Prozent) und `hallenton:stumm`, nicht turnierweit. Ohne Speicher (privates Fenster, gesperrt)
 * gelten 100 % und nicht stumm; nichts wirft. H3c: eigener Regler `tor` für die Torhymne (Musik ist oft lauter als eine
 * Hupe), Vorbelegung wie die übrigen 100 %; ein älterer Eintrag ohne `tor` behält Abpfiff und Halbzeit.
 */
export type TonArt = 'abpfiff' | 'halbzeit';
/** Regler je Gerät: die beiden End-Töne und die Torhymne (@HT-023). */
export type ReglerArt = TonArt | 'tor';

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

export function gespeicherteLautstaerke(speicher: Speicher | null): Record<ReglerArt, number> {
  let roh: unknown;
  try {
    roh = JSON.parse(lies(speicher, LAUTSTAERKE_SCHLUESSEL) ?? 'null');
  } catch {
    roh = null;
  }
  const werte = roh && typeof roh === 'object' ? (roh as Partial<Record<ReglerArt, unknown>>) : {};
  return {
    abpfiff: gueltigeProzent(werte.abpfiff) ?? 100, halbzeit: gueltigeProzent(werte.halbzeit) ?? 100, tor: gueltigeProzent(werte.tor) ?? 100,
  };
}

/** `localStorage` des Browsers; `null`, wenn der Zugriff gesperrt ist. */
export function browserSpeicher(): Speicher | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
