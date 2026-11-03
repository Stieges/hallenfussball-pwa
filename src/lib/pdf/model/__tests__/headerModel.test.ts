/**
 * @DR-031 Eckdaten, @DR-006/@DR-020 Regelzeile und Spielzeit, @DR-024 Titel ohne Lücke in allen vier Lagen, @DR-003 und
 * @DR-010 QR, @DR-038 Link-Flächen. Modell mit Fake-Messfunktion; die Beispiele sind die Fixtures a und b.
 */
import { describe, expect, it } from 'vitest';
import { printLimits } from '../../../../design-tokens/print';
import { printHeader } from '../../../../design-tokens/print-header';
import { FALL_A, FALL_B } from '../../__tests__/fixtures/handzettelFaelle';
import type { HeaderBlock, TextRun } from '../types';
import { modelOf, type ModelOptions } from './modelSupport';
import { qrBoxSide } from '../headerModel';
import { qrModules } from '../../../qr/publicQr';

function headerOf(fall = FALL_B, opts: ModelOptions = {}): HeaderBlock {
  const block = modelOf(fall, opts).model.pages[0].blocks[0];
  if (block?.kind !== 'header') { throw new Error('Seite 1 ohne Kopf'); }
  return block;
}

const factText = (h: HeaderBlock): string => h.facts.cells.flatMap(c => c.runs.map(r => r.text)).join('');

describe('@DR-031 Eckdaten statt Formularzeilen', () => {
  it('@DR-031 Datum, „Beginn 10:00 · Ende ca. 15:40“, Halle, Spielzeit und Ablauf stehen in einem hellen Block', () => {
    const h = headerOf(FALL_B);

    expect(h.facts.cells.map(c => c.key)).toEqual(['when', 'where', 'duration', 'flow']);
    expect(factText(h)).toContain('Sonntag, 15.11.2026');
    expect(factText(h)).toContain('Beginn 10:00 · Ende ca. 15:40');
    expect(factText(h)).toContain('TuS Halle');
    expect(h.facts.fill.kind).toBe('facts');
  });

  it('@DR-031 Endzeit auf 5 Minuten gerundet: Fall a endet 18:59, gedruckt „Ende ca. 19:00“', () => {
    expect(factText(headerOf(FALL_A))).toContain('Ende ca. 19:00');
  });

  it('@DR-031 die Uhrzeiten im Block stehen in mindestens 14 pt', () => {
    const times = headerOf(FALL_B).facts.cells.flatMap(c => c.runs).filter(r => /Beginn|Ende ca\./.test(r.text));

    expect(times.length).toBeGreaterThan(0);
    for (const r of times) { expect(r.pt).toBeGreaterThanOrEqual(printLimits.timePt); }
  });

  it('@DR-031 der Kopf hat keine Liste aus Bezeichnung und Wert: keine Bezeichnung mit Doppelpunkt im Eckdaten-Block', () => {
    const runs = headerOf(FALL_B).facts.cells.flatMap(c => c.runs);

    expect(runs.filter(r => r.text.trimEnd().endsWith(':'))).toEqual([]);
  });

  it('Gegenbeispiel @DR-031 ohne Halle keine leere Bezeichnung und kein „·“ am Rand', () => {
    const h = headerOf(FALL_B, { options: { hallName: '' } });
    const texts = h.facts.cells.flatMap(c => c.runs.map(r => r.text.trim()));

    expect(h.facts.cells.map(c => c.key)).not.toContain('where');
    expect(texts).not.toContain('');
    expect(texts.filter(t => t.startsWith("·") && !t.includes('Ende ca.'))).toEqual([]);
    expect(h.facts.cells.filter(c => /·\s*$/.test(c.runs.at(-1)?.text ?? ''))).toEqual([]);
  });

  it('Gegenbeispiel @DR-031 ohne Datum ebenso: kein „Kein Datum“, die Uhrzeiten bleiben', () => {
    const h = headerOf(FALL_B, { tournament: { date: '' } });
    const texts = h.facts.cells.flatMap(c => c.runs.map(r => r.text.trim()));

    expect(factText(h)).not.toMatch(/Kein Datum/);
    expect(texts).not.toContain('');
    expect(factText(h)).toContain('Beginn 10:00');
    expect(texts.filter(t => t.startsWith("·") && !t.includes('Ende'))).toEqual([]);
    expect(h.facts.cells.filter(c => /·\s*$/.test(c.runs.at(-1)?.text ?? ''))).toEqual([]);
  });
});

