/**
 * T9 (Befund C-PDF-QR-RAND-FOLGESEITE): Der Zuschauer-QR im Kurzkopf der Folgeseiten hat ringsum einen weißen Rand von
 * mindestens vier Punkten des Musters, auch zur Kopflinie darunter; die Link-Fläche des QR reicht nicht über die Linie.
 * Gemessen am fertigen PDF (pdfjs), Seite 2 der Fälle a und b.
 * Szenarien: @DR-003 („ringsum bleibt ein weißer Rand, mindestens so breit wie vier Punkte des Musters, ohne Rahmen“), @DR-038.
 */
import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { printStroke } from '../../../design-tokens/print';
import { pageGeometry } from '../layout';
import { FALL_A, FALL_B, FALL_SHARE_CODE } from './fixtures/handzettelFaelle';
import { handzettelPdf, BASE_URL } from './handzettelPdf';
import type { Box, LayoutLine, LayoutPage } from './pdfjsLayout';

const TOL = 0.05;
const GEO = pageGeometry('a4', 'portrait');
const MODULES = QRCode.create(`${BASE_URL}/#/live/${FALL_SHARE_CODE}`).modules.size;

/** Schwarze Module des QR im Kurzkopf: kleine schwarze Füllungen oben in der rechten Hälfte. */
function qrBoxOf(page: LayoutPage): Box {
  const rects = page.rects.filter(r => r.fill === '#000000' && r.y < GEO.top + 40 && r.x > GEO.left + GEO.contentWidth / 2 && r.h < 5);
  const x = Math.min(...rects.map(r => r.x));
  const y = Math.min(...rects.map(r => r.y));
  return { x, y, w: Math.max(...rects.map(r => r.x + r.w)) - x, h: Math.max(...rects.map(r => r.y + r.h)) - y };
}

/** Kopflinie des Kurzkopfs: waagrechte Linie in Kurzkopf-Stärke über die ganze Satzbreite, oben auf der Seite. */
function headRule(page: LayoutPage): LayoutLine | undefined {
  return page.lines.find(l => Math.abs(l.y1 - l.y2) < 0.01 && l.y1 < GEO.top + 40 && Math.abs(l.width - printStroke.shortHead) < 0.02
    && Math.abs(Math.abs(l.x2 - l.x1) - GEO.contentWidth) < 0.5);
}

describe.each([['a', FALL_A], ['b', FALL_B]] as const)('@DR-003 Kurzkopf Seite 2 (Fall %s): weißer Rand ≥ 4 Punkte, auch zur Kopflinie', (_name, fall) => {
  it('@DR-003 zwischen Unterkante des Musters und Oberkante der Kopflinie liegen mindestens vier Punkte', async () => {
    const { pages } = await handzettelPdf(fall);
    const page = pages[1];
    const box = qrBoxOf(page);
    const module = box.w / MODULES;
    const rule = headRule(page);

    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(rule, 'Kopflinie').toBeDefined();
    expect(rule!.y1 - rule!.width / 2 - (box.y + box.h)).toBeGreaterThanOrEqual(4 * module - TOL);
  });

  it('@DR-003 im Rand von vier Punkten ringsum steht weder Text noch Linie noch eine andere Füllung', async () => {
    const { pages } = await handzettelPdf(fall);
    const page = pages[1];
    const box = qrBoxOf(page);
    const zone = (4 * box.w) / MODULES - TOL;
    const quiet = { x: box.x - zone, y: box.y - zone, w: box.w + 2 * zone, h: box.h + 2 * zone };
    const hits = (b: Box): boolean => b.x < quiet.x + quiet.w && b.x + b.w > quiet.x && b.y < quiet.y + quiet.h && b.y + b.h > quiet.y;
    const lineBox = (l: LayoutLine): Box => ({
      x: Math.min(l.x1, l.x2) - l.width / 2, y: Math.min(l.y1, l.y2) - l.width / 2, w: Math.abs(l.x2 - l.x1) + l.width, h: Math.abs(l.y2 - l.y1) + l.width,
    });

    expect(page.lines.filter(l => hits(lineBox(l)))).toEqual([]);
    expect(page.texts.filter(t => t.str.trim() !== '' && hits({ x: t.x, y: t.y - 1, w: t.w, h: 1 }))).toEqual([]);
    expect(page.rects.filter(r => hits(r) && !(r.fill === '#000000' && r.x >= box.x - TOL && r.y >= box.y - TOL && r.x + r.w <= box.x + box.w + TOL && r.y + r.h <= box.y + box.h + TOL))).toEqual([]);
  });

  it('@DR-038 die Link-Fläche des QR reicht nicht bis an die Kopflinie', async () => {
    const { pages } = await handzettelPdf(fall);
    const page = pages[1];
    const rule = headRule(page);
    const link = page.links.find(l => l.y < GEO.top + 40);

    expect(link).toBeDefined();
    expect(link!.y + link!.h).toBeLessThanOrEqual(rule!.y1 - rule!.width / 2 + TOL);
  });
});
