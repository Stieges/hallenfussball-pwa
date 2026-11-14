/**
 * Geteilte Abfrage „tönt ein anderes Fenster dieses Geräts?“ (H4-9, Folgepunkt k7 aus dem H4-8-Review): Kopfzeile, Streifen und Seite
 * fragten je für sich alle 3 s `navigator.locks.query`. Jetzt gibt es eine Abfrage je Gerät (Fenster): läuft, solange mindestens ein
 * Hörer angemeldet ist (sofort beim ersten, danach alle `ABFRAGE_MS`), und geht aus, wenn der letzte geht. Als Speicher für
 * `useSyncExternalStore`: `abonniereAnderesFenster` und `anderesFensterGehalten`. Reiner Lesezugriff (`anderesFenster.ts`).
 */
import { browserSperrAbfrage, haeltEinFensterDieSperre } from './anderesFenster';

export const ABFRAGE_MS = 3000;

const hoerer = new Set<() => void>();
let gehalten = false;
let takt: ReturnType<typeof setInterval> | null = null;
/** Zählt Starts: eine späte Antwort einer beendeten Abfrage ändert nichts mehr. */
let lauf = 0;

function frage(meinLauf: number): void {
  void haeltEinFensterDieSperre(browserSperrAbfrage()).then((halten) => {
    if (meinLauf === lauf && halten !== gehalten) {
      gehalten = halten;
      for (const fn of [...hoerer]) {
        fn();
      }
    }
  });
}

/** Meldet einen Hörer an; der erste startet die Abfrage (sofort + alle `ABFRAGE_MS`), der letzte beim Abmelden beendet sie. */
export function abonniereAnderesFenster(fn: () => void): () => void {
  hoerer.add(fn);
  if (hoerer.size === 1) {
    lauf += 1;
    const meinLauf = lauf;
    frage(meinLauf);
    takt = setInterval(() => frage(meinLauf), ABFRAGE_MS);
  }
  return () => {
    hoerer.delete(fn);
    if (hoerer.size === 0) {
      if (takt !== null) {
        clearInterval(takt);
        takt = null;
      }
      lauf += 1;
      gehalten = false;
    }
  };
}

export function anderesFensterGehalten(): boolean {
  return gehalten;
}
