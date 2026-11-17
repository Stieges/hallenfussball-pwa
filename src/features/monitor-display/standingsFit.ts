/**
 * Schriftgröße der Monitor-Tabelle nach freier Höhe und Zeilenzahl (@ZM-125, @ZM-129, @ZM-087): reine Funktion ohne React.
 *
 * Die Tabelle nutzt die Bildhöhe innerhalb des Bildrands: wenige Zeilen (6 Teams) bekommen eine große Schrift, viele (12 Teams) fallen bis
 * zur harten Untergrenze von 3 % der Bildhöhe. Das Modell rechnet wie `listRows.ts` aus den Tokens (`displayList.standings`), nimmt ein
 * Querformat 16:9 an und ist vorsichtig (lieber etwas kleiner als eine abgeschnittene Zeile). Lange Namen belegen mehrere Zeilen
 * (`nameLines`), die Höhe der Zeile wächst entsprechend.
 */
import { displayList } from '../../design-tokens';
import { nameLines } from './listRows';

/** Zahl am Anfang eines Token-Werts („6.5vh“, „0.25em“, „0.3em 0.5em“). */
function num(token: string): number {
  return parseFloat(token);
}

/** Breite eines Zeichens in em der Schrift, vorsichtig (gemessen 0,57). */
const CHAR_EM = 0.6;
/** Querformat 16:9: Breite in Einheiten der Bildhöhe. */
const WIDTH_VH = (100 * 16) / 9;
/** Rahmen einer Zeile in vh (1 px bei 720 Zeilen, aufgerundet). */
const BORDER_VH = 0.2;
/** Reserve unten in vh (Rundung, Schattenwurf). */
const RESERVE_VH = 1.5;
/** Feinheit der Suche in vh. */
const STEP_VH = 0.05;
/** Spalten der Tabelle: Platz | Name | S | U | N | Diff | Pkt (`displayList.standingsColumns`, in em der Zeilenschrift). */
const COLUMNS = displayList.standingsColumns.replace(/minmax\([^)]*\)/, 'fr').split(' ');
/** Breite aller Spalten außer dem Namen in em (die Namensspalte ist `minmax(0, 1fr)`). */
const FIXED_EM = COLUMNS.filter(c => c.endsWith('em')).reduce((sum, c) => sum + num(c), 0);
const COLUMN_GAPS = COLUMNS.length - 1;

const { standings: tokens } = displayList;
const padY = num(tokens.rowPaddingY);
const padX = num(tokens.rowPaddingX);
const cardPadY = num(tokens.cardPadding);
const cardPadX = num(tokens.cardPadding.split(' ')[1]);
const gap = num(tokens.cellGap);

/** Höhe von Überschrift und Abstand darunter in vh (Überschrift fest, `SlideHeading`). */
const HEADING_BLOCK_VH = num(displayList.fontSizes.heading) * tokens.lineHeight + num(displayList.headingGap);

/** Zeichen eines Teamnamens je Zeile bei Schrift `font` (vh) und Bildrand `overscan` (Prozent). */
export function standingsCharsPerLine(font: number, overscan: number): number {
  const total = WIDTH_VH * (1 - (2 * overscan) / 100);
  const name = total - font * (2 * cardPadX + 2 * padX + COLUMN_GAPS * gap + FIXED_EM);
  return Math.max(1, Math.floor(name / (CHAR_EM * font)));
}

/** Höhe der Tabelle samt Überschrift in vh bei Zeilenschrift `font` (vh). */
export function standingsHeight(names: readonly string[], font: number, overscan: number): number {
  const perLine = standingsCharsPerLine(font, overscan);
  const rowChrome = 2 * padY * font + BORDER_VH;
  const head = Math.max(num(displayList.fontSizes.head), tokens.headRatio * font) * tokens.lineHeight + rowChrome;
  const rows = names.reduce((sum, name) => sum + nameLines(name, perLine) * font * tokens.lineHeight + rowChrome, 0);
  return HEADING_BLOCK_VH + 2 * cardPadY * font + 2 * BORDER_VH + head + rows;
}

/** Größte Zeilenschrift (vh) zwischen Untergrenze und Obergrenze, bei der die Tabelle in die freie Höhe passt; sonst die Untergrenze. */
export function standingsFont(names: readonly string[], overscan: number): number {
  const min = num(tokens.fontMin);
  const available = 100 - 2 * overscan - RESERVE_VH;
  for (let font = num(tokens.fontMax); font > min; font -= STEP_VH) {
    if (standingsHeight(names, font, overscan) <= available) {
      return Math.round(font * 100) / 100;
    }
  }
  return min;
}

/** Schrift als CSS-Wert („5.95vh“). */
export function standingsFontSize(names: readonly string[], overscan: number): string {
  return `${String(standingsFont(names, overscan))}vh`;
}
