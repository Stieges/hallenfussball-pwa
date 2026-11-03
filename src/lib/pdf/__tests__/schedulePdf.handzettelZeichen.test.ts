/**
 * T7a, Spielzeilen am fertigen PDF (pdfjs): @DR-034 Schreiblinien und Abstände, @DR-001 Farben und Größen, @DR-019 Zustände,
 * @DR-004, @DR-025 Spalte „SR“, @DR-022 englische Texte. Erwartungen aus dem Gherkin, Zahlen aus den Tokens (`print-sheet.ts`).
 * Gemessen wird auf jeder Seite, nicht nur auf Seite 1.
 */
import { describe, expect, it } from 'vitest';
import { printAccent, printLimits, printType } from '../../../design-tokens/print';
import { printAccentDefault, printGroupMark, printWriteLine } from '../../../design-tokens/print-sheet';
import { getContrastRatio } from '../../colorUtils';
import { grayOf, zebraTone } from '../../color/accent';
import { FALL_A, FALL_B, FALL_C, mitStandA } from './fixtures/handzettelFaelle';
import { handzettelPdf } from './handzettelPdf';
import type { LayoutLine, LayoutPage, LayoutRect, LayoutText } from './pdfjsLayout';

const TOL = printWriteLine.tolerance;
const strs = (page: LayoutPage): string[] => page.texts.map(t => t.str.trim()).filter(s => s !== '');
const horizontal = (l: LayoutLine): boolean => Math.abs(l.y1 - l.y2) < 0.01;
const nahe = (a: string, b: string): boolean => [1, 3, 5].every(i => Math.abs(Number.parseInt(a.slice(i, i + 2), 16) - Number.parseInt(b.slice(i, i + 2), 16)) <= 2);
const überlappt = (a: { x1: number; x2: number }, b: { x1: number; x2: number }): boolean => Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > 1;

/** Schreiblinien einer Seite: dünne waagerechte Striche mit der Stärke des Tokens (nicht Trenner, nicht Unterstreichung). */
const schreiblinien = (page: LayoutPage): LayoutLine[] =>
  page.lines.filter(l => horizontal(l) && Math.abs(l.width - printWriteLine.stroke) <= 0.02 && Math.abs(l.x2 - l.x1) >= printWriteLine.resultNarrow - TOL && l.y1 < 270);
const fläche = (page: LayoutPage): LayoutRect[] => page.rects.filter(r => r.fill !== undefined && r.fill !== '#000000' && r.fill !== '#ffffff' && r.w > 100 && r.h > 5 && r.h < 15);
const zeile = (page: LayoutPage, nr: number): LayoutText[] => {
  const n = page.texts.find(t => t.str.trim() === String(nr) && Math.abs(t.size - printType.nr) < 0.05);
  return n ? page.texts.filter(t => Math.abs(t.y - n.y) < 4) : [];
};
const linienDerZeile = (page: LayoutPage, nr: number): LayoutLine[] => {
  const n = page.texts.find(t => t.str.trim() === String(nr) && Math.abs(t.size - printType.nr) < 0.05);
  return n ? schreiblinien(page).filter(l => l.y1 > n.y - 1 && l.y1 < n.y + 5) : [];
};

describe.each([['a', FALL_A], ['b', FALL_B], ['c', FALL_C]] as const)('@DR-034 Schreiblinie (Fall %s), jede Seite', (_name, fall) => {
  it('@DR-034 jede Schreiblinie ist ein einziger Strich', async () => {
    const { pages } = await handzettelPdf(fall);

    pages.forEach((page, i) => {
      const linien = schreiblinien(page);
      linien.forEach(l => {
        const doppelt = linien.filter(o => o !== l && Math.abs(o.y1 - l.y1) < 0.4 && überlappt({ x1: Math.min(l.x1, l.x2), x2: Math.max(l.x1, l.x2) }, { x1: Math.min(o.x1, o.x2), x2: Math.max(o.x1, o.x2) }));
        expect(doppelt, `Seite ${i + 1} Linie bei y=${l.y1.toFixed(1)}`).toEqual([]);
      });
    });
  });

  it('@DR-034 mindestens 3 mm zur Kante einer hellen Fläche und mindestens 4 mm zu jedem anderen Strich (± 0,15 mm)', async () => {
    const { pages } = await handzettelPdf(fall);

    pages.forEach((page, i) => {
      const kanten = fläche(page).flatMap(r => [r.y, r.y + r.h]);
      const striche = page.lines.filter(l => horizontal(l) && !schreiblinien(page).includes(l));
      schreiblinien(page).forEach(l => {
        kanten.forEach(k => expect(Math.abs(l.y1 - k), `Seite ${i + 1} Fläche bei ${l.y1.toFixed(1)}`).toBeGreaterThanOrEqual(printWriteLine.minGapToFill - TOL));
        striche.filter(o => überlappt({ x1: Math.min(l.x1, l.x2), x2: Math.max(l.x1, l.x2) }, { x1: Math.min(o.x1, o.x2), x2: Math.max(o.x1, o.x2) }))
          .forEach(o => expect(Math.abs(l.y1 - o.y1), `Seite ${i + 1} Strich bei ${l.y1.toFixed(1)}`).toBeGreaterThanOrEqual(printWriteLine.minGapToStroke - TOL));
      });
    });
  });
});

