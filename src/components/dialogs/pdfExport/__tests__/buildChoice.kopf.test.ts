/**
 * PDF-Paket T8: Kopf des Spielplans mit den Grafiken aus dem Gerätespeicher (@DR-024, @DR-023, @DR-040, @W3-030). Gemessen am
 * echten PDF (pdfjs) für die Fälle a, b und c der Mockup-Runde; Grafiken laufen durch `graphicsOptions` wie im Dialog.
 * Prüfbilder: selbst erzeugt (Wappenform 1 : 1, zweite Grafik 2 : 1), kein Vereinswappen.
 */
import { describe, expect, it } from 'vitest';
import type { StoredGraphic, TournamentGraphics } from '../../../../core/storage/tournamentGraphicsStore';
import { printHeader } from '../../../../design-tokens/print-header';
import { printFont, printType, printUnit } from '../../../../design-tokens/print';
import { printRule, printSheetHead } from '../../../../design-tokens/print-sheet';
import type { LayoutPage, LayoutText } from '../../../../lib/pdf/__tests__/pdfjsLayout';
import { FALL_A, FALL_B, FALL_C, type HandzettelFall } from '../../../../lib/pdf/__tests__/fixtures/handzettelFaelle';
import { handzettelPdf } from '../../../../lib/pdf/__tests__/handzettelPdf';
import { pngBytes } from '../../../../lib/pdf/__tests__/pdfLogoFixture';
import { pageGeometry } from '../../../../lib/pdf/layout';
import { graphicsOptions } from '../graphicsOptions';

const geo = pageGeometry('a4', 'portrait');
const LEFT = geo.left;
const RIGHT = geo.left + geo.contentWidth;
const BLAU = '#2A2576';

function gespeichert(widthPx: number, heightPx: number): StoredGraphic {
  return { dataUrl: `data:image/png;base64,${Buffer.from(pngBytes(widthPx, heightPx)).toString('base64')}`, widthPx, heightPx, originalHeightPx: heightPx };
}
const WAPPEN = gespeichert(300, 300);
const ZWEITE = gespeichert(600, 300);
const lage = (links: boolean, rechts: boolean): TournamentGraphics => ({
  ...(links ? { left: WAPPEN, accent: BLAU } : {}),
  ...(rechts ? { right: ZWEITE } : {}),
});

const wann = (page: LayoutPage): LayoutText | undefined => page.texts.find(t => ['WANN', 'WHEN'].includes(t.str.trim()));
const kopfZeilen = (page: LayoutPage): LayoutText[] => page.texts.filter(t => t.y < (wann(page)?.y ?? 0) - 1 && t.str.trim() !== '');
const spaltenkopfY = (page: LayoutPage): number => page.texts.find(t => ['Nr.', 'No.'].includes(t.str.trim()))?.y ?? Number.NaN;

describe.each<[string, HandzettelFall]>([['a', FALL_A], ['b', FALL_B], ['c', FALL_C]])('Fall %s: Titel mittig im freien Platz zwischen den Grafiken (@DR-024)', (_name, fall) => {
  it.each<[string, boolean, boolean]>([['beide Grafiken', true, true], ['nur links', true, false], ['nur rechts', false, true], ['ohne Grafik (anderes Gerät)', false, false]])(
    '%s: jede Kopfzeile mittig im freien Platz (±0,3 mm), keine Überlappung mit den Grafiken, kein Platzhalter',
    async (_n, links, rechts) => {
      const { pages } = await handzettelPdf(fall, { options: graphicsOptions(lage(links, rechts)) });
      const page = pages[0];
      const bilder = [...page.images].sort((a, b) => a.x - b.x);
      const l = bilder.find(i => i.x < 100);
      const r = bilder.find(i => i.x >= 100);
      const von = l ? l.x + l.w + printHeader.logoGap : LEFT;
      const bis = r ? r.x - printHeader.logoGap : RIGHT;

      expect(page.images).toHaveLength((links ? 1 : 0) + (rechts ? 1 : 0));
      expect(kopfZeilen(page).length).toBeGreaterThanOrEqual(2);
      kopfZeilen(page).forEach(t => {
        expect(Math.abs(t.x + t.w / 2 - (von + bis) / 2), `„${t.str}“ mittig`).toBeLessThanOrEqual(0.3);
        expect(t.x).toBeGreaterThanOrEqual(von - 0.3);
        expect(t.x + t.w).toBeLessThanOrEqual(bis + 0.3);
      });
      expect(page.texts.some(t => /logo/i.test(t.str))).toBe(false);
    },
  );

  it('@DR-023 @DR-024 der Kopf ist nur so hoch wie die höhere Seite: Grafiken (20 mm) oder Text, darunter nur Abstand und Kopflinie', async () => {
    const { pages } = await handzettelPdf(fall, { options: graphicsOptions(lage(true, true)) });
    const page = pages[0];
    const unten = Math.max(
      ...page.images.map(i => i.y + i.h),
      ...kopfZeilen(page).map(t => t.y + t.size * printFont.descentEm * printUnit.mmPerPt),
    );
    const kopfLinie = Math.min(...page.lines.filter(l => Math.abs(l.y1 - l.y2) < 0.01 && l.x2 - l.x1 > 150 && l.width > 0.4).map(l => l.y1));

    expect(kopfLinie - unten).toBeCloseTo(printSheetHead.bandPadBottom + printSheetHead.titleAirBottom + printRule.head / 2, 0);
    expect(spaltenkopfY(page)).toBeGreaterThan(kopfLinie);
  });
});

describe('@DR-024 Gegenprobe mit echten Grafiken: „Hallencup Nord“ mit 20 Gruppenspielen verliert kein Spiel von Seite 1', () => {
  it('mit beiden Grafiken (je 20 mm hoch) stehen die Spiele 1 bis 20 auf Seite 1', async () => {
    const { pages } = await handzettelPdf(FALL_B, { tournament: { title: 'Hallencup Nord' }, options: graphicsOptions(lage(true, true)) });
    const nummern = pages[0].texts.filter(t => /^\d{1,2}$/.test(t.str.trim()) && t.x < 25 && Math.abs(t.size - printType.nr) < 0.05);

    expect(pages[0].images.map(i => i.h).every(h => h <= printHeader.logoMaxHeight + 0.05)).toBe(true);
    expect(nummern).toHaveLength(20);
  });
});
