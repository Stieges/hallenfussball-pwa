/**
 * Zeilen und Seiten der Listen-Folien „Spielplan eines Felds“ und „Nächste Spiele“ (@ZM-187, @ZM-188, @ZM-185, @ZM-129): reine
 * Funktionen ohne React.
 *
 * Seiten nach Höhe statt nach fester Zeilenzahl: Jede Zeile kostet so viel Höhe, wie ihre höchste Zelle (Uhrzeit mit „(war …)“,
 * Teamnamen mit voraussichtlichem Umbruch) braucht, und eine Seite fasst, was in die Bildhöhe passt, höchstens `maxRows` Spiele.
 * Nichts ist abgeschnitten (@ZM-188). Das Modell rechnet aus den Tokens der Folie (`displayList`) und nimmt ein Querformat 16:9
 * mit dem wirksamen Bildrand und dem Hinweis (`ListFrame`) an; es ist vorsichtig, lieber eine Seite mehr als eine abgeschnittene Zeile. Die Seitenzahl
 * braucht der Takt vor dem Zeichnen, darum wird sie gerechnet und nicht im Bild gemessen; `visual:metrics` und die Browser-Tests
 * messen im Bild nach, ob das Modell hält.
 *
 * Die Spalten einer Folie hängen nur an allen Spielen der Folie, nie an der Seite oder am Zustand eines Spiels: ändert sich ein
 * Spiel, rückt keine Zeile (@ZM-187).
 */
import { displayFontSizes, displayLayout, displayList, displayMonitor } from '../../design-tokens';
import type { MatchView } from '../../core/view';
import { monitorSideLabel } from './matchSides';

/**
 * Zusatzzeilen unter der Uhrzeit, die in jeder Zeile einer Folie gleich da sind oder in keiner (@ZM-187, @ZM-189). Es gibt keine eigenen
 * Spalten für Zustand, Feld oder Bezeichnung: alles steht unter der Uhrzeit.
 */
export interface ListColumns {
  /** Zeile für den Zustand („Live“, „Ende“ …) und „gewertet“: im Spielplan in jeder Zeile reserviert, damit nichts springt. */
  state: boolean;
  /** Zeile mit dem Feld: nur bei mehreren Feldern und nur in „Nächste Spiele“ (@ZM-189). */
  field: boolean;
}

/** Zusatzzeilen der Folie. `showState` nur im Spielplan; `matches` aller Felder entscheidet, ob es mehrere Felder gibt. */
export function listColumns(showState: boolean, showField: boolean, allMatches: readonly MatchView[]): ListColumns {
  return { state: showState, field: showField && new Set(allMatches.map(m => m.field)).size > 1 };
}

/** Spiele je Seite des Spielplans höchstens (@ZM-185: bis zu 4, bei sehr langen Namen weniger). */
export const SCHEDULE_MAX_ROWS = 4;

