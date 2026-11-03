/**
 * T7a, Links im PDF (pdfjs `getAnnotations`): @DR-038 QR, Beschriftung, QR der Folgeseiten und Adresse in jeder Fußzeile führen
 * zur Zuschauer-Seite; die Beschriftung ist fett und mit genau einer Linie unterstrichen; ohne Online-Teilen kein QR, kein Link.
 */
import { describe, expect, it } from 'vitest';
import { printLimits } from '../../../design-tokens/print';
import { printSheetHead } from '../../../design-tokens/print-sheet';
import { pageGeometry } from '../layout';
import { FALL_A, FALL_B, FALL_SHARE_CODE } from './fixtures/handzettelFaelle';
import { handzettelPdf, BASE_URL } from './handzettelPdf';
import type { LayoutPage } from './pdfjsLayout';

const URL_ZUSCHAUER = `${BASE_URL}/#/live/${FALL_SHARE_CODE}`;
const FUSSLINIE = pageGeometry('a4', 'portrait', 1, 2).footRuleY;
const TOL = 0.2;

const caption = (page: LayoutPage) => page.texts.find(t => t.str.trim() === 'Live-Ergebnisse');

describe('@DR-038 Links auf die Zuschauer-Seite', () => {
  it('@DR-038 Link auf den QR auf Seite 1 → Zuschauer-Adresse, mindestens 30 mm', async () => {
    const { pages } = await handzettelPdf(FALL_B);
    const qr = pages[0].links.find(l => l.h > 30);

    expect(qr?.url).toBe(URL_ZUSCHAUER);
    expect(qr?.w).toBeGreaterThanOrEqual(30);
  });

  it('@DR-038 die Beschriftung unter dem QR ist ein Link, fett und mit genau einer Linie unterstrichen', async () => {
    const { pages } = await handzettelPdf(FALL_B);
    const text = caption(pages[0]);
    const link = pages[0].links.find(l => l.h < 10 && l.y < FUSSLINIE - 20);
    const linien = pages[0].lines.filter(l => text !== undefined && Math.abs(l.y1 - l.y2) < 0.01 && l.y1 > text.y && l.y1 < text.y + 2 && Math.abs(l.width - printSheetHead.underlineStroke) < 0.02);

    expect(text).toBeDefined();
    expect(link?.url).toBe(URL_ZUSCHAUER);
    expect(link && text ? Math.abs(link.w - text.w) : 99, 'Fläche = Breite der Beschriftung').toBeLessThanOrEqual(1);
    expect(linien, 'genau eine Unterstreichung').toHaveLength(1);
    expect(linien[0] && text ? Math.abs(Math.abs(linien[0].x2 - linien[0].x1) - text.w) : 99).toBeLessThanOrEqual(1);
  });

  it('@DR-038 QR jeder Folgeseite ist ein Link (mindestens 20 mm) und die Adresse in der Fußzeile jeder Seite', async () => {
    const { pages } = await handzettelPdf(FALL_B);

    expect(pages.length).toBeGreaterThanOrEqual(2);
    pages.forEach((page, i) => {
      const fuss = page.links.filter(l => l.y > FUSSLINIE);
      expect(fuss.map(l => l.url), `Seite ${i + 1} Fußzeile`).toEqual([URL_ZUSCHAUER]);
      if (i > 0) {
        const qr = page.links.find(l => l.y < 40);
        expect(qr?.url, `Seite ${i + 1} QR`).toBe(URL_ZUSCHAUER);
        expect(qr?.w).toBeGreaterThanOrEqual(20);
      }
    });
  });

  it('@DR-038 Fußzeile mit Umbruch (langer Titel): die Adresse bleibt Link, über der Schriftgrenze des unteren Rands', async () => {
    const { pages } = await handzettelPdf(FALL_A, { tournament: { title: 'Internationaler Hallenfußball-Wintercup der SG Nordheim 2026' } });

    pages.forEach((page, i) => {
      expect(page.links.filter(l => l.y > FUSSLINIE).map(l => l.url), `Seite ${i + 1}`).toEqual([URL_ZUSCHAUER]);
      page.links.forEach(l => expect(l.y + l.h).toBeLessThanOrEqual(page.texts.length > 0 ? 297 - printLimits.margin + TOL : 0));
    });
  });

  it('@DR-038 Gegenbeispiel: nicht online geteilt – kein QR, keine Beschriftung, kein Link, keine Adresse in der Fußzeile', async () => {
    const { pages } = await handzettelPdf(FALL_B, { tournament: { isPublic: false } });

    pages.forEach((page, i) => {
      expect(page.links, `Seite ${i + 1}`).toEqual([]);
      expect(caption(page)).toBeUndefined();
      expect(page.texts.some(t => /hallenfussball-pwa|\/#\/live/.test(t.str)), `Seite ${i + 1} Adresse`).toBe(false);
    });
    expect(pages[0].rects.filter(r => r.fill === '#000000' && r.w < 3 && r.h < 3 && r.y < 90)).toEqual([]);
  });
});
