/**
 * @DR-054 Die Finalrunde im Endstand steht als ruhiges Raster mit lesbarem Zusatzergebnis: eigene Seite ohne Platzliste, dünne graue Linien um
 * jede Zelle, alle Spielzeilen gleich hoch, Ergebnis hinterlegt, Spaltenköpfe mittig, Zusatzzeile mit Wort und fetter Zahl nebeneinander,
 * Rundennamen fett mit Akzentlinie ab der zweiten Runde, keine Zebra-Zeilen. Gelesen aus dem fertigen PDF (pdfjs), Daten des Mockups.
 */
import { describe, expect, it } from 'vitest';
import { printTableGrid } from '../../../design-tokens/print-sheet';
import { printFinalsGrid } from '../../../design-tokens/print-endstand';
import { endstandHallencup, endstandPages, istFett } from './endstandSupport';
import { gridRowHeight, verticalsVisible } from '../model/finalsGridModel';
import type { LayoutLine, LayoutPage, LayoutText } from './pdfjsLayout';

const TOL = 0.1;
const trim = (t: LayoutText): string => t.str.trim();
const GRAU = '#8c8c8c';
const waagerecht = (l: LayoutLine): boolean => Math.abs(l.y1 - l.y2) < 0.01;
/** Akzentlinie: 1,5 pt stark (die Farbe wird beim Schreiben ins PDF gerundet, die Stärke unterscheidet sie sicher vom grauen Raster). */
const istAkzent = (l: LayoutLine): boolean => waagerecht(l) && l.width > 0.4;
const senkrecht = (l: LayoutLine): boolean => Math.abs(l.x1 - l.x2) < 0.01;

async function finalSeite(options: Parameters<typeof endstandPages>[1] = {}, overrides: Parameters<typeof endstandHallencup>[0] = {}) {
  const pages = await endstandPages(endstandHallencup(overrides), options);
  const page = pages.find(p => p.texts.some(t => trim(t) === 'Halbfinale'));
  if (!page) { throw new Error('Seite der Finalrunde fehlt'); }
  return { pages, page };
}
/** Spalten bei zwei Feldern: Nr 9, Zeit 18, Feld 11, Heim und Gast je 48, Ergebnis 46 (Summe 180). */
const KANTEN = [15, 24, 42, 53, 101, 147, 195];
const MITTEN = { nr: 19.5, zeit: 33, feld: 47.5, heim: 77, ergebnis: 124, gast: 171 };

/** Zeilen der vier Spiele: Ober- und Unterkante aus den waagerechten Linien (grau oder Akzent) über die ganze Breite. */
function zeilen(page: LayoutPage): Array<{ nr: string; top: number; bottom: number }> {
  const grenzen = page.lines.filter(l => waagerecht(l) && (l.color === GRAU || istAkzent(l)) && Math.abs(l.x1 - 15) < TOL && Math.abs(l.x2 - 195) < TOL).map(l => l.y1).sort((a, b) => a - b);
  return ['13', '14', '15', '16'].map(nr => {
    const text = page.texts.find(t => trim(t) === nr && t.x < 24)!;
    return { nr, top: Math.max(...grenzen.filter(y => y < text.y)), bottom: Math.min(...grenzen.filter(y => y > text.y)) };
  });
}

