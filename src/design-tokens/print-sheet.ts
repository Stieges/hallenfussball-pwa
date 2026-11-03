/**
 * Druck-Tokens des Handzettels (Spielplan nach Mockup-Runde 2 vom 30.10., PDF-Paket § 3, Vorlauf V1): Schreiblinien,
 * Zebra, Zeilen der Spieltabelle, Trennstriche. Ergänzt `print.ts`. Maße in mm, Strichstärken aus pt umgerechnet.
 *
 * Quelle: `mockups/runde-2026-10-30/handzettel/` (NOTIZ.md, Abschnitt „Korrekturen nach Review“ maßgeblich, und
 * `handzettel.css`); Abstände nach @DR-034. Der Probedruck entscheidet endgültig.
 */
import { printAccent, printUnit } from './print';

const pt = (value: number): number => value * printUnit.mmPerPt;

/** Schreiblinien (@DR-004, @DR-034, @DR-036, @DR-037): ein dünner schwarzer Strich, kein Kasten. */
export const printWriteLine = {
  /** Strichstärke 0,5 pt (gemessen am Mockup-PDF 0,17–0,21 mm). */
  stroke: pt(0.5),
  /** Abstand zur Kante einer hellen Fläche, mindestens (@DR-034). */
  minGapToFill: 3,
  /** Abstand zu jedem anderen gezeichneten Strich, mindestens (@DR-034). */
  minGapToStroke: 4,
  /** Messtoleranz am Ausdruck (@DR-034). */
  tolerance: 0.15,
  /**
   * Lage der Linie über dem Zeilenboden, in jeder Zeile gleich (zweizeilige Namen ändern sie nicht). 3 mm statt 4 mm des Mockups, damit
   * über der Linie bis zur Zeilenoberkante mindestens `minWriteSpace` frei bleiben (@DR-034); der Zeileninhalt rückt um
   * `printMatchRow.contentDrop` mit.
   */
  aboveRowBottom: 3,
  /** Freier Raum zum Schreiben über der Linie bis zur Oberkante der Zeile, mindestens, mm (@DR-034). */
  minWriteSpace: 5,
  /** Ergebnislinie je Seite: 12 mm (Mockup a, b); mit Spalte „SR“ und in der Finalrunde 10 mm (Mockup c, b Spiele 21–28). */
  result: 12,
  resultNarrow: 10,
  /** Breite des Doppelpunkts zwischen den Ergebnislinien (14 pt fett), schmal 5 mm. */
  colon: 6,
  colonNarrow: 5,
  colonPt: 14,
  /** Kleine Linien für Verlängerung und Strafstoßschießen (@DR-019): 8 mm, Doppelpunkt 4 mm, 3 mm neben dem Ergebnis. */
  small: 8,
  smallColon: 4,
  smallGap: 3,
  /** Namenslinie eines offenen Finalplatzes (@DR-037): mindestens 50 mm, 3,5 mm vor bzw. nach den Ergebnislinien. */
  nameMin: 50,
  nameInset: 3.5,
  /** Strafstoßschießen um Platz 1 (@DR-036): Trefferlinie 11 mm; die Teamlinien füllen den Rest. */
  shootoutHits: 11,
  /** Platzierung (@DR-005, @DR-009): Zeile 9 mm, Linie 2,5 mm über dem Zeilenboden, Nummer 7 mm breit, Spaltenabstand 8 mm. */
  rankRowHeight: 9,
  rankLineLift: 2.5,
  rankNumberWidth: 7,
  rankColumnGap: 8,
} as const;

/**
 * Zebra statt Trennstrichen (@DR-034): jede zweite Spielzeile im Zebra-Ton (`zebraTone` aus `lib/color/accent.ts`,
 * Grauwert ≤ `printAccent.zebraMaxGray`). Derselbe Ton füllt die Eckdaten und den Kopf der Gruppentabellen.
 */
export const printZebra = {
  /** Die erste Zeile unter dem Spaltenkopf bleibt weiß (Mockup: `tbody tr:nth-child(even)`); gilt je Seite neu. */
  firstRowTinted: false,
  /** Ecken des Eckdaten-Blocks (@DR-031). */
  factsRadius: 2,
} as const;

