/**
 * Ein-Stellen-Regel für die Anzeige einer Spielseite im PDF (B-28a1).
 *
 * Nur diese Datei liest `homeTeam`/`awayTeam` und die Herkunft aus dem Spiel. Die Herkunft eines Platzes steht seit
 * A-36a am Spiel (`originA/B`, unveränderlich, auch nach der Besetzung), sonst im offenen Slot. Sie wird in der Sprache
 * des Dokuments übersetzt (B-28 C4, `origin.ts`, @DR-022), nicht aus dem vorübersetzten Text des Generators. Ein
 * besetzter Platz zeigt den Teamnamen.
 */
import type { ScheduledMatch } from '../../core/generators';
import { slotSource } from '../../core/models/matchSlot';
import type { SlotSource } from '../../core/models/schemas/MatchSlotSchema';
import { isGroupOrigin, originLabel, sourceLabel, type OriginMatch } from './origin';
import type { PdfTexts } from './translations';

/** Kontext der Spielseiten. */
export interface PdfSideContext {
  /** Tabellen aus (B-28 C5, @ZM-102; gilt nicht für die Fassung zum Ausfüllen, @DR-018): offene Gruppen-Herkunft wird „noch offen“, Sieger/Verlierer bleiben; ein besetzter Platz zeigt den Teamnamen. */
  hidePendingOrigin?: boolean;
  /** Fassung zum Ausfüllen (B-28 C6): ein Finalplatz zeigt immer seine Herkunft, nie das feststehende Team. */
  originOnly?: boolean;
  /** Spiele des Plans: benennen das Vorgängerspiel einer Sieger-/Verlierer-Herkunft („Halbfinale 1“). */
  matches?: readonly OriginMatch[];
  /** Texte des Dokuments: ohne sie bleibt die Anzeige, wie der Generator sie liefert. */
  t?: PdfTexts;
  /** Ist `name` der Name eines Teams des Plans? Dann ist der Platz besetzt. */
  isTeam?: (name: string) => boolean;
  /** Anzeigename einer Gruppe (eigene Gruppennamen des Turniers). */
  groupName?: (id: string) => string;
}

/** Herkunft des Platzes: gespeichert am Spiel (A-36a), sonst die Herkunft im Slot (offen oder `resolvedFrom`). */
function sideOrigin(match: ScheduledMatch, side: 'A' | 'B'): SlotSource | undefined {
  const stored = side === 'A' ? match.originA : match.originB;
  const slot = side === 'A' ? match.slotA : match.slotB;
  // Plan-Spiele aus Altdaten können ohne Slot ankommen (Laufzeit, nicht Typ)
  return stored ?? (slot === undefined ? undefined : slotSource(slot));
}

/** Anzeige der Seite `A` (Heim) oder `B` (Gast) eines Spiels. */
export function sideLabel(match: ScheduledMatch, side: 'A' | 'B', ctx: PdfSideContext = {}): string {
  const shown = side === 'A' ? match.homeTeam : match.awayTeam;
  if (!ctx.t) {
    return shown;
  }
  const source = sideOrigin(match, side);
  const fromSource = source === undefined ? undefined : sourceLabel(source, ctx.t, ctx.matches ?? [], ctx.groupName);
  if (ctx.isTeam?.(shown) === true) {
    // Nur die Fassung zum Ausfüllen zeigt für einen besetzten Finalplatz die Herkunft (nie den Teamnamen); bei
    // ausgeschalteten Tabellen steht der Teamname ohne Herkunft (@ZM-102), „noch offen“ gilt nur für offene Plätze.
    return ctx.originOnly === true && match.phase !== 'groupStage' ? fromSource ?? ctx.t.origin.undecided : shown;
  }
  // „noch offen“ nur für Spielplan und Zuschauer; die Fassung zum Ausfüllen zeigt immer die Herkunft (@DR-018)
  if (ctx.hidePendingOrigin === true && ctx.originOnly !== true && (source?.kind === 'groupRank' || isGroupOrigin(shown))) {
    return ctx.t.origin.undecided;
  }
  return fromSource ?? originLabel(shown, ctx.t, ctx.groupName);
}
