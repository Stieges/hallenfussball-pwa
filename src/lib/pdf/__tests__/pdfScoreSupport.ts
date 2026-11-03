/**
 * Hilfen für die Tests der Ergebniszelle, der Schreiblinien und der Spieltabellen (B-28 C1, T7a, T7b). Nur Tests.
 * Eine Spielzeile wird im fertigen PDF über ihre Spielnummer gefunden: die Zahl in der Nr-Spalte; die Grenze zur Nachbarzeile
 * liegt mittig zwischen zwei Spielnummern (Zebra-Flächen statt Trennlinien, @DR-034).
 */
import type { GeneratedSchedule } from '../../../core/generators';
import { printColumns, printType } from '../../../design-tokens/print';
import { printMatchTable } from '../../../design-tokens/print-sheet';
import type { Match, Tournament } from '../../../types/tournament';
import { buildSchedulePdf, type PDFExportOptions } from '../schedulePdf';
import { pageGeometry } from '../layout';
import { withTournamentState } from '../tournamentState';
import { hallencupSchedule, hallencupTournament, matchByNumber } from './pdfFixture';
import { readLayout, type LayoutLine, type LayoutPage, type LayoutText } from './pdfjsLayout';
import { translatorFor } from './pdfText';

export const TOL = 0.1;
export const SIZE_TOL = 0.05;

/** Plan und Turnier mit Stand: `updates` je Spielnummer wie `Match`-Felder des Turniers, eingemischt über die Fassade. */
export function mitStand(
  schedule: GeneratedSchedule,
  tournament: Tournament,
  updates: Record<number, Partial<Match>>,
): { schedule: GeneratedSchedule; tournament: Tournament } {
  const matches: Match[] = Object.entries(updates).map(([nummer, overrides]) => {
    const base = matchByNumber(schedule, Number(nummer));
    return {
      id: base.id,
      round: 0,
      field: base.field,
      slotA: base.slotA,
      slotB: base.slotB,
      originA: base.originA,
      originB: base.originB,
      group: base.group,
      phase: base.phase,
      matchNumber: Number(nummer),
      ...overrides,
    };
  });
  const mitSpielen = { ...tournament, matches };
  return { schedule: withTournamentState(schedule, mitSpielen), tournament: mitSpielen };
}

/** Das fertige PDF als Seiten mit Text, Linien und Rechtecken. */
export async function lesen(
  schedule: GeneratedSchedule,
  tournament: Tournament,
  options: Partial<PDFExportOptions> = {},
): Promise<LayoutPage[]> {
  const { doc } = await buildSchedulePdf({
    schedule,
    standings: undefined,
    options: { locale: 'de', translate: translatorFor('de'), tournament, includeScores: true, ...options },
  });
  return readLayout(new Uint8Array(doc.output('arraybuffer')));
}

/** Das „Hallencup Nord“ mit Stand `updates`, gelesen. */
export async function hallencupMitStand(
  updates: Record<number, Partial<Match>>,
  overrides: Partial<Tournament> = {},
  options: Partial<PDFExportOptions> = {},
): Promise<LayoutPage[]> {
  const tournament = hallencupTournament(overrides);
  const stand = mitStand(hallencupSchedule(tournament), tournament, updates);
  return lesen(stand.schedule, stand.tournament, options);
}

export interface Zeile { page: LayoutPage; nr: LayoutText; top: number; bottom: number; index: number }

const laenge = (l: LayoutLine): number => Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
export const waagerecht = (l: LayoutLine): boolean => Math.abs(l.y1 - l.y2) < TOL;
export const senkrecht = (l: LayoutLine): boolean => Math.abs(l.x1 - l.x2) < TOL;

/**
 * Platz vor der ersten bzw. nach der letzten Spielnummer einer Seite, soweit Herkunft und kleine Linien noch zur Zeile gehören (mm):
 * unten reicht er bis unter das zweite Paar kleiner Linien samt Beschriftung, bleibt aber über der nächsten Überschrift.
 */
const RAND_OBEN = 6;
const RAND_UNTEN = 14;

/**
 * Zeile der Spielnummer `nummer`: die Zahl in der Nr-Spalte (Schrift `printType.nr`). Die Zeilen trennt seit der Mockup-Runde 2 keine
 * Linie, sondern eine helle Fläche; die Grenze zur Nachbarzeile liegt darum mittig zwischen zwei Spielnummern.
 */
export function zeileVon(pages: LayoutPage[], nummer: number): Zeile {
  const links = pageGeometry('a4', 'portrait').left;
  for (const [index, page] of pages.entries()) {
    const nummern = page.texts
      .filter(t => Math.abs(t.size - printType.nr) <= SIZE_TOL && t.x >= links && t.x < links + printColumns.match.nr && /^\d+$/.test(t.str.trim()))
      .sort((a, b) => a.y - b.y);
    const stelle = nummern.findIndex(t => t.str.trim() === String(nummer));
    if (stelle < 0) {continue;}
    const nr = nummern[stelle];
    const davor = nummern[stelle - 1];
    const danach = nummern[stelle + 1];
    return { page, nr, top: davor ? (davor.y + nr.y) / 2 : nr.y - RAND_OBEN, bottom: danach ? (nr.y + danach.y) / 2 : nr.y + RAND_UNTEN, index };
  }
  throw new Error(`Spiel ${nummer} steht in keiner Nr-Spalte`);
}

/** Textstücke der Zeile (zwischen ihrer oberen und unteren Grenze). */
export const textsIn = (zeile: Zeile): LayoutText[] =>
  zeile.page.texts.filter(t => t.y > zeile.top && t.y < zeile.bottom);

/** Waagerechte Linien der Zeile, mindestens `mindestens` mm lang. */
export const linienIn = (zeile: Zeile, mindestens = 0): LayoutLine[] =>
  zeile.page.lines.filter(l => waagerecht(l) && l.y1 > zeile.top && l.y1 < zeile.bottom && laenge(l) >= mindestens);

/**
 * Ist das Textstück fett gesetzt? Die eingebetteten Schnitte tragen denselben Schriftnamen („pdfSans“), `bold` aus
 * `pdfjsLayout` bleibt deshalb falsch. Verglichen wird die Schriftkennung mit der des Spaltenkopfs „Nr“ der Seite:
 * Spaltenköpfe sind fett (v7.2, `headStyles`), Teamnamen nicht.
 */
export function istFett(page: LayoutPage, text: LayoutText): boolean {
  const kopf = page.texts.find(t => t.str.trim() === 'Nr.' && Math.abs(t.size - printMatchTable.headPt) <= SIZE_TOL);
  const name = page.texts.find(t => t.str.trim() === 'FC Nord' || t.str.trim() === 'SV Süd');
  if (!kopf || !name) {
    throw new Error('Spaltenkopf „Nr“ oder ein Teamname fehlt auf der Seite');
  }
  if (kopf.font === name.font) {
    throw new Error('fett und normal tragen dieselbe Schriftkennung');
  }
  return text.font === kopf.font;
}

/**
 * Kennung des fetten Schnitts im ganzen Dokument (pdfjs vergibt sie dokumentweit): die Schrift der Spaltenköpfe „Nr“.
 * `undefined`, wenn das Dokument keinen Spaltenkopf hat.
 */
export function fettKennung(pages: LayoutPage[]): string | undefined {
  return pages.flatMap(page => page.texts).find(t => t.str.trim() === 'Nr.' && Math.abs(t.size - printMatchTable.headPt) <= SIZE_TOL)?.font;
}
