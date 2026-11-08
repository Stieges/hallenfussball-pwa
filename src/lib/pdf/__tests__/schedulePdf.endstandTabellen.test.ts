/**
 * @DR-051 Die Tabellen im Endstand-PDF heben hervor, was über den Platz entscheidet: „Platz“ und „Punkte“ gleich, fett und am größten
 * (15 pt), Spalte „Punkte“ hinterlegt, die übrigen Zahlen nach der Wertungsreihenfolge abgestuft, darunter die Zeile „Wertung: …“.
 * Gelesen aus dem fertigen PDF (pdfjs) am Hallencup Nord des Mockups (Bild-OK Daniel 08.11.).
 */
import { describe, expect, it } from 'vitest';
import { printEndTable } from '../../../design-tokens/print-endstand';
import { printColumns } from '../../../design-tokens/print';
import { printAccentDefault } from '../../../design-tokens/print-sheet';
import { endstandHallencup, endstandNikolaus, endstandPages, istFett, seiteMit } from './endstandSupport';
import type { LayoutPage, LayoutText } from './pdfjsLayout';

const TOL = 0.05;
const trim = (t: LayoutText): string => t.str.trim();
/** Seite der Tabellen: die erste mit dem Spaltenkopf „Sp.“. */
const tabellenSeite = (pages: LayoutPage[]): LayoutPage => pages[pages.findIndex(p => p.texts.some(t => trim(t) === 'Sp.'))];
/** Mitte einer Spalte: Abstand vom linken Rand 15 mm, Breiten aus den Tokens (Team nimmt den Rest). */
function spalten(): Record<string, { x1: number; x2: number }> {
  const c = printColumns.standings;
  const team = 180 - Object.values(c).reduce((s, w) => s + w, 0);
  const out: Record<string, { x1: number; x2: number }> = {};
  let x = 15;
  for (const [key, w] of [['pos', c.pos], ['team', team], ['played', c.played], ['won', c.won], ['drawn', c.drawn], ['lost', c.lost], ['goals', c.goals], ['diff', c.diff], ['points', c.points]] as const) {
    out[key] = { x1: x, x2: x + w };
    x += w;
  }
  return out;
}
/** Zahlen einer Spalte (Spaltenköpfe sind 8,5 pt und zählen nicht), Mitte der Textstücke in der Spalte. */
function inSpalte(page: LayoutPage, key: string): LayoutText[] {
  const { x1, x2 } = spalten()[key];
  const kopf = page.texts.find(t => trim(t) === 'Sp.')?.y ?? 0;
  return page.texts.filter(t => t.y > kopf + 1 && t.y < 200 && t.size > 9 && t.x + t.w / 2 > x1 && t.x + t.w / 2 < x2 && trim(t) !== '');
}

