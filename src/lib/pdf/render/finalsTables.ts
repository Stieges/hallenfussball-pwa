/**
 * Finalrunde: K.-o.-Zeilen über der Finalrunde (B-28a3-3b, @DR-015) und je Runde eine Überschrift und eine Tabelle
 * (B-28a3-4b Punkt 4): Achtelfinale, Viertelfinale, Halbfinale, Spiel um Platz 3 bzw. 5/7, Finale. Runden in der
 * Reihenfolge ihrer ersten Anstoßzeit, Spiele darin nach Anstoßzeit. Nur Zeichnen. Gemeinsame Tabellenoptionen und
 * Tabellenaufbau in `matchTable.ts`. Die Regel der Runde (`finalsConfig`) bestimmt die kleinen Felder.
 */
import type jsPDF from 'jspdf';
import type { ScheduledMatch } from '../../../core/generators';
import { printColors, printType, printMetrics, printGap, printColumns } from '../../../design-tokens/print';
import type { FinalsConfig, KnockoutRound } from '../../../types/tournament';
import { ascentMm, ensureSpace, type PageGeometry } from '../layout';
import { bracketRoundPerMatch, koModeFor, type KoKey } from '../koSlots';
import type { StatefulMatch } from '../tournamentState';
import type { PdfTexts } from '../translations';
import { PDF_FONT } from '../fonts';
import { renderMatchTable, type MatchTableContext } from './matchTable';
import { sectionTitle } from './matchTables';

/** Überschrift einer Runde: eine Runde des Brackets oder ein Platzierungsspiel. */
export type FinalRoundKey = KnockoutRound | 'thirdPlace' | 'fifthSixth' | 'seventhEighth';

export interface FinalRound {
  key: FinalRoundKey;
  /** Spiele der Runde, nach Anstoßzeit (bei gleicher Zeit nach Spielnummer). */
  matches: StatefulMatch[];
}

const PLACEMENT_KEYS: readonly FinalRoundKey[] = ['thirdPlace', 'fifthSixth', 'seventhEighth'];

/** Zeitfolge: Anstoßzeit, dann Spielnummer. */
function byKickoff(a: ScheduledMatch, b: ScheduledMatch): number {
  return a.startTime.getTime() - b.startTime.getTime() || a.matchNumber - b.matchNumber;
}

/**
 * Finalspiele in Runden gegliedert. Jede Runde kommt einmal vor, in der Reihenfolge ihrer ersten Anstoßzeit. Die
 * Runde eines Bracket-Spiels kommt aus `bracketRoundPerMatch` (Phase oder Bracket-Größe).
 */
export function finalRounds(finals: readonly StatefulMatch[]): FinalRound[] {
  const bracket = finals.filter(m => m.finalType !== 'final' && !PLACEMENT_KEYS.includes(m.finalType as FinalRoundKey));
  const rounds = bracketRoundPerMatch(bracket);
  const bracketRound = new Map<ScheduledMatch, KnockoutRound>(bracket.map((match, index) => [match, rounds[index]]));

  const groups = new Map<FinalRoundKey, StatefulMatch[]>();
  for (const match of finals) {
    const key: FinalRoundKey = match.finalType === 'final'
      ? 'final'
      : (match.finalType as FinalRoundKey | undefined) ?? bracketRound.get(match) ?? 'roundOf16';
    groups.set(key, [...(groups.get(key) ?? []), match]);
  }

  return Array.from(groups, ([key, matches]) => ({ key, matches: [...matches].sort(byKickoff) }))
    .sort((a, b) => byKickoff(a.matches[0], b.matches[0]));
}

/** Überschrift einer Runde über die Übersetzungen. */
function roundTitle(key: FinalRoundKey, t: PdfTexts): string {
  switch (key) {
    case 'thirdPlace':
      return t.thirdPlace;
    case 'fifthSixth':
      return t.fifthSixth;
    case 'seventhEighth':
      return t.seventhEighth;
    default:
      return t.phaseTitle(key, key);
  }
}

/**
 * K.-o.-Zeilen über der Finalrunde, je Zeile umbrochen. Rückgabe: nächste freie Grundlinie.
 */
function drawKoLines(doc: jsPDF, lines: string[], geo: PageGeometry, yPos: number): number {
  if (lines.length === 0) {
    return yPos;
  }
  doc.setTextColor(...printColors.ink);
  doc.setFont(PDF_FONT.family, 'normal');
  doc.setFontSize(printType.note);
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, geo.contentWidth) as string[];
    const height = wrapped.length * printMetrics.koLineAdvance;
    yPos = ensureSpace(doc, yPos, height, geo);
    wrapped.forEach((part, index) => {
      doc.text(part, geo.left, yPos + index * printMetrics.koLineAdvance);
    });
    yPos += height;
  }
  return yPos + printGap.sectionGap;
}

/** K.-o.-Schlüssel der Regel einer Runde: Platzierungsspiele 5 und 7 folgen der Regel „placement“. */
function koKeyOf(key: FinalRoundKey): KoKey {
  return key === 'fifthSixth' || key === 'seventhEighth' ? 'placement' : key;
}

/**
 * Finalrunde: K.-o.-Zeilen, dann je Runde eine Überschrift (h2) und eine Tabelle.
 */
export function renderFinalsSection(
  doc: jsPDF,
  finals: StatefulMatch[],
  ctx: MatchTableContext,
  numberOfFields: number,
  finalsConfig: FinalsConfig | null | undefined,
  geo: PageGeometry,
  yPos: number,
  koLines: string[]
): number {
  yPos = drawKoLines(doc, koLines, geo, yPos);
  for (const round of finalRounds(finals)) {
    yPos = ensureSpace(doc, yPos, printMetrics.sectionTitleMinSpace, geo);
    yPos = sectionTitle(doc, roundTitle(round.key, ctx.t), geo, yPos, printType.h2);
    const end = renderMatchTable(doc, {
      matches: round.matches,
      widths: printColumns.finals,
      showField: numberOfFields > 1,
      mode: koModeFor(koKeyOf(round.key), finalsConfig),
      padV: printGap.finalPadV,
    }, ctx, yPos);
    // Grundlinie der nächsten Überschrift (Runde oder Platzierung), B-28a3-4F F3
    yPos = end + printGap.sectionGap + ascentMm(printType.h2);
  }
  return yPos;
}
