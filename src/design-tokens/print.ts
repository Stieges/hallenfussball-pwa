/**
 * Druck-Tokens für das PDF (`src/lib/pdf/**`). Druck, mm/pt/RGB.
 *
 * Wertgleich zu den früheren `PDF_STYLE`-Konstanten und Layout-Maßen aus `pdfExporter.ts` (B-28a1).
 * Render-Dateien lesen nur diese Tokens, keine Literale für Farben, Maße oder Schriftgrößen.
 * Bildschirm-Tokens stehen in den übrigen Dateien dieses Ordners.
 */

/** RGB 0–255, Werte aus den Hex-Kommentaren übernommen. */
export const printColors = {
  /** #e5e7eb – Tabellenlinien */
  border: [229, 231, 235],
  /** #d4d4d8 – Rahmen der Boxen und Meta-Box */
  borderDark: [212, 212, 216],
  /** #f9fafb – Tabellenkopf */
  headBg: [249, 250, 251],
  /** #111827 – Fließtext */
  textMain: [17, 24, 39],
  /** #6b7280 – Labels und Hinweise */
  textMuted: [107, 114, 128],
  /** #ffffff */
  white: [255, 255, 255],
} as const;

/** Schriftgrößen in pt. */
export const printFonts = {
  h1: 18,
  h2: 15,
  meta: 11,
  metaSmall: 10,
  sectionTitle: 14,
  phaseTitle: 14,
  groupTitle: 13,
  table: 11,
  tableSmall: 10,
  hint: 10,
} as const;

/** Seitenränder und Abstände in mm. */
export const printSpacing = {
  pageMargin: {
    top: 14,
    bottom: 16,
    left: 16,
    right: 16,
  },
  /** Abstand zwischen Abschnitten */
  sectionGap: 6,
  /** Abstand zwischen Blöcken innerhalb eines Abschnitts */
  blockGap: 4,
} as const;

/** Seitenformate in mm. Die Ausrichtung wählt die Zeile. */
export const printPage = {
  a4: {
    portrait: { width: 210, height: 297 },
    landscape: { width: 297, height: 210 },
  },
} as const;

/** Weitere Maße in mm, je Baustein benannt. Nur Zahlen aus dem früheren Layout. */
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
  boxBorderWidth: 0.5,
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

  /** Tabellen */
  tableCellPadding: 2,
  tableCellPaddingCompact: 1.5,
  tableLineWidth: 0.3,

  /** Standings-Abstand nach einer Gruppentabelle (sectionGap + 4) */
  standingsGroupAdvance: 4,
} as const;

/** Spaltenbreiten der Spieltabellen in mm. */
export const printTableColumns = {
  nr: 10,
  time: 15,
  field: 15,
  group: 10,
  result: 25,
  referee: 15,
} as const;

/** Spaltenbreiten der Tabellen (Pos, Team, Sp, S, U, N, Tore, Diff, Pkt) in mm. */
export const printStandingsColumns = {
  pos: 8,
  team: 37,
  played: 8,
  won: 7,
  drawn: 7,
  lost: 7,
  goals: 12,
  diff: 10,
  points: 11,
} as const;