describe('@DR-006 und @DR-020 Spielzeit und Regelzeile', () => {
  it('@DR-006 die Spielzeit mit Zeitstrafe steht bei den Eckdaten, nicht in der Regelzeile', () => {
    const h = headerOf({ ...FALL_B, zeitstrafeSek: 120 });
    const duration = h.facts.cells.find(c => c.key === 'duration')!.runs.map(r => r.text).join(' ');

    expect(duration).toContain('10 Minuten');
    expect(duration).toContain('Zeitstrafe');
    expect(h.rules.map(r => r.text).join(' ')).not.toContain('Spielzeit');
  });

  it('@DR-006 Regelzeile: fettes „Modus:“ und „Wertung:“, dann „Regelwerk: …“', () => {
    const h = headerOf(FALL_B, { tournament: { rulebook: 'BFV-Richtlinien für Futsal und private Hallenturniere' } });
    const bold = h.rules.filter(r => r.weight === 'bold').map(r => r.text);
    const text = h.rules.map(r => r.text).join(' ');

    expect(bold).toEqual(['Modus:', 'Wertung:', 'Regelwerk:']);
    expect(text.indexOf('Wertung:')).toBeGreaterThan(text.indexOf('Modus:'));
    expect(text).toMatch(/Regelwerk: BFV-Richtlinien für Futsal und private Hallenturniere$/);
  });

  it('@DR-020 die Gleichstandsregel steht als ganze Aussage in der Regelzeile', () => {
    expect(headerOf(FALL_A).rules.map(r => r.text).join(' ')).toContain('Gleichstand auf Platz 1: Strafstoßschießen');
  });
});

const titleLines = (h: HeaderBlock): TextRun[] => h.title.filter(r => r.weight === 'bold');
/** Fake-Messung (2,0 / 2,2 mm je Zeichen): Ausdehnung einer zentrierten Zeile. */
const extent = (r: TextRun): { von: number; bis: number } => {
  const w = [...r.text].length * (r.weight === 'bold' ? 2.2 : 2);
  return { von: r.x - w / 2, bis: r.x + w / 2 };
};
/** Freier Titelbereich zwischen den Grafiken (Satzspiegel 15 bis 195 mm). */
const titleArea = (h: HeaderBlock): { von: number; bis: number } => {
  const l = h.images.find(i => i.side === 'left');
  const r = h.images.find(i => i.side === 'right');
  return { von: 15 + (l ? l.w + printHeader.logoGap : 0), bis: 195 - (r ? r.w + printHeader.logoGap : 0) };
};

