/**
 * Gedächtnis des Geräts über Tabs und Neuladen (H3b-2b Fixrunde 1, Review W2, Regel 4 „je Gerät jedes Ende genau einmal“):
 * `localStorage` `hallenton:gedaechtnis` je Turnier mit den erledigten Enden der letzten 10 Minuten (Schlüssel → Serverzeit des
 * Erledigens) und den Zeitpunkten der zuletzt gespielten Töne. Ein Tab, der die Sperre übernimmt oder nach dem Neuladen
 * aktiviert wird, liest es und tönt ein schon gespieltes Ende nicht noch einmal. Ältere Einträge braucht niemand: nach 5 s
 * tönt ein Ende ohnehin nicht mehr (@HT-013). Nichts wirft.
 */
import type { TonGedaechtnis } from '../../../core/hallenton';
import type { KanalSpeicher } from './lautsprecherKanal';
import { lies, schreib } from './tonEinstellungen';

export const GEDAECHTNIS_SCHLUESSEL = 'hallenton:gedaechtnis';
export const GEDAECHTNIS_HALTEN_MS = 10 * 60_000;
const GEMERKTE_TOENE = 8;

interface Gespeichert {
  turnierId: string;
  erledigt: Record<string, number>;
  gespieltUm: number[];
}

function lesen(speicher: KanalSpeicher | null, turnierId: string): Gespeichert | null {
  try {
    const roh: unknown = JSON.parse(lies(speicher, GEDAECHTNIS_SCHLUESSEL) ?? 'null');
    if (!roh || typeof roh !== 'object') {
      return null;
    }
    const g = roh as Partial<Gespeichert>;
    const erledigt = g.erledigt && typeof g.erledigt === 'object' ? g.erledigt : null;
    const gespieltUm = Array.isArray(g.gespieltUm) ? g.gespieltUm.filter((t): t is number => typeof t === 'number') : null;
    if (g.turnierId !== turnierId || erledigt === null || gespieltUm === null) {
      return null;
    }
    const nurZahlen = Object.fromEntries(Object.entries(erledigt).filter(([, t]) => typeof t === 'number'));
    return { turnierId, erledigt: nurZahlen, gespieltUm };
  } catch {
    return null;
  }
}

/** Das gemeinsame Gedächtnis mit dem eigenen vereint (für `beginne`). */
export function vereineGedaechtnis(speicher: KanalSpeicher | null, turnierId: string, eigenes: TonGedaechtnis, now: number): TonGedaechtnis {
  const geteilt = lesen(speicher, turnierId);
  if (!geteilt) {
    return eigenes;
  }
  const frisch = Object.entries(geteilt.erledigt).filter(([, t]) => now - t <= GEDAECHTNIS_HALTEN_MS).map(([s]) => s);
  const erledigt = [...new Set([...eigenes.erledigt, ...frisch])];
  const gespieltUm = [...new Set([...eigenes.gespieltUm, ...geteilt.gespieltUm])].sort((a, b) => a - b).slice(-GEMERKTE_TOENE);
  return { erledigt, gespieltUm };
}

/** Nach jedem gespielten Ton: erledigte Enden (mit der Zeit des ersten Erledigens) und gespielte Zeiten teilen. */
export function teileGedaechtnis(speicher: KanalSpeicher | null, turnierId: string, gedaechtnis: TonGedaechtnis, now: number): void {
  const alt = lesen(speicher, turnierId)?.erledigt ?? {};
  const erledigt: Record<string, number> = {};
  for (const schluessel of new Set([...Object.keys(alt), ...gedaechtnis.erledigt])) {
    const seit = alt[schluessel] ?? now;
    if (now - seit <= GEDAECHTNIS_HALTEN_MS) {
      erledigt[schluessel] = seit;
    }
  }
  const eintrag: Gespeichert = { turnierId, erledigt, gespieltUm: gedaechtnis.gespieltUm.slice(-GEMERKTE_TOENE) };
  schreib(speicher, GEDAECHTNIS_SCHLUESSEL, JSON.stringify(eintrag));
}
