/**
 * Lautsprecher-Felder dieses Geräts über die Tabs teilen (H3b-2b, @HT-033 Zeile 8, Regel 3): Der Tab, der tönt, meldet seine
 * Felder je mit dem Kennzeichen „bereit“ in `localStorage` (`hallenton:felder`) und stößt die anderen Tabs über
 * `BroadcastChannel('hallenton')` an. H3b-3 liest das für Regel 3 im Cockpit (`bereiteLautsprecherFeldIds`), das Reload-Tor
 * für alle Tabs (`lautsprecherReloadTor.ts`).
 *
 * Eine Meldung ohne Erneuerung gilt nach 15 s als veraltet (z. B. Tab abgestürzt): Sonst schwiege der Cockpit-Ton in den
 * anderen Tabs, obwohl hier nichts mehr tönt. Der tönende Tab erneuert sie alle 5 s. Zeit ist die Uhr des Geräts, die alle
 * Tabs gleich sehen; ein Sprung lässt eine Meldung höchstens früher veralten. Nichts wirft.
 */
import { feldKennung, type FeldKennung } from './aktuellesSpielJeFeld';
import { lies, schreib, type Speicher } from './tonEinstellungen';

export const FELDER_SCHLUESSEL = 'hallenton:felder';
export const KANAL_NAME = 'hallenton';
export const MELDUNG_VERALTET_MS = 15_000;
export const MELDUNG_ERNEUERN_MS = 5000;

/** `localStorage`-Ausschnitt mit Löschen. */
export interface KanalSpeicher extends Speicher {
  removeItem(schluessel: string): void;
}

export interface LautsprecherFeldMeldung {
  feld: number;
  bereit: boolean;
}

export interface LautsprecherMeldung {
  turnierId: string;
  felder: readonly LautsprecherFeldMeldung[];
  tabId: string;
  /** Uhr des Geräts beim Melden (ms). */
  at: number;
}

/** Ausschnitt von `BroadcastChannel`; im Test ein Bus zwischen gefälschten Tabs. */
export interface NachrichtenKanal {
  postMessage(nachricht: unknown): void;
  addEventListener(type: 'message', fn: () => void): void;
  removeEventListener(type: 'message', fn: () => void): void;
  close(): void;
}

export interface LautsprecherKanal {
  /** Meldung dieses Tabs setzen; `null` nimmt nur die eigene Meldung weg (die eines anderen Tabs bleibt). */
  melden(meldung: { turnierId: string; felder: readonly LautsprecherFeldMeldung[] } | null): void;
  /** Gültige (nicht veraltete) Meldung des Geräts. */
  lesen(): LautsprecherMeldung | null;
  /** Bei jeder Änderung, auch einer eigenen. */
  beobachten(fn: () => void): () => void;
  schliessen(): void;
}

export interface LautsprecherKanalDeps {
  speicher: KanalSpeicher | null;
  kanal: NachrichtenKanal | null;
  tabId: string;
  jetzt: () => number;
}

function alsMeldung(roh: unknown): LautsprecherMeldung | null {
  if (!roh || typeof roh !== 'object') {
    return null;
  }
  const m = roh as Partial<LautsprecherMeldung>;
  const felder = Array.isArray(m.felder) ? m.felder : null;
  if (typeof m.turnierId !== 'string' || typeof m.tabId !== 'string' || typeof m.at !== 'number' || felder === null) {
    return null;
  }
  const gueltig = felder.every((f: unknown) => !!f && typeof f === 'object'
    && Number.isInteger((f as LautsprecherFeldMeldung).feld) && typeof (f as LautsprecherFeldMeldung).bereit === 'boolean');
  return gueltig ? { turnierId: m.turnierId, felder, tabId: m.tabId, at: m.at } : null;
}

/** `localStorage` des Browsers mit Löschen; `null`, wenn gesperrt. */
export function browserKanalSpeicher(): KanalSpeicher | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Gültige Meldung aus dem Speicher; `null` ohne Meldung, bei unlesbarem Inhalt oder nach 15 s ohne Erneuerung. */
export function leseLautsprecherFelder(speicher: Speicher | null, jetzt: number): LautsprecherMeldung | null {
  let roh: unknown;
  try {
    roh = JSON.parse(lies(speicher, FELDER_SCHLUESSEL) ?? 'null');
  } catch {
    return null;
  }
  const meldung = alsMeldung(roh);
  return meldung && jetzt - meldung.at <= MELDUNG_VERALTET_MS && meldung.at - jetzt <= MELDUNG_VERALTET_MS ? meldung : null;
}

/** Regel 3 (H3b-3): Felder (`field-N`), deren Lautsprecher auf diesem Gerät bereit ist – optional nur für ein Turnier. */
export function bereiteLautsprecherFeldIds(meldung: LautsprecherMeldung | null, turnierId?: string): FeldKennung[] {
  if (!meldung || (turnierId !== undefined && meldung.turnierId !== turnierId)) {
    return [];
  }
  return meldung.felder.filter((f) => f.bereit).map((f) => feldKennung(f.feld));
}

export function erzeugeLautsprecherKanal({ speicher, kanal, tabId, jetzt }: LautsprecherKanalDeps): LautsprecherKanal {
  const zuhoerer = new Set<() => void>();
  const melde = (): void => {
    for (const fn of [...zuhoerer]) {
      fn();
    }
  };
  kanal?.addEventListener('message', melde);
  const anstossen = (): void => {
    try {
      kanal?.postMessage({ art: 'felder' });
    } catch {
      // Kanal geschlossen: die anderen Tabs lesen beim nächsten Prüfen
    }
    melde();
  };
  return {
    melden(meldung) {
      if (meldung === null) {
        const alt = leseLautsprecherFelder(speicher, jetzt());
        if (alt?.tabId !== tabId) {
          return;
        }
        try {
          speicher?.removeItem(FELDER_SCHLUESSEL);
        } catch {
          // gesperrt: die Meldung veraltet nach 15 s
        }
      } else {
        schreib(speicher, FELDER_SCHLUESSEL, JSON.stringify({ ...meldung, tabId, at: jetzt() }));
      }
      anstossen();
    },
    lesen: () => leseLautsprecherFelder(speicher, jetzt()),
    beobachten(fn) {
      zuhoerer.add(fn);
      return () => {
        zuhoerer.delete(fn);
      };
    },
    schliessen() {
      kanal?.removeEventListener('message', melde);
      kanal?.close();
      zuhoerer.clear();
    },
  };
}
