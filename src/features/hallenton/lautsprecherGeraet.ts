/**
 * Hallen-Lautsprecher dieses Geräts (H3b-2b), Zustand im Modul ohne React – Brücke zwischen dem unsichtbaren Baustein
 * `<HallLautsprecherLaufzeit/>` (erzeugt die Laufzeit) und `useHallLautsprecher` (Aktionen, Anzeige in H4):
 * - Einschaltung `{ turnierId, felder, name }` in `localStorage` (`hallenton:geraet`), damit der Lautsprecher nach dem
 *   Neuladen weiterläuft (dann „Ton aktivieren“ nötig, @HT-013); alle Tabs sehen sie (`storage`-Ereignis).
 * - Ein Spieler je Tab (ein `AudioContext`), erst beim ersten Bedarf erzeugt; normale Geräte haben keinen.
 * - „Schlafen gelegt“ (`document.wasDiscarded`) gilt ab dem Laden bis zum ersten erfolgreichen „Ton aktivieren“ (@HT-037).
 * - H4-1: Geräteweit über die Tabs (`localStorage` + `storage`-Ereignis, Muster wie `hallenton:felder`): die Abgelöst-Marke
 *   (`hallenton:abgeloest`, @HT-015), der Fehlergrund des Lebenszeichens (`hallenton:lebenszeichen-fehler`, @HT-012, @HT-041)
 *   und der Anstoß „erneut versuchen“ (`hallenton:erneut`).
 */
import { lies, schreib } from './runtime/tonEinstellungen';
import { browserKanalSpeicher } from './runtime/lautsprecherKanal';
import { erzeugeBrowserHallTonSpieler, type HallTonSpieler } from './runtime/hallTonSpieler';
import type { HallFehlerGrund } from '../../core/repositories/hallentonRpc';
import type { HallLautsprecherLaufzeit } from './runtime/HallLautsprecherLaufzeit';

export const GERAET_SCHLUESSEL = 'hallenton:geraet';
export const ABGELOEST_SCHLUESSEL = 'hallenton:abgeloest';
export const FEHLER_SCHLUESSEL = 'hallenton:lebenszeichen-fehler';
export const ERNEUT_SCHLUESSEL = 'hallenton:erneut';
const FEHLER_GRUENDE: readonly HallFehlerGrund[] = ['kein_recht', 'ungueltig', 'turnier_beendet', 'netz', 'antwort_unbekannt'];

export interface Einschaltung {
  turnierId: string;
  felder: readonly number[];
  name: string;
}

/** Spur einer Ablösung (@HT-015): welche Felder von einem anderen Gerät übernommen wurden, und wann (Serverzeit, ms). */
export interface AbgeloestMarke {
  turnierId: string;
  felder: readonly number[];
  um: number;
}

export interface GeraetStand {
  einschaltung: Einschaltung | null;
  laufzeit: HallLautsprecherLaufzeit | null;
  /** Fehlergrund des letzten Lebenszeichens (z. B. `ungueltig`, `kein_recht`, `netz`); `null` nach Erfolg (H3b-3 K2). */
  lebenszeichenFehler: HallFehlerGrund | null;
  /** Das Gerät wurde für Felder abgelöst und hat es noch nicht „verstanden“ (@HT-015); `null` = keine Marke. */
  abgeloest: AbgeloestMarke | null;
}

const zuhoerer = new Set<() => void>();
const erneutHoerer = new Set<() => void>();
let erneutZaehler = 0;
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

function gespeicherteMarke(): AbgeloestMarke | null {
  try {
    const roh: unknown = JSON.parse(lies(browserKanalSpeicher(), ABGELOEST_SCHLUESSEL) ?? 'null');
    if (!roh || typeof roh !== 'object') {
      return null;
    }
    const m = roh as Partial<AbgeloestMarke>;
    const felder = Array.isArray(m.felder) && m.felder.every((f) => Number.isInteger(f) && f > 0) ? m.felder : null;
    return typeof m.turnierId === 'string' && typeof m.um === 'number' && Number.isFinite(m.um) && felder && felder.length > 0
      ? { turnierId: m.turnierId, felder, um: m.um }
      : null;
  } catch {
    return null;
  }
}

function gespeicherterFehler(): HallFehlerGrund | null {
  const roh = lies(browserKanalSpeicher(), FEHLER_SCHLUESSEL);
  return FEHLER_GRUENDE.find((g) => g === roh) ?? null;
}

