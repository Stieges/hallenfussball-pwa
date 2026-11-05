/**
 * @DR-045: Ein ausgefallenes Spiel (beide Teams nicht angetreten) steht im Spielplan mit Ergebnissen als „ausgefallen“, fett und so
 * groß wie die Ergebnisse der anderen Spiele; keine Wertungstore, kein Zusatz zur Wertung; in der Tabelle zählt es nach der Wertung.
 * @DR-019 gilt weiter: „ausgefallen“ ohne Schreiblinien, auch bei ausgeblendeten Ergebnissen. Am PDF (pdfjs) und im Seitenmodell
 * (echte Schrift: der Text bleibt in der Spalte „Ergebnis“, die Zeile wird nicht höher).
 */
import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { printFont, printType, printUnit } from '../../../design-tokens/print';
import type { Match } from '../../../types/tournament';
import { calculateStandingsPerGroup } from '../../../utils/calculations';
import { fontOf, registerPdfFonts } from '../fonts';
import { jspdfMeasure } from '../model/measure';
import { matchPages, modelOf } from '../model/__tests__/modelSupport';
import type { MatchRowModel, ScheduleModel } from '../model/types';
import { FALL_A, FALL_B, FALL_C, mitStandA, type HandzettelFall } from './fixtures/handzettelFaelle';
import { fallMatches, fallTournament } from './fixtures/handzettelTurnier';
import { handzettelPdf } from './handzettelPdf';
import type { LayoutPage, LayoutText } from './pdfjsLayout';

const TOL = 0.05;
/** Spiel 6 des Nikolaus-Turniers: TSV Waging blau – DJK Kammer, 17:20. */
const NR = 6;

/** Beide Teams nicht angetreten (Wertung, Stand 0:0 nach der Engine); Spiel 1 normal beendet 2:1 als Vergleich. */
function doppelt(fall: HandzettelFall, nr: number): Match[] {
  return fallMatches(fall).map((m): Match => {
    if (m.matchNumber === nr) { return { ...m, matchStatus: 'finished', scoreA: 0, scoreB: 0, decidedBy: 'forfeit', forfeitAbsent: 'both' }; }
    if (m.matchNumber === 1) { return { ...m, matchStatus: 'finished', scoreA: 2, scoreB: 1 }; }
    return m;
  });
}

async function pdfVon(fall: HandzettelFall, matches: Match[], includeScores = true) {
  return handzettelPdf(fall, {
    tournament: { matches }, options: { includeScores },
    standings: calculateStandingsPerGroup(fallTournament(fall, { matches })),
  });
}

/** Textstücke einer Zeile: von 4 mm über ihrer Uhrzeit bis 4 mm über der Uhrzeit der nächsten Zeile. */
function zeile(page: LayoutPage, time: string, next: string): LayoutText[] {
  const top = page.texts.find(t => t.str.trim() === time)!.y - 4;
  const bottom = page.texts.find(t => t.str.trim() === next)!.y - 4;
  return page.texts.filter(t => t.y > top && t.y < bottom && t.str.trim() !== '');
}