describe('@DR-034 Doppelpunkt statt Kasten, Zebra statt Trennstriche', () => {
  it('@DR-034 bei Spiel 12 je eine Linie für Heim und Gast, getrennt durch einen Doppelpunkt, ohne Kasten', async () => {
    const { pages } = await handzettelPdf(FALL_B);
    const linien = linienDerZeile(pages[0], 12).sort((a, b) => a.x1 - b.x1);
    const doppelpunkt = zeile(pages[0], 12).find(t => t.str.trim() === ':');

    expect(linien).toHaveLength(2);
    expect(doppelpunkt && doppelpunkt.x > linien[0].x2 && doppelpunkt.x < linien[1].x1).toBe(true);
    const senkrecht = pages[0].lines.filter(l => Math.abs(l.x1 - l.x2) < 0.01 && l.x1 > linien[0].x1 - 1 && l.x1 < linien[1].x2 + 1 && l.y1 > 60);
    expect(senkrecht, 'keine senkrechte Kante im Ergebnisfeld').toEqual([]);
  });

  it('@DR-034 die Zeilen sind durch abwechselnd helle Flächen getrennt, nicht durch Trennstriche (nur Stundentrenner)', async () => {
    const { pages } = await handzettelPdf(FALL_B);
    const flächen = fläche(pages[0]);
    const trenner = pages[0].lines.filter(l => horizontal(l) && l.width > 0.4 && Math.abs(l.x2 - l.x1) > 150 && l.y1 > 70 && l.y1 < 270);

    expect(flächen.length).toBeGreaterThanOrEqual(9);
    // 20 Spiele, 4 Stunden: höchstens Spaltenkopflinie und drei Stundentrenner, nie ein Strich je Zeile
    expect(trenner.length).toBeLessThanOrEqual(5);
  });

  it('@DR-004 Schreiblinie von mindestens 10 mm: eine zweistellige Zahl passt (Spalte „SR“: schmaler)', async () => {
    const a = await handzettelPdf(FALL_A);
    const c = await handzettelPdf(FALL_C);

    expect(linienDerZeile(a.pages[0], 1).every(l => Math.abs(l.x2 - l.x1) >= printWriteLine.result - TOL)).toBe(true);
    expect(linienDerZeile(c.pages[0], 1).every(l => Math.abs(l.x2 - l.x1) >= printWriteLine.resultNarrow - TOL)).toBe(true);
  });
});

