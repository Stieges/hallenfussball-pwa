/**
 * Hallen-Lautsprecher dieses Geräts (H3b-2b), Zustand im Modul ohne React – Brücke zwischen dem unsichtbaren Baustein
 * `<HallLautsprecherLaufzeit/>` (erzeugt die Laufzeit) und `useHallLautsprecher` (Aktionen, Anzeige in H4):
 * - Einschaltung `{ turnierId, felder, name }` in `localStorage` (`hallenton:geraet`), damit der Lautsprecher nach dem
 *   Neuladen weiterläuft (dann „Ton aktivieren“ nötig, @HT-013); alle Tabs sehen sie (`storage`-Ereignis).
 * - Ein Spieler je Tab (ein `AudioContext`), erst beim ersten Bedarf erzeugt; normale Geräte haben keinen.
 * - „Schlafen gelegt“ (`document.wasDiscarded`) gilt ab dem Laden bis zum ersten erfolgreichen „Ton aktivieren“ (@HT-037).
 */
import { lies, schreib } from './runtime/tonEinstellungen';
import { browserKanalSpeicher } from './runtime/lautsprecherKanal';
import { erzeugeBrowserHallTonSpieler, type HallTonSpieler } from './runtime/hallTonSpieler';
import type { HallFehlerGrund } from '../../core/repositories/hallentonRpc';
import type { HallLautsprecherLaufzeit } from './runtime/HallLautsprecherLaufzeit';

export const GERAET_SCHLUESSEL = 'hallenton:geraet';

export interface Einschaltung {
  turnierId: string;
  felder: readonly number[];
  name: string;
}

export interface GeraetStand {
  einschaltung: Einschaltung | null;
  laufzeit: HallLautsprecherLaufzeit | null;
  /** Fehlergrund des letzten Lebenszeichens (z. B. `ungueltig`, `kein_recht`, `netz`); `null` nach Erfolg (H3b-3 K2). */
  lebenszeichenFehler: HallFehlerGrund | null;
}

const zuhoerer = new Set<() => void>();
let stand: GeraetStand | null = null;
let spieler: HallTonSpieler | null = null;
let geschlafen = typeof document !== 'undefined' && (document as Document & { wasDiscarded?: boolean }).wasDiscarded === true;

function alsEinschaltung(roh: unknown): Einschaltung | null {
  if (!roh || typeof roh !== 'object') {
    return null;
  }
  const e = roh as Partial<Einschaltung>;
  const felder = Array.isArray(e.felder) && e.felder.every((f) => Number.isInteger(f) && f > 0) ? e.felder : null;
  return typeof e.turnierId === 'string' && typeof e.name === 'string' && felder && felder.length > 0
    ? { turnierId: e.turnierId, felder, name: e.name }
    : null;
}

function gespeichert(): Einschaltung | null {
  try {
    return alsEinschaltung(JSON.parse(lies(browserKanalSpeicher(), GERAET_SCHLUESSEL) ?? 'null'));
  } catch {
    return null;
  }
}

function melden(neu: GeraetStand): void {
  stand = neu;
  for (const fn of [...zuhoerer]) {
    fn();
  }
}

function beiSpeicher(ereignis: StorageEvent): void {
  if (ereignis.key === GERAET_SCHLUESSEL || ereignis.key === null) {
    melden({ ...geraetStand(), einschaltung: gespeichert() });
  }
}

export function geraetStand(): GeraetStand {
  stand ??= { einschaltung: gespeichert(), laufzeit: null, lebenszeichenFehler: null };
  return stand;
}

export function abonniereGeraet(fn: () => void): () => void {
  if (zuhoerer.size === 0 && typeof window !== 'undefined') {
    window.addEventListener('storage', beiSpeicher);
  }
  zuhoerer.add(fn);
  return () => {
    zuhoerer.delete(fn);
    if (zuhoerer.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', beiSpeicher);
    }
  };
}

export function setzeEinschaltung(einschaltung: Einschaltung | null): void {
  const speicher = browserKanalSpeicher();
  if (einschaltung === null) {
    try {
      speicher?.removeItem(GERAET_SCHLUESSEL);
    } catch {
      // gesperrt: gilt bis zum Neuladen
    }
  } else {
    schreib(speicher, GERAET_SCHLUESSEL, JSON.stringify(einschaltung));
  }
  melden({ ...geraetStand(), einschaltung });
}

export function setzeLaufzeit(laufzeit: HallLautsprecherLaufzeit | null): void {
  melden({ ...geraetStand(), laufzeit, lebenszeichenFehler: null });
}

export function setzeLebenszeichenFehler(grund: HallFehlerGrund | null): void {
  if (geraetStand().lebenszeichenFehler !== grund) {
    melden({ ...geraetStand(), lebenszeichenFehler: grund });
  }
}

/** Der Spieler dieses Tabs (ein `AudioContext`). */
export function geraetSpieler(): HallTonSpieler {
  spieler ??= erzeugeBrowserHallTonSpieler();
  return spieler;
}

export function istGeschlafen(): boolean {
  return geschlafen;
}

export function schlafenQuittiert(): void {
  geschlafen = false;
}

/** Nur für Tests. */
export function __setzeGeraetFuerTests(neu: { spieler?: HallTonSpieler | null; geschlafen?: boolean } = {}): void {
  stand = null;
  spieler = neu.spieler ?? null;
  geschlafen = neu.geschlafen ?? false;
  zuhoerer.clear();
}
