/**
 * Druck-Tokens für das PDF (`src/lib/pdf/**`). Druck, mm/pt/RGB.
 *
 * Quelle der Werte, soweit nicht anders vermerkt: Druckentwurf v7.2 (`druck-scratch/druck.css`, B-28a3-2).
 * Die Render-Dateien lesen nur diese Tokens, keine Literale für Farben, Maße oder Schriftgrößen (Token-Wächter).
 * Maße, die v7.2 nicht festlegt (Kopf, Regelzeilen, Teilnehmer, Abschnitte), stehen in `printMetrics`.
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
  /** .cancel: Text „ausgefallen“ im Kasten */
  cancel: 11,
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
  /** Kurzkopf-Linie */
  shortHead: 0.5,
  /** .foot border-top */
  foot: 0.3,
  /** .score .f, .cancel, .pen .f: Rahmen der Ergebnis- und Schreibfelder */
  box: 0.3,
} as const;

/** Felder und Balken der Ergebnisspalte in mm (`druck.css`: .score, .pen, .cancel, tr.live). */
export const printBox = {
  /** .score .f: Ergebniskästchen, eine zweistellige Zahl mit Kugelschreiber passt hinein */
  scoreField: { w: 12, h: 8 },
  /** .pen .f (nach `.pen .f` Überschreibung): kleine Felder für Verlängerung und Strafstoßschießen */
  penField: { w: 12, h: 7 },
  /** .cancel: Kasten „ausgefallen“ */
  cancel: { w: 27, h: 8 },
  /** Schreibfeld in der Spalte „SR“: Höhe, Breite folgt der Spalte */
  refereeFieldH: 8,
  /** .score gap: Abstand Kästchen ↔ Doppelpunkt, Breite des Doppelpunkts */
  scoreGap: 1,
  colonWidth: 2,
  /** tr.live td:first-child border-left: Balken links an der Zeile */
  liveBar: 1.8,
  /** Abstand Kasten → Kennzeichen darunter (.mark margin-top), Abstand Zeilen kleiner Felder (.pen margin-top) */
  markGap: 0.5,
  penGap: 1.2,
  /** Abstand Beschriftung → kleine Felder (.pen .lbl margin-bottom) */
  penLabelGap: 0.6,
  /** Zeilenhöhe von Kennzeichen und Feldbeschriftung als Vielfaches der Schrift (line-height 1,1) */
  smallLineEm: 1.1,
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
  /** tr.fin td: Innenabstand oben und unten in der Finalrunde (kleine Felder stoßen sonst an die Zeilenlinie) */
  finalPadV: 1.8,
  /** table.m td.nr: Innenabstand links und rechts (Spielnummer passt in die schmale Spalte) */
  nrPad: 0.5,
  /** table.s thead th und td: Innenabstand (vertikal und horizontal gleich) */
  compactPad: 1.2,
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
    /** Spalte „SR“ (@DR-025): Nummer, Teamname oder Schreibfeld */
    referee: 24,
  },
  /** Finalrunde: Ergebnisspalte breiter */
  finals: {
    nr: 7,
    time: 17,
    field: 10,
    result: 44,
    referee: 20,
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
  /** Kopf: QR-Spalte rechts (v7.2 .head 32 mm) und Abstand zum Text (6 mm). Die Spalte bleibt bis zum QR-Code leer. */
  qrColumnWidth: 32,
  qrColumnGap: 6,
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

  /** Abschnittstitel */
  sectionTitleMinSpace: 10,
  /** Platz für Titel plus Tabelle (Gruppentabelle, Platzierung) */
  sectionTableMinSpace: 12,
  /** Abstand Titel → Tabelle bei Gruppenphase und Platzierung */
  sectionTitleUnderline: 2,
  /** Abstand Abschnittstitel → erste Teilnehmerzeile */
  sectionTitleAdvance: 4,

  /** Teilnehmer: Zeilenabstand bei 12 pt (× 1,2), Abstand Kennung → Name */
  participantAdvance: 5.1,
  participantLabelGap: 3,
  /** Teilnehmer als Blöcke (B-28a3-4b, Daniel 15.10.): Mindestbreite eines Kastens, Abstand zwischen Kästen nebeneinander und untereinander */
  participantBoxMinWidth: 80,
  participantBoxGap: 4,
  participantBoxRowGap: 3,
  /** Innenabstand des Kastens, Abstand Titel-Grundlinie → erste Namenszeile, Abstand letzte Grundlinie → Unterkante */
  participantBoxInset: 2,
  participantBoxTitleAdvance: 5.5,
  participantBoxBottom: 2.5,

  /** K.-o.-Zeilen über der Finalrunde (10,5 pt) */
  koLineAdvance: 4.5,
  /** Finalrunden-Untertitel */
  finalsSubtitleMinSpace: 8,
  finalsSubtitleAdvance: 4,

  /** Standings-Abstand nach einer Gruppentabelle (sectionGap + 4) */
  standingsGroupAdvance: 4,

  /** Platzierung (@DR-009, zweispaltig): Zeilenhöhe je Platz (Schreiblinie für Kugelschreiber, mindestens 8 mm), Breite der Platznummer, Abstand Nummer → Linie/Name */
  placeRowHeight: 8,
  /** Platzierung: Abstand zwischen linker und rechter Spalte */
  placeColumnGap: 8,
  placeNumberWidth: 10,
  placeNumberGap: 2,
  /** Fußzeile (9 pt × 1,2): Zeilenabstand; Titel in der Fußzeile wird nie unter diese Zeichenzahl gekürzt; Seitenzahl für die Breitenmessung (größte erwartete) */
  footAdvance: 3.8,
  footTitleMin: 12,
  footWorstPage: 99,
  /** Hinweise an den Nutzer zeigen von einem langen Freitext (Regelwerk) höchstens diese Zeichen */
  noteExcerptMax: 60,
  /** Runden-Überschrift: Abstand Titel → Hinweis „Uhrzeiten voraussichtlich“ */
  roundNoteGap: 3,

  /** Platzierung: Abstand Satz → erste Zeile, Abstand Schreiblinie → Grundlinie der Schrift darüber */
  placeSentenceAdvance: 6,
  placeTextLift: 1.5,
} as const;
