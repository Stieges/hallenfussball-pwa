/**
 * B-28 C7 – Architektur-Naht (Fable B10): ein Eingang `PdfInput`, ein `RenderContext`, `pageGeometry(format, orientation)`
 * mit `scale` an einer Stelle. Der Spielplan bleibt dabei unverändert: Text und Koordinaten aller Seiten der vier
 * Pflicht-Fixtures sind vor und nach dem Umbau gleich (Prüfsumme über die gerundeten pdfjs-Maße). Seit C8 ist die Summe ein
 * Änderungsmelder gegen ungewollte Verschiebungen, kein Nachweis der Wortlaute (das tragen die pdfjs-Wortlaut-Tests). Bei
 * Neuaufnahme Bild DE und EN sichten.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { printPage } from '../../../design-tokens/print';
import { printFormat } from '../../../design-tokens/print-format';
import { pageGeometry } from '../layout';
import { hallencupSchedule } from './pdfFixture';
import { FIXTURES, layoutOf } from './pdfFixtureLayout';
import { translatorFor } from './pdfText';
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

/**
 * Prüfsummen je Pflicht-Fixture. Aufgenommen am Stand c1d6b429 (vor dem Umbau der Naht); die Naht hat sie nicht verändert.
 * Neu aufgenommen am Stand C8-F (16.10.: Spalten mindestens so breit wie ihr Kopfwort; C8 vorher c7d6997a6c6d, c2263d5409c3,
 * a42071e7d8cb, 82c6e0bc524d; selbst aufgenommen, bestätigt also nur Stabilität), weil Daniels Wortlaut-Entscheidungen den gedruckten Text ändern: Kopfzeile
 * „Spielplan“ (G57), „Gruppen + Finalrunde“ (G71), „Wertung“ (G72), „5 Schützen je Team“ (G74). Die Kopfzeile verschiebt
 * alles darunter; Bilder (Grafiken) erfasst die Summe nicht. Die Maße der alten Stände: 1f942dff25ce, 8bd3acd911de,
 * 2cff8b00a80b, a492098473fc (hoch 12, hoch 20, quer 12, quer 20).
 */
const VORHER: Record<string, string> = {
  '12 Spiele, hoch': '2ce4400a8222',
  '20 Spiele, hoch': '5290b179abed',
  '12 Spiele, quer': '3da3988d5446',
  '20 Spiele, quer': '4f32e0da30fc',
};

describe('@DR-001 Naht: Spielplan-Muster vorher = nachher', () => {
  it.each(FIXTURES)('$name: Prüfsumme des Layouts', async ({ name, options, schedule }) => {
    const { pages } = await layoutOf({ ...options, now: STAND }, schedule());

    expect(layoutDigest(pages)).toBe(VORHER[name]);
  });
});

describe('@DR-022 Naht EN: Spielplan englisch (Änderungsmelder, Kopfwörter ungebrochen seit C8-F)', () => {
  it('12 Spiele, hoch, englisch: Prüfsumme des Layouts', async () => {
    const { pages } = await layoutOf({ locale: 'en', translate: translatorFor('en'), now: STAND }, hallencupSchedule());

    expect(layoutDigest(pages)).toBe('a89e4efe5be4');
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
