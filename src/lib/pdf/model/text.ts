/**
 * Kleine Bausteine für Textstücke des Seitenmodells (`TextRun`): Grundlinie für mittig gesetzte Zeilen, Zeilenhöhe,
 * Umbruch einer Folge von Wörtern. Rein; Maße aus den Druck-Tokens.
 */
import { printFont, printUnit } from '../../../design-tokens/print';
import type { FontWeight, TextMeasure } from './measure';
import type { TextRun } from './types';

/** Zeilenabstand in mm bei `pt` Punkt und dem Faktor `lineHeight`. */
export function advanceMm(pt: number, lineHeight: number): number {
  return pt * lineHeight * printUnit.mmPerPt;
}

/** Grundlinie, auf der die Versalhöhe einer Zeile in `pt` Punkt senkrecht um `centerY` zentriert ist. */
export function centeredBaseline(centerY: number, pt: number): number {
  return centerY + (printFont.capEm * pt * printUnit.mmPerPt) / 2;
}

/** Oberlänge über der Grundlinie in mm. */
export function ascent(pt: number): number {
  return pt * printFont.ascentEm * printUnit.mmPerPt;
}

/** Unterlänge unter der Grundlinie in mm. */
export function descent(pt: number): number {
  return pt * printFont.descentEm * printUnit.mmPerPt;
}

export function run(text: string, x: number, y: number, pt: number, weight: FontWeight, align: TextRun['align'] = 'left'): TextRun {
  return { text, x, y, pt, weight, align };
}

/** Ein Wort mit Schnitt, für Fließtext aus fetten Bezeichnungen und normalem Text (Regelzeile). */
export interface Word { text: string; weight: FontWeight }

/**
 * Setzt Wörter fließend in Zeilen der Breite `width`; Leerzeichen zwischen den Wörtern misst der normale Schnitt.
 * Jede Zeile besteht aus aufeinanderfolgenden Textstücken gleichen Schnitts ab `x`; Grundlinie der ersten Zeile `y`.
 */
export function flowWords(words: Word[], x: number, y: number, width: number, pt: number, advance: number, measure: TextMeasure): TextRun[] {
  const space = measure.width(' ', pt, 'normal');
  const runs: TextRun[] = [];
  let line = 0;
  let cursor = 0;
  let open: TextRun | undefined;
  for (const word of words) {
    const w = measure.width(word.text, pt, word.weight);
    if (cursor > 0 && cursor + space + w > width) {
      line += 1;
      cursor = 0;
      open = undefined;
    }
    if (open?.weight === word.weight) {
      open.text += ` ${word.text}`;
      cursor += space + w;
      continue;
    }
    const gap = cursor > 0 ? space : 0;
    open = run(word.text, x + cursor + gap, y + line * advance, pt, word.weight);
    runs.push(open);
    cursor += gap + w;
  }
  return runs;
}
