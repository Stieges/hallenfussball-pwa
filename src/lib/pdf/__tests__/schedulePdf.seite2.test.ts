/**
 * T7b – Seite 2 ff. des Handzettels am fertigen PDF (pdfjs), Fälle a, b, c, b-lang der Mockup-Runde 2.
 * Szenarien: @DR-035 (Kästchen grau, keine Legende), @DR-036 (Strafstoß-Zeile), @DR-037 (Namenslinie, Herkunft unter der Linie),
 * @DR-034 (Abstände), @DR-033 (Umbruch an der Stunde), @DR-019 (laufendes Finale ohne „läuft“, EN), @DR-039 (Kurzkopf zuerst).
 */
import { describe, expect, it } from 'vitest';
import { printLimits } from '../../../design-tokens/print';
import { printFinals, printTableGrid, printWriteLine } from '../../../design-tokens/print-sheet';
import { FALL_A, FALL_B, FALL_B_KONTAKT, FALL_B_SR, FALL_B_SR_TEAM, fallBLang, mitRegelnDR019 } from './fixtures/handzettelFaelle';
import { handzettelPdf } from './handzettelPdf';
import type { LayoutLine, LayoutPage } from './pdfjsLayout';
import { hallencupMitStand } from './pdfScoreSupport';

const TOL = printWriteLine.tolerance;
const waag = (l: LayoutLine): boolean => Math.abs(l.y1 - l.y2) < 0.05;
const laenge = (l: LayoutLine): number => Math.abs(l.x2 - l.x1);
const strs = (pages: LayoutPage[]): string[] => pages.flatMap(p => p.texts.map(t => t.str.trim())).filter(s => s !== '');

describe('@DR-035 Tabellen zum Selbstausfüllen', () => {
  it('Jeder gegen jeden hat eine Tabelle mit grauen Kästchen und ohne Legende', async () => {
    const { pages } = await handzettelPdf(FALL_A, { options: { edition: 'blank' } });
    const grau = pages[1].lines.filter(l => laenge(l) > 0 && l.width > 0 && Math.abs(l.width - printTableGrid.stroke) < 0.02);

    expect(strs(pages)).toContain('Team');
    expect(grau.length).toBeGreaterThanOrEqual(8);
    expect(strs(pages).some(s => /Platz\s*·|Spiele\s*·|Pl\s+Platz/.test(s))).toBe(false);
  });
});

describe('@DR-036 Strafstoßschießen um Platz 1', () => {
  it('Jeder gegen jeden mit Regel: Zeile mit vier Linien und Beschriftung, ohne Kasten', async () => {
    const { pages } = await handzettelPdf(FALL_A);
    const lang = pages[1].lines.filter(l => waag(l) && Math.abs(l.width - printWriteLine.stroke) < 0.02);

    expect(strs(pages)).toContain('Strafstoßschießen um Platz 1 (nur bei Gleichstand)');
    expect(strs(pages).filter(s => s === 'Treffer')).toHaveLength(1);
    expect(lang.filter(l => laenge(l) >= printWriteLine.shootoutHits - TOL).length).toBeGreaterThanOrEqual(4);
  });

  it('Gegenbeispiel: ohne eingestellte Regel entfällt die Zeile', async () => {
    const { pages } = await handzettelPdf(FALL_A, { tournament: { placementsToPlayOut: [] } });

    expect(strs(pages).some(s => s.startsWith('Strafstoßschießen um Platz 1'))).toBe(false);
  });

  it('Gegenbeispiel: Gruppen mit Finalrunde (b) haben keine solche Zeile', async () => {
    const { pages } = await handzettelPdf(FALL_B);

    expect(strs(pages).some(s => s.startsWith('Strafstoßschießen um Platz 1'))).toBe(false);
  });
});

