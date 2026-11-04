/**
 * Druck-Tokens für das PDF (`src/lib/pdf/**`). Druck, mm/pt/RGB.
 *
 * Quelle der Werte, soweit nicht anders vermerkt: Druckentwurf v7.2 (`druck-scratch/druck.css`, B-28a3-2).
 * Die Render-Dateien lesen nur diese Tokens, keine Literale für Farben, Maße oder Schriftgrößen (Token-Wächter).
 * Maße, die v7.2 nicht festlegt (Kopf, Regelzeilen, Teilnehmer, Abschnitte), stehen in `printMetrics`.
 * Bildschirm-Tokens stehen in den übrigen Dateien dieses Ordners.
 */

import { palette } from './colors/palette';

/** Papier: nur Schwarz und Weiß, dazu das 12-%-Raster für Tabellenköpfe. Kein Grau im Text. */
export const printColors = {
  /** --ink: Text, Linien, Rahmen */
  ink: [0, 0, 0],
  /** --paper: Hintergrund */
  paper: [255, 255, 255],
} as const;

/**
 * Akzentfarbe des Spielplans und des Aushangs (@DR-001, @DR-041). Die Farbe selbst kommt aus dem Turnierlogo
 * (`lib/color/accent.ts`) und läuft nur über `PdfInput.accent`; ohne Logo gilt das Grün der App.
 */
export const printAccent = {
  /** Rückfall ohne Turnierlogo oder ohne brauchbare Farbe: Primärgrün der App (#047857, 5,48 : 1 gegen Weiß). */
  fallback: palette.emerald[700],
  /** Eine farbige Linie hebt sich gegen Weiß mindestens im Verhältnis 3 : 1 ab (@DR-001). */
  minContrast: 3,
  /** Hellster Grauwert (0–255) des Zebra-Tons: 222 ≈ 13 % Schwarz, über der Untergrenze `printLimits.tintMinPercent`. */
  zebraMaxGray: 222,
  /** Kleinster Grauwert-Abstand Akzentlinie ↔ Zebra, damit beide schwarzweiß unterscheidbar bleiben (@DR-001 letzte Zeile). */
  minGrayGap: 60,
} as const;

/** Untergrenzen (@DR-001). Die Tests lesen sie hier, nie eine zweite Zahl im Test. */
export const printLimits = {
  /** Kein Textstück näher als diese Strecke am Papierrand, mm. */
  margin: 12,
  /** Kleinste Schrift in pt. Ausnahmen laut Liste (Kopfangaben, Spaltenköpfe, Fußzeile, Kennzeichen, Feldbeschriftungen). */
  minFontPt: 7.5,
  /** Uhrzeit (Daniel 15.10.): mindestens 14 pt. */
  timePt: 14,
  /** Ergebnis (Daniel 15.10.): mindestens 18 pt. */
  resultPt: 18,
  /** Teamnamen in den Spieltabellen (Heim und Gast): mindestens 12 pt. */
  teamPt: 12,
  /** Raster-Untergrenze in Prozent Schwarz (@DR-001, Plan N3). Der Test misst die Füllung gegen dieses Limit. */
  tintMinPercent: 12,
  /** Toleranz in Graustufen (0–255) für die Rundung beim Schreiben der Farbe ins PDF. */
  grayTolerance: 1,
} as const;

/** Schrift des PDFs: Inter 4.1 (eingebettet, `fonts.ts`). Oberkante einer Zeile = Grundlinie − Schriftgröße × ascentEm. */
export const printFont = {
  /** hhea-Ascender von Inter 4.1: 1984/2048 em. Kein Glyph ragt höher (Akzente auf Großbuchstaben bleiben darunter). */
  ascentEm: 0.96875,
  /** sCapHeight von Inter 4.1: 1490/2048 em. Ziffern stehen auf Versalhöhe; damit werden sie im Kasten mittig gesetzt. */
  capEm: 0.7275,
  /** Mitte des Doppelpunkts über der Grundlinie in em (Punkte von 0 bis x-Höhe 1118/2048 em): damit steht er mittig im Kasten. */
  colonMidEm: 0.28,
  /** hhea-Descender von Inter 4.1: 494/2048 em, aufgerundet. Kein Glyph reicht tiefer unter die Grundlinie (Unterlängen der Fußzeile, B5b). */
  descentEm: 0.2413,
} as const;

/** Umrechnung in mm. Die Render- und Maß-Dateien rechnen damit, keine eigene Zahl. */
export const printUnit = {
  mmPerPt: 25.4 / 72,
} as const;

/** Seitenformate in mm und Seitenränder (`@page`: oben 14, rechts 15, unten 12, links 15). */
export const printPage = {
  a4: {
    portrait: { width: 210, height: 297 },
    landscape: { width: 297, height: 210 },
  },
  margin: {
    top: 14,
    right: 15,
    bottom: 12,
    left: 15,
  },
} as const;

