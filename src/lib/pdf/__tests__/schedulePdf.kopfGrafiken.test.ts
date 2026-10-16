/**
 * B-28 C4 – zwei Grafiken im Kopf (@DR-023, @DR-024), Geometrie nach Entscheidung 15.10.: oben Grafik links ·
 * Titel Mitte · Grafik rechts, darunter Angaben links und QR rechts. Gemessen am fertigen PDF (pdfjs).
 * Szenarien: @DR-023, @DR-024, @DR-003, @BM-021 (Titel bis drei Zeilen, nie kürzen), @BM-009.
 */
import { describe, expect, it } from 'vitest';
import { printHeader } from '../../../design-tokens/print-header';
import { printType } from '../../../design-tokens/print';
import { pageGeometry } from '../layout';
import { hallencupTournament } from './pdfFixture';
import { bboxOf, expectedMatrix, headBottom, kopfPdf, overlaps, qrRects, textBox, titleLines, TOL } from './pdfKopfSupport';
import { brokenJpegLogo, fixtureLogo, garbageLogo, hugePixelLogo, oversizedLogo, truncatedPngLogo } from './pdfLogoFixture';
import { squash } from './pdfjsText';

const geo = pageGeometry('a4', 'portrait');
const SIXTY = 'Internationaler Hallenfussball Wintercup Nordheim Sued 2026';
const SIDE_ASPECT = 2;
/** @DR-003: Kante des QR auf Seite 1 mindestens 3 cm. */
const MIN_QR_MM = 30;

describe('@DR-023 @DR-024 zwei Grafiken links und rechts', () => {
  it('links am linken, rechts am rechten Rand des Satzspiegels, jede höchstens 20 mm hoch, Seitenverhältnis erhalten', async () => {
    const { pages } = await kopfPdf({ logoLeft: fixtureLogo(SIDE_ASPECT), logoRight: fixtureLogo(1) });
    const [left, right] = [...pages[0].images].sort((a, b) => a.x - b.x);

    expect(pages[0].images).toHaveLength(2);
    expect(left.x).toBeCloseTo(geo.left, 1);
    expect(right.x + right.w).toBeCloseTo(geo.left + geo.contentWidth, 1);
    expect(left.h).toBeLessThanOrEqual(printHeader.logoMaxHeight + TOL);
    expect(right.h).toBeLessThanOrEqual(printHeader.logoMaxHeight + TOL);
    expect(left.w / left.h).toBeCloseTo(SIDE_ASPECT, 1);
    expect(right.w / right.h).toBeCloseTo(1, 1);
  });

  it('Gegenbeispiel: sehr hohe und sehr breite Grafik bleiben in Höhe und Breite begrenzt', async () => {
    const { pages } = await kopfPdf({ logoLeft: fixtureLogo(0.25), logoRight: fixtureLogo(8) });
    const [tall, wide] = [...pages[0].images].sort((a, b) => a.x - b.x);

    expect(tall.h).toBeLessThanOrEqual(printHeader.logoMaxHeight + TOL);
    expect(tall.w / tall.h).toBeCloseTo(0.25, 1);
    expect(wide.w).toBeLessThanOrEqual(printHeader.logoMaxWidth + TOL);
    expect(wide.w / wide.h).toBeCloseTo(8, 0);
  });

  it('nichts überlappt: Grafiken, Titel, Angaben und QR haben paarweise keine gemeinsame Fläche', async () => {
    const { pages } = await kopfPdf({ logoLeft: fixtureLogo(SIDE_ASPECT), logoRight: fixtureLogo(SIDE_ASPECT) });
    const page = pages[0];
    const images = page.images;
    const qr = bboxOf(qrRects(page));
    const bottom = headBottom(page);
    const texts = page.texts.filter(t => t.y < bottom && t.str.trim() !== '');

    for (const image of images) {
      expect(overlaps(image, qr), 'Grafik ↔ QR').toBe(false);
      texts.forEach(t => expect(overlaps(image, textBox(t)), `Grafik ↔ „${t.str}“`).toBe(false));
    }
    texts.forEach(t => expect(overlaps(qr, textBox(t)), `QR ↔ „${t.str}“`).toBe(false));
    expect(overlaps(images[0], images[1])).toBe(false);
  });

  it('60-Zeichen-Titel mit beiden Grafiken und QR: vollständig, höchstens drei Zeilen, zwischen den Grafiken', async () => {
    const tournament = hallencupTournament({ title: SIXTY });
    const { pages } = await kopfPdf({ logoLeft: fixtureLogo(SIDE_ASPECT), logoRight: fixtureLogo(SIDE_ASPECT) }, tournament);
    const lines = titleLines(pages[0], printHeader.titleMinPt - TOL);
    const [left, right] = [...pages[0].images].sort((a, b) => a.x - b.x);

    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines.length).toBeLessThanOrEqual(printHeader.titleMaxLines);
    expect(squash(lines.map(t => t.str).join(' '))).toBe(squash(SIXTY));
    expect(lines.some(t => t.str.includes('…'))).toBe(false);
    lines.forEach(t => {
      expect(t.x, `„${t.str}“ links`).toBeGreaterThanOrEqual(left.x + left.w - TOL);
      expect(t.x + t.w, `„${t.str}“ rechts`).toBeLessThanOrEqual(right.x + TOL);
    });
    expect(bboxOf(qrRects(pages[0])).w).toBeGreaterThanOrEqual(MIN_QR_MM);
    expect(qrRects(pages[0]).length).toBeGreaterThan(0);
    expectedMatrix('ABC123');
  });
});

