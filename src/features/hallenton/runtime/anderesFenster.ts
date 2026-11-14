/**
 * Hält ein anderes Fenster dieses Geräts die Sperre `hallenton`? (H4-8, @HT-033 Zeile 8, Nachtrag 13.11.)
 * Ein zweites Fenster fragt das sofort über `navigator.locks.query` ab, statt erst nach einem Klick auf „Ton aktivieren“ zu erfahren,
 * dass schon ein Fenster tönt: dann steht gleich der ruhige Hinweis „Lautsprecher läuft schon in einem anderen Fenster“ (ohne Warnfarbe,
 * ohne Klick) und „Ton nicht aktiv – hier klicken“ nur, wenn kein Fenster tönt. Ohne Web Locks (`null`): wie bisher, kein Hinweis.
 * Nichts wirft: scheitert die Abfrage, gilt „kein Fenster tönt“.
 */
import { SPERRE_NAME } from './geraeteSperre';

/** Ausschnitt von `LockManager`. */
export interface SperrAbfrage {
  query(): Promise<{ held?: ReadonlyArray<{ name?: string }> }>;
}

export async function haeltEinFensterDieSperre(verwalter: SperrAbfrage | null): Promise<boolean> {
  if (verwalter === null) {
    return false;
  }
  try {
    const stand = await verwalter.query();
    return (stand.held ?? []).some((sperre) => sperre.name === SPERRE_NAME);
  } catch {
    return false;
  }
}

/** Die Sperrenverwaltung des Browsers; ohne Web Locks (oder ohne `query`) `null`. */
export function browserSperrAbfrage(): SperrAbfrage | null {
  if (typeof navigator === 'undefined' || !('locks' in navigator)) {
    return null;
  }
  const locks = navigator.locks as Partial<SperrAbfrage> | undefined;
  return typeof locks?.query === 'function' ? (locks as SperrAbfrage) : null;
}
