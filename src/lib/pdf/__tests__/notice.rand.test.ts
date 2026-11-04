/**
 * B-28 C7 – Rand und Schwarz-Weiß für den Aushang (@DR-017, @DR-001, @DR-041, @BM-006), über die gemeinsamen Aushang-Fixtures
 * (`NOTICE_FIXTURES`): Rand mindestens printLimits.margin, nichts außerhalb, Text schwarz, Farbe nur als Akzentlinie, QR samt Ruhezone
 * auf dem Blatt, keine Schrift im Ruhebereich des QR.
 */
import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { printAccent, printLimits } from '../../../design-tokens/print';
import { generateLiveUrl } from '../../../utils/shareUtils';
import { printHeader } from '../../../design-tokens/print-header';
import { NOTICE_BASE_URL, NOTICE_FIXTURES, noticePdf, noticeTextBox, NOTICE_TOL, qrBox, SHARE_CODE } from './pdfNoticeSupport';

/** pdfjs rundet die Kanäle (0–1 → 0–255) um höchstens eine Stufe. */
const sameColor = (a: string, b: string): boolean =>
  [1, 3, 5].every(i => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 1);

describe.each(NOTICE_FIXTURES)('@DR-017 Rand und Schwarz-Weiß: $name', ({ tournament, options }) => {
  it('Text, Linien und Füllungen liegen mindestens printLimits.margin vom Blattrand', async () => {
    const { page, width, height } = await noticePdf(tournament, options);
    const m = printLimits.margin;

    page.texts.forEach(t => {
      const box = noticeTextBox(t);
      expect(box.x, `„${t.str}“ links`).toBeGreaterThanOrEqual(m - NOTICE_TOL);
      expect(box.x + box.w, `„${t.str}“ rechts`).toBeLessThanOrEqual(width - m + NOTICE_TOL);
      expect(box.y, `„${t.str}“ oben`).toBeGreaterThanOrEqual(m - NOTICE_TOL);
      expect(t.y, `„${t.str}“ unten`).toBeLessThanOrEqual(height - m + NOTICE_TOL);
    });
    page.images.forEach(image => {
      expect(image.x, 'Grafik links').toBeGreaterThanOrEqual(m - NOTICE_TOL);
      expect(image.x + image.w, 'Grafik rechts').toBeLessThanOrEqual(width - m + NOTICE_TOL);
      expect(image.y, 'Grafik oben').toBeGreaterThanOrEqual(m - NOTICE_TOL);
      expect(image.y + image.h, 'Grafik unten').toBeLessThanOrEqual(height - m + NOTICE_TOL);
    });
    page.rects.forEach(r => {
      expect(r.x).toBeGreaterThanOrEqual(m - NOTICE_TOL);
      expect(r.x + r.w).toBeLessThanOrEqual(width - m + NOTICE_TOL);
      expect(r.y + r.h).toBeLessThanOrEqual(height - m + NOTICE_TOL);
    });
  });

  it('alle Texte schwarz, Füllungen schwarz, Farbe nur als Akzent auf Linien (@DR-017, @DR-041)', async () => {
    const { page } = await noticePdf(tournament, options);

    page.textColors.forEach(c => expect(c, 'Textfarbe').toBe('#000000'));
    page.rects.forEach(r => expect(r.fill).toBe('#000000'));
    page.colors.filter(c => !['#000000', '#ffffff'].includes(c)).forEach(c => {
      expect(sameColor(c, printAccent.fallback), `Farbe ${c} ist nur der Akzent`).toBe(true);
      expect(page.lines.some(l => l.color === c), `Farbe ${c} steht auf einer Linie`).toBe(true);
    });
  });

  it('der QR samt Ruhezone liegt auf dem Blatt, und in der Ruhezone steht kein Text', async () => {
    const { page, width, height } = await noticePdf(tournament, options);
    const box = qrBox(page);
    const size = QRCode.create(generateLiveUrl(SHARE_CODE, NOTICE_BASE_URL)).modules.size;
    const zone = (box.w / size) * printHeader.qrQuietModules - NOTICE_TOL;
    const quiet = { x: box.x - zone, y: box.y - zone, w: box.w + 2 * zone, h: box.h + 2 * zone };

    expect(quiet.x).toBeGreaterThanOrEqual(printLimits.margin - NOTICE_TOL);
    expect(quiet.x + quiet.w).toBeLessThanOrEqual(width - printLimits.margin + NOTICE_TOL);
    expect(quiet.y + quiet.h).toBeLessThanOrEqual(height - printLimits.margin + NOTICE_TOL);
    page.texts.forEach(t => {
      const b = noticeTextBox(t);
      const inside = b.x < quiet.x + quiet.w && b.x + b.w > quiet.x && b.y < quiet.y + quiet.h && b.y + b.h > quiet.y;
      expect(inside, `„${t.str}“ in der Ruhezone`).toBe(false);
    });
  });
});
