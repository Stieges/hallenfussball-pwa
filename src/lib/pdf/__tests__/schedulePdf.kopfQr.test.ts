/**
 * B-28 C4 – Zuschauer-QR im Kopf von Seite 1, als Vektor gelesen aus dem fertigen PDF (pdfjs).
 * Szenarien: @DR-003 (mindestens 3 cm), @DR-010 (Beschriftung), @BM-009 (erste Seite), @BM-043 (Adresse), @ZM-064
 * (nicht geteilt: kein QR, keine Platzhalterfläche), @ZM-058 (Spielplan-PDF).
 */
import { describe, expect, it } from 'vitest';
import { printType } from '../../../design-tokens/print';
import { pageGeometry } from '../layout';
import { hallencupTournament } from './pdfFixture';
import QRCode from 'qrcode';
import { BASE_URL, bboxOf, drawnMatrix, expectedMatrix, headBottom, kopfPdf, qrRects, TOL, textBox } from './pdfKopfSupport';
import { generateLiveUrl, generateTournamentUrl } from '../../../utils/shareUtils';
import { generateFullSchedule } from '../../../core/generators';
import { squash } from './pdfjsText';

const MIN_EDGE_MM = 30;
const CAPTION = 'Live-Ergebnisse';

describe('@DR-003 @BM-009 @BM-043 geteiltes Turnier: der QR steht auf Seite 1', () => {
  it('die gezeichnete Matrix ist QRCode.create(generateLiveUrl(code)), Zelle für Zelle', async () => {
    const { pages } = await kopfPdf();
    const expected = expectedMatrix('ABC123');

    expect(drawnMatrix(pages[0], expected.length)).toEqual(expected);
  });

  it('@BM-043 der Inhalt ist die volle Adresse https://…/#/live/ABC123, nicht die relative und nicht die Verwaltungsadresse', async () => {
    const { pages } = await kopfPdf();
    const drawn = drawnMatrix(pages[0], expectedMatrix('ABC123').length);
    const matrixOf = (url: string): boolean[][] => {
      const { modules } = QRCode.create(url);
      return Array.from({ length: modules.size }, (_, r) => Array.from({ length: modules.size }, (_, c) => Boolean(modules.get(r, c))));
    };

    expect(generateLiveUrl('ABC123', BASE_URL)).toMatch(/^https:\/\/.+\/#\/live\/ABC123$/);
    expect(drawn).toEqual(matrixOf(generateLiveUrl('ABC123', BASE_URL)));
    expect(drawn).not.toEqual(matrixOf('/#/live/ABC123'));
    expect(drawn).not.toEqual(matrixOf(generateTournamentUrl('ABC123', BASE_URL)));
  });

  it('Kante mindestens 30 mm, quadratisch, nur schwarze Module auf dem Papier', async () => {
    const { pages } = await kopfPdf();
    const box = bboxOf(qrRects(pages[0]));

    expect(box.w).toBeGreaterThanOrEqual(MIN_EDGE_MM);
    expect(Math.abs(box.w - box.h)).toBeLessThanOrEqual(TOL);
    expect(pages[0].rects.filter(r => r.fill !== '#000000' && r.y < headBottom(pages[0]) && r.w > 0).map(r => r.fill), 'keine Fläche unter dem Symbol außer Papier').toEqual([]);
  });

  it('Ruhezone von 4 Modulen: weder Text noch Linie noch Füllung außer dem Symbol', async () => {
    const { pages } = await kopfPdf();
    const box = bboxOf(qrRects(pages[0]));
    const module = box.w / expectedMatrix('ABC123').length;
    const zone = module * 4 - TOL;
    const quiet = { x: box.x - zone, y: box.y - zone, w: box.w + 2 * zone, h: box.h + 2 * zone };
    const inside = (b: { x: number; y: number; w: number; h: number }): boolean =>
      b.x < quiet.x + quiet.w && b.x + b.w > quiet.x && b.y < quiet.y + quiet.h && b.y + b.h > quiet.y;

    const fremdeModule = qrRects(pages[0]).filter(r => r.x < box.x - TOL || r.y < box.y - TOL || r.x + r.w > box.x + box.w + TOL || r.y + r.h > box.y + box.h + TOL);
    expect(fremdeModule).toEqual([]);
    expect(pages[0].texts.filter(t => inside(textBox(t))).map(t => t.str)).toEqual([]);
    expect(pages[0].lines.filter(l => inside({ x: Math.min(l.x1, l.x2), y: Math.min(l.y1, l.y2), w: Math.abs(l.x2 - l.x1), h: Math.abs(l.y2 - l.y1) })).length).toBe(0);
  });

  it('@DR-010 kurze Beschriftung darunter, mittig zum Symbol, außerhalb der Ruhezone', async () => {
    const { pages } = await kopfPdf();
    const box = bboxOf(qrRects(pages[0]));
    const caption = pages[0].texts.find(t => squash(t.str) === squash(CAPTION));

    expect(caption).toBeDefined();
    expect(caption!.y).toBeGreaterThan(box.y + box.h);
    expect(Math.abs(caption!.x + caption!.w / 2 - (box.x + box.w / 2))).toBeLessThanOrEqual(1);
  });

  it('der QR steht rechts im Kopf und endet am Satzspiegel', async () => {
    const { pages } = await kopfPdf();
    const geo = pageGeometry('a4', 'portrait');
    const box = bboxOf(qrRects(pages[0]));

    expect(box.x + box.w).toBeLessThanOrEqual(geo.left + geo.contentWidth + TOL);
    expect(box.x).toBeGreaterThan(geo.left + geo.contentWidth / 2);
    expect(box.y + box.h).toBeLessThan(headBottom(pages[0]));
  });

  it('@DR-010 Ergebnisse für Zuschauer ausgeblendet: Beschriftung „Spielplan aufs Handy“', async () => {
    const { pages } = await kopfPdf({ viewerResultsHidden: true });

    expect(pages[0].texts.some(t => squash(t.str) === squash('Spielplan aufs Handy'))).toBe(true);
    expect(pages[0].texts.some(t => squash(t.str) === squash(CAPTION))).toBe(false);
  });

  it('die Spalte ist so breit wie Symbol plus Ruhezone: Angaben enden links davon', async () => {
    const tournament = hallencupTournament();
    const lang = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921 e. V., Abteilung Hallenfußball mit Jugendmannschaften';
    const { pages } = await kopfPdf({ organizerName: lang }, tournament);
    const box = bboxOf(qrRects(pages[0]));
    const module = box.w / expectedMatrix('ABC123').length;
    const angaben = pages[0].texts.filter(t => t.size <= printType.meta + TOL && t.y > 20 && t.y < box.y + box.h && t.x + t.w < box.x + box.w + 1 && t.x < box.x);

    expect(angaben.length).toBeGreaterThan(0);
    angaben.forEach(t => expect(t.x + t.w, `„${t.str}“`).toBeLessThanOrEqual(box.x - module * 4 + TOL));
  });
});

describe('@ZM-064 nicht geteilt: kein QR und keine leere Fläche', () => {
  it.each([
    ['isPublic aus', { isPublic: false }],
    ['ohne Share-Code', { shareCode: undefined }],
  ])('%s: keine schwarzen Module, keine weiße Fläche, keine Beschriftung', async (_name, override) => {
    const { pages } = await kopfPdf({}, hallencupTournament(override));

    expect(qrRects(pages[0])).toEqual([]);
    expect(pages[0].rects.filter(r => r.fill === '#ffffff' && r.y < headBottom(pages[0]))).toEqual([]);
    expect(pages[0].texts.some(t => squash(t.str) === squash(CAPTION))).toBe(false);
  });

  it('Gegenbeispiel: die Angaben nutzen die ganze Breite (keine reservierte QR-Spalte)', async () => {
    const lang = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921 e. V., Abteilung Hallenfußball mit Jugendmannschaften';
    const geo = pageGeometry('a4', 'portrait');
    const geteilt = await kopfPdf({ organizerName: lang });
    const privat = await kopfPdf({ organizerName: lang }, hallencupTournament({ isPublic: false }));
    const rechtsterRand = (pdf: Awaited<ReturnType<typeof kopfPdf>>): number =>
      Math.max(...pdf.pages[0].texts.filter(t => t.size >= printType.meta - TOL && t.size <= printType.meta + TOL && t.y > 20 && t.y < headBottom(pdf.pages[0]) - 3).map(t => t.x + t.w));

    expect(rechtsterRand(privat)).toBeGreaterThan(rechtsterRand(geteilt) + 10);
    expect(rechtsterRand(privat)).toBeLessThanOrEqual(geo.left + geo.contentWidth + TOL);
  });
});

describe('@DR-003 Folgeseiten: QR mindestens 20 mm, gleiche Adresse', () => {
  const GROSS = 'ABCDEFGH';
  async function mehrSeiten() {
    const teams = Array.from({ length: 16 }, (_, i) => ({ id: `t${i}`, name: `Verein ${i + 1}`, group: GROSS[Math.floor(i / 8)] }));
    const tournament = hallencupTournament({ teams, numberOfTeams: 16, numberOfGroups: 2 });
    return kopfPdf({}, tournament, generateFullSchedule(tournament, 'de'));
  }

  it('jede Folgeseite trägt den QR mit Kante ≥ 20 mm und derselben Matrix, rechts im Kurzkopf', async () => {
    const { pages } = await mehrSeiten();
    const expected = expectedMatrix('ABC123');
    const geo = pageGeometry('a4', 'portrait');

    expect(pages.length).toBeGreaterThanOrEqual(2);
    for (const [i, page] of pages.slice(1).entries()) {
      const rects = page.rects.filter(r => r.fill === '#000000' && r.y < geo.top + 40 && r.x > geo.left + geo.contentWidth / 2 && r.h < 5);
      const box = bboxOf(rects);
      expect(box.w, `Seite ${i + 2}`).toBeGreaterThanOrEqual(20);
      expect(Math.abs(box.w - box.h)).toBeLessThanOrEqual(TOL);
      expect(box.x + box.w).toBeLessThanOrEqual(geo.left + geo.contentWidth + TOL);
      const module = box.w / expected.length;
      const drawn = expected.map((row, r) => row.map((_, c) => rects.some(q => box.x + (c + 0.5) * module >= q.x && box.x + (c + 0.5) * module <= q.x + q.w && box.y + (r + 0.5) * module >= q.y && box.y + (r + 0.5) * module <= q.y + q.h)));
      expect(drawn, `Matrix Seite ${i + 2}`).toEqual(expected);
    }
  });

  it('Titel und Untertitel des Kurzkopfs laufen nicht in die QR-Spalte', async () => {
    const { pages } = await mehrSeiten();
    const geo = pageGeometry('a4', 'portrait');
    const rects = pages[1].rects.filter(r => r.fill === '#000000' && r.y < geo.top + 40 && r.x > geo.left + geo.contentWidth / 2 && r.h < 5);
    const box = bboxOf(rects);

    pages[1].texts.filter(t => t.y < box.y + box.h && t.str.trim() !== '').forEach(t => expect(t.x + t.w, `„${t.str}“`).toBeLessThanOrEqual(box.x + TOL));
  });

  it('Gegenbeispiel @ZM-064: nicht geteilt, kein QR auf den Folgeseiten', async () => {
    const teams = Array.from({ length: 16 }, (_, i) => ({ id: `t${i}`, name: `Verein ${i + 1}`, group: GROSS[Math.floor(i / 8)] }));
    const tournament = hallencupTournament({ teams, numberOfTeams: 16, numberOfGroups: 2, isPublic: false });
    const { pages } = await kopfPdf({}, tournament, generateFullSchedule(tournament, 'de'));

    pages.slice(1).forEach(page => expect(page.rects.filter(r => r.fill === '#000000' && r.h < 5 && r.y < 50)).toEqual([]));
  });
});
