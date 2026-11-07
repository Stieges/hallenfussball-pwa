/**
 * Planer des Hallen-Lautsprechers (Record `2026-10-15_hallenton.md`, vier Regeln; @HT-002 – @HT-013, @HT-031 – @HT-034).
 * Rein, ohne React und ohne Uhr: Stand je Feld + Serverzeit + Gedächtnis → geplante Töne und Warnungen.
 *
 * - Regel 2: Stand am Server nur mit Antwort ≤ 3 s; sonst kein Ton nach altem Stand und Warnung (@HT-011). Das eigene
 *   Cockpit gilt immer (@HT-033 Zeile 11).
 * - Kein Nachholen (@HT-013): Ein Ende, das bei seiner Ankunft (`bekanntSeit`) länger als 5 s zurückliegt, tönt nicht;
 *   ebenso keins, das seit mehr als 5 s bekannt ist und noch nicht gespielt wurde. Ein Ende durch eine Korrektur über die
 *   Grenze zählt ab der Korrektur (`enden.ts`, Controller 07.11.).
 * - Regel 4: jedes Ende genau einmal (Schlüssel im Gedächtnis); Enden innerhalb 1 s ergeben einen Ton – Abpfiff-Ton, wenn
 *   eines davon ein Abpfiff ist, gleich welches Ende zuerst ankommt (@HT-032). Ein Ende bis 1 s neben einem gespielten Ton
 *   geht in diesem auf.
 */
import { feldEndeOf, restBisGrenzeMs, type FeldEnde } from './enden';
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

/**
 * Regel 4: Ein Ende innerhalb von 1 s um einen gespielten Ton geht in diesem auf. Gemessen wird am Zeitpunkt des Endes selbst,
 * nicht am Zeitpunkt des Plans – sonst tönte ein Ende, das erst mit der nächsten Abfrage (> 1 s später) ankommt, nach (C1).
 */
function inGespieltemTonAufgegangen(gespieltUm: readonly number[], endeAt: number): boolean {
  return gespieltUm.some((um) => Math.abs(endeAt - um) <= ZUSAMMEN_MS);
}

function tonAus(gruppe: readonly Kandidat[]): GeplanterTon {
  const at = gruppe[0].zeit;
  // ist eines der Enden ein Abpfiff, ist es der Abpfiff-Ton – gleich, welches Ende zuerst ankommt (@HT-032 Zeilen 3, 4)
  const art: HallTonArt = gruppe.some((k) => k.ende.art === 'abpfiff') ? 'abpfiff' : 'halbzeit';
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
    // gemischte Gruppe (Server-Feld + eigenes Cockpit): keine Prüfung – der Ton ist für das eigene Feld ohnehin fällig, ein
    // Server-Feld mit veraltetem Stand tönt dann mit (Review M3, harmlos)
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
      // Gerätestatus, auch ohne laufendes Spiel; Hinweise im Cockpit zeigt H3b nur bei laufendem Spiel (Review M7)
      warnungen.push({ feldId: feld.feldId, grund: 'keineVerbindung' });
      continue;
    }
    // enge Abfrage auch bei angehaltener Uhr kurz vor Schluss: jede Unterbrechung verschiebt das Ende (@HT-005, I1)
    const rest = ausServer ? restBisGrenzeMs(feld.state, feld.ctx, serverNow) : null;
    if (rest !== null && rest <= ENGE_ABFRAGE_AB_MS) {
      abfrageTaktMs = ENGE_ABFRAGE_TAKT_MS;
    }
    const ende = feldEndeOf(feld.state, feld.ctx, serverNow);
    if (ende === null || erledigt.has(ende.schluessel)) {
      continue;
    }
    // 5 s ab Bekanntwerden: bei der Ankunft nicht älter als 5 s, und seit dem Bekanntwerden nicht länger als 5 s ungespielt
    const bekanntAb = Math.max(feld.bekanntSeit, ende.at);
    if (feld.bekanntSeit - ende.at > NACHHOLEN_MAX_MS || serverNow - bekanntAb > NACHHOLEN_MAX_MS) {
      erledige(ende.schluessel);
      continue;
    }
    const zeit = Math.max(ende.at, serverNow);
    if (inGespieltemTonAufgegangen(gedaechtnis.gespieltUm, ende.at)) {
      // endgültig erst, wenn das Ende eingetreten ist – ein künftiges kann sich noch verschieben (Pause, Korrektur)
      if (ende.at <= serverNow) {
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