describe('@DR-045 ausgefallen im Spielplan mit Ergebnissen', () => {
  it('@DR-045 statt eines Ergebnisses „ausgefallen“, fett wie die Ergebnisse der anderen Spiele und größer als bisher (11 pt); keine Wertungstore, kein Zusatz', async () => {
    const { pages } = await pdfVon(FALL_A, doppelt(FALL_A, NR));
    const reihe = zeile(pages[0], '17:20', '17:30');
    const text = reihe.find(t => t.str.trim() === 'ausgefallen');
    const ziffern = zeile(pages[0], '16:30', '16:40').filter(t => /^\d+$/.test(t.str.trim()) && t.size > printType.time);

    expect(text).toBeDefined();
    expect(ziffern.length).toBe(2);
    expect(text!.size).toBeGreaterThan(printType.cancel + TOL);
    expect(text!.font, 'fetter Schnitt wie die Ziffern').toBe(ziffern[0].font);
    expect(reihe.filter(t => /^\d+$/.test(t.str.trim()) && t.size > printType.time).map(t => t.str), 'keine Wertungstore').toEqual([]);
    expect(reihe.some(t => /gewertet|korrigiert/.test(t.str)), 'kein Zusatz').toBe(false);
  });

  it('@DR-045 Spiel mit Status „ausgefallen“ (Stand am Turniertag, Spiel 6): ebenso fett und größer als bisher', async () => {
    const { pages } = await handzettelPdf(mitStandA(FALL_A), { options: { includeScores: true } });
    const text = zeile(pages[0], '17:20', '17:30').find(t => t.str.trim() === 'ausgefallen');
    const ziffer = zeile(pages[0], '16:30', '16:40').find(t => /^\d+$/.test(t.str.trim()) && t.size > printType.time);

    expect(text?.size).toBeGreaterThan(printType.cancel + TOL);
    expect(text?.font).toBe(ziffer!.font);
  });

  /**
   * BEFUND C-PDF-AUSGEFALLEN-GROESSE (offen, Entscheidung Daniel): „ausgefallen“ fett in 18 pt ist 36,9 mm breit, die Spalte „Ergebnis“ 30 mm (Finalrunde 25,5 mm).
   * In der Spalte zu bleiben (Vorgabe Fixrunde) geht vor; die Schrift wird so groß, wie es passt (Gruppenspiele etwa 13,3 pt).
   */
  it.fails('@DR-045 C-PDF-AUSGEFALLEN-GROESSE „ausgefallen“ so groß wie die Ergebnisse der anderen Spiele (18 pt) – passt nicht in die Spalte', async () => {
    const { pages } = await pdfVon(FALL_A, doppelt(FALL_A, NR));
    const text = zeile(pages[0], '17:20', '17:30').find(t => t.str.trim() === 'ausgefallen');
    const ziffer = zeile(pages[0], '16:30', '16:40').find(t => /^\d+$/.test(t.str.trim()) && t.size > printType.time);

    expect(text!.size).toBeCloseTo(ziffer!.size, 1);
  });

  it('@DR-045 in der Tabelle zählt das Spiel nach der Wertung: beide Teams 1 Spiel, 0 Punkte, 0:2 Tore', async () => {
    const { pages } = await pdfVon(FALL_A, doppelt(FALL_A, NR));
    const tabelle = pages.find(p => p.texts.some(t => t.str.trim() === 'Pkt.'))!;
    for (const team of ['TSV Waging blau']) {
      const name = tabelle.texts.find(t => t.str.trim() === team)!;
      const werte = tabelle.texts.filter(t => Math.abs(t.y - name.y) < 1 && t.x > name.x + name.w).map(t => t.str.trim()).filter(s => s !== '');
      expect(werte, team).toEqual(['1', '0', '0', '1', '0:2', '-2', '0']);
    }
  });

  it('@DR-019 auch bei ausgeblendeten Ergebnissen steht „ausgefallen“, ohne Schreiblinien', async () => {
    const { pages } = await pdfVon(FALL_A, doppelt(FALL_A, NR), false);
    const reihe = zeile(pages[0], '17:20', '17:30');
    const top = Math.min(...reihe.map(t => t.y)) - 4;
    const bottom = Math.max(...reihe.map(t => t.y)) + 4;

    expect(reihe.some(t => t.str.trim() === 'ausgefallen')).toBe(true);
    expect(reihe.some(t => t.str.trim() === ':'), 'kein Doppelpunkt der Schreiblinien').toBe(false);
    expect(pages[0].lines.filter(l => Math.abs(l.y1 - l.y2) < 0.05 && l.y1 > top && l.y1 < bottom && Math.abs(l.x2 - l.x1) < 20)).toEqual([]);
  });
});

describe('@DR-045 der Text bleibt in der Spalte „Ergebnis“, die Zeile wird nicht höher (echte Schrift)', () => {
  const rowsOf = (model: ScheduleModel): MatchRowModel[] =>
    model.pages.flatMap(p => p.blocks.flatMap(b => (b.kind === 'matchRows' ? b.rows : b.kind === 'finals' ? b.rounds.flatMap(r => r.rows) : [])));

  it.each([
    ['Nikolaus, Spiel 6', FALL_A, 6],
    ['lange Namen und Spalte „SR“ (Fall c), Spiel 6', FALL_C, 6],
    ['Finalrunde (Fall b), Viertelfinale 21', FALL_B, 21],
  ] as [string, HandzettelFall, number][])('%s', async (_name, fall, nr) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    await registerPdfFonts(doc);
    const measure = jspdfMeasure(doc, fontOf(doc));
    const { model } = modelOf(fall, { measure, tournament: { matches: doppelt(fall, nr) }, options: { includeScores: true } });
    const mitText = modelOf(fall, { measure, options: { includeScores: true } }).model;
    const rows = rowsOf(model);
    const row = rows.find(r => r.number === nr)!;
    const ohne = rowsOf(mitText).find(r => r.number === nr)!;
    const block = model.pages.flatMap(p => p.blocks).find(b => (b.kind === 'matchRows' ? b.rows.includes(row) : b.kind === 'finals' && b.rounds.some(r => r.rows.includes(row))))!;
    const cols = block.kind === 'matchRows' || block.kind === 'finals' ? block.head.columns : [];
    const col = cols.find(c => c.key === 'result')!;
    const run = row.cell.runs.find(r => r.text === 'ausgefallen')!;
    const w = measure.width(run.text, run.pt, run.weight);

    expect(run.weight).toBe('bold');
    expect(run.x - w / 2).toBeGreaterThanOrEqual(col.x - TOL);
    expect(run.x + w / 2).toBeLessThanOrEqual(col.x + col.w + TOL);
    expect(row.box.h, 'nicht höher als dieselbe Zeile ohne Ergebnis').toBeLessThanOrEqual(ohne.box.h + TOL);
    expect(run.y + run.pt * printFont.descentEm * printUnit.mmPerPt, 'Unterlänge des „g“ in der Zeile').toBeLessThanOrEqual(row.box.y + row.box.h + TOL);
    expect(matchPages(model).length).toBe(matchPages(mitText).length);
  });
});
