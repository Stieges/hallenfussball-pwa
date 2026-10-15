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
import type { PdfTexts } from './translations';

/** Kontext der Spielseiten. */
export interface PdfSideContext {
  /** Gruppen-Herkunft eines offenen Platzes wird „noch offen“ (Tabellen aus, B-28 C5); Sieger/Verlierer bleiben. */
  hidePendingOrigin?: boolean;
  /** Fassung zum Ausfüllen (B-28 C6): auch ein besetzter Platz zeigt seine Herkunft, nie das feststehende Team. */
  originOnly?: boolean;
  /** Texte des Dokuments: ohne sie bleibt die Anzeige, wie der Generator sie liefert. */
  t?: PdfTexts;
  /** Ist `name` der Name eines Teams des Plans? Dann ist der Platz besetzt. */
  isTeam?: (name: string) => boolean;
  /** Anzeigename einer Gruppe (eigene Gruppennamen des Turniers). */
  groupName?: (id: string) => string;
}

/** Anzeige der Seite `A` (Heim) oder `B` (Gast) eines Spiels. */
export function sideLabel(match: ScheduledMatch, side: 'A' | 'B', ctx: PdfSideContext = {}): string {
  const shown = side === 'A' ? match.homeTeam : match.awayTeam;
  const raw = side === 'A' ? match.originalTeamA : match.originalTeamB;
  const occupied = ctx.isTeam?.(shown) === true;
  if (!ctx.t || (occupied && ctx.originOnly !== true)) {
    return shown;
  }
  if (ctx.hidePendingOrigin === true && (isGroupOrigin(raw) || isGroupOrigin(shown))) {
    return ctx.t.origin.undecided;
  }
  const fromRaw = originLabel(raw, ctx.t, ctx.groupName);
  return fromRaw === raw ? originLabel(shown, ctx.t, ctx.groupName) : fromRaw;
}