/**
 * Zeilen der Spieltabelle (@DR-033). Höhe einer Zeile = größter Wert aus `minHeight` und Namenszeilen ×
 * Schriftgröße × `lineHeight` + 2 × Polster (`printRowPad`); einzeilige Zeilen dürfen bis `maxHeight` wachsen, wenn
 * Seite 1 Platz hat.
 */
export const printMatchRow = {
  /**
   * 8,3 mm (Mockup b, 20 Spiele auf Seite 1) = Linie 4 mm über dem Boden + 4 mm zum Stundentrenner der Zeile + halbe
   * Strichstärke des Trenners (0,26 mm), aufgerundet. Darunter verletzt die Linie @DR-034.
   */
  minHeight: 8.3,
  /** 11 mm (Mockup a): 7 mm Schreibraum über der Linie. */
  maxHeight: 11,
  /** Zeilenabstand mehrzeiliger Namen als Vielfaches der Schrift; nie kleiner, auch nicht in der Stufe „eng“ (@DR-033). */
  lineHeight: 1.15,
  /** Der Zeileninhalt (Name, Zeit, Nummer, Gruppenzeichen) sitzt so viel tiefer als in der Mitte der Zeile, damit die Linie darunter wie bisher zu ihm liegt. */
  contentDrop: 1,
  /** Auf einer Folgeseite der Gruppenspiele stehen mindestens so viele Spiele (@DR-033 Beispiel 3). */
  minRowsOnNextPage: 3,
} as const;

/** Polster über und unter dem Namen in einer Spielzeile (@DR-033 Beispiel 2): normal 1 mm (Mockup c), eng 0. */
export const printRowPad = {
  normal: 1,
  tight: 0,
} as const;

/** Stundentrenner (Gruppenspiele): Akzentlinie 1,5 pt, liegt in der neuen Stunde, Oberkante auf der Zeilengrenze. */
export const printHourRule = {
  stroke: pt(1.5),
  /**
   * Der Trenner liegt nicht an der Zeilengrenze, sondern so viel tiefer in der neuen Stunde: Die Schreiblinie der Zeile davor ist nur
   * `aboveRowBottom` (3 mm) über der Grenze und hält so den Abstand von mindestens 4 mm zu jedem anderen Strich (@DR-034).
   */
  inset: 0.75,
} as const;

/** Übrige Trennstriche (Mockup `handzettel.css`). Akzent: `head`, `round`; schwarz: `tableHead`, `foot`. */
export const printRule = {
  /** Unter dem Kopf von Seite 1 und dem Kurzkopf. */
  head: pt(1.5),
  /** Über dem Rundennamen der Finalrunde. */
  round: pt(1.5),
  /** Unter dem Spaltenkopf einer Spieltabelle. */
  tableHead: pt(1.5),
  /** Über der Fußzeile. */
  foot: pt(0.75),
} as const;

/** Raster der Gruppentabellen zum Selbstausfüllen (@DR-035): grau statt schwarz (#8C8C8C), 0,75 pt. */
export const printTableGrid = {
  color: [140, 140, 140],
  stroke: pt(0.75),
} as const;

/** Gruppenzeichen (Spalte „Gr“): 5,2 mm, Rahmen 1,25 pt in Akzentfarbe, Gruppe A eckig, B rund, dann im Wechsel. */
export const printGroupMark = {
  size: 5.2,
  stroke: pt(1.25),
} as const;

/**
 * Akzent ohne Turnierlogo (@DR-041 „keins“): Linie = App-Grün, helle Fläche = dasselbe Grün mit Weiß gemischt
 * (`zebraTone('#047857')` aus `lib/color/accent.ts`; ein Test hält beides gleich). Das Druckmodul rechnet nicht selbst.
 */
export const printAccentDefault = {
  line: printAccent.fallback,
  tint: '#CFE5DF',
} as const;

/**
 * Kopf von Seite 1 (Mockup `handzettel.css`: .kopf, .eck, .regel, .qr). Titel 24 pt, Eckdaten im hellen Block mit
 * Beschriftung 8 pt, Hauptwert 14 pt, Nebenwert 11 pt; Regelzeile 10,5 pt. Uhrzeiten stehen in 14 pt (@DR-031).
 */