describe('@DR-054 Finalrunde im Endstand', () => {
  it('eigene Seite ohne Platzliste; die Platzliste steht auf der Siegerehrung, danach nichts mehr', async () => {
    const { pages, page } = await finalSeite();
    const texte = page.texts.map(trim);

    expect(pages).toHaveLength(4);
    expect(texte).not.toContain('Platzierung');
    expect(pages.indexOf(page)).toBe(2);
    expect(pages[3].texts.map(trim)).toContain('Platzierung');
    expect(pages[1].texts.map(trim).filter(t => ['Halbfinale', 'Finale'].includes(t))).toEqual([]);
  });

  it('Raster: senkrechte und waagerechte graue Linien (0,75 pt) um jede Zelle jeder Spielzeile', async () => {
    const { page } = await finalSeite();
    const grau = page.lines.filter(l => l.color === GRAU);

    expect(grau.every(l => Math.abs(l.width - printTableGrid.stroke) < 0.01)).toBe(true);
    for (const zeile of zeilen(page)) {
      for (const x of KANTEN) {
        const decken = grau.filter(l => senkrecht(l) && Math.abs(l.x1 - x) < TOL && Math.min(l.y1, l.y2) <= zeile.top + TOL && Math.max(l.y1, l.y2) >= zeile.bottom - TOL);
        expect(decken.length, `Zeile ${zeile.nr}, Kante x=${x}`).toBeGreaterThan(0);
      }
    }
  });

  it('jede Spielzeile ist gleich hoch, auch mit Strafstoßschießen (13) und Verlängerung (16)', async () => {
    const { page } = await finalSeite();
    const hoehen = zeilen(page).map(z => z.bottom - z.top);

    expect(hoehen).toHaveLength(4);
    expect(Math.max(...hoehen) - Math.min(...hoehen)).toBeLessThan(0.05);
    expect(hoehen[0]).toBeGreaterThanOrEqual(printFinalsGrid.rowHeight - 0.05);
  });

  it('Finale mit Verlängerung UND Strafstoßschießen (zwei Zusatzzeilen): alle Zeilen werden gleich hoch, nicht nur diese', async () => {
    const pages = await endstandPages(endstandHallencup({}, [], { overtimeScoreA: 2, overtimeScoreB: 2, penaltyScoreA: 5, penaltyScoreB: 4, decidedBy: 'penalty' }));
    const page = pages.find(p => p.texts.some(t => trim(t) === 'Halbfinale'))!;
    const hoehen = zeilen(page).map(z => z.bottom - z.top);

    expect(page.texts.map(trim)).toEqual(expect.arrayContaining(['2 : 2', '5 : 4']));
    expect(Math.max(...hoehen) - Math.min(...hoehen)).toBeLessThan(0.05);
    expect(hoehen[0]).toBeGreaterThan(printFinalsGrid.rowHeight + 1);
  });

  it('Ergebnis in jeder Zeile hinterlegt; sonst nur der Spaltenkopf, keine abwechselnd hinterlegten Zeilen', async () => {
    const { page } = await finalSeite();
    const flaechen = page.rects.filter(r => r.fill !== '#000000');
    const ergebnis = flaechen.filter(r => Math.abs(r.x - 101) < TOL && Math.abs(r.w - printFinalsGrid.cols.result) < TOL);
    const kopf = flaechen.filter(r => Math.abs(r.w - 180) < TOL);

    expect(ergebnis).toHaveLength(4);
    expect(zeilen(page).every((z, i) => Math.abs(ergebnis[i].y - z.top) < TOL && Math.abs(ergebnis[i].h - (z.bottom - z.top)) < TOL)).toBe(true);
    expect(kopf).toHaveLength(1);
    expect(flaechen).toHaveLength(5);
  });

  it('Spaltenköpfe mittig über ihrer Spalte', async () => {
    const { page } = await finalSeite();
    const mitte = (text: string): number => {
      const t = page.texts.find(x => trim(x) === text && x.size < 9)!;
      return t.x + t.w / 2;
    };

    for (const [text, soll] of [['Nr.', MITTEN.nr], ['Zeit', MITTEN.zeit], ['Feld', MITTEN.feld], ['Heim', MITTEN.heim], ['Ergebnis', MITTEN.ergebnis], ['Gast', MITTEN.gast]] as const) {
      expect(mitte(text), text).toBeCloseTo(soll, 0);
      expect(Math.abs(mitte(text) - soll), text).toBeLessThan(0.15);
    }
  });

  it.each([['Strafstoßschießen', '4 : 3'], ['Verlängerung', '1 : 0']])('Zusatzzeile „%s %s“: Wort und fette Zahl nebeneinander auf einer Grundlinie, Zahl mindestens 12 pt, mittig in der Ergebnis-Zelle', async (wort, zahl) => {
    const { page } = await finalSeite();
    const w = page.texts.find(t => trim(t) === wort && t.size < 10)!;
    const z = page.texts.find(t => trim(t) === zahl && t.size >= printFinalsGrid.extraValuePt - 0.05 && t.size < 13)!;

    expect(w).toBeDefined();
    expect(z).toBeDefined();
    expect(Math.abs(w.y - z.y)).toBeLessThan(0.05);
    expect(z.x - (w.x + w.w)).toBeGreaterThan(0);
    expect(z.x - (w.x + w.w)).toBeLessThan(3);
    expect(istFett(page, z)).toBe(true);
    expect(istFett(page, w)).toBe(false);
    expect(Math.abs(w.size - printFinalsGrid.extraWordPt)).toBeLessThan(0.05);
    expect(Math.abs((w.x + z.x + z.w) / 2 - MITTEN.ergebnis)).toBeLessThan(0.3);
  });

  it('Spiele ohne Zusatz haben keine Zusatzzeile (14 und 15)', async () => {
    const { page } = await finalSeite();
    const [, z14, z15] = zeilen(page);
    const imErgebnis = page.texts.filter(t => t.x > 101 && t.x < 147 && t.size < 10 && t.y > 60);

    expect(imErgebnis.filter(t => t.y > z14.top && t.y < z14.bottom)).toEqual([]);
    expect(imErgebnis.filter(t => t.y > z15.top && t.y < z15.bottom)).toEqual([]);
  });

  it('Rundennamen fett in 12 pt; Akzentlinie über „Spiel um Platz 3“ und „Finale“, nicht über „Halbfinale“', async () => {
    const { page } = await finalSeite();
    const runden = ['Halbfinale', 'Spiel um Platz 3', 'Finale'].map(n => page.texts.find(t => trim(t) === n && t.size > 11 && t.size < 13)!);
    // ohne die Akzentlinie unter dem Kurzkopf (oben auf der Seite)
    const akzent = page.lines.filter(l => istAkzent(l) && l.y1 > runden[0].y - 20).sort((a, b) => a.y1 - b.y1);

    expect(runden.every(t => t !== undefined && istFett(page, t) && Math.abs(t.size - printFinalsGrid.roundPt) < 0.05)).toBe(true);
    expect(akzent).toHaveLength(2);
    expect(akzent.every(l => Math.abs(l.width - 1.5 * 25.4 / 72) < 0.01 && Math.abs(l.x1 - 15) < TOL && Math.abs(l.x2 - 195) < TOL)).toBe(true);
    // die Linie liegt über dem Rundennamen und unter den Spielen der Runde davor
    expect(akzent[0].y1).toBeLessThan(runden[1].y);
    expect(akzent[0].y1).toBeGreaterThan(runden[0].y);
    expect(akzent[1].y1).toBeLessThan(runden[2].y);
    expect(akzent[1].y1).toBeGreaterThan(runden[1].y);
  });

  it('Mit einem Feld entfällt die Spalte „Feld“, das Raster bleibt', async () => {
    const { page } = await finalSeite({}, { numberOfFields: 1 });

    expect(page.texts.some(t => trim(t) === 'Feld')).toBe(false);
    expect(zeilen(page).every(z => z.bottom - z.top >= printFinalsGrid.rowHeight - 0.05)).toBe(true);
  });

  it('Gegenbeispiel: der Spielplan (nicht der Endstand) behält die Finalrunde mit Zebra und Rundennamen in Versalien', async () => {
    const pages = await endstandPages(endstandHallencup(), { edition: 'plan' });
    const texte = pages.flatMap(p => p.texts).map(trim);

    expect(texte).toContain('HALBFINALE');
    expect(texte).not.toContain('Halbfinale');
  });
});

describe('@DR-054 Hilfen des Rasters', () => {
  it('Zeilenhöhe: mindestens 16 mm, bei mehr Inhalt in allen Zeilen gleich größer (drei Namenszeilen, zwei Zusatzzeilen)', () => {
    expect(gridRowHeight(1, 1)).toBeCloseTo(printFinalsGrid.rowHeight, 5);
    expect(gridRowHeight(1, 0)).toBeCloseTo(printFinalsGrid.rowHeight, 5);
    expect(gridRowHeight(1, 2)).toBeGreaterThan(printFinalsGrid.rowHeight);
    expect(gridRowHeight(3, 0)).toBeGreaterThan(printFinalsGrid.rowHeight);
  });

  it('senkrechte Linien umschaltbar: „all“ zeichnet sie immer, „parallel“ nur bei gleichzeitigen Spielen', () => {
    expect(verticalsVisible('all', false)).toBe(true);
    expect(verticalsVisible('all', true)).toBe(true);
    expect(verticalsVisible('parallel', true)).toBe(true);
    expect(verticalsVisible('parallel', false)).toBe(false);
    expect(printFinalsGrid.verticals).toBe('all');
  });
});