/** Schriftgrößen in pt (`druck.css`). Uhrzeit und Ergebnis stehen in `printLimits`. */
export const printType = {
  /** .kicker */
  kicker: 8.5,
  /** .title (Kurzkopf: `titleShort`) */
  title: 26,
  titleShort: 16,
  /** .head.short .subtitle */
  subtitle: 10.5,
  /** .meta: Kopfangaben (Bezeichnungen und Werte). 10,5 pt statt v7.2 9,5 pt (Daniel 15.10., bewusste Abweichung). */
  meta: 10.5,
  /** h2 */
  h2: 13,
  /** table.m td */
  body: 12,
  /** table.m td.nr */
  nr: 10.5,
  /** table.m td.zeit (Uhrzeit, Untergrenze in `printLimits.timePt`) */
  time: 14,
  /** .score .f (Ergebnisfeld, Untergrenze in `printLimits.resultPt`) */
  result: 18,
  /** .score .col (Doppelpunkt zwischen den Feldern) */
  resultColon: 15,
  /** .mark */
  mark: 9,
  /** .cancel: Text „ausgefallen“ im Kasten */
  cancel: 11,
  /** .ko-line, .rules-line */
  note: 10.5,
  /** .foot */
  foot: 9,
} as const;

/** Linien und Rahmen in mm (`druck.css`). */
export const printStroke = {
  /** .head border-bottom */
  head: 0.7,
  /** table thead border (Kopf und Abschnittslinie) */
  thead: 0.5,
  /** Kurzkopf-Linie */
  shortHead: 0.5,
  /** .foot border-top */
  foot: 0.3,
} as const;

/** Abstände in mm (`druck.css`, wo vorhanden). */
export const printGap = {
  /** Abstand zwischen Tabellen und Abschnitten (`.s-gap` 5 mm) */
  sectionGap: 5,
  /** h2 margin oben und unten */
  h2Top: 4,
  h2Bottom: 1.8,
  /** Kopf Seite 1: Abstand Unterkante Text → Kopflinie (v7.2 .head padding-bottom 2,5 mm plus Unterlänge) */
  headPadBottom: 3.2,
  /** Kurzkopf (Folgeseiten): Gesamthöhe bis zum Inhalt bei einer Titelzeile, Grundlinien von Titel und Untertitel, Linie */
  shortHeadHeight: 16,
  shortHeadTitleBaseline: 6,
  shortHeadSubBaseline: 11.5,
  shortHeadRule: 14,
  /** Platz zwischen Satzspiegel (Unterkante) und Fußlinie */
  footSpace: 1.5,
  /** Fußzeile: Abstand Fußlinie → Oberkante der ersten Fußzeile */
  footRuleGap: 1,
} as const;

/** Spaltenbreiten in mm (`<colgroup>` in `gen.py`). Heim und Gast bekommen den Rest. */
export const printColumns = {
  /** Spielzeilen der Gruppenphase */
  match: {
    nr: 7,
    time: 17,
    field: 10,
    group: 9,
    result: 30,
    /** Spalte „SR“ (@DR-025, @OB-075: Kurzform im Kopf): Nummer, Teamname oder Schreibfeld; die Breite trägt den Teamnamen („Teams pfeifen“) */
    referee: 27,
  },
  /** Gruppentabellen und Platzierung */
  standings: {
    pos: 10,
    played: 11,
    won: 10,
    drawn: 10,
    lost: 10,
    goals: 21,
    diff: 13,
    points: 13,
  },
} as const;

/**
 * Übrige Layout-Maße in mm, die v7.2 nicht festlegt: Kopf (Kicker, Titel, Angaben, Regelzeilen, QR-Spalte),
 * Teilnehmer als Zeilen, Abschnitte und K.-o.-Zeilen.
 */
export const printMetrics = {
  /** Kopf: QR-Spalte, Grafiken und Titelband stehen in `print-header.ts` (B-28 C4). */
  /** Kopf: Abstand Kicker → Titel (v7.2 margin 0,6 mm), Zeilenabstand umbrochener Titel (26 pt × 1,05) */
  kickerToTitle: 0.6,
  titleAdvance: 9.6,
  /** Kurzkopf: Zeilenabstand des umbrochenen Titels (16 pt × 1,05, höchstens zwei Zeilen) */
  shortTitleAdvance: 6,
  /** Kopf: Abstand Titel-Grundlinie → erste Angabe (Unterlänge des Titels plus Oberlänge der Angabe) */
  headBlockGap: 6,
  /** Kopf: Zeilenabstand der Angaben und Regelzeilen (10,5 pt × 1,22 wie v7.2 .meta) */
  factAdvance: 4.5,
  factLabelGap: 3,

  /** K.-o.-Zeilen über der Finalrunde (10,5 pt) */
  koLineAdvance: 4.5,

  /** Fußzeile (9 pt × 1,2): Zeilenabstand; Seitenzahl für die Breitenmessung (größte erwartete) */
  footAdvance: 3.8,
  footWorstPage: 99,
  /** Abstand zwischen der linken Spalte der Fußzeile und „Seite x von y“ (@DR-044), mm */
  footColumnGap: 4,
  /** Hinweise an den Nutzer zeigen von einem langen Freitext (Regelwerk) höchstens diese Zeichen */
  noteExcerptMax: 60,
} as const;

/** Zeitangaben im Kopf des Spielplans (@DR-031). */
export const printSchedule = {
  /** „Ende ca.“ wird auf ein Vielfaches dieser Minutenzahl gerundet („ca.“ und eine minutengenaue Zeit widersprechen sich). */
  endRoundMinutes: 5,
} as const;
