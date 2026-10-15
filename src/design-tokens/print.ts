/**
 * Druck-Tokens für das PDF (`src/lib/pdf/**`). Druck, mm/pt/RGB.
 *
 * Quelle der Werte, soweit nicht anders vermerkt: Druckentwurf v7.2 (`druck-scratch/druck.css`, B-28a3-2).
 * Die Render-Dateien lesen nur diese Tokens, keine Literale für Farben, Maße oder Schriftgrößen (Token-Wächter).
 * Maße, die v7.2 nicht festlegt (Kopf, Meta-Box, Teilnehmerkästen), bleiben bis a3-3/a4 in `printMetrics`.
 * Bildschirm-Tokens stehen in den übrigen Dateien dieses Ordners.
 */

/** Papier: nur Schwarz und Weiß, dazu das 12-%-Raster für Tabellenköpfe. Kein Grau im Text. */
export const printColors = {
  /** --ink: Text, Linien, Rahmen */
  ink: [0, 0, 0],
  /** --paper: Hintergrund */
  paper: [255, 255, 255],
  /** --tint: 12 % Schwarz (#e0e0e0), nur Tabellenköpfe */
  tint: [224, 224, 224],
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
  /** .title .age */
  age: 13,
  /** .head.short .subtitle */
  subtitle: 10.5,
  /** .meta */
  meta: 9.5,
  /** h2 */
  h2: 13,
  /** .teams */
  teams: 10.5,
  /** table.m thead th */
  head: 9,
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
  /** .pen .lbl */
  penLabel: 8.5,
  /** .pen .f */
  penField: 11,
  /** .pen-done */
  penDone: 9,
  /** tr.round td */
  round: 11,
  /** tr.round td .note */
  roundNote: 9,
  /** .origin-s, td.team small */
  origin: 9,
  /** .ko-line, .rules-line */
  note: 10.5,
  /** table.s caption */
  caption: 11.5,
  /** table.s thead th */
  tableSHead: 9,
  /** table.s td */
  tableSBody: 11,
  /** .rank */
  rank: 11.5,
  /** .foot */
  foot: 9,
} as const;

/** Linien und Rahmen in mm (`druck.css`). */
export const printStroke = {
  /** .head border-bottom */
  head: 0.7,
  /** table thead border (Kopf und Abschnittslinie) */
  thead: 0.5,
  /** Zeilenlinie der Tabellen */
  row: 0.25,
  /** Teilnehmerkästen und Meta-Box, Rahmen (Entwurf: 0,3; Bestand 0,5 bleibt bis a3-3) */
  box: 0.3,
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
  /** table.m thead th: Innenabstand vertikal / horizontal */
  headPadV: 1.3,
  headPadH: 1.5,
  /** table.m td: Innenabstand vertikal / horizontal */
  bodyPadV: 0.6,
  bodyPadH: 1.5,
  /** table.m td.nr: Innenabstand links und rechts (Spielnummer passt in die schmale Spalte) */
  nrPad: 0.5,
  /** table.s thead th und td: Innenabstand (vertikal und horizontal gleich) */
  compactPad: 1.2,
  /** Kurzkopf (Folgeseiten): Gesamthöhe bis zum Inhalt, Grundlinien von Titel und Untertitel, Linie */
  shortHeadHeight: 16,
  shortHeadTitleBaseline: 6,
  shortHeadSubBaseline: 11.5,
  shortHeadRule: 14,
  /** Platz zwischen Satzspiegel und Seitenzahl */
  footSpace: 4,
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
    referee: 15,
  },
  /** Finalrunde: Ergebnisspalte breiter */
  finals: {
    nr: 7,
    time: 17,
    field: 10,
    result: 44,
    referee: 15,
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
 * Übrige Layout-Maße in mm, die v7.2 nicht festlegt. Sie bleiben bis zu a3-3 (Kopf) und a4 (Teilnehmer) unverändert.
 */
export const printMetrics = {
  /** Mindestplatz für den Kopf */
  headerMinSpace: 14,
  /** Abstand Titel → Untertitel */
  titleAdvance: 7,
  /** Abstand Untertitel → Meta-Box (sectionGap + 2) */
  subtitleAdvance: 8,

  /** Meta-Box */
  metaPadding: 4,
  metaLineHeight: 5,
  metaRowGap: 1,
  metaColumnGap: 10,
  /** Abstand Label → Wert */
  metaLabelGap: 3,
  /** Abstand Rahmen → erste Zeile */
  metaTextOffset: 4,
  /** Zusätzlicher Platz unter der Meta-Box */
  metaExtraSpace: 4,
  metaBorderWidth: 0.8,
  /** Radius der abgerundeten Rahmen */
  boxRadius: 2,

  /** Hinweiszeile */
  hintMinSpace: 6,
  hintAdvance: 4,

  /** Abschnittstitel */
  sectionTitleMinSpace: 10,
  /** Platz für Titel plus Tabelle (Gruppentabelle, Platzierung) */
  sectionTableMinSpace: 12,
  /** Abstand Titel → Tabelle bei Gruppenphase und Platzierung */
  sectionTitleUnderline: 2,
  /** Abstand Titel → Teilnehmerkasten */
  sectionTitleAdvance: 4,

  /** Teilnehmer-Kästen */
  boxPadding: 3,
  boxTitleHeight: 6,
  /** Abstand Kastenoberkante → Gruppentitel bzw. erste Zeile */
  boxTextOffset: 4,
  /** Titel → erste Teamzeile (boxTitleHeight - 2) */
  boxTitleAdvance: 4,
  teamLineHeight: 4,
  boxMinSpace: 4,
  /** Abstand zwischen Kastenzeilen */
  boxRowAdvance: 4,
  /** Spaltenabstand zwischen den Gruppenkästen */
  participantsColGap: 6,

  /** Finalrunden-Untertitel */
  finalsSubtitleMinSpace: 8,
  finalsSubtitleAdvance: 4,

  /** Standings-Abstand nach einer Gruppentabelle (sectionGap + 4) */
  standingsGroupAdvance: 4,
} as const;
