/**
 * CockpitKastenOrt (H4-18, @HT-059): welcher Kasten „Hallen-Lautsprecher aus – Ende selbst anzeigen“ steht gerade im Cockpit? Der Kasten
 * (`CockpitHallHinweis`) meldet hier „für Turnier T zeige ich die Lautsprecher-Störung von Feld F“, der Kopf (`HallStatusZeile` im Cockpit)
 * liest das und lässt die doppelte Pille weg. Gleiches Muster wie `StatusZeileOrt`: kleiner Speicher ohne React-Baum, weil Kopf und Kasten in
 * verschiedenen Teilbäumen stehen. Gemeldet wird nur, was TATSÄCHLICH im Bild steht (der Kasten steht im Baum und ist nicht verdeckt, etwa von der Leibchen-Wahl am Handy); Abmelden beim Verschwinden.
 * Beide Wege laufen vor dem Malen (`useLayoutEffect`): kein Bild lang doppelt, kein Bild lang gar nichts.
 */
import { useLayoutEffect, useSyncExternalStore } from 'react';

/** Was der Kasten dieses Turniers gerade zeigt: die Felder, und davon die, deren Kasten die Taste „Ton aktivieren“ trägt (G1, @HT-059). */
export interface GezeigteKaesten {
  felder: ReadonlySet<number>;
  mitTonTaste: ReadonlySet<number>;
}

interface Eintrag { anzahl: number; mitTaste: number }

const gemeldet = new Map<string, Map<number, Eintrag>>();
const LEER: GezeigteKaesten = { felder: new Set<number>(), mitTonTaste: new Set<number>() };
const stand = new Map<string, GezeigteKaesten>();
const hoerer = new Set<() => void>();

function melden(turnierId: string): void {
  const felder = gemeldet.get(turnierId);
  if (felder === undefined) {
    stand.delete(turnierId);
  } else {
    stand.set(turnierId, { felder: new Set(felder.keys()), mitTonTaste: new Set([...felder].filter(([, e]) => e.mitTaste > 0).map(([f]) => f)) });
  }
  for (const fn of [...hoerer]) {
    fn();
  }
}

/** Meldet den gezeigten Kasten für Turnier und Feld (mit oder ohne Taste „Ton aktivieren“); die Rückgabe meldet ihn ab. */
export function meldeCockpitKasten(turnierId: string, feld: number, mitTonTaste = false): () => void {
  const felder = gemeldet.get(turnierId) ?? new Map<number, Eintrag>();
  const alt = felder.get(feld) ?? { anzahl: 0, mitTaste: 0 };
  const taste = mitTonTaste ? 1 : 0;
  felder.set(feld, { anzahl: alt.anzahl + 1, mitTaste: alt.mitTaste + taste });
  gemeldet.set(turnierId, felder);
  melden(turnierId);
  let offen = true;
  return () => {
    if (!offen) {
      return;
    }
    offen = false;
    const jetzt = felder.get(feld) ?? { anzahl: 1, mitTaste: taste };
    if (jetzt.anzahl <= 1) {
      felder.delete(feld);
    } else {
      felder.set(feld, { anzahl: jetzt.anzahl - 1, mitTaste: jetzt.mitTaste - taste });
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
export function useCockpitKastenMeldung(turnierId: string, feld: number, mitTonTaste: boolean): void {
  useLayoutEffect(() => meldeCockpitKasten(turnierId, feld, mitTonTaste), [turnierId, feld, mitTonTaste]);
}

/** Für den Kopf: die Kästen dieses Turniers, die gerade gezeigt werden (stabiles Objekt, solange sich nichts ändert). */
export function useCockpitKaesten(turnierId: string): GezeigteKaesten {
  return useSyncExternalStore(abonniere, () => stand.get(turnierId) ?? LEER, () => LEER);
}