describe('@DR-037 @DR-005 Finalrunde: Namenslinie und Herkunft unter der Linie', () => {
  it('Fall b: je Platz eine Namenslinie von mindestens 50 mm, die Herkunft steht 7,5 pt klein darunter', async () => {
    const { pages } = await handzettelPdf(FALL_B);
    const seite = pages.find(p => p.texts.some(t => t.str.trim() === 'Sieger Spiel 22'))!;
    const linien = seite.lines.filter(l => waag(l) && laenge(l) >= printWriteLine.nameMin - TOL);
    const herkunft = seite.texts.filter(t => /^(Sieger|Verlierer) Spiel \d+$|^\d\. Gruppe [AB]$/.test(t.str.trim()));

    expect(herkunft).toHaveLength(16);
    expect(linien.length).toBeGreaterThanOrEqual(16);
    for (const t of herkunft) {
      expect(Math.abs(t.size - printFinals.smallPt)).toBeLessThan(0.05);
      const darueber = linien.filter(l => l.y1 < t.y && t.y - l.y1 < printWriteLine.minWriteSpace && Math.min(l.x1, l.x2) < t.x + 1 && Math.max(l.x1, l.x2) > t.x);
      expect(darueber.length, t.str).toBeGreaterThan(0);
    }
  });

  it('@DR-034 die Linien der Finalrunde halten 4 mm Abstand zu den Rundentrennern und 3 mm zu den Flächenkanten', async () => {
    const { pages } = await handzettelPdf(FALL_B);
    const seite = pages.find(p => p.texts.some(t => t.str.trim() === 'Sieger Spiel 22'))!;
    const schreib = seite.lines.filter(l => waag(l) && Math.abs(l.width - printWriteLine.stroke) < 0.02);
    const trenner = seite.lines.filter(l => waag(l) && l.width > printWriteLine.stroke + 0.1);
    const kanten = seite.rects.filter(r => r.w > 100).flatMap(r => [r.y, r.y + r.h]);

    expect(trenner.length).toBeGreaterThan(0);
    for (const l of schreib) {
      for (const t of trenner) { expect(Math.abs(l.y1 - t.y1)).toBeGreaterThanOrEqual(printWriteLine.minGapToStroke - TOL); }
      for (const k of kanten) { expect(Math.abs(l.y1 - k)).toBeGreaterThanOrEqual(printWriteLine.minGapToFill - TOL); }
    }
  });
});

describe('@DR-033 Seitenumbruch an der Stunde', () => {
  it('b-lang: die Folgeseite beginnt mit einer vollen Stunde (13:00), Seite 1 endet davor', async () => {
    const { pages } = await handzettelPdf(fallBLang(1));
    const zeiten = (p: LayoutPage): string[] => p.texts.filter(t => /^\d{2}:\d{2}$/.test(t.str.trim()) && t.size >= printLimits.timePt - 0.05).sort((a, b) => a.y - b.y).map(t => t.str.trim());

    expect(zeiten(pages[1])[0]).toBe('13:00');
    expect(zeiten(pages[0]).at(-1)).toBe('12:48');
  });
});

describe('@DR-019 laufendes Finale im Ausdruck', () => {
  it('EN: ein laufendes Finale steht wie ohne Ergebnis da, ohne „running“ und ohne Zwischenstand', async () => {
    const ergebnis = await hallencupMitStand({ 16: { matchStatus: 'running', scoreA: 1, scoreB: 1 } }, {}, { locale: 'en' });
    const text = strs(ergebnis).join(' ');

    expect(text).not.toMatch(/running|in progress/i);
    expect(ergebnis.flatMap(p => p.texts).some(t => /^\d$/.test(t.str.trim()) && t.size >= printLimits.resultPt - 0.05)).toBe(false);
  });

  it('DR-019 Golden Goal, Verlängerung und Strafstoß kommen in einem Plan vor', async () => {
    const { pages } = await handzettelPdf(mitRegelnDR019());

    expect(strs(pages).filter(s => s === 'nach Verlängerung')).toHaveLength(2);
  });
});

describe('@DR-039 Lesereihenfolge', () => {
  it('der Kurzkopf der Folgeseite steht vor den Tabellen, die Fußzeile zuletzt', async () => {
    const { pages } = await handzettelPdf(FALL_B);
    const texte = pages[1].texts.map(t => t.str.trim()).filter(s => s !== '');

    expect(texte[0]).toContain('Franz');
    expect(texte.at(-1)).toMatch(/Seite 2 von/);
  });
});