describe('@DR-019 Zustände der Gruppenspiele ohne Farbe unterscheidbar', () => {
  const stand = (halbzeit = false, includeScores = true) => handzettelPdf(mitStandA(FALL_A, halbzeit), { options: { includeScores } });

  it('@DR-019 Spiel 7 läuft: „läuft“ und je eine leere Schreiblinie für Heim und Gast', async () => {
    const { pages } = await stand();

    expect(zeile(pages[0], 7).map(t => t.str.trim())).toContain('läuft');
    expect(linienDerZeile(pages[0], 7)).toHaveLength(2);
  });

  it('@DR-019 Halbzeit: ebenfalls „läuft“ mit zwei Linien', async () => {
    const { pages } = await stand(true);

    expect(zeile(pages[0], 7).map(t => t.str.trim())).toContain('läuft');
    expect(linienDerZeile(pages[0], 7)).toHaveLength(2);
  });

  it('@DR-019 Spiel 6 ausgefallen: „ausgefallen“ ohne Schreiblinien, auch bei ausgeblendeten Ergebnissen', async () => {
    for (const mit of [true, false]) {
      const { pages } = await stand(false, mit);
      expect(zeile(pages[0], 6).map(t => t.str.trim()), `Ergebnisse ${mit}`).toContain('ausgefallen');
      expect(linienDerZeile(pages[0], 6), `Ergebnisse ${mit}`).toEqual([]);
    }
  });

  it('@DR-019 beendetes Spiel 1 (2:1): Ziffern in mindestens 18 pt, keine Linien; ohne Ergebnisse leere Linien statt „ausgefallen“', async () => {
    const mit = await stand();
    const ziffern = zeile(mit.pages[0], 1).filter(t => /^\d$/.test(t.str.trim()) && t.size >= printLimits.resultPt - 0.05);
    expect(ziffern.map(t => t.str.trim())).toEqual(['2', '1']);
    expect(linienDerZeile(mit.pages[0], 1)).toEqual([]);

    const ohne = await handzettelPdf(mitStandA(FALL_A), { options: { includeScores: false } });
    expect(zeile(ohne.pages[0], 1).some(t => /^\d$/.test(t.str.trim()) && t.size >= printLimits.resultPt - 0.05)).toBe(false);
    const leer = await handzettelPdf(mitStandA(FALL_A), { options: { edition: 'blank' } });
    expect(zeile(leer.pages[0], 6).map(t => t.str.trim())).not.toContain('ausgefallen');
    expect(linienDerZeile(leer.pages[0], 6)).toHaveLength(2);
    expect(strs(leer.pages[0])).not.toContain('läuft');
  });
});

describe('@DR-001 Gruppenzeichen in der Spalte „Gr.“', () => {
  // Rahmen eines Zeichens: eckig = vier Striche (zwei senkrechte), rund = Kurven ohne gerade Kante
  const eckig = (page: LayoutPage, zeilenY: number): boolean =>
    page.lines.some(l => Math.abs(l.x1 - l.x2) < 0.01 && Math.abs(Math.abs(l.y2 - l.y1) - printGroupMark.size) < 0.1 && Math.abs((l.y1 + l.y2) / 2 - zeilenY) < 3);

  it('@DR-001 mehrere Gruppen: Spalte „Gr.“, in jeder Gruppenzeile der Buchstabe; A eckig, B rund', async () => {
    const { pages } = await handzettelPdf(FALL_B);
    const page = pages[0];
    const spiel = (nr: number) => FALL_B.spiele.find(sp => sp.nr === nr);

    expect(strs(page)).toContain('Gr.');
    for (const nr of [1, 2, 3, 4]) {
      const sp = spiel(nr);
      const n = page.texts.find(t => t.str.trim() === String(nr) && Math.abs(t.size - printType.nr) < 0.05);
      expect(zeile(page, nr).some(t => t.str.trim() === sp?.gruppe), `Spiel ${nr} trägt ${sp?.gruppe}`).toBe(true);
      expect(eckig(page, (n?.y ?? 0) - 1.5), `Spiel ${nr} (${sp?.gruppe}) eckig`).toBe(sp?.gruppe === 'A');
    }
  });

  it('@DR-001 Gegenbeispiel: nur eine Gruppe – keine Spalte „Gr.“ und kein Zeichen', async () => {
    const { pages } = await handzettelPdf(FALL_A);

    expect(strs(pages[0])).not.toContain('Gr.');
    expect(pages[0].lines.filter(l => Math.abs(l.x1 - l.x2) < 0.01 && Math.abs(Math.abs(l.y2 - l.y1) - printGroupMark.size) < 0.1)).toEqual([]);
  });
});

describe('@DR-025 Spalte „SR“', () => {
  it('@DR-025 mit Einträgen: Spalte „SR“, bei Spiel 1 „1“ (Nummer, nie ein Name)', async () => {
    const { pages } = await handzettelPdf(FALL_C);

    expect(strs(pages[0])).toContain('SR');
    expect(zeile(pages[0], 1).some(t => t.str.trim() === '1' && t.x > 160)).toBe(true);
    expect(pages.flatMap(strs).some(s => /Schmidt|Müller/.test(s))).toBe(false);
  });

  it('@DR-025 Gegenbeispiel: ohne jeden Eintrag keine Spalte „SR“', async () => {
    const { pages } = await handzettelPdf(FALL_A);

    expect(strs(pages[0])).not.toContain('SR');
  });
});

