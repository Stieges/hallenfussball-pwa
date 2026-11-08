/**
 * Druck-Tokens des Endstand-PDFs (Gestaltungspaket, Bild-OK Daniel 08.11.2026): Tabellen mit abgestufter Wertung (@DR-051),
 * Seite „Siegerehrung“ (@DR-052) und Finalrunde als Raster (@DR-054). Ergänzt `print.ts` und `print-sheet.ts`.
 *
 * Quelle: `mockups/endstand-pdf-gestaltung/` (`a4.css`, `bauen.mjs`). Maße in mm, Schriftgrößen in pt, Strichstärken aus pt umgerechnet.
 * Der Probedruck entscheidet endgültig.
 */
import { printUnit } from './print';

const pt = (value: number): number => value * printUnit.mmPerPt;

/**
 * Tabellen im Endstand (@DR-051). „Platz“ und „Punkte“ stehen gleich, fett und am größten (15 pt); die übrigen Zahlen
 * werden nach der Wertungsreihenfolge abgestuft: die erste Wertung nach den Punkten in `second`, alles danach in `rest`.
 */
export const printEndTable = {
  /** Platz und Punkte: fett, größer als jede andere Zahl. */
  topPt: 15,
  /** Spalte der ersten Wertung nach den Punkten (Standard: Tordifferenz), normal. */
  secondPt: 12,
  /** Alle weiteren Spalten (Tore, Spiele, S, U, N), normal. */
  restPt: 10.5,
  /** Zeile „Wertung: Punkte · Tordifferenz · Tore“ unter den Tabellen: Schrift, Zeilenabstand als Vielfaches. */
  hintPt: 10.5,
  hintLineHeight: 1.2,
} as const;

/**
 * Seite „Siegerehrung“ (@DR-052): alle Plätze als schlichte, gleichförmige Liste (kein Treppchen), darunter die Torschützenliste
 * mit den Spalten Rang | Verein | Nr. | Tore. Zeilen der Platzliste mit grauer Trennlinie (`printTableGrid`), Zeilen der
 * Torschützen abwechselnd hinterlegt.
 */
export const printCeremony = {
  /** Überschriften „Platzierung“ und „Torschützen“: Höhe des Bandes (13 pt, 1,1 Zeilenhöhe, 2 mm darunter). */
  titleBand: 7,
  /** Abstand zwischen Platzliste und Überschrift „Torschützen“. */
  sectionGap: 6,
  /** Platzliste: Zeilenhöhe, Breite der Platznummer, Schrift (Platznummer fett, Name normal). */
  placeRowHeight: 8,
  placeNumberWidth: 12,
  placePt: 12,
  /** Torschützen: Tabellenbreite (nicht die ganze Seite), Spalten Rang | Verein | Nr. | Tore. */
  scorerWidth: 150,
  scorerCols: { rank: 18, club: 76, number: 28, goals: 28 },
  scorerHeadHeight: 6.5,
  scorerRowHeight: 5.8,
  scorerPt: 12,
  /** Innenabstand von Verein und Nr. links, von Tore rechts. */
  scorerInsetLeft: 2,
  scorerInsetRight: 4,
  /** Linie unter dem Kopf der Torschützenliste (schwarz, 1,5 pt). */
  scorerHeadRule: pt(1.5),
  /** Fußnote „Außerdem: 2 Tore ohne Rückennummer · 1 Eigentor“: Abstand zur Tabelle, Schrift, Zeilenabstand. */
  noteGap: 2,
  notePt: 10.5,
  noteLineHeight: 1.2,
} as const;

/**
 * Finalrunde im Endstand als Raster (@DR-054, Muster A): dünne graue Linien um jede Zelle, alle Spielzeilen gleich hoch, Ergebnis
 * hinterlegt, Zusatzzeile „Strafstoßschießen 4 : 3“ in derselben Zelle.
 */
export const printFinalsGrid = {
  /** Feste Spalten in mm; Heim und Gast teilen den Rest. */
  cols: { nr: 9, time: 18, field: 11, result: 46 },
  headHeight: 6.5,
  /** Abstand der K.-o.-Zeilen („Finale: bei Gleichstand …“) zum Spaltenkopf. */
  koGap: 4,
  /** Zeile mit dem Rundennamen (12 pt fett), Abstand der Schrift von der Oberkante. */
  roundHeight: 9,
  roundPt: 12,
  roundTextTop: 2.6,
  /** Innenabstand von Rundenname, Heim (rechts) und Gast (links), mm. */
  roundInset: 2,
  nameInset: 2,
  timeInset: 1.5,
  /** Mindesthöhe einer Spielzeile; sie wächst nur, wenn der Inhalt mehr braucht, und dann in allen Zeilen gleich. */
  rowHeight: 16,
  /** Abstand der Hauptzeile (Namen, Ergebnis) von der Oberkante der Zeile bis zu ihrer Oberkante, Höhe der Hauptzeile. */
  rowTop: 3.2,
  mainLine: 6.5,
  /** Zusatzzeilen unter dem Ergebnis: Abstand zur Hauptzeile, Höhe je Zeile, Luft unter der letzten. */
  extraGap: 0.8,
  extraLine: 4,
  rowBottomPad: 1.5,
  /** Schrift: Nr. und Feld, Wort der Zusatzzeile, Zahl der Zusatzzeile (fett, mindestens 12 pt). */
  smallPt: 10.5,
  extraWordPt: 9,
  extraValuePt: 12,
  /** Ergebnis: Ziffern links und rechts vom Doppelpunkt, Abstand von der Mitte. */
  scoreGap: 3,
  /**
   * Senkrechte Linien (geparkt, Daniel 08.11.: „Mischung aus a und d“): `all` = Raster um jede Zelle (Muster A, gebaut),
   * `parallel` = senkrechte Linien nur bei gleichzeitigen Spielen (Muster D). Der Wechsel betrifft nur diese eine Stelle.
   */
  verticals: 'all' as 'all' | 'parallel',
} as const;
