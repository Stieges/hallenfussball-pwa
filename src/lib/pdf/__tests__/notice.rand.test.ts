/**
 * B-28 C7 – Rand und Schwarz-Weiß für den Aushang (@DR-017, @DR-001, @BM-006), über die gemeinsamen Aushang-Fixtures
 * (`NOTICE_FIXTURES`): Rand mindestens printLimits.margin, nichts außerhalb, nur Schwarz auf Papier, QR samt Ruhezone
 * auf dem Blatt, keine Schrift im Ruhebereich des QR.
 */
import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { printLimits } from '../../../design-tokens/print';
import { generateLiveUrl } from '../../../utils/shareUtils';
import { printNotice } from '../../../design-tokens/print-notice';
import { NOTICE_BASE_URL, NOTICE_FIXTURES, noticePdf, noticeTextBox, NOTICE_TOL, qrBox, SHARE_CODE } from './pdfNoticeSupport';

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
    page.rects.forEach(r => {
      expect(r.x).toBeGreaterThanOrEqual(m - NOTICE_TOL);
      expect(r.x + r.w).toBeLessThanOrEqual(width - m + NOTICE_TOL);
      expect(r.y + r.h).toBeLessThanOrEqual(height - m + NOTICE_TOL);
    });
  });

  it('nur Schwarz auf Papier: jede Farbe im Inhalt ist Schwarz oder Weiß, jede Füllung schwarz', async () => {
    const { page } = await noticePdf(tournament, options);

    page.colors.forEach(c => expect(['#000000', '#ffffff'], `Farbe ${c}`).toContain(c));
    page.rects.forEach(r => expect(r.fill).toBe('#000000'));
  });

  it('der QR samt Ruhezone liegt auf dem Blatt, und in der Ruhezone steht kein Text', async () => {
    const { page, width, height } = await noticePdf(tournament, options);
    const box = qrBox(page);
    const size = QRCode.create(generateLiveUrl(SHARE_CODE, NOTICE_BASE_URL)).modules.size;
    const zone = (box.w / size) * printNotice.qrQuietModules - NOTICE_TOL;
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