describe('@DR-001 Farben und Größen', () => {
  it('@DR-001 jeder Text ist schwarz, nie in Akzentfarbe', async () => {
    for (const fall of [FALL_A, FALL_B, FALL_C]) {
      const { pages } = await handzettelPdf(fall, { options: { accent: { line: '#2A2576', tint: '#DDDCE9' } } });
      pages.forEach((page, i) => expect(new Set(page.textColors), `Fall ${fall.name} Seite ${i + 1}`).toEqual(new Set(['#000000'])));
    }
  });

  it('@DR-001 Akzent steht nur auf Linien und Füllungen: Stundentrenner und Kopflinie in Akzentfarbe, Füllung im hellen Ton', async () => {
    const accent = { line: '#2A2576', tint: '#DDDCE9' };
    const { pages } = await handzettelPdf(FALL_A, { options: { accent } });

    expect(pages[0].lines.some(l => nahe(l.color, accent.line) && l.width > 0.4)).toBe(true);
    expect(pages[0].rects.some(r => r.fill !== undefined && nahe(r.fill, accent.tint))).toBe(true);
    expect(pages[0].rects.filter(r => r.fill !== undefined && nahe(r.fill, accent.line))).toEqual([]);
  });

  it('@DR-001 Akzentlinie hebt sich gegen Weiß mindestens 3 : 1 ab, helle Fläche entspricht mindestens 12 % Schwarz', () => {
    expect(getContrastRatio(printAccentDefault.line, '#ffffff')).toBeGreaterThanOrEqual(printAccent.minContrast);
    expect(((255 - grayOf(printAccentDefault.tint)) / 255) * 100).toBeGreaterThanOrEqual(printLimits.tintMinPercent - 0.5);
  });

  it('@DR-001 Grauwert-Abstand Akzentlinie ↔ Zebra mindestens printAccent.minGrayGap (Rechnung; die Messung am Ausdruck folgt in T9)', () => {
    expect(grayOf(printAccentDefault.tint) - grayOf(printAccentDefault.line)).toBeGreaterThanOrEqual(printAccent.minGrayGap);
  });

  it('@DR-041 Rückfall-Ton gleich dem gerechneten: printAccentDefault.tint = zebraTone(printAccentDefault.line)', () => {
    expect(zebraTone(printAccentDefault.line).toLowerCase()).toBe(printAccentDefault.tint.toLowerCase());
  });

  it('@DR-001 Zustände ohne Farbe unterscheidbar: jedes Kennzeichen steht als Text (läuft, ausgefallen, Ziffern)', async () => {
    const { pages } = await handzettelPdf(mitStandA(FALL_A), { options: { includeScores: true } });
    const texte = pages[0].texts.map(t => t.str.trim());

    expect(texte).toEqual(expect.arrayContaining(['läuft', 'ausgefallen']));
  });

  it('@DR-001 keine Uhrzeit bricht um: jede Uhrzeit der Zeit-Spalte ist ein ganzes HH:MM, Teamnamen mindestens 12 pt', async () => {
    const { pages } = await handzettelPdf(FALL_C);
    const kopf = pages[0].texts.find(t => t.str.trim() === 'Zeit');
    const zeiten = pages[0].texts.filter(t => Math.abs(t.size - printType.time) < 0.05 && /\d/.test(t.str) && t.x < 40 && t.y > (kopf?.y ?? 0));

    expect(zeiten.length).toBeGreaterThanOrEqual(15);
    zeiten.forEach(t => expect(t.str.trim()).toMatch(/^\d\d:\d\d$/));
    const namen = pages[0].texts.filter(t => FALL_C.teams.some(team => team.name.startsWith(t.str.trim()) && t.str.trim().length > 6));
    namen.forEach(t => expect(t.size).toBeGreaterThanOrEqual(printLimits.teamPt - 0.05));
  });
});

describe('@DR-022 englische App: feste Texte des Spielplans auf Englisch', () => {
  it('@DR-022 englische App: Eckdaten („When“, „Start … End approx.“, „Match time“) englisch, deutsche Wörter fehlen, Teamnamen unverändert', async () => {
    const { pages } = await handzettelPdf(FALL_B, { locale: 'en' });
    const kopf = pages[0].texts.map(t => t.str).join('').replace(/\s/g, '');

    expect(kopf).toContain('When');
    expect(kopf).toContain('Start10:00·Endapprox.');
    expect(kopf).toContain('Wheretheplay'.slice(0, 5));
    expect(kopf).toContain('Matchtime');
    expect(kopf).not.toMatch(/Beginn|Wann|Spielzeit/);
    expect(strs(pages[0])).toContain('TSV Waging');
  });
});