function loesche(schluessel: string): void {
  try {
    browserKanalSpeicher()?.removeItem(schluessel);
  } catch {
    // gesperrt: gilt bis zum Neuladen
  }
}

function melden(neu: GeraetStand): void {
  stand = neu;
  for (const fn of [...zuhoerer]) {
    fn();
  }
}

function beiSpeicher(ereignis: StorageEvent): void {
  const alle = ereignis.key === null;
  if (ereignis.key === ERNEUT_SCHLUESSEL || alle) {
    erneutAnstossen();
  }
  if (alle || ereignis.key === GERAET_SCHLUESSEL || ereignis.key === ABGELOEST_SCHLUESSEL || ereignis.key === FEHLER_SCHLUESSEL) {
    melden({ ...geraetStand(), einschaltung: gespeichert(), abgeloest: gespeicherteMarke(), lebenszeichenFehler: gespeicherterFehler() });
  }
}

export function geraetStand(): GeraetStand {
  stand ??= { einschaltung: gespeichert(), laufzeit: null, lebenszeichenFehler: gespeicherterFehler(), abgeloest: gespeicherteMarke() };
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
    loesche(GERAET_SCHLUESSEL);
    loesche(FEHLER_SCHLUESSEL); // kein Lautsprecher mehr: ein alter Grund gehört nicht zum nächsten Einschalten
    melden({ ...geraetStand(), einschaltung, lebenszeichenFehler: null });
    return;
  }
  schreib(speicher, GERAET_SCHLUESSEL, JSON.stringify(einschaltung));
  melden({ ...geraetStand(), einschaltung });
}

export function setzeLaufzeit(laufzeit: HallLautsprecherLaufzeit | null): void {
  melden({ ...geraetStand(), laufzeit });
}

/** Fehlergrund des Lebenszeichens für alle Tabs des Geräts (@HT-012, @HT-041); `null` nach einem Erfolg. */
export function setzeLebenszeichenFehler(grund: HallFehlerGrund | null): void {
  if (geraetStand().lebenszeichenFehler === grund) {
    return;
  }
  if (grund === null) {
    loesche(FEHLER_SCHLUESSEL);
  } else {
    schreib(browserKanalSpeicher(), FEHLER_SCHLUESSEL, grund);
  }
  melden({ ...geraetStand(), lebenszeichenFehler: grund });
}

/**
 * @HT-015: Spur der Ablösung vor dem Löschen der Rolle; weitere Ablösungen desselben Turniers kommen dazu. `um` = Serverzeit.
 * Bleibt, bis das Gerät neu eingeschaltet wird oder `abgeloestVerstanden()` gerufen wird.
 */
export function merkeAbloesung(turnierId: string, felder: readonly number[], um: number): void {
  const alt = geraetStand().abgeloest;
  const alle = alt?.turnierId === turnierId ? [...new Set([...alt.felder, ...felder])].sort((a, b) => a - b) : [...felder];
  if (alle.length === 0) {
    return;
  }
  const marke: AbgeloestMarke = { turnierId, felder: alle, um };
  schreib(browserKanalSpeicher(), ABGELOEST_SCHLUESSEL, JSON.stringify(marke));
  melden({ ...geraetStand(), abgeloest: marke });
}

/** Die Turnierleitung hat „von einem anderen Gerät übernommen“ gesehen (H4-9) oder schaltet neu ein: Marke weg, in allen Tabs. */
export function abgeloestVerstanden(): void {
  loesche(ABGELOEST_SCHLUESSEL);
  melden({ ...geraetStand(), abgeloest: null });
}

function erneutAnstossen(): void {
  for (const fn of [...erneutHoerer]) {
    fn();
  }
}

/** Die Laufzeit eines Tabs hört auf „erneut versuchen“ (Neu-Anmeldung oder Taste, N2). */
export function beiErneutVersuchen(fn: () => void): () => void {
  erneutHoerer.add(fn);
  return () => {
    erneutHoerer.delete(fn);
  };
}

/** Ein „still“ nach `kein_recht` beenden und neu melden; `geraeteweit`: auch in den anderen Tabs (Taste), nicht bei der Neu-Anmeldung dieses Tabs. */
export function erneutVersuchen(geraeteweit = true): void {
  if (geraeteweit) {
    erneutZaehler += 1;
    schreib(browserKanalSpeicher(), ERNEUT_SCHLUESSEL, `${Date.now()}-${erneutZaehler}`);
  }
  erneutAnstossen();
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
  erneutHoerer.clear();
}