describe('@DR-023 fehlt eine Grafik, entsteht keine Lücke', () => {
  it.each([
    ['nur links', { logoLeft: fixtureLogo(SIDE_ASPECT) }],
    ['nur rechts', { logoRight: fixtureLogo(SIDE_ASPECT) }],
  ])('%s: eine Grafik, der Titel bleibt zentriert', async (_name, extra) => {
    const { pages } = await kopfPdf(extra);
    const lines = titleLines(pages[0], printType.title - TOL);
    const centerPage = geo.left + geo.contentWidth / 2;

    expect(pages[0].images).toHaveLength(1);
    expect(lines.length).toBeGreaterThan(0);
    lines.forEach(t => expect(Math.abs(t.x + t.w / 2 - centerPage), `„${t.str}“`).toBeLessThanOrEqual(1));
  });

  it('keine Grafik: kein Bild, Titel über der vollen Breite (breiter als mit Grafiken möglich)', async () => {
    const tournament = hallencupTournament({ title: SIXTY });
    const { pages } = await kopfPdf({}, tournament);
    const lines = titleLines(pages[0], printType.title - TOL);
    const widest = Math.max(...lines.map(t => t.w));

    expect(pages[0].images).toHaveLength(0);
    expect(widest).toBeGreaterThan(geo.contentWidth - 2 * (printHeader.logoMaxWidth + printHeader.logoGap));
    expect(lines.length).toBeLessThanOrEqual(printHeader.titleMaxLines);
  });

  it('keine Grafik: erste Angabe unverändert unter dem Titel (kein reservierter Streifen)', async () => {
    const { pages } = await kopfPdf();
    const lines = titleLines(pages[0], printType.title - TOL);
    const veranstalter = pages[0].texts.find(t => t.str.trim() === 'Veranstalter');

    expect(veranstalter).toBeDefined();
    const erwartet = lines[lines.length - 1].y + 6; // Abstand Titel → erste Angabe laut headBlockGap
    expect(veranstalter!.y).toBeCloseTo(erwartet, 0);
  });
});

describe('@DR-024 unbrauchbare Bilddaten: der Spielplan entsteht trotzdem, mit Hinweis', () => {
  it.each([
    ['kein Bildformat', garbageLogo()],
    ['PNG-Kopf, Rest fehlt', truncatedPngLogo()],
    ['JPEG-Kopf, Rest Müll', brokenJpegLogo()],
    ['PNG-Daten, als JPEG angegeben', { ...fixtureLogo(2), format: 'JPEG' as const }],
    ['gültiges PNG, aber über der Größengrenze', oversizedLogo()],
  ])('%s links: PDF mit Seite 1, kein Bild, Hinweis vor dem Speichern', async (_name, logo) => {
    const { pages, notes } = await kopfPdf({ logoLeft: logo });

    expect(pages.length).toBeGreaterThan(0);
    expect(pages[0].images).toHaveLength(0);
    expect(notes.some(n => n.toLowerCase().includes('grafik'))).toBe(true);
  });

  it('10000 × 10000 Bildpunkte (wenige Byte): schnell abgelehnt, ohne Dekodieren, mit Hinweis', async () => {
    const start = performance.now();
    const { pages, notes } = await kopfPdf({ logoLeft: hugePixelLogo() });

    expect(performance.now() - start).toBeLessThan(5000);
    expect(pages[0].images).toHaveLength(0);
    expect(notes.some(n => n.toLowerCase().includes('grafik'))).toBe(true);
  });

  it('Gegenbeispiel: gültige Grafiken ergeben keinen Hinweis', async () => {
    const gut = await kopfPdf({ logoLeft: fixtureLogo(SIDE_ASPECT), logoRight: fixtureLogo(SIDE_ASPECT) });

    expect(gut.notes.filter(n => n.toLowerCase().includes('grafik'))).toEqual([]);
  });

  it('das Seitenverhältnis kommt aus den Bilddaten, nicht vom Aufrufer', async () => {
    const lügt = { ...fixtureLogo(2), aspect: 0.5 };
    const { pages } = await kopfPdf({ logoLeft: lügt });

    expect(pages[0].images[0].w / pages[0].images[0].h).toBeCloseTo(2, 1);
  });

  it('Gegenbeispiel: ein unplausibles Seitenverhältnis (Streifen) ist unbrauchbar', async () => {
    const { pages, notes } = await kopfPdf({ logoRight: fixtureLogo(20) });

    expect(pages[0].images).toHaveLength(0);
    expect(notes.some(n => n.toLowerCase().includes('grafik'))).toBe(true);
  });
});