describe('@DR-037 @DR-034 Finalrunde mit Spalte „SR“ am fertigen PDF', () => {
  it('jede Namenslinie ≥ 50 mm, die kleinen Linien unter den Ergebnislinien, Schreibraum ≥ 5 mm auch für die untere Reihe', async () => {
    const { pages } = await handzettelPdf(FALL_B_SR);
    const seite = pages.find(p => p.texts.some(t => t.str.trim() === 'Sieger Spiel 22'))!;
    const linien = seite.lines.filter(l => waag(l) && Math.abs(l.width - printWriteLine.stroke) < 0.02);
    const namen = linien.filter(l => laenge(l) >= printWriteLine.nameMin - TOL);
    const klein = linien.filter(l => Math.abs(laenge(l) - printWriteLine.small) < TOL);
    const ergebnis = linien.filter(l => Math.abs(laenge(l) - printWriteLine.resultNarrow) < TOL);

    expect(namen.length).toBeGreaterThanOrEqual(16);
    expect(klein.length).toBe(16);
    for (const k of klein) {
      const darueber = ergebnis.filter(r => r.y1 < k.y1 && Math.abs((r.x1 + r.x2) / 2 - k.x1) < laenge(r) + 5);
      const naechste = Math.max(...darueber.map(r => r.y1));
      expect(k.y1 - naechste).toBeGreaterThanOrEqual(printWriteLine.minWriteSpace - TOL);
    }
  });
});

describe('@DR-044 Fall mit Ansprechpartner (b, erfunden)', () => {
  it('eigene Zeile „Ansprechpartner: Max Mustermann · 0171 1234567 · fussballjugend@tsv-waging.de“, ungekürzt, auf jeder Seite', async () => {
    const { pages } = await handzettelPdf(FALL_B_KONTAKT);

    pages.forEach(page => expect(page.texts.map(t => t.str.trim())).toContain('Ansprechpartner: Max Mustermann · 0171 1234567 · fussballjugend@tsv-waging.de'));
  });
});

describe('@DR-037 Uhrzeit und Namenslinie der Finalrunde (echte Schrift)', () => {
  it('rechte Kante der Zeit ↔ Beginn der Namenslinie mindestens 1,5 mm, ohne und mit SR-Spalte', async () => {
    for (const fall of [FALL_B, FALL_B_SR]) {
      const { pages } = await handzettelPdf(fall);
      const seite = pages.find(p => p.texts.some(t => t.str.trim() === 'Sieger Spiel 22'))!;
      const zeiten = seite.texts.filter(t => /^1[45]:\d\d$/.test(t.str.trim()));
      const namen = seite.lines.filter(l => waag(l) && laenge(l) >= printWriteLine.nameMin - TOL);

      expect(zeiten).toHaveLength(8);
      for (const z of zeiten) {
        const linie = namen.filter(l => Math.abs(l.y1 - z.y) < 2 && Math.min(l.x1, l.x2) > z.x).sort((a, b) => a.x1 - b.x1)[0];
        expect(Math.min(linie.x1, linie.x2) - (z.x + z.w), `${z.str}`).toBeGreaterThanOrEqual(1.5);
      }
    }
  });
});

describe('@DR-037 @DR-025 „Teams pfeifen“: Teamnamen in der SR-Spalte der Finalrunde', () => {
  it.each(['de', 'en'] as const)('%s: jede Namenslinie ≥ 50 mm, der Teamname bricht in seiner Spalte um und ragt nicht über den Rand', async locale => {
    const { pages } = await handzettelPdf(FALL_B_SR_TEAM, { locale });
    const seite = pages.find(p => p.texts.some(t => /^(Sieger|Winner) (Spiel|match) 22$/.test(t.str.trim())))!;
    const namen = seite.lines.filter(l => waag(l) && Math.abs(l.width - printWriteLine.stroke) < 0.02 && laenge(l) >= printWriteLine.nameMin - TOL);
    const rechts = 210 - 15;
    const sr = seite.texts.filter(t => t.str.trim() !== '' && t.x > rechts - printFinals.cols.referee + 1);

    expect(namen.length).toBeGreaterThanOrEqual(16);
    expect(sr.length).toBeGreaterThan(0);
    for (const t of sr) { expect(t.x + t.w, t.str).toBeLessThanOrEqual(rechts + TOL); }
  });
});
