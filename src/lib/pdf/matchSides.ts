/**
 * Ein-Stellen-Regel für die Anzeige einer Spielseite im PDF (B-28a1).
 *
 * Nur diese Datei liest `homeTeam`/`awayTeam`/`originalTeamA/B` aus dem Spiel. Solange ein Platz nicht besetzt ist,
 * wird die Herkunft aus dem Rohschlüssel (`originalTeamA/B`, z. B. `group-a-2nd`, `semi1-winner`) in der Sprache des
 * Dokuments übersetzt (B-28 C4, `origin.ts`, @DR-022), nicht aus dem vorübersetzten Text des Generators. Ein besetzter
 * Platz zeigt den Teamnamen. B-35 kann diese eine Stelle auf `slotLabel` umstellen, die Render-Dateien bleiben unverändert.
 */
import type { ScheduledMatch } from '../../core/generators';
import { isGroupOrigin, originLabel } from './origin';
import type { StructuralOrigin } from './originStructure';
import type { PdfTexts } from './translations';

/** Kontext der Spielseiten. */
export interface PdfSideContext {
  /** Tabellen aus (B-28 C5, @ZM-102; gilt nicht für die Fassung zum Ausfüllen, @DR-018): offene Gruppen-Herkunft wird „noch offen“, Sieger/Verlierer bleiben; ein besetzter Platz zeigt den Teamnamen. */
  hidePendingOrigin?: boolean;
  /** Fassung zum Ausfüllen (B-28 C6): ein Finalplatz zeigt immer seine Herkunft, nie das feststehende Team. */
  originOnly?: boolean;
  /** Herkunft aus der Turnierstruktur (`originStructure.ts`); nötig für besetzte Finalplätze bei `originOnly`. */
  structure?: StructuralOrigin;
  /** Gruppe des Teams mit diesem Namen: ein besetzter Platz zählt nur, wenn sie zur Gruppen-Herkunft passt. */
  groupOf?: (name: string) => string | undefined;
  /** Texte des Dokuments: ohne sie bleibt die Anzeige, wie der Generator sie liefert. */
  t?: PdfTexts;
  /** Ist `name` der Name eines Teams des Plans? Dann ist der Platz besetzt. */
  isTeam?: (name: string) => boolean;
  /** Anzeigename einer Gruppe (eigene Gruppennamen des Turniers). */
  groupName?: (id: string) => string;
}

/** Besetzter Finalplatz bei `originOnly` (Fassung zum Ausfüllen): Herkunft aus der Struktur, nie der Teamname. */
function occupiedFinalLabel(shown: string, key: string | undefined, ctx: PdfSideContext, t: PdfTexts): string {
  const group = key !== undefined && isGroupOrigin(key);
  // Gruppen-Herkunft nur, wenn das besetzte Team in der genannten Gruppe spielt; sonst ist die Zuordnung geraten
  const fits = !group || ctx.groupOf?.(shown)?.toLowerCase() === key.split('-')[1]?.toLowerCase();
  const known = key !== undefined && fits && (group || originLabel(key, t) !== key);
  if (!known) {
    return t.origin.undecided;
  }
  return ctx.originOnly === true ? originLabel(key, t, ctx.groupName) : shown;
}

/** Anzeige der Seite `A` (Heim) oder `B` (Gast) eines Spiels. */
export function sideLabel(match: ScheduledMatch, side: 'A' | 'B', ctx: PdfSideContext = {}): string {
  const shown = side === 'A' ? match.homeTeam : match.awayTeam;
  const raw = side === 'A' ? match.originalTeamA : match.originalTeamB;
  if (!ctx.t) {
    return shown;
  }
  if (ctx.isTeam?.(shown) === true) {
    // Nur die Fassung zum Ausfüllen zeigt für einen besetzten Platz die Herkunft; bei ausgeschalteten Tabellen steht der
    // Teamname ohne Herkunft (@ZM-102), „noch offen“ gilt nur für offene Plätze.
    return ctx.originOnly === true && match.phase !== 'groupStage' ? occupiedFinalLabel(shown, ctx.structure?.(match, side), ctx, ctx.t) : shown;
  }
  // „noch offen“ nur für Spielplan und Zuschauer; die Fassung zum Ausfüllen zeigt immer die Herkunft (@DR-018)
  if (ctx.hidePendingOrigin === true && ctx.originOnly !== true && (isGroupOrigin(raw) || isGroupOrigin(shown))) {
    return ctx.t.origin.undecided;
  }
  const fromRaw = originLabel(raw, ctx.t, ctx.groupName);
  return fromRaw === raw ? originLabel(shown, ctx.t, ctx.groupName) : fromRaw;
}
