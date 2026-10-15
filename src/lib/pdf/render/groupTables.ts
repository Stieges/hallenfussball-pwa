/**
 * Spieltabelle der Gruppenphase (B-28 C1). Nur Zeichnen: eine Tabelle, Feld-Spalte nur bei mehr als einem Feld,
 * Gruppen-Spalte „Gr“ nur bei mehr als einer Gruppe. Läuft sie über die Seite, kommt die Folgeseite mit wiederholtem
 * Spaltenkopf (Kurzkopf: `shortHeader.ts`). Die Tabelle selbst steht in `matchTable.ts`.
 */
import type jsPDF from 'jspdf';
import type { GeneratedSchedule } from '../../../core/generators';
import { printColumns, printGap, printMetrics, printType } from '../../../design-tokens/print';
import { getGroupShortCode } from '../../../utils/displayNames';
import { ensureSpace, type PageGeometry } from '../layout';
import type { StatefulMatch } from '../tournamentState';
import { renderMatchTable, type MatchTableContext } from './matchTable';
import { sectionTitle } from './matchTables';

type GeneratedTournament = GeneratedSchedule['tournament'];

/** Gruppenphase: Titel, dann die Spieltabelle. Rückgabe: nächste freie Grundlinie. */
export function renderGroupStage(
  doc: jsPDF,
  matches: StatefulMatch[],
  ctx: MatchTableContext,
  numberOfFields: number,
  geo: PageGeometry,
  yPos: number,
  tournament: GeneratedTournament,
  sectionName: string
): number {
  yPos = ensureSpace(doc, yPos, printMetrics.sectionTitleMinSpace, geo);
  yPos = sectionTitle(doc, sectionName, geo, yPos, printType.h2);

  // Spalte „Gr“ nur, wenn es mehr als eine Gruppe gibt
  const hasMultipleGroups = new Set(matches.map(match => match.group).filter(Boolean)).size > 1;

  const end = renderMatchTable(doc, {
    matches,
    widths: printColumns.match,
    showField: numberOfFields > 1,
    ...(hasMultipleGroups ? { groupCode: match => (match.group ? getGroupShortCode(match.group, tournament) : '-') } : {}),
  }, ctx, yPos);
  return end + printGap.sectionGap;
}