/** Zahl am Anfang eines Token-Werts („3.6vh“, „max(3.2cqh, 3vh)“, „11em“). */
function num(token: string): number {
  return parseFloat(token.replace(/^max\(/, ''));
}

const FONT = num(displayList.fontSizes.team);
/** Zeilenhöhe der Schrift (Inter, `normal`), gemessen am Bild: 31 px bei 25,9 px Schrift. */
const LINE = 1.2;
/** Breite eines Zeichens in em der Schrift, vorsichtig (gemessen: 2,05 vh bei 3,6 vh Schrift = 0,57 em). */
const CHAR_EM = 0.6;
/** Querformat 16:9: Breite in Einheiten der Bildhöhe. */
const WIDTH_VH = (100 * 16) / 9;

/** Rahmen der Seite, in dem die Folie steht: wirksamer Bildrand in Prozent (@ME-067, 0–10) und ob der Wachhalten-Hinweis oben Platz nimmt (@ME-006). */
export interface ListFrame {
  overscan: number;
  notice: boolean;
}

/** Vorbelegter Rahmen: Standard-Bildrand, kein Hinweis. */
export const DEFAULT_FRAME: ListFrame = { overscan: displayMonitor.overscan.defaultPercent, notice: false };

/** Höhe des Hinweises in vh (Schrift mal Zeilenhöhe plus Polster und Rahmen oben und unten). */
const NOTICE_VH = num(displayFontSizes.notice) * displayLayout.scoreArea.noticeLineHeight
  + 2 * (num(displayLayout.scoreArea.noticePadY) + num(displayLayout.scoreArea.noticeBorderWidth));
/** Rahmen einer Zeile oben und unten in vh (1 px bei 720 Zeilen, aufgerundet). */
const ROW_BORDER = 0.3;
/** Rest des Bildes für Überschrift (Zeile, Abstand), Seitenhinweis (Zeile, Abstand) und Reserve. */
const CHROME = num(displayList.fontSizes.heading) * LINE + num(displayList.headingGap)
  + num(displayList.fontSizes.head) * LINE + num(displayList.rowGap) + 1.5;

/** Höhe der Zeilen-Fläche einer Seite in vh. */
function availableHeight(frame: ListFrame): number {
  return 100 - 2 * frame.overscan - (frame.notice ? NOTICE_VH : 0) - CHROME;
}

/** Breite eines Teamnamens in Zeichen je Zeile (Heim und Gast gleich breit). */
export function nameCharsPerLine(frame: ListFrame): number {
  const gaps = 3;
  const fixed = num(displayList.timeFieldWidth) * FONT + num(displayList.separatorWidth) * FONT;
  const inner = WIDTH_VH * (1 - (2 * frame.overscan) / 100) - 2 * num(displayList.rowPaddingX) - gaps * num(displayList.cellGap) - fixed;
  return Math.max(1, Math.floor(inner / 2 / (CHAR_EM * FONT)));
}

/**
 * Ein Wort mit Bindestrich bleibt zusammen, solange es in eine Zeile passt (@ZM-188): „Nordheim-Süd“ bricht nicht am Bindestrich,
 * erst ein zu langes Wort („Oberweiler-Niederstetten“) bricht dort.
 */
export function hyphenWordStaysTogether(word: string, perLine: number): boolean {
  return word.includes('-') && [...word].length <= perLine;
}

/** Teile, an denen der Browser umbrechen darf (nach Leerzeichen, nach Bindestrich nur bei zu langem Wort); `space` = ein Leerzeichen steht davor. */
function breakParts(text: string, perLine: number): { len: number; space: boolean }[] {
  const parts: { len: number; space: boolean }[] = [];
  let space = false;
  for (const m of text.matchAll(/(\s+)|([^\s]+)/g)) {
    if (m[1] !== undefined) { space = true; continue; }
    const word = m[2];
    const stays = hyphenWordStaysTogether(word, perLine);
    const pieces = stays ? [word] : word.match(/[^-]+-?|-/g) ?? [];
    pieces.forEach((piece, i) => { parts.push({ len: [...piece].length, space: i === 0 && space && parts.length > 0 }); });
    space = false;
  }
  return parts;
}

/** Zeilen, die ein Name bei `perLine` Zeichen belegt (Umbruch an Leerzeichen und Bindestrichen, überlange Wörter brechen). */
export function nameLines(text: string, perLine: number): number {
  let lines = 1;
  let used = 0;
  for (const { len, space } of breakParts(text, perLine)) {
    const joined = used === 0 ? len : used + (space ? 1 : 0) + len;
    if (used !== 0 && joined > perLine) {
      lines += 1;
      used = 0;
    }
    const start = used === 0 ? len : used + (space ? 1 : 0) + len;
    if (start > perLine && used === 0) {
      lines += Math.ceil(len / perLine) - 1;
      used = len % perLine === 0 ? perLine : len % perLine;
    } else {
      used = start;
    }
  }
  return lines;
}

/**
 * Höhe eines Spiels in vh (Zwischenzeile mit der Bezeichnung, falls vorhanden, plus Zeilenkarte aus Polster, Rahmen, Inhalt). Uhrzeit, Teamnamen und Stand stehen senkrecht mittig; Zusatzzeilen hängen
 * außerhalb des Flusses direkt unter Uhrzeit bzw. Stand (@ZM-189). Damit sie nicht abgeschnitten werden, muss der Inhalt die Zusatzzeilen
 * unterhalb der Mittelachse aufnehmen: 2 × (halbe Zeile + Zusatzhöhe), die Zusätze dürfen ins untere Polster ragen. `reserveExtra`:
 * Zeile für „(4:3 i. E.)“ unter dem Stand freihalten (Spielplan, Finalrunde).
 */
export function rowHeight(match: MatchView, cols: ListColumns, frame: ListFrame = DEFAULT_FRAME, reserveExtra: boolean = cols.state): number {
  const perLine = nameCharsPerLine(frame);
  const names = Math.max(nameLines(monitorSideLabel(match.home), perLine), nameLines(monitorSideLabel(match.away), perLine));
  const note = num(displayList.fontSizes.note) * LINE;
  const padY = num(displayList.rowPaddingY);
  const unterMitte = (zeile: number, zusatz: number): number => (zusatz === 0 ? zeile : 2 * (zeile / 2 + Math.max(0, zusatz - 0.8 * padY)));
  const zusatzZeit = (cols.state ? note : 0) + (cols.field ? note : 0);
  const timeCell = unterMitte(num(displayList.fontSizes.time) * LINE, zusatzZeit);
  // Die Spielbezeichnung („Halbfinale 1“) ist eine eigene Zwischenzeile über der Zeilenkarte und gehört zum Spiel (Höhe: Zeile plus Abstand)
  const zwischenzeile = match.labelText ? num(displayList.fontSizes.timeNote) * LINE + num(displayList.labelGap) : 0;
  const unten = reserveExtra ? Math.max(0, note - 0.8 * padY) : 0;
  const scoreLine = num(displayList.fontSizes.score) * LINE;
  const scoreCell = unten > 0 ? 2 * (scoreLine / 2 + unten) : scoreLine;
  const namen = names * FONT * LINE;
  const content = Math.max(timeCell, namen, scoreCell);
  return zwischenzeile + 2 * padY + ROW_BORDER + content;
}

/**
 * Seiten einer Listen-Folie: so viele Spiele hintereinander, wie in die Höhe passen, höchstens `maxRows`; ein Spiel, das allein
 * zu hoch ist, steht allein. Jedes Spiel steht auf genau einer Seite. Mindestens eine Seite (auch ohne Spiele).
 */
export function listPages(matches: readonly MatchView[], cols: ListColumns, maxRows: number = Number.POSITIVE_INFINITY, frame: ListFrame = DEFAULT_FRAME): MatchView[][] {
  const available = availableHeight(frame);
  const gap = num(displayList.rowGap);
  const pages: MatchView[][] = [[]];
  let used = 0;
  for (const match of matches) {
    const height = rowHeight(match, cols, frame);
    const current = pages[pages.length - 1];
    const next = current.length === 0 ? height : used + gap + height;
    if (current.length > 0 && (next > available || current.length >= maxRows)) {
      pages.push([match]);
      used = height;
    } else {
      current.push(match);
      used = next;
    }
  }
  return pages;
}

/**
 * Seiten wie `listPages`, aber gleichmäßig verteilt („2 + 2“ statt „3 + 1“): die Seitenzahl n bleibt die des Höhenmodells, jede Seite bekommt
 * höchstens ceil(Spiele / n) Spiele (7 Spiele auf 3 Seiten: 3 + 2 + 2). Passt eine so gebildete Seite nicht in die Höhe (sehr verschieden hohe Zeilen), bleibt es bei `listPages`.
 */
export function listPagesBalanced(matches: readonly MatchView[], cols: ListColumns, maxRows: number = Number.POSITIVE_INFINITY, frame: ListFrame = DEFAULT_FRAME): MatchView[][] {
  const pages = listPages(matches, cols, maxRows, frame);
  if (pages.length < 2) { return pages; }
  const base = Math.floor(matches.length / pages.length);
  const mehr = matches.length % pages.length;
  const chunks: MatchView[][] = [];
  let von = 0;
  for (let i = 0; i < pages.length; i += 1) {
    const anzahl = base + (i < mehr ? 1 : 0);
    chunks.push(matches.slice(von, von + anzahl));
    von += anzahl;
  }
  const available = availableHeight(frame);
  const gap = num(displayList.rowGap);
  const fits = (chunk: readonly MatchView[]): boolean => chunk.length <= maxRows
    && chunk.reduce((sum, m, i) => sum + rowHeight(m, cols, frame) + (i === 0 ? 0 : gap), 0) <= available;
  return chunks.every(fits) ? chunks : pages;
}

/** Seite (0-basiert), auf der das Spiel `matchId` steht; -1, wenn es in keiner Seite steht. */
export function pageIndexOf(pages: readonly (readonly MatchView[])[], matchId: string): number {
  return pages.findIndex(page => page.some(m => m.id === matchId));
}