describe('@DR-024 Titel ohne Lücke in allen vier Lagen, mittig im freien Platz', () => {
  const lagen: Array<[string, { left?: number; right?: number }]> = [['beide Grafiken', { left: 1, right: 1 }], ['nur links', { left: 1 }], ['nur rechts', { right: 1 }], ['keine', {}]];

  it.each(lagen)('@DR-024 %s: Titel und Zeile darunter liegen mittig im freien Titelbereich, jede Zeile einzeln, ohne Überlappung mit den Grafiken', (_n, aspect) => {
    const h = headerOf(FALL_B, { graphicsAspect: aspect });
    const area = titleArea(h);

    expect(h.title.length).toBeGreaterThan(1);
    h.title.forEach(r => {
      expect(r.align).toBe('center');
      const e = extent(r);
      expect((e.von + e.bis) / 2, `„${r.text}“ mittig`).toBeCloseTo((area.von + area.bis) / 2, 0);
      expect(e.von, `„${r.text}“ links`).toBeGreaterThanOrEqual(area.von - 0.3);
      expect(e.bis, `„${r.text}“ rechts`).toBeLessThanOrEqual(area.bis + 0.3);
    });
  });

  it('@DR-024 beide Grafiken: je höchstens 20 mm hoch (@DR-023), Seite links und rechts', () => {
    const h = headerOf(FALL_B, { graphicsAspect: { left: 1, right: 1 } });

    expect(h.images.map(i => i.side)).toEqual(['left', 'right']);
    for (const image of h.images) { expect(image.h).toBeLessThanOrEqual(printHeader.logoMaxHeight); }
  });

  it('@DR-024 nur links: der Titel nutzt den Platz rechts (weniger Zeilen als mit beiden)', () => {
    expect(titleLines(headerOf(FALL_B, { graphicsAspect: { left: 1 } })).length).toBeLessThan(titleLines(headerOf(FALL_B, { graphicsAspect: { left: 1, right: 1 } })).length);
  });

  it('@DR-024 nur rechts: Grafik am rechten Rand; keine von beiden: volle Breite, keine leere Fläche, kein „Logo“', () => {
    const rechts = headerOf(FALL_B, { graphicsAspect: { right: 1 } });
    const keine = headerOf(FALL_B);

    expect(rechts.images.map(i => i.side)).toEqual(['right']);
    expect(rechts.images[0].x + rechts.images[0].w).toBeCloseTo(195, 5);
    expect(keine.images).toEqual([]);
    expect(keine.title.map(r => r.text).join(' ')).not.toMatch(/Logo/);
    expect(titleLines(keine)).toHaveLength(1);
  });

  it('@DR-031 Eckdaten, Regelzeile bleiben linksbündig', () => {
    const h = headerOf(FALL_B);

    expect(h.rules.every(r => r.align === 'left')).toBe(true);
    expect(h.facts.cells.flatMap(c => c.runs).every(r => r.align === 'left')).toBe(true);
  });
});

describe('@DR-003, @DR-010 und @DR-038 QR und Links', () => {
  it('@DR-003 QR mit Symbol von mindestens 30 mm und Ruhezone von 4 Modulen ringsum', () => {
    const qr = headerOf(FALL_B).qr!;
    const modules = qrModules(qr.url).length;
    const quiet = (qr.box.w - qr.symbol.w) / 2;

    expect(qr.symbol.w).toBeGreaterThanOrEqual(30);
    expect(quiet).toBeCloseTo(printHeader.qrQuietModules * (qr.symbol.w / modules), 5);
    expect(qr.box.w).toBeCloseTo(qrBoxSide(modules, printHeader.qrEdge), 5);
  });

  it('@DR-010 Beschriftung „Live-Ergebnisse“, fett und mit genau einer Unterstreichung', () => {
    const cap = headerOf(FALL_B).qrCaption!;

    expect(cap.text).toBe('Live-Ergebnisse');
    expect(cap.weight).toBe('bold');
    expect(cap.underline!.x2).toBeGreaterThan(cap.underline!.x1);
  });

  it('@DR-010 bei ausgeblendeten Ergebnissen „Spielplan aufs Handy“', () => {
    expect(headerOf(FALL_B, { options: { viewerResultsHidden: true } }).qrCaption!.text).toBe('Spielplan aufs Handy');
  });

  it('@DR-038 Seite 1: Link-Fläche auf dem QR und auf der Beschriftung, Ziel die Zuschauer-Adresse', () => {
    const { model } = modelOf(FALL_B);

    expect(model.pages[0].links).toHaveLength(2);
    expect(model.pages[0].links.map(l => l.url)).toEqual(Array(2).fill('https://hallenfussball-pwa.vercel.app/#/live/K7M2QX'));
  });

  it('Gegenbeispiel @DR-038 nicht geteilt: kein QR, keine Beschriftung, keine Link-Fläche', () => {
    const { model } = modelOf(FALL_B, { tournament: { isPublic: false } });
    const h = model.pages[0].blocks[0];

    expect(h?.kind === 'header' && h.qr).toBeFalsy();
    expect(h?.kind === 'header' && h.qrCaption).toBeFalsy();
    expect(model.pages.every(p => p.links.length === 0 && p.qr === null)).toBe(true);
  });
});
