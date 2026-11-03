/**
 * Platzierung (@DR-005, @DR-009). Rein, fertig vermessen: Überschrift, vor dem Abschluss der Satz „Die Platzierung steht nach dem
 * Finale fest“, dann eine Zeile je Platz in zwei Spalten (Plätze 1 bis ⌈n/2⌉ links, der Rest rechts, gleiche Zeilen nebeneinander).
 * Offen: je Team eine Schreiblinie, über der bis zur Oberkante der Zeile mindestens 5 mm frei bleiben (@DR-034). Abgeschlossen:
 * der Name laut gespeichertem Endstand auf der Linie (nie gekürzt, bis zu drei Zeilen, die Zeile wächst für beide Spalten).
 */
import { printLimits, printType } from '../../../design-tokens/print';
import { printFinals, printMatchRow, printTail, printWriteLine } from '../../../design-tokens/print-sheet';
import type { PlacementState, RankEntry } from '../placement';
import type { ModelEnv } from './env';
import { wrapName } from './nameLines';
import type { Placeable, Splittable } from './sectionFlow';
import { advanceMm, ascent, run } from './text';
import type { TextRun, WriteLine } from './types';

interface Slot { place: number; name: string | undefined }

/** Platzierung als Teile (ganz oder zwischen Zeilen geteilt); `ranking` nur im Zustand `final`. */
export function rankingParts(env: ModelEnv, state: PlacementState, ranking: RankEntry[], hasFinalRound: boolean): Splittable {
  const { geo, t, input } = env.source;
  const teamCount = input.schedule.teams.length;
  const pending = state === 'open';
  const slots: Slot[] = pending
    ? Array.from({ length: teamCount }, (_, i) => ({ place: i + 1, name: undefined }))
    : ranking.map(entry => ({ place: entry.place, name: entry.team.name }));
  const rows = Math.ceil(slots.length / 2);
  const columnW = (geo.contentWidth - printWriteLine.rankColumnGap) / 2;
  // Die Platznummer ist mindestens `rankNumberWidth` breit, bei „10.“ so breit wie die Schrift verlangt (Linie beginnt dahinter)
  const numberW = Math.max(printWriteLine.rankNumberWidth, ...slots.map(slot => env.measure.width(`${slot.place}.`, printTail.rankNumberPt, 'bold') + printFinals.nameOuter));
  const nameW = columnW - numberW - printFinals.nameOuter;
  const adv = advanceMm(printType.body, printMatchRow.lineHeight);
  const nameLines = (slot: Slot | undefined): string[] => (slot?.name === undefined ? [] : wrapName(slot.name, nameW, printLimits.teamPt, env.measure));
  const rowHeights = Array.from({ length: rows }, (_, i) =>
    printWriteLine.rankRowHeight + Math.max(0, Math.max(nameLines(slots[i]).length, nameLines(slots[i + rows]).length) - 1) * adv);
  const head = printTail.rankTitleBand + (pending ? printTail.rankSentenceBand : 0);
  const sum = (from: number, to: number): number => rowHeights.slice(from, to).reduce((total, h) => total + h, 0);
  /** Zeilen `from` bis `to`; Überschrift und Satz nur vor der ersten Zeile. */
  const chunk = (from: number, to: number): Placeable => ({
    height: (from === 0 ? head : 0) + sum(from, to),
    build: top => {
      const runs: TextRun[] = [];
      if (from === 0) {
        runs.push(run(t.finalRanking, geo.left, top + ascent(printType.h2), printType.h2, 'bold'));
        if (pending) {
          runs.push(run(hasFinalRound ? t.placementPending.afterFinal : t.placementPending.afterLast, geo.left, top + printTail.rankTitleBand + ascent(printType.note), printType.note, 'normal'));
        }
      }
      const lines: WriteLine[] = [];
      let y = top + (from === 0 ? head : 0);
      for (let i = from; i < to; i++) {
        const h = rowHeights[i];
        const lineY = y + h - printWriteLine.rankLineLift;
        [slots[i], slots[i + rows]].forEach((slot, side) => {
          if (!slot) { return; }
          const x = geo.left + side * (columnW + printWriteLine.rankColumnGap);
          const base = lineY - printFinals.baselineRise;
          runs.push(run(`${slot.place}.`, x, base, printTail.rankNumberPt, 'bold'));
          const names = nameLines(slot);
          names.forEach((line, k) => runs.push(run(line, x + numberW, base - (names.length - 1 - k) * adv, printLimits.teamPt, 'normal')));
          lines.push({ kind: 'rank', x1: x + numberW, x2: x + columnW, y: lineY });
        });
        y += h;
      }
      const height = y - top;
      return [{ kind: 'ranking', top, height, runs, lines }];
    },
  });
  return {
    height: head + sum(0, rows),
    // Passt die Liste nicht auf eine Seite, bricht sie nur zwischen zwei Zeilen um (@BM-021)
    chunks: capacity => {
      const parts: Placeable[] = [];
      let from = 0;
      let used = head;
      for (let i = 0; i < rows; i++) {
        if (i > from && used + rowHeights[i] > capacity) {
          parts.push(chunk(from, i));
          from = i;
          used = 0;
        }
        used += rowHeights[i];
      }
      parts.push(chunk(from, rows));
      return parts;
    },
  };
}