export const printSheetHead = {
  titlePt: 24,
  titleMinPt: 18,
  titleStepPt: 2,
  titleMaxLines: 3,
  titleLineHeight: 1.12,
  /** Ausrichtung von Titel und Zeile darunter im freien Titelbereich (@DR-024): `center` mittig, `left` linksbündig. */
  titleAlign: 'center' as 'left' | 'center',
  subtitlePt: 11,
  subtitleGap: 1,
  /** Abstand Unterkante Text/Grafik → Kopflinie (Akzent, 1,5 pt). */
  bandPadBottom: 2.5,
  /** Abstand Kopflinie → Eckdaten. */
  belowRule: 3,
  /** Eckdaten: Beschriftung 8 pt, Hauptwert 14 pt, Nebenwert 11 pt (Abstand der Grafik zum Titel: `printHeader.logoGap`). */
  factLabelPt: 8,
  /** Bezeichnungen im Eckdaten-Block: Versalien mit Sperrung (mm je Zeichen), darunter ein kurzer Akzentstrich (Länge mm, Abstand zur Grundlinie mm). */
  factLabelCharSpace: 0.25,
  factMarkLength: 6,
  factMarkStroke: pt(0.75),
  factMarkDrop: 0.6,
  factBigPt: 14,
  factMidPt: 11,
  /** Hallenname, der in 14 pt mehr als `hallMaxLines` Zeilen braucht: eine Stufe kleiner, weiter fett und vollständig (@DR-031). */
  factHallSmallPt: 12,
  hallMaxLines: 2,
  factLineHeight: 1.2,
  factsPadV: 2.5,
  factsPadH: 3,
  factsColGap: 3,
  factsRowGap: 2,
  /** Mindestbreite der zweiten Spalte; die erste gibt nach, wenn der Block schmal ist. */
  factsSecondColMin: 50,
  /** Luft der ersten Eckdaten-Spalte hinter Datum und Uhrzeiten, mm. */
  factsFirstColReserve: 1,
  rulePt: 10.5,
  ruleLineHeight: 1.3,
  /** Abstand Eckdaten-Block → Regelzeile. */
  ruleGap: 2.5,
  /**
   * Abstand zwischen Eckdaten-Spalte und QR. Mit 3,5 mm passt „28 Spiele, davon 8 Finalspiele“ (55,5 mm in Inter 11 pt) mit rund
   * 0,45 mm Luft in die Zelle „Ablauf“; ab 10 Finalspielen (eine Ziffer mehr) bricht der Text um und „Ablauf“ entfällt (@DR-031).
   */
  qrGap: 3.5,
  qrCaptionPt: 10.5,
  qrCaptionGap: 1,
  /** Abstand Unterstreichung → Grundlinie der Beschriftung. */
  underlineDrop: 0.6,
  /** Abstand Kopf → Spaltenkopf der Spiele. */
  belowHead: 2,
  /** Abstand der Unterstreichung zur Schrift allgemein, Strichstärke der Unterstreichung. */
  underlineStroke: pt(0.75),
} as const;

/** Spieltabelle (Mockup `.spiele`): Spaltenbreiten, Spaltenkopf, Innenabstände der Namen. */
export const printMatchTable = {
  /** Feste Spalten in mm; Heim und Gast teilen den Rest. */
  cols: { nr: 8, time: 17, field: 10, group: 9, result: 30, referee: 26.5 },
  headHeight: 6,
  headPt: 8.5,
  /** Namen: Abstand zum Ergebnis (innen) und zur Spaltenkante (außen). */
  nameInner: 1.4,
  nameOuter: 0.6,
  /** Zeit: Abstand zur linken Spaltenkante. */
  timeInset: 2,
  /** Zeilen der Referee-Spalte: Abstand links, Schrift. */
  refInset: 1.5,
  refPt: 10.5,
  /** Ergebnis: Zahlen links/rechts vom Doppelpunkt. */
  scoreGap: 3,
  /** Text „läuft“, „ausgefallen“, Kennzeichen „korrigiert“: Abstand zum Zeilenboden bzw. zur Mitte. */
  liveInset: 1,
  markGap: 0.8,
  /** Doppelpunkt zwischen den Schreiblinien: Grundlinie so weit über der Linie. */
  colonLift: 0.6,
  /** Beschriftung kleiner Linien (Verlängerung, Strafstoßschießen) über den Linien. */
  smallLabelPt: 7.5,
  smallLabelRise: 3.2,
} as const;

/** Fußzeile mit Adresse (@DR-038): Adresse als Link in einer eigenen Zeile. */
export const printFooterLink = {
  underlineStroke: pt(0.75),
} as const;
