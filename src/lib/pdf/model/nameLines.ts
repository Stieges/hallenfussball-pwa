/**
 * Umbruch eines Teamnamens (@DR-032): nur an einem Leerzeichen, nach einem Bindestrich und nach einem „/“, nie mitten im
 * Wort, nie gekürzt. Greedy: so wenige Zeilen wie möglich; mehr als zwei Zeilen ergeben sich nur, wenn der Name auch auf
 * zwei Zeilen nicht passt (Ausnahme dritte Zeile, Schrift gleich). Ein geschütztes Leerzeichen (U+00A0) trennt nicht.
 * Rein: gemessen wird über `TextMeasure`.
 */
import type { FontWeight, TextMeasure } from './measure';

/** Teile eines Namens, hinter denen umgebrochen werden darf; `space` heißt: hinter dem Teil steht ein Leerzeichen. */
interface Piece { text: string; space: boolean }

function piecesOf(name: string): Piece[] {
  return name
    .trim()
    .split(' ')
    .filter(word => word !== '')
    .flatMap(word => {
      const parts = word.match(/[^\-/]+[-/]?|[-/]/g) ?? [word];
      return parts.map((text, index) => ({ text, space: index === parts.length - 1 }));
    });
}

/** Zeilen des Namens in `width` mm bei `pt` Punkt im Schnitt `weight`. */
export function wrapName(name: string, width: number, pt: number, measure: TextMeasure, weight: FontWeight = 'normal'): string[] {
  const lines: string[] = [];
  let current = '';
  let pendingSpace = false;
  for (const piece of piecesOf(name)) {
    const joined = current === '' ? piece.text : `${current}${pendingSpace ? ' ' : ''}${piece.text}`;
    if (current !== '' && measure.width(joined, pt, weight) > width) {
      lines.push(current);
      current = piece.text;
    } else {
      current = joined;
    }
    pendingSpace = piece.space;
  }
  return current === '' ? lines : [...lines, current];
}
