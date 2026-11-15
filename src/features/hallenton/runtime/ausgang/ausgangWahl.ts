/**
 * Die Wahl des Ausgangs, lokal je Gerät (H4-6, @HT-053): `localStorage` unter `hallenton:ausgang` als JSON
 * `{ id, name, gruppe }` – nicht je Turnier. Der Wechsel erreicht jeden Tab des Geräts über das `storage`-Ereignis (der tönende
 * Tab ist oft ein anderer als der, in dem Olli wählt); im eigenen Tab meldet `setzen` selbst.
 *
 * Name und Kennung verlassen das Gerät nie: sie stehen nur hier, nie im Lebenszeichen, in Sentry oder in Logs.
 * Ohne Speicher (gesperrt, privates Fenster) gilt die Wahl bis zum Neuladen (im Arbeitsspeicher); nichts wirft.
 */
import { STANDARD_AUSGANG_ID, type GewaehlterAusgang } from '../../../../core/hallenton';
import type { KanalSpeicher } from '../lautsprecherKanal';
import { lies, schreib } from '../tonEinstellungen';

export const AUSGANG_SCHLUESSEL = 'hallenton:ausgang';
/** Wird nach einer Bestätigung (Mikrofon erlaubt) beschrieben: die anderen Tabs lesen die Ausgänge neu (@HT-055). */
export const AUSGANG_PRUEFEN_SCHLUESSEL = 'hallenton:ausgang-pruefen';

/** Ausschnitt von `window` für das `storage`-Ereignis. */
export interface SpeicherEreignisse {
  addEventListener(type: 'storage', fn: (ereignis: { key: string | null }) => void): void;
  removeEventListener(type: 'storage', fn: (ereignis: { key: string | null }) => void): void;
}

export interface AusgangWahl {
  /** `null` = „Standard (Ausgang des Systems)“. */
  lesen(): GewaehlterAusgang | null;
  /** `null` oder der Systemstandard löscht die Wahl. */
  setzen(wahl: GewaehlterAusgang | null): void;
  /** Anstoß an die anderen Tabs, die Ausgänge neu zu lesen (nach „Ausgang bestätigen“). */
  pruefenAnstossen(): void;
  /** Wahl geändert (hier oder in einem anderen Tab) oder neu zu prüfen. */
  beobachten(fn: () => void): () => void;
}

function alsWahl(roh: unknown): GewaehlterAusgang | null {
  if (!roh || typeof roh !== 'object') {
    return null;
  }
  const w = roh as Partial<GewaehlterAusgang>;
  return typeof w.id === 'string' && w.id !== '' && w.id !== STANDARD_AUSGANG_ID && typeof w.name === 'string' && typeof w.gruppe === 'string'
    ? { id: w.id, name: w.name, gruppe: w.gruppe }
    : null;
}

export function erzeugeAusgangWahl({ speicher, seite }: { speicher: KanalSpeicher | null; seite: SpeicherEreignisse | null }): AusgangWahl {
  const zuhoerer = new Set<() => void>();
  let imArbeitsspeicher: GewaehlterAusgang | null = null; // gilt nur, wenn der Speicher gesperrt ist
  let zaehler = 0;

  const lesen = (): GewaehlterAusgang | null => {
    if (!speicher) {
      return imArbeitsspeicher;
    }
    try {
      return alsWahl(JSON.parse(lies(speicher, AUSGANG_SCHLUESSEL) ?? 'null'));
    } catch {
      return null;
    }
  };

  const melden = (): void => {
    for (const fn of [...zuhoerer]) {
      fn();
    }
  };

  const beiSpeicher = (ereignis: { key: string | null }): void => {
    if (ereignis.key === null || ereignis.key === AUSGANG_SCHLUESSEL || ereignis.key === AUSGANG_PRUEFEN_SCHLUESSEL) {
      melden();
    }
  };

  return {
    lesen,
    setzen(wahl) {
      const gueltig = wahl === null ? null : alsWahl(wahl);
      imArbeitsspeicher = gueltig;
      if (speicher) {
        if (gueltig === null) {
          try {
            speicher.removeItem(AUSGANG_SCHLUESSEL);
          } catch {
            // gesperrt: gilt bis zum Neuladen
          }
        } else {
          schreib(speicher, AUSGANG_SCHLUESSEL, JSON.stringify(gueltig));
        }
      }
      melden();
    },
    pruefenAnstossen() {
      zaehler += 1;
      schreib(speicher, AUSGANG_PRUEFEN_SCHLUESSEL, String(Date.now() + zaehler));
      melden();
    },
    beobachten(fn) {
      if (zuhoerer.size === 0) {
        seite?.addEventListener('storage', beiSpeicher);
      }
      zuhoerer.add(fn);
      return () => {
        zuhoerer.delete(fn);
        if (zuhoerer.size === 0) {
          seite?.removeEventListener('storage', beiSpeicher);
        }
      };
    },
  };
}
