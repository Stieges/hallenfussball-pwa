/**
 * CockpitKastenOrt (H4-18, @HT-059): welcher Kasten „Hallen-Lautsprecher aus – Ende selbst anzeigen“ steht gerade im Cockpit? Der Kasten
 * (`CockpitHallHinweis`) meldet hier „für Turnier T zeige ich die Lautsprecher-Störung von Feld F“, der Kopf (`HallStatusZeile` im Cockpit)
 * liest das und lässt die doppelte Pille weg. Gleiches Muster wie `StatusZeileOrt`: kleiner Speicher ohne React-Baum, weil Kopf und Kasten in
 * verschiedenen Teilbäumen stehen. Gemeldet wird nur, was TATSÄCHLICH gezeigt wird (der Kasten steht im Baum); Abmelden beim Verschwinden.
 * Beide Wege laufen vor dem Malen (`useLayoutEffect`): kein Bild lang doppelt, kein Bild lang gar nichts.
 */
import { useLayoutEffect, useSyncExternalStore } from 'react';

const gemeldet = new Map<string, Map<number, number>>();
const stand = new Map<string, ReadonlySet<number>>();
const hoerer = new Set<() => void>();
const LEER: ReadonlySet<number> = new Set<number>();

function melden(turnierId: string): void {
  const felder = gemeldet.get(turnierId);
  if (felder === undefined) {
    stand.delete(turnierId);
  } else {
    stand.set(turnierId, new Set(felder.keys()));
  }
  for (const fn of [...hoerer]) {
    fn();
  }
}

/** Meldet den gezeigten Kasten für Turnier und Feld; die Rückgabe meldet ihn ab. */
export function meldeCockpitKasten(turnierId: string, feld: number): () => void {
  const felder = gemeldet.get(turnierId) ?? new Map<number, number>();
  felder.set(feld, (felder.get(feld) ?? 0) + 1);
  gemeldet.set(turnierId, felder);
  melden(turnierId);
  let offen = true;
  return () => {
    if (!offen) {
      return;
    }
    offen = false;
    const rest = (felder.get(feld) ?? 1) - 1;
    if (rest <= 0) {
      felder.delete(feld);
    } else {
      felder.set(feld, rest);
    }
    if (felder.size === 0) {
      gemeldet.delete(turnierId);
    }
    melden(turnierId);
  };
}

function abonniere(fn: () => void): () => void {
  hoerer.add(fn);
  return () => {
    hoerer.delete(fn);
  };
}

/** Für den Kasten: solange er gezeigt wird, steht Feld F von Turnier T im Speicher. */
export function useCockpitKastenMeldung(turnierId: string, feld: number): void {
  useLayoutEffect(() => meldeCockpitKasten(turnierId, feld), [turnierId, feld]);
}

/** Für den Kopf: die Felder, für die der Kasten dieses Turniers gerade gezeigt wird (stabile Menge, solange sich nichts ändert). */
export function useCockpitKastenFelder(turnierId: string): ReadonlySet<number> {
  return useSyncExternalStore(abonniere, () => stand.get(turnierId) ?? LEER, () => LEER);
}
