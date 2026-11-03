/**
 * Seitenmodell des Spielplan-PDFs (PDF-Paket § 3, Vorlauf V1): WAS auf welcher Seite steht und WO. Alle Maße in mm ab
 * der linken oberen Papierecke, Schrift in pt. Gebaut von `model/*` (T6, rein, ohne jsPDF), 1:1 gezeichnet von
 * `render/*` (T7a, T7b): Die Zeichenschicht rechnet keine Position mehr und misst keinen Text.
 *
 * Farben stehen nicht im Modell. Flächen und Striche nennen ihre Art; Akzent, Zebra-Ton und Strichstärke setzt die
 * Zeichenschicht aus `PdfInput` und den Druck-Tokens (`printZebra`, `printHourRule`, `printRule`, `printWriteLine`).
 * Text ist immer schwarz (@DR-001).
 *
 * Lesereihenfolge (@DR-039): Die Zeichenschicht gibt Texte in der Reihenfolge der Felder und Listen dieses Modells aus,
 * Blöcke in der Reihenfolge von `PageModel.blocks`, die Fußzeile zuletzt.
 */
import type { PdfInput } from '../pdfInput';
import type { PdfLocale, PdfTexts } from '../translations';
import type { FontWeight, TextMeasure } from './measure';

/** Rechteck: `x`, `y` linke obere Ecke. */
export interface Rect { x: number; y: number; w: number; h: number }

/** Waagerechte Strecke auf der Höhe `y` (Mitte des Strichs). */
export interface HLine { x1: number; x2: number; y: number }

/**
 * Ein Textstück in einer Zeile. `y` ist die Grundlinie; `x` ist je nach `align` die linke Kante, die Mitte oder die
 * rechte Kante. Mehrzeiliger Text sind mehrere Textstücke.
 */
export interface TextRun {
  text: string;
  x: number;
  y: number;
  pt: number;
  weight: FontWeight;
  align: 'left' | 'center' | 'right';
  /** Unterstreichung eines Links (@DR-038): genau ein Strich, schon vermessen. */
  underline?: HLine;
}

/** Schreiblinie (@DR-034): ein dünner schwarzer Strich, auf dem von Hand eingetragen wird. */
export type WriteLineKind = 'result' | 'small' | 'name' | 'rank' | 'shootout';
export interface WriteLine extends HLine { kind: WriteLineKind }

/**
 * Gezeichneter Strich, der keine Schreiblinie ist; gegen ihn gilt der Abstand `printWriteLine.minGapToStroke`.
 * `hour` Stundentrenner, `round` Rundentrenner der Finalrunde, `head` Linie unter dem Kopf (beide Akzent);
 * `tableHead` Linie unter einem Spaltenkopf, `foot` Fußlinie (beide schwarz).
 */
export type RuleKind = 'hour' | 'round' | 'head' | 'tableHead' | 'foot';
export interface RuleLine extends HLine { kind: RuleKind }

/** Helle Fläche im Zebra-Ton (@DR-001: ≥ 12 % Schwarz). `facts` hat die Ecken `printZebra.factsRadius`. */
export interface Fill extends Rect { kind: 'zebra' | 'facts' | 'tableHead' }

/** Antippbare Fläche mit Ziel (@DR-038). Ohne Online-Teilen gibt es keine. */
export interface LinkArea extends Rect { url: string }

/** Platz einer Turniergrafik (@DR-023), Seitenverhältnis wie das Bild. Fehlt die Grafik, fehlt der Platz (@DR-024). */
export interface ImagePlace extends Rect { side: 'left' | 'right' }

/** Zuschauer-QR (@DR-003): `box` ist die weiße Fläche mit Ruhezone, `symbol` das Punktmuster. */
export interface QrPlace { url: string; box: Rect; symbol: Rect }

/** Gruppenzeichen in der Spalte „Gr“: Buchstabe in einer Form, die Gruppe ist ohne Farbe erkennbar (@DR-001). */
export interface GroupMark { text: TextRun; frame: Rect; shape: 'square' | 'circle' }

interface BlockBase {
  /** Oberkante und Höhe des ganzen Blocks; die Seitenplanung (`pagePlan.ts`) rechnet nur damit. */
  top: number;
  height: number;
}

/** Eckdaten im hellen Block (@DR-031). Fehlt eine Angabe (etwa die Halle), fehlt ihr Feld ganz. */
export type FactKey = 'when' | 'where' | 'duration' | 'flow';
export interface FactCell { key: FactKey; runs: TextRun[] }
export interface FactsModel { fill: Fill; cells: FactCell[] }

