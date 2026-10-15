/**
 * Hilfen für die Tests der Ergebniszelle, der Schreibfelder und der Spieltabellen (B-28 C1). Nur Tests.
 * Eine Spielzeile wird im fertigen PDF über ihre Spielnummer gefunden: die Zahl in der Nr-Spalte, die Zeilenlinien
 * darüber und darunter begrenzen die Zeile. Kästchen sind Rechtecke mit Strich: pdfjs liefert drei ihrer vier
 * Kanten (die schließende fehlt), deshalb zählen zwei Waagerechte gleicher Länge im Abstand der Höhe und die
 * Senkrechte rechts.
 */
import type { GeneratedSchedule } from '../../../core/generators';
import { printColumns, printType } from '../../../design-tokens/print';
import type { Match, Tournament } from '../../../types/tournament';
import { buildSchedulePdf, type PDFExportOptions } from '../schedulePdf';
import { pageGeometry } from '../layout';
import { withTournamentState } from '../tournamentState';
import { hallencupSchedule, hallencupTournament, matchByNumber } from './pdfFixture';
import { readLayout, type Box, type LayoutLine, type LayoutPage, type LayoutRect, type LayoutText } from './pdfjsLayout';
import { translatorFor } from './pdfText';

export const TOL = 0.1;
/** Eine Zeilenlinie reicht mindestens über diese Strecke (mm); der Gitterrand eines Kästchens ist kürzer. */
const MINDESTLAENGE_ZEILENLINIE = 100;
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
      teamA: base.originalTeamA,
      teamB: base.originalTeamB,
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

/** Höhen (y) der Zeilenlinien: autoTable zieht sie zellenweise, zusammen ergeben sie eine Linie über die Tabelle. */
export function zeilenLinien(page: LayoutPage): number[] {
  const laengeJeHoehe = new Map<number, number>();
  for (const l of page.lines.filter(waagerecht)) {
    const y = Math.round(l.y1 * 10) / 10;
    laengeJeHoehe.set(y, (laengeJeHoehe.get(y) ?? 0) + laenge(l));
  }
  return [...laengeJeHoehe].filter(([, summe]) => summe > MINDESTLAENGE_ZEILENLINIE).map(([y]) => y).sort((a, b) => a - b);
}

/** Zeile der Spielnummer `nummer`: Zahl in der Nr-Spalte (Schrift `printType.nr`), begrenzt von den Zeilenlinien. */
export function zeileVon(pages: LayoutPage[], nummer: number): Zeile {
  const links = pageGeometry('a4', 'portrait').left;
  for (const [index, page] of pages.entries()) {
    const nr = page.texts.find(t =>
      t.str.trim() === String(nummer) && Math.abs(t.size - printType.nr) <= SIZE_TOL && t.x >= links && t.x < links + printColumns.match.nr);
    if (!nr) {continue;}
    const linien = zeilenLinien(page);
    const oben = Math.max(...linien.filter(y => y < nr.y));
    const unten = Math.min(...linien.filter(y => y > nr.y));
    return { page, nr, top: oben, bottom: unten, index };
  }
  throw new Error(`Spiel ${nummer} steht in keiner Nr-Spalte`);
}

/** Textstücke der Zeile (zwischen den Zeilenlinien). */
export const textsIn = (zeile: Zeile): LayoutText[] =>
  zeile.page.texts.filter(t => t.y > zeile.top && t.y < zeile.bottom);

/** Kästchen der Größe `w` × `h` in einem senkrechten Bereich. */
export function kaestchen(page: LayoutPage, w: number, h: number, von = -Infinity, bis = Infinity): Box[] {
  const waag = page.lines.filter(l => waagerecht(l) && Math.abs(laenge(l) - w) <= TOL);
  const senk = page.lines.filter(l => senkrecht(l) && Math.abs(laenge(l) - h) <= TOL);
  const gefunden: Box[] = [];
  for (const oben of waag) {
    const x = Math.min(oben.x1, oben.x2);
    const unten = waag.find(l => Math.abs(Math.min(l.x1, l.x2) - x) <= TOL && Math.abs(l.y1 - oben.y1 - h) <= TOL);
    const rechts = senk.some(l => Math.abs(l.x1 - (x + w)) <= TOL && Math.abs(Math.min(l.y1, l.y2) - oben.y1) <= TOL);
    if (unten && rechts && oben.y1 >= von && unten.y1 <= bis) {
      gefunden.push({ x, y: oben.y1, w, h });
    }
  }
  return gefunden.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Kästchen der Größe `w` × `h` innerhalb der Zeile. */
export const kaestchenIn = (zeile: Zeile, w: number, h: number): Box[] => kaestchen(zeile.page, w, h, zeile.top, zeile.bottom);

/** Schwarz gefüllte Rechtecke der Breite `w` (Balken) in einem senkrechten Bereich. */
export function balken(page: LayoutPage, w: number, von: number, bis: number): LayoutRect[] {
  return page.rects.filter(r => r.fill === '#000000' && Math.abs(r.w - w) <= TOL && r.y >= von - TOL && r.y + r.h <= bis + TOL);
}

/**
 * Ist das Textstück fett gesetzt? Die eingebetteten Schnitte tragen denselben Schriftnamen („pdfSans“), `bold` aus
 * `pdfjsLayout` bleibt deshalb falsch. Verglichen wird die Schriftkennung mit der des Spaltenkopfs „Nr“ der Seite:
 * Spaltenköpfe sind fett (v7.2, `headStyles`), Teamnamen nicht.
 */
export function istFett(page: LayoutPage, text: LayoutText): boolean {
  const kopf = page.texts.find(t => t.str.trim() === 'Nr' && Math.abs(t.size - printType.head) <= SIZE_TOL);
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
  return pages.flatMap(page => page.texts).find(t => t.str.trim() === 'Nr' && Math.abs(t.size - printType.head) <= SIZE_TOL)?.font;
}
