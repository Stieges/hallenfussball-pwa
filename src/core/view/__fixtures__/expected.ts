/**
 * Feste Erwartungstabelle mit Record-Wortlaut (A-36b, Teilplan A-36 § 4, M5). NICHT aus dem Baustein berechnet:
 * Zuschauer-, Monitor- und PDF-Tests (A-36c/A-36d) vergleichen gegen diese Literale.
 *
 * Quellen: @TM-015, @ZM-102, @BM-032 („Sieger Halbfinale 1“, „noch offen“, englisch „to be decided“, Konsolidierung
 * G62 vom 16.10.), @BM-014 (Herkunft klein unter besetztem Platz), @DR-005/@DR-018 (Vorlage: Paarung als Herkunft,
 * auch bei ausgeschalteten Tabellen – Korrektur Daniel 15.10.), @ZM-104 („ausgefallen“), @ZM-111 (14:40),
 * @ET-002/@ET-013 (Endstand).
 */
export type Text = { de: string; en: string };

export interface ExpectedSide {
  label: Text;
  /** fehlt = keine Zusatzzeile */
  subLabel?: Text;
}

const NORD: Text = { de: 'FC Nord', en: 'FC Nord' };
const WEST: Text = { de: 'TSV West', en: 'TSV West' };
const FIRST_A: Text = { de: 'Erster Gruppe A', en: '1st Group A' };
const SECOND_B: Text = { de: 'Zweiter Gruppe B', en: '2nd Group B' };
const FIRST_B: Text = { de: 'Erster Gruppe B', en: '1st Group B' };
const OPEN: Text = { de: 'noch offen', en: 'to be decided' };
const WINNER_SF1: Text = { de: 'Sieger Halbfinale 1', en: 'Winner of Semifinal 1' };

/** Spielplan (Zuschauer-Seite, Monitor, PDF mit Ergebnissen) – je Lage. „leitungApp“ = organizer·app, sonst öffentlich. */
export const EXPECTED_PLAN = {
  'F-HF': {
    hf1Home: { label: NORD, subLabel: FIRST_A },
    hf1Away: { label: SECOND_B },
    finalHome: { label: WINNER_SF1 },
  },
  'F-TAB': {
    hf1Home: { label: NORD },
    hf1Away: { label: OPEN },
    finalHome: { label: WINNER_SF1 },
  },
  'F-TAB leitungApp': {
    hf1Home: { label: NORD, subLabel: FIRST_A },
    hf1Away: { label: SECOND_B },
    finalHome: { label: WINNER_SF1 },
  },
  'F-3G': {
    hf1Home: { label: NORD, subLabel: FIRST_A },
    hf1Away: { label: SECOND_B },
    finalHome: { label: WINNER_SF1 },
  },
  'F-NEU': {
    hf2Home: { label: WEST },
  },
} as const satisfies Record<string, Record<string, ExpectedSide>>;

/** Spielplan ohne Ergebnisse (Vorlage, @DR-005/@DR-018): nie ein Teamname in der Finalrunde. */
export const EXPECTED_BLANK = {
  'F-HF': { hf1Home: FIRST_A, hf1Away: SECOND_B, finalHome: WINNER_SF1 },
  'F-TAB': { hf1Home: FIRST_A, hf1Away: SECOND_B, finalHome: WINNER_SF1 },
  'F-3G': { hf1Home: FIRST_A, hf1Away: SECOND_B, finalHome: WINNER_SF1 },
  'F-NEU': { hf2Home: FIRST_B },
} as const satisfies Record<string, Record<string, Text>>;

/** Spielbezeichnung (W7: Record-Wortlaut „Halbfinale 1“). */
export const EXPECTED_LABEL = {
  hf1: { de: 'Halbfinale 1', en: 'Semifinal 1' },
  final: { de: 'Finale', en: 'Final' },
} as const satisfies Record<string, Text>;

/** Zustände (@ZM-039/@ZM-040/@ZM-041/@ZM-104) und Endstand (@ET-002/@ET-013/@ZM-147). */
export const EXPECTED_STATE = {
  'F-PAUSE spiel7': { status: 'paused', statusText: { de: 'läuft', en: 'live' }, isLive: true, score: [1, 0] },
  'F-PAUSE spiel8': { status: 'running', statusText: { de: 'läuft', en: 'live' }, isLive: true, score: [0, 0] },
  // eslint-disable-next-line local-rules/no-hardcoded-sport-terms-preferred -- feste Record-Literale (M5), bewusst nicht aus i18n
  'F-AUS spiel9': { status: 'cancelled', statusText: { de: 'ausgefallen', en: 'cancelled' }, isLive: false },
  'F-NV hf2': { status: 'finished', score: [4, 1], overtime: [3, 0], decidedBy: 'overtime', winner: 'a' },
  'F-ES finale': { status: 'finished', score: [1, 1], penalty: [4, 3], decidedBy: 'penalty', winner: 'a' },
  'F-NUR spiel3': { status: 'finished', score: [2, 1], decidedBy: 'regular', winner: 'a' },
} as const;

/** Uhrzeit (@ZM-111, F-ZEIT): Gerät in America/New_York, Turnier in Europe/Berlin. */
export const EXPECTED_TIME = {
  spiel9Kickoff: { date: '2026-11-28', time: '14:40' },
  now: { date: '2026-11-28', time: '14:32' },
} as const;

/** Rohtexte, die nie in einem Anzeigetext stehen dürfen. */
export const FORBIDDEN_FRAGMENTS = ['group-', '-winner', 'TBD', '…', 'tournament:'] as const;