/** Kopf von Seite 1: Grafiken, Titelband ohne Lücke (@DR-024), Eckdaten, Regelzeile (@DR-020), QR mit Beschriftung. */
export interface HeaderBlock extends BlockBase {
  kind: 'header';
  images: ImagePlace[];
  /** Titel und Untertitel. */
  title: TextRun[];
  facts: FactsModel;
  /** Regelzeile, höchstens drei Zeilen; fette Bezeichnungen („Modus:“) sind eigene Textstücke. */
  rules: TextRun[];
  qr?: QrPlace;
  /** „Live-Ergebnisse“ bzw. „Spielplan aufs Handy“ (@DR-010), fett und unterstrichen. */
  qrCaption?: TextRun;
  rule: RuleLine;
}

/** Kurzkopf der Folgeseiten: Grafik links, Titel, Tag, kleiner QR (@DR-003). */
export interface ShortHeaderBlock extends BlockBase {
  kind: 'shortHeader';
  images: ImagePlace[];
  title: TextRun[];
  qr?: QrPlace;
  rule: RuleLine;
}

/** Spalten einer Spieltabelle. `shootout` nur in der Finalrunde, `referee` nur mit Einträgen (@DR-025). */
export type ColumnKey = 'nr' | 'time' | 'group' | 'home' | 'result' | 'shootout' | 'away' | 'referee';
export interface ColumnModel { key: ColumnKey; x: number; w: number }

/** Spaltenkopf einer Spieltabelle; auf jeder Folgeseite wiederholt (@DR-002, @DR-033). */
export interface MatchHeadModel { columns: ColumnModel[]; labels: TextRun[]; rule: RuleLine }

/** Eine Seite eines Spiels: umbrochener Name (@DR-032) oder, bei offenem Platz, die Herkunft (@DR-037). */
export interface SideModel {
  /** Zeilen des Namens, höchstens drei; leer bei offenem Platz. */
  name: string[];
  /** „Sieger Spiel 25“, „1. Gruppe A“; nur bei offenem Platz. */
  origin?: string;
  runs: TextRun[];
}

/** Kleine Linien neben dem Ergebnis, je nach Regel der Runde (@DR-004, @DR-019). */
export type SmallLineKind = 'overtime' | 'shootout';

/**
 * Inhalt der Ergebniszelle je Zustand (@DR-019): `score` mit Ziffern und Kennzeichen, `lines` zum Eintragen (auch
 * „läuft“), `text` für „ausgefallen“. Die Schreiblinien selbst stehen in `MatchRowModel.lines`.
 */
export type ResultCell =
  | { kind: 'score'; a: string; b: string; marks: string[]; runs: TextRun[] }
  | { kind: 'lines'; live: boolean; small: SmallLineKind[]; runs: TextRun[] }
  | { kind: 'text'; text: string; runs: TextRun[] };

/** Eine Spielzeile, Gruppenspiel oder Finalrunde. */
export interface MatchRowModel {
  matchId: string;
  number: number;
  /** Zeile über die ganze Tabellenbreite; `zebra` füllt genau dieses Rechteck. */
  box: Rect;
  zebra: boolean;
  /** Stundentrenner über der Zeile (nie direkt unter dem Spaltenkopf). */
  ruleAbove?: RuleLine;
  nr: TextRun;
  time: TextRun;
  group?: GroupMark;
  home: SideModel;
  cell: ResultCell;
  away: SideModel;
  /** Nur Nummer oder pfeifendes Team, nie ein Personenname (@DR-025); höchstens zwei Zeilen. */
  referee?: TextRun[];
  lines: WriteLine[];
}

/** Gruppenspiele bzw. ihre Fortsetzung auf einer Folgeseite. */
export interface MatchRowsBlock extends BlockBase {
  kind: 'matchRows';
  head: MatchHeadModel;
  rows: MatchRowModel[];
}

/** Eine Runde der Finalrunde: Rundenname als eigene Zeile über einem Rundentrenner, darunter ihre Spiele. */
export interface FinalsRoundModel { title: TextRun; rule: RuleLine; rows: MatchRowModel[] }

/** Finalrunde (@DR-019, @DR-037); die K.-o.-Regel steht als `TextBlock` davor (@DR-006, @DR-015). */
export interface FinalsBlock extends BlockBase {
  kind: 'finals';
  head: MatchHeadModel;
  rounds: FinalsRoundModel[];
}

/** Spalte einer Gruppentabelle; der Kopf ist die Kurzform (@OB-075). */
export type StandingsKey = 'rank' | 'team' | 'played' | 'won' | 'drawn' | 'lost' | 'goals' | 'diff' | 'points';
export interface StandingsColumn { key: StandingsKey; w: number; label: string }

