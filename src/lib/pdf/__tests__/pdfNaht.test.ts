/**
 * B-28 C7 – Architektur-Naht (Fable B10): ein Eingang `PdfInput`, ein `RenderContext`, `pageGeometry(format, orientation)`
 * mit `scale` an einer Stelle. Der Spielplan bleibt dabei unverändert: Text und Koordinaten aller Seiten der vier
 * Pflicht-Fixtures sind vor und nach dem Umbau gleich (Prüfsumme über die gerundeten pdfjs-Maße).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { printPage } from '../../../design-tokens/print';
import { printFormat } from '../../../design-tokens/print-format';
import { pageGeometry } from '../layout';
import { FIXTURES, layoutOf } from './pdfFixtureLayout';
import type { LayoutPage } from './pdfjsLayout';

/** Fester Zeitpunkt: die Fußzeile trägt den Stand, sonst änderte sich die Prüfsumme jede Minute. */
const STAND = new Date(2026, 10, 14, 15, 7);
const round = (n: number): number => Math.round(n * 100) / 100;

/** Prüfsumme über Text, Maße, Füllungen und Linien aller Seiten, auf 0,01 mm gerundet. */
export function layoutDigest(pages: LayoutPage[]): string {
  const flat = pages.map(p => ({
    t: p.texts.map(t => [t.str, round(t.x), round(t.y), round(t.size), round(t.w)]),
    r: p.rects.map(r => [round(r.x), round(r.y), round(r.w), round(r.h), r.fill ?? '', r.stroke ?? '']),
    l: p.lines.map(l => [round(l.x1), round(l.y1), round(l.x2), round(l.y2), round(l.width), l.color]),
  }));
  return createHash('sha1').update(JSON.stringify(flat)).digest('hex').slice(0, 12);
}

/** Prüfsummen, aufgenommen am Stand c1d6b429 (vor dem Umbau), je Pflicht-Fixture. */
const VORHER: Record<string, string> = {
  '12 Spiele, hoch': '1f942dff25ce',
  '20 Spiele, hoch': '8bd3acd911de',
  '12 Spiele, quer': '2cff8b00a80b',
  '20 Spiele, quer': 'a492098473fc',
};

describe('@DR-001 Naht: Spielplan-Muster vorher = nachher', () => {
  it.each(FIXTURES)('$name: Prüfsumme des Layouts', async ({ name, options, schedule }) => {
    const { pages } = await layoutOf({ ...options, now: STAND }, schedule());

    expect(layoutDigest(pages)).toBe(VORHER[name]);
  });
});

describe('B10d pageGeometry(format, orientation): scale an einer Stelle', () => {
  it('A4 hat scale 1 und die Ränder der Tokens', () => {
    const geo = pageGeometry('a4', 'portrait');

    expect(geo.scale).toBe(1);
    expect(geo.left).toBe(printPage.margin.left);
    expect(geo.top).toBe(printPage.margin.top);
    expect(geo.contentWidth).toBe(printPage.a4.portrait.width - printPage.margin.left - printPage.margin.right);
  });

  it.each(['a3', 'a2'] as const)('%s: Ränder = Token × scale, Satzspiegel = Breite − Ränder, genau einmal skaliert', format => {
    const geo = pageGeometry(format, 'portrait');
    const scale = printFormat[format].scale;

    expect(geo.scale).toBe(scale);
    expect(geo.left).toBeCloseTo(printPage.margin.left * scale, 6);
    expect(geo.right).toBeCloseTo(printPage.margin.right * scale, 6);
    expect(geo.top).toBeCloseTo(printPage.margin.top * scale, 6);
    expect(geo.contentWidth).toBeCloseTo(geo.width - geo.left - geo.right, 6);
    expect(geo.contentWidth).toBeCloseTo(printFormat[format].portrait.width - (printPage.margin.left + printPage.margin.right) * scale, 6);
  });
});
