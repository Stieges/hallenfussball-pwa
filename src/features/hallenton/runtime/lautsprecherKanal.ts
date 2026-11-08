/**
 * Lautsprecher-Felder dieses Geräts über die Tabs teilen (H3b-2b, @HT-033 Zeile 8, Regel 3): Der Tab, der tönt, meldet seine
 * Felder je mit dem Kennzeichen „bereit“ in `localStorage` (`hallenton:felder`) und stößt die anderen Tabs über
 * `BroadcastChannel('hallenton')` an. H3b-3 liest das für Regel 3 im Cockpit (`bereiteLautsprecherFeldIds`), das Reload-Tor
 * für alle Tabs (`lautsprecherReloadTor.ts`).
 *
 * Fail-safe (Ruling W-neu-1): Eine Meldung ohne Erneuerung gilt nach 2 s als nicht bereit (Neuladen, Schließen, Absturz),
 * dann tönt das Cockpit wieder. Der Halter der Sperre erneuert sie im Takt höchstens einmal je Sekunde; `pagehide` nimmt die
 * eigene Meldung sofort weg. Zeit ist die Uhr des Geräts, die alle Tabs gleich sehen; ein Sprung lässt eine Meldung höchstens
 * früher veralten. Nichts wirft.
 */
import { feldKennung, type FeldKennung } from './aktuellesSpielJeFeld';
import { lies, schreib, type Speicher } from './tonEinstellungen';

export const FELDER_SCHLUESSEL = 'hallenton:felder';
export const KANAL_NAME = 'hallenton';
export const MELDUNG_VERALTET_MS = 2000;
export const MELDUNG_ERNEUERN_MS = 1000;
/** Reload-Tor: im Zweifel nicht neu laden – eigene, längere Toleranz (Ruling k3-neu-3). */
export const TOR_TOLERANZ_MS = 15_000;

/** `localStorage`-Ausschnitt mit Löschen. */
export interface KanalSpeicher extends Speicher {
  removeItem(schluessel: string): void;
}

export interface LautsprecherFeldMeldung {
  feld: number;
  bereit: boolean;
  /**
   * Serverzeit der letzten Antwort des Servers für dieses Feld (K3 aus H3b-3); `null` = keine. Fehlt der Wert (ältere Meldung),
   * gilt das wie `null`: das Cockpit tönt.
   */
  antwortAt?: number | null;
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
  /** Gültige (nicht veraltete) Meldung des Geräts; `toleranzMs` Standard 2 s (Regel 3), das Reload-Tor nimmt 15 s. */
  lesen(toleranzMs?: number): LautsprecherMeldung | null;
  /** Alter der eigenen Meldung nach der Uhr des Kanals (k3-neu-1: Erneuern und Bewerten mit derselben Uhr); `null` ohne. */
  eigenesAlter(): number | null;
  /** Bei jeder Änderung, auch einer eigenen. */
  beobachten(fn: () => void): () => void;
  schliessen(): void;
}

/** Ausschnitt von `window` für `pagehide`. */
export interface SeitenEreignisse {
  addEventListener(type: 'pagehide', fn: () => void): void;
  removeEventListener(type: 'pagehide', fn: () => void): void;
}

export interface LautsprecherKanalDeps {
  speicher: KanalSpeicher | null;
  kanal: NachrichtenKanal | null;
  tabId: string;
  jetzt: () => number;
  /** `window`: beim Verlassen der Seite (`pagehide`) die eigene Meldung wegnehmen. */
  seite?: SeitenEreignisse | null;
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
  const gueltig = felder.every((f: unknown) => {
    const feld = f as LautsprecherFeldMeldung;
    const antwortAt = !!f && typeof f === 'object' ? feld.antwortAt : undefined;
    return !!f && typeof f === 'object' && Number.isInteger(feld.feld) && typeof feld.bereit === 'boolean'
      && (antwortAt === undefined || antwortAt === null || Number.isFinite(antwortAt));
  });
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

/** Gültige Meldung aus dem Speicher; `null` ohne Meldung, bei unlesbarem Inhalt oder wenn sie älter als `toleranzMs` ist (Standard 2 s). */
export function leseLautsprecherFelder(speicher: Speicher | null, jetzt: number, toleranzMs: number = MELDUNG_VERALTET_MS): LautsprecherMeldung | null {
  let roh: unknown;
  try {
    roh = JSON.parse(lies(speicher, FELDER_SCHLUESSEL) ?? 'null');
  } catch {
    return null;
  }
  const meldung = alsMeldung(roh);
  return meldung && jetzt - meldung.at <= toleranzMs && meldung.at - jetzt <= toleranzMs ? meldung : null;
}

/** Regel 3 (H3b-3): Felder (`field-N`), deren Lautsprecher auf diesem Gerät bereit ist – optional nur für ein Turnier. */
export function bereiteLautsprecherFeldIds(meldung: LautsprecherMeldung | null, turnierId?: string): FeldKennung[] {
  if (!meldung || (turnierId !== undefined && meldung.turnierId !== turnierId)) {
    return [];
  }
  return meldung.felder.filter((f) => f.bereit).map((f) => feldKennung(f.feld));
}

export function erzeugeLautsprecherKanal({ speicher, kanal, tabId, jetzt, seite = null }: LautsprecherKanalDeps): LautsprecherKanal {
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
  const meldenFn: LautsprecherKanal['melden'] = (meldung) => {
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
  };
  const beimVerlassen = (): void => meldenFn(null);
  seite?.addEventListener('pagehide', beimVerlassen);
  return {
    melden: meldenFn,
    lesen: (toleranzMs) => leseLautsprecherFelder(speicher, jetzt(), toleranzMs),
    eigenesAlter() {
      const eigene = leseLautsprecherFelder(speicher, jetzt(), Number.POSITIVE_INFINITY);
      return eigene?.tabId === tabId ? jetzt() - eigene.at : null;
    },
    beobachten(fn) {
      zuhoerer.add(fn);
      return () => {
        zuhoerer.delete(fn);
      };
    },
    schliessen() {
      seite?.removeEventListener('pagehide', beimVerlassen);
      kanal?.removeEventListener('message', melde);
      kanal?.close();
      zuhoerer.clear();
    },
  };
}