/**
 * Gruppentabelle. Gezeichnet mit `jspdf-autotable` ab `top` (`grid`: Kästchen mit grauem Raster, @DR-035; `zebra`:
 * Fassung mit Werten). Die Höhe rechnet das Modell aus `headHeight` und `rowHeight`; die Zeichenschicht setzt die
 * Zeilenhöhe fest, damit autotable nicht abweicht.
 */
export interface StandingsTableBlock extends BlockBase {
  kind: 'standingsTable';
  x: number;
  w: number;
  group?: GroupMark;
  caption: string;
  columns: StandingsColumn[];
  headHeight: number;
  rowHeight: number;
  /** Team und Zellen in Spaltenreihenfolge ohne `team`; leer in der Fassung ohne Ergebnisse. */
  rows: Array<{ team: string[]; cells: string[] }>;
  style: 'grid' | 'zebra';
}

/** Strafstoßschießen um Platz 1 (@DR-036): Überschrift, Linien für beide Teams und ihre Treffer, ohne Kasten. */
export interface ShootoutBlock extends BlockBase {
  kind: 'shootout';
  title: TextRun;
  /** Doppelpunkt zwischen den Treffern und die Beschriftungen „Team“, „Treffer“, „Team“. */
  runs: TextRun[];
  lines: WriteLine[];
}

/** Ein Platz der Platzierung (@DR-005, @DR-009): Nummer und Name oder Schreiblinie. */
export interface RankEntryModel { place: number; number: TextRun; name?: TextRun; line?: WriteLine }

/** Platzierung, zweispaltig; nach dem Abschluss in einer Gruppe entfällt sie (@DR-009, „Abschlusstabelle“). */
export interface RankingBlock extends BlockBase {
  kind: 'ranking';
  title: TextRun;
  entries: RankEntryModel[];
}

/** Abschnittstitel und Hinweise (K.-o.-Regel über der Finalrunde, Tabellentitel). */
export interface TextBlock extends BlockBase {
  kind: 'text';
  runs: TextRun[];
}

export type Block =
  | HeaderBlock
  | ShortHeaderBlock
  | MatchRowsBlock
  | FinalsBlock
  | StandingsTableBlock
  | ShootoutBlock
  | RankingBlock
  | TextBlock;

/** Fußzeile (@DR-001): Adresse (Link), Hinweis, „Stand … · Seite x von y“; zuletzt gelesen (@DR-039). */
export interface FooterModel { rule: RuleLine; runs: TextRun[] }

export interface PageModel {
  /** Seitennummer ab 1. */
  number: number;
  blocks: Block[];
  /** Größe des QR auf dieser Seite; `null` ohne Online-Teilen (@DR-038 Gegenbeispiel). */
  qr: 'large' | 'small' | null;
  /** QR, Beschriftung und Adresse der Fußzeile als Link (@DR-038); leer ohne Online-Teilen. */
  links: LinkArea[];
  footer: FooterModel;
}

/**
 * Welche Stufe der Regel bei Platzmangel auf Seite 1 gegriffen hat (@DR-033): `normal` ohne Eingriff, `shortNames`
 * Kurznamen, `tight` Polster verringert (`printRowPad.tight`), `nextPage` Folgeseite mit mindestens
 * `printMatchRow.minRowsOnNextPage` Spielen.
 */
export type FitStep = 'normal' | 'shortNames' | 'tight' | 'nextPage';

/** Das ganze Dokument. */
export interface ScheduleModel {
  /** Eigenschaften der Datei (@DR-039): „<Turnier> – <Spielplan>“ in der Sprache des Dokuments. */
  meta: { title: string; lang: PdfLocale };
  /** Immer A4 hoch (@DR-026); `PdfInput.orientation` ändert daran nichts (Lücke L3). */
  format: 'a4-portrait';
  fit: FitStep;
  pages: PageModel[];
}

/** Eingang des Seitenmodells: der aufgelöste PDF-Eingang, die Texte und, was das Modell aus Bildern und QR braucht. */
export interface ScheduleModelSource {
  input: PdfInput;
  t: PdfTexts;
  /** Seitenverhältnis (Breite ÷ Höhe) je hinterlegter und ladbarer Grafik; fehlt eine, rückt der Titel nach (@DR-024). */
  graphicsAspect: { left?: number; right?: number };
  /** Zuschauer-Adresse und Kantenlänge des QR in Modulen; fehlt ohne Online-Teilen (@DR-038). */
  qr?: { url: string; modules: number };
}

/** Baut das Seitenmodell (T6). Rein: gleiche Quelle und Messfunktion ergeben dasselbe Modell. */
export type BuildScheduleModel = (source: ScheduleModelSource, measure: TextMeasure) => ScheduleModel;
