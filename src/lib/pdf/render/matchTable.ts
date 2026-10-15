/**
 * Eine Spieltabelle (B-28 C1): Spalten Nr, Zeit, Feld, Gr, Heim, Ergebnis, Gast, SR. Gruppenphase und Finalrunde
 * teilen sich diese Funktion; sie unterscheiden sich in den Spaltenbreiten, der Gruppen-Spalte und der Regel der Runde
 * (kleine Felder). Spalten sind benannt, nicht nummeriert. Die Ergebniszelle bleibt leer und wird im
 * `didDrawCell`-Hook gezeichnet (`scoreCell.ts`). Spielseiten nur über `sideLabel` (Ein-Stellen-Regel).
 */
import type jsPDF from 'jspdf';
import autoTable, { type CellInput, type RowInput, type Styles } from 'jspdf-autotable';
import type { ScheduledMatch } from '../../../core/generators';
import { printGap, printType } from '../../../design-tokens/print';
import type { TiebreakerMode } from '../../../types/tournament';
import { resultState, type ResultOptions } from '../matchResult';
import { sideLabel } from '../matchSides';
import { tableEndY } from '../jspdfTypes';
import type { PageGeometry } from '../layout';
import type { ScoreSpec } from '../scoreLayout';
import type { StatefulMatch } from '../tournamentState';
import type { PdfTexts } from '../translations';
import { drawLiveBar, drawRefereeField, drawScoreCell, scoreCellMinHeight, scoreSpecFor } from './scoreCell';
import { matchTableOptions, pad } from './matchTables';

type ColumnKey = 'nr' | 'time' | 'field' | 'group' | 'home' | 'result' | 'away' | 'referee';

/** Breiten der festen Spalten in mm (Token `printColumns`). `group` fehlt in der Finalrunde. */
export interface ColumnWidths { nr: number; time: number; field: number; group?: number; result: number; referee: number }

/** Was die Tabelle von außen braucht: Texte, Seitenmaß, Ergebnisoptionen und die Anzeige des Schiedsrichters. */
export interface MatchTableContext {
  t: PdfTexts;
  geo: PageGeometry;
  result: ResultOptions;
  /** Anzeige in der Spalte „SR“; leer heißt: Schreibfeld. */
  refereeLabel: (match: ScheduledMatch) => string;
}

export interface MatchTableInput {
  matches: StatefulMatch[];
  widths: ColumnWidths;
  showField: boolean;
  /** Kurzzeichen der Gruppe eines Spiels; ohne diese Funktion keine Spalte „Gr“. */
  groupCode?: (match: ScheduledMatch) => string;
  /** Regel der Runde bei K.-o.-Spielen: bestimmt die kleinen Felder. */
  mode?: TiebreakerMode;
  /** Innenabstand oben und unten; Vorgabe `printGap.bodyPadV`, die Finalrunde nimmt `printGap.finalPadV`. */
  padV?: number;
}

interface Row { match: StatefulMatch; spec: ScoreSpec; referee: string }

interface Column {
  key: ColumnKey;
  head: string;
  style: Partial<Styles>;
  cell: (row: Row) => CellInput;
}

function buildColumns(input: MatchTableInput, ctx: MatchTableContext): Column[] {
  const { t } = ctx;
  const { widths } = input;
  const columns: Column[] = [
    { key: 'nr', head: t.nr, style: { halign: 'center', cellWidth: widths.nr, fontSize: printType.nr, cellPadding: pad(input.padV ?? printGap.bodyPadV, printGap.nrPad) }, cell: r => r.match.matchNumber.toString() },
    { key: 'time', head: t.timeHeader, style: { halign: 'center', cellWidth: widths.time, fontSize: printType.time, fontStyle: 'bold' }, cell: r => r.match.time },
  ];
  if (input.showField) {
    columns.push({ key: 'field', head: t.field, style: { halign: 'center', cellWidth: widths.field }, cell: r => r.match.field.toString() });
  }
  const { groupCode } = input;
  if (groupCode && widths.group !== undefined) {
    columns.push({ key: 'group', head: t.group, style: { halign: 'center', cellWidth: widths.group, fontStyle: 'bold' }, cell: r => groupCode(r.match) });
  }
  columns.push(
    { key: 'home', head: t.home, style: { halign: 'right' }, cell: r => sideLabel(r.match, 'A') }, // Heim endet am Ergebnis
    {
      key: 'result',
      head: t.result,
      style: { halign: 'center', cellWidth: widths.result },
      cell: r => ({ content: '', styles: { minCellHeight: scoreCellMinHeight(r.spec, input.padV ?? printGap.bodyPadV) } }),
    },
    { key: 'away', head: t.away, style: { halign: 'left' }, cell: r => sideLabel(r.match, 'B') },
    { key: 'referee', head: t.referee, style: { halign: 'center', cellWidth: widths.referee }, cell: r => r.referee },
  );
  return columns;
}

/** Zeichnet die Tabelle ab `startY`; Rückgabe: Unterkante der Tabelle. */
export function renderMatchTable(doc: jsPDF, input: MatchTableInput, ctx: MatchTableContext, startY: number): number {
  const columns = buildColumns(input, ctx);
  const rows: Row[] = input.matches.map(match => ({
    match,
    spec: scoreSpecFor(resultState(match, ctx.result), input.mode, ctx.t),
    referee: ctx.refereeLabel(match),
  }));
  const head: RowInput[] = [columns.map(column => column.head)];
  const body: RowInput[] = rows.map(row => columns.map(column => column.cell(row)));
  const columnStyles: Record<number, Partial<Styles>> = {};
  columns.forEach((column, index) => {
    columnStyles[index] = column.style;
  });

  autoTable(doc, {
    ...matchTableOptions(ctx.geo, startY, head, body, columnStyles, input.padV),
    didDrawCell: data => {
      if (data.section !== 'body') {
        return;
      }
      // Eine geteilte Restzeile (nur ohne `rowPageBreak: 'avoid'`, etwa bei einer Zeile höher als die Seite) hat keinen Eintrag
      const row = rows.at(data.row.index);
      if (!row) {
        return;
      }
      const cell = { x: data.cell.x, y: data.cell.y, w: data.cell.width, h: data.cell.height };
      switch (columns[data.column.index].key) {
        case 'result':
          drawScoreCell(doc, cell, row.spec);
          break;
        case 'nr':
          if (row.spec.kind === 'live') {
            drawLiveBar(doc, cell);
          }
          break;
        case 'referee':
          if (row.referee === '') {
            drawRefereeField(doc, cell, printGap.bodyPadH);
          }
          break;
        default:
          break;
      }
    },
  });
  return tableEndY(doc);
}
