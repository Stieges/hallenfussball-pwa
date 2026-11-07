/**
 * Planer des Hallen-Lautsprechers (Record `2026-10-15_hallenton.md`, vier Regeln; @HT-002 – @HT-013, @HT-031 – @HT-034).
 * Rein, ohne React und ohne Uhr: Stand je Feld + Serverzeit + Gedächtnis → geplante Töne und Warnungen.
 *
 * - Regel 2: Stand am Server nur mit Antwort ≤ 3 s; sonst kein Ton nach altem Stand und Warnung (@HT-011). Das eigene
 *   Cockpit gilt immer (@HT-033 Zeile 11).
 * - Kein Nachholen: Ein Ende, das bei Bekanntwerden bzw. jetzt länger als 5 s zurückliegt, tönt nicht mehr (@HT-013).
 * - Regel 4: jedes Ende genau einmal (Schlüssel im Gedächtnis); Enden innerhalb 1 s ergeben einen Ton – Abpfiff-Ton, wenn
 *   eines davon ein Abpfiff ist, nur bei vorhersehbaren Enden; meldet der Ton ein schon eingetretenes Ende (von Hand), zählt
 *   dessen Tonart (@HT-032). Ein Ende bis 1 s nach einem gespielten Ton geht in diesem auf.
 */
import { feldEndeOf, type FeldEnde } from './enden';
import type { GeplanterTon, HallTonArt, HallTonWarnung, PlanEingabe, PlanErgebnis, TonGedaechtnis } from './types';

/** Kein Ton für ein Ende, das länger als 5 s zurückliegt (@HT-013). */
export const NACHHOLEN_MAX_MS = 5000;
/** Enden innerhalb von 1 s ergeben einen Ton (Regel 4, @HT-032). */
export const ZUSAMMEN_MS = 1000;
/** Ältere Antwort des Servers: kein Ton nach diesem Stand (@HT-011). */
export const ANTWORT_MAX_ALTER_MS = 3000;
/** Ab 15 s vor dem errechneten Ende jede Sekunde nachfragen („Im Einzelnen“, @HT-005). */
export const ENGE_ABFRAGE_AB_MS = 15_000;
export const ENGE_ABFRAGE_TAKT_MS = 1000;
/** So viele Zeitpunkte gespielter Töne genügen für die 1-s-Regel. */
const GEMERKTE_TOENE = 8;

export const LEERES_GEDAECHTNIS: TonGedaechtnis = { erledigt: [], gespieltUm: [] };

interface Kandidat {
  feldId: string;
  ende: FeldEnde;
  /** Wann der Ton erklänge: das Ende, frühestens jetzt. */
  zeit: number;
  ausServer: boolean;
}

function inGespieltemTonAufgegangen(gespieltUm: readonly number[], zeit: number): boolean {
  return gespieltUm.some((um) => zeit >= um && zeit - um <= ZUSAMMEN_MS);
}

function tonAus(gruppe: readonly Kandidat[]): GeplanterTon {
  const at = gruppe[0].zeit;
  // ein schon eingetretenes Ende tönt bereits mit seiner Art; vorhersehbare Enden entscheiden nur unter sich
  const eingetreten = gruppe.filter((k) => !k.ende.vorhergesagt);
  const massgeblich = eingetreten.length > 0 ? eingetreten : gruppe;
  const art: HallTonArt = massgeblich.some((k) => k.ende.art === 'abpfiff') ? 'abpfiff' : 'halbzeit';
  const felder: string[] = [];
  for (const k of gruppe) {
    if (!felder.includes(k.feldId)) {
      felder.push(k.feldId);
    }
  }
  return {
    at, art, felder,
    schluessel: gruppe.map((k) => k.ende.schluessel),
    enden: gruppe.map((k) => ({ schluessel: k.ende.schluessel, feldId: k.feldId, at: k.ende.at })),
    antwortNoetigAb: gruppe.every((k) => k.ausServer) ? at - ANTWORT_MAX_ALTER_MS : null,
  };
}

function gruppiere(kandidaten: readonly Kandidat[]): GeplanterTon[] {
  const sortiert = [...kandidaten].sort((a, b) => a.zeit - b.zeit);
  const toene: GeplanterTon[] = [];
  let i = 0;
  while (i < sortiert.length) {
    const gruppe = [sortiert[i]];
    let j = i + 1;
    while (j < sortiert.length && sortiert[j].zeit - sortiert[i].zeit <= ZUSAMMEN_MS) {
      gruppe.push(sortiert[j]);
      j += 1;
    }
    toene.push(tonAus(gruppe));
    i = j;
  }
  return toene;
}

export function planeHallToene(eingabe: PlanEingabe, gedaechtnis: TonGedaechtnis): PlanErgebnis {
  const { serverNow } = eingabe;
  const erledigt = new Set(gedaechtnis.erledigt);
  const neuErledigt: string[] = [];
  const warnungen: HallTonWarnung[] = [];
  const kandidaten: Kandidat[] = [];
  let abfrageTaktMs: number | null = null;
  const erledige = (schluessel: string): void => {
    erledigt.add(schluessel);
    neuErledigt.push(schluessel);
  };

  for (const feld of eingabe.felder) {
    const ausServer = feld.quelle.art === 'server';
    if (feld.quelle.art === 'server' && feld.quelle.antwortAlterMs > ANTWORT_MAX_ALTER_MS) {
      warnungen.push({ feldId: feld.feldId, grund: 'keineVerbindung' });
      continue;
    }
    const ende = feldEndeOf(feld.state, feld.ctx, serverNow);
    if (ende === null || erledigt.has(ende.schluessel)) {
      continue;
    }
    if (ausServer && ende.vorhergesagt && ende.at - serverNow <= ENGE_ABFRAGE_AB_MS) {
      abfrageTaktMs = ENGE_ABFRAGE_TAKT_MS;
    }
    if (Math.max(feld.bekanntSeit, serverNow) - ende.at > NACHHOLEN_MAX_MS) {
      erledige(ende.schluessel);
      continue;
    }
    const zeit = Math.max(ende.at, serverNow);
    if (inGespieltemTonAufgegangen(gedaechtnis.gespieltUm, zeit)) {
      // endgültig erst, wenn das Ende eingetreten ist – ein künftiges kann sich noch verschieben (Pause, Korrektur)
      if (zeit <= serverNow) {
        erledige(ende.schluessel);
      }
      continue;
    }
    kandidaten.push({ feldId: feld.feldId, ende, zeit, ausServer });
  }

  return {
    toene: gruppiere(kandidaten),
    warnungen,
    abfrageTaktMs,
    gedaechtnis: neuErledigt.length === 0 ? gedaechtnis : { ...gedaechtnis, erledigt: [...gedaechtnis.erledigt, ...neuErledigt] },
  };
}

/**
 * Nach dem Abspielen: die schon eingetretenen Enden des Tons sind erledigt, der Zeitpunkt zählt für die 1-s-Regel. Ein Ende
 * des Tons, das erst kurz danach fällig ist, geht dann im gespielten Ton auf – oder tönt eigens, wenn es sich verschiebt.
 */
export function hallTonGespielt(gedaechtnis: TonGedaechtnis, ton: GeplanterTon, gespieltAt: number): TonGedaechtnis {
  const erledigt = [...gedaechtnis.erledigt];
  for (const ende of ton.enden) {
    if (ende.at <= gespieltAt && !erledigt.includes(ende.schluessel)) {
      erledigt.push(ende.schluessel);
    }
  }
  return { erledigt, gespieltUm: [...gedaechtnis.gespieltUm, gespieltAt].slice(-GEMERKTE_TOENE) };
}
