/**
 * StatusZeileOrt (H4-5, G6): wer zeigt die Statuszeile des Hallentons? Eine Kopfzeile mit Statuszeile (Verwaltung, Cockpit) meldet sich
 * hier als Host für ihr Turnier an. Ansichten ohne Kopf zeigen den Streifen (`HallGeraetStreifen`) nur, solange für das Turnier des
 * eigenen Lautsprecher-Geräts kein Host eingebunden ist – so steht die Zeile in jeder Ansicht genau einmal (@HT-012).
 * Kleiner Speicher ohne React-Baum, weil der Streifen in `App.tsx` neben, nicht unter den Köpfen steht.
 */
import { useLayoutEffect, useSyncExternalStore } from 'react';

const hosts = new Map<string, number>();
const hoerer = new Set<() => void>();
let version = 0;

function melden(): void {
  version += 1;
  for (const fn of [...hoerer]) {
    fn();
  }
}

/** Meldet einen Host für das Turnier an; die Rückgabe meldet ihn ab. */
export function meldeStatusZeileHost(turnierId: string): () => void {
  hosts.set(turnierId, (hosts.get(turnierId) ?? 0) + 1);
  melden();
  let offen = true;
  return () => {
    if (!offen) {
      return;
    }
    offen = false;
    const rest = (hosts.get(turnierId) ?? 1) - 1;
    if (rest <= 0) {
      hosts.delete(turnierId);
    } else {
      hosts.set(turnierId, rest);
    }
    melden();
  };
}

export function hatStatusZeileHost(turnierId: string | null): boolean {
  return turnierId !== null && hosts.has(turnierId);
}

function abonniere(fn: () => void): () => void {
  hoerer.add(fn);
  return () => {
    hoerer.delete(fn);
  };
}

/** Für die Kopfzeile: solange sie eingebunden ist, ist sie Host des Turniers. */
export function useStatusZeileHost(turnierId: string): void {
  // vor dem Malen: sonst stünden Streifen und Kopfzeile ein Bild lang gleichzeitig da
  useLayoutEffect(() => meldeStatusZeileHost(turnierId), [turnierId]);
}

/** Für den Streifen: gibt es für das Turnier einen Host? */
export function useHatStatusZeileHost(turnierId: string | null): boolean {
  useSyncExternalStore(abonniere, () => version, () => 0);
  return hatStatusZeileHost(turnierId);
}
