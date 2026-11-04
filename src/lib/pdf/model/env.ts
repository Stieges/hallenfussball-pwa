/**
 * Gemeinsamer Eingang der Abschnitte des Seitenmodells (Spiele, Tabellen, Finalrunde, Platzierung): der aufgelöste PDF-Eingang,
 * die Regeln, die Sichtbarkeit und der Kontext der Spielseiten an einer Stelle. Rein.
 */
import { getGroupDisplayName } from '../../../utils/displayNames';
import type { ScheduledMatch } from '../../../core/generators';
import { printMatchTable } from '../../../design-tokens/print-sheet';
import type { PdfSideContext } from '../matchSides';
import { refereeLabelFor } from '../refereeLabel';
import { pdfRulesFrom, type PdfRules } from '../rules';
import { pdfContentRules } from '../visibility';
import type { RowTexts } from './matchRows';
import type { TextMeasure } from './measure';
import type { ScheduleModelSource } from './types';

export interface ModelEnv {
  source: ScheduleModelSource;
  measure: TextMeasure;
  rules: PdfRules;
  /** Ergebnisse sind für diese Zielgruppe sichtbar (`pdfContentRules`); `includeScores` kommt noch der Wunsch des Dialogs dazu. */
  resultsVisible: boolean;
  includeScores: boolean;
  includeStandings: boolean;
  /** Gruppentabellen und Platzierung sind für diese Zielgruppe sichtbar (`pdfContentRules`). */
  tablesVisible: boolean;
  sideCtx: PdfSideContext;
  refLabel: (match: ScheduledMatch) => string;
  rowTexts: RowTexts;
}

export function modelEnv(source: ScheduleModelSource, measure: TextMeasure): ModelEnv {
  const { input, t } = source;
  const { schedule, tournament, edition } = input;
  const content = pdfContentRules(tournament, input.audience, input.viewerBaseUrl);
  return {
    source,
    measure,
    rules: pdfRulesFrom(tournament, schedule),
    resultsVisible: content.results,
    includeScores: input.wish.scores && content.results,
    includeStandings: input.wish.standings && content.tables,
    tablesVisible: content.tables,
    sideCtx: {
      t,
      isTeam: name => schedule.teams.some(team => team.name === name),
      groupName: id => t.groupLabel(id, getGroupDisplayName(id, schedule.tournament)),
      hidePendingOrigin: content.hidePendingOrigin,
      originOnly: edition === 'blank',
      matches: schedule.allMatches,
    },
    refLabel: refereeLabelFor(schedule),
    rowTexts: { skipped: t.skipped, overtime: t.afterOvertime, shootout: t.shootout },
  };
}

/** Breite der Spalte „SR“: breitester Eintrag oder Kopf, mit Rand; `undefined` ohne Einträge (@DR-025, @DR-032). */
export function refereeWidthOf(labels: string[], head: string, measure: TextMeasure, inset: number = printMatchTable.refInset): number | undefined {
  const entries = labels.filter(label => label !== '');
  if (entries.length === 0) { return undefined; }
  return Math.max(...entries.map(label => measure.width(label, printMatchTable.refPt, 'normal')), measure.width(head, printMatchTable.headPt, 'bold')) + 2 * inset;
}