describe('@DR-051 Tabellen im Endstand: Platz und Punkte am deutlichsten', () => {
  it('Spalten bleiben an derselben Stelle: Platz, Team, Sp., S, U, N, Tore, Diff., Pkt.', async () => {
    const page = tabellenSeite(await endstandPages(endstandHallencup()));
    const kopf = page.texts.filter(t => ['Sp.', 'S', 'U', 'N', 'Tore', 'Diff.', 'Pkt.'].includes(trim(t)) && t.y < 70).sort((a, b) => a.x - b.x).map(trim);

    expect(kopf).toEqual(['Sp.', 'S', 'U', 'N', 'Tore', 'Diff.', 'Pkt.']);
    expect(inSpalte(page, 'pos').length).toBe(8);
    expect(inSpalte(page, 'points').length).toBe(8);
  });

  it('Platz und Punkte: fett, gleiche Größe 15 pt, größer als jede andere Zahl der Tabelle', async () => {
    const page = tabellenSeite(await endstandPages(endstandHallencup()));
    const platz = inSpalte(page, 'pos');
    const punkte = inSpalte(page, 'points');

    expect([...platz, ...punkte].every(t => istFett(page, t) && Math.abs(t.size - printEndTable.topPt) < TOL)).toBe(true);
    const andere = ['played', 'won', 'drawn', 'lost', 'goals', 'diff'].flatMap(k => inSpalte(page, k));
    expect(andere.length).toBeGreaterThan(0);
    expect(Math.max(...andere.map(t => t.size))).toBeLessThan(printEndTable.topPt);
  });

  it('Abstufung nach der Wertung Punkte, Tordifferenz, Tore: Diff. 12 pt normal, Tore und Sp./S/U/N 10,5 pt normal', async () => {
    const page = tabellenSeite(await endstandPages(endstandHallencup({ placementLogic: [{ id: 'points', enabled: true }, { id: 'goalDifference', enabled: true }, { id: 'goalsFor', enabled: true }] })));
    const is = (key: string, pt: number): boolean => inSpalte(page, key).every(t => !istFett(page, t) && Math.abs(t.size - pt) < TOL);

    expect(is('diff', printEndTable.secondPt)).toBe(true);
    expect(is('goals', printEndTable.restPt)).toBe(true);
    for (const k of ['played', 'won', 'drawn', 'lost']) { expect(is(k, printEndTable.restPt), k).toBe(true); }
  });

  it('ändert Olli die Wertungsreihenfolge (Punkte, Tore, Tordifferenz), folgt die Abstufung: Tore 12 pt, Diff. 10,5 pt', async () => {
    const page = tabellenSeite(await endstandPages(endstandHallencup({ placementLogic: [{ id: 'points', enabled: true }, { id: 'goalsFor', enabled: true }, { id: 'goalDifference', enabled: true }] })));

    expect(inSpalte(page, 'goals').every(t => Math.abs(t.size - printEndTable.secondPt) < TOL && !istFett(page, t))).toBe(true);
    expect(inSpalte(page, 'diff').every(t => Math.abs(t.size - printEndTable.restPt) < TOL)).toBe(true);
    expect(inSpalte(page, 'points').every(t => Math.abs(t.size - printEndTable.topPt) < TOL && istFett(page, t))).toBe(true);
  });

  it('der direkte Vergleich hat keine Spalte und verschiebt die Abstufung nicht (Voreinstellung der App)', async () => {
    const page = tabellenSeite(await endstandPages(endstandHallencup()));

    expect(inSpalte(page, 'diff').every(t => Math.abs(t.size - printEndTable.secondPt) < TOL)).toBe(true);
    expect(inSpalte(page, 'goals').every(t => Math.abs(t.size - printEndTable.restPt) < TOL)).toBe(true);
  });

  it('die Spalte „Punkte“ ist in jeder Zeile hinterlegt (Fläche wie der Tabellenkopf), die Spalte „Tore“ nicht', async () => {
    const page = tabellenSeite(await endstandPages(endstandHallencup()));
    const { x1, x2 } = spalten().points;
    // Ton des Spaltenkopfs (die Farbe wird beim Schreiben ins PDF gerundet)
    const tint = page.rects.find(r => Math.abs(r.w - 180) < TOL && r.h < 7)?.fill ?? printAccentDefault.tint;
    const punktFlaechen = page.rects.filter(r => r.fill === tint && Math.abs(r.x - x1) < TOL && Math.abs(r.w - (x2 - x1)) < TOL && r.h > 8 && r.h < 9);

    expect(punktFlaechen).toHaveLength(8);
    const toreFlaechen = page.rects.filter(r => r.fill === tint && Math.abs(r.x - spalten().goals.x1) < TOL && r.h > 8 && r.h < 9);
    expect(toreFlaechen).toHaveLength(0);
  });

  it('@DR-051 darunter steht einmal „Wertung: Punkte · Tordifferenz · Tore“ in 10,5 pt', async () => {
    const pages = await endstandPages(endstandHallencup({ placementLogic: [{ id: 'points', enabled: true }, { id: 'goalDifference', enabled: true }, { id: 'goalsFor', enabled: true }] }));
    const zeilen = pages.flatMap(p => p.texts).filter(t => trim(t).startsWith('Wertung:') && t.size < 11);

    expect(zeilen).toHaveLength(1);
    expect(trim(zeilen[0])).toBe('Wertung: Punkte · Tordifferenz · Tore');
    expect(Math.abs(zeilen[0].size - printEndTable.hintPt)).toBeLessThan(TOL);
    const seite = pages.findIndex(p => p.texts.includes(zeilen[0]));
    expect(seite).toBe(pages.indexOf(tabellenSeite(pages)));
  });

  it('@DR-051 die Zeile „Wertung: …“ nennt die Kriterien in der Reihenfolge der Turnierregel, mit „direkter Vergleich“, wenn er gilt', async () => {
    const pages = await endstandPages(endstandHallencup({ placementLogic: [{ id: 'points', enabled: true }, { id: 'goalsFor', enabled: true }, { id: 'directComparison', enabled: true }, { id: 'goalDifference', enabled: false }] }));

    expect(pages.flatMap(p => p.texts).map(trim)).toContain('Wertung: Punkte · Tore · direkter Vergleich');
  });

  it('Abschlusstabelle (Nikolausturnier-Datensatz des Mockups, eine Gruppe, ohne Torschützen): gleiche Hervorhebung, Wertungszeile darunter', async () => {
    const pages = await endstandPages(endstandNikolaus());
    const page = tabellenSeite(pages);

    expect(inSpalte(page, 'points').map(t => t.size)).toEqual(Array(6).fill(printEndTable.topPt));
    expect(inSpalte(page, 'pos').every(t => istFett(page, t))).toBe(true);
    expect(page.texts.map(trim).some(t => t.startsWith('Wertung:'))).toBe(true);
    expect(seiteMit(pages, 'Abschlusstabelle')).toBe(pages.indexOf(page));
  });

  it('@DR-051 gilt der direkte Vergleich nicht (ausgeschaltet), steht er nicht in der Zeile „Wertung: …“', async () => {
    const pages = await endstandPages(endstandHallencup({ placementLogic: [{ id: 'points', enabled: true }, { id: 'directComparison', enabled: false }, { id: 'goalDifference', enabled: true }, { id: 'goalsFor', enabled: true }] }));

    expect(pages.flatMap(p => p.texts).map(trim)).toContain('Wertung: Punkte · Tordifferenz · Tore');
  });

  it('Gegenbeispiel: im Spielplan (nicht Endstand) bleiben die Tabellen wie bisher, ohne Hinterlegung der Punkte und ohne Wertungszeile', async () => {
    const fall = endstandHallencup();
    const pages = await endstandPages(fall, { edition: 'plan', closed: false, closedAt: undefined, ranking: undefined });
    const page = tabellenSeite(pages);
    const { x1 } = spalten().points;

    expect(page.rects.filter(r => Math.abs(r.x - x1) < TOL && r.h > 8 && r.h < 9)).toHaveLength(0);
    expect(page.texts.some(t => trim(t).startsWith('Wertung:') && t.size < 11)).toBe(false);
    expect(inSpalte(page, 'points').every(t => Math.abs(t.size - printEndTable.topPt) > TOL)).toBe(true);
  });
});
