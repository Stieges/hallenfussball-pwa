/**
 * C-ZUSCHAUER-NAV-KONTRAST-INFO: Die Beschriftung der unteren Navigation der Zuschauer-Seite hat auch dann mindestens
 * 4,5 : 1 Kontrast (WCAG 2.2 AA, Regel „Kontrast“ im Record Zuschauer und Monitor), wenn ein blauer Ergebniskasten hinter
 * der Leiste liegt. Die Leiste ist eine deckende Fläche (Muster @OB-055: Text liegt auf deckender Fläche).
 * Vorher: Fläche der Leiste war im dunklen Thema nur 5 % Weiß, das Blau schien durch, „Info“ fiel durch (axe color-contrast).
 * Gegenbeispiel: ohne Kasten dahinter bleibt der Kontrast ebenfalls erfüllt. Hell und dunkel, Handy 360.
 * Wartet auf Zustände (Leiste da), nicht auf Zeit. Läuft nur im Projekt `desktop` (setzt das Fenster selbst).
 */
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../scripts/visual-metrics/saat/lader.mjs';

const MIN_KONTRAST = 4.5;
const NAV = 'nav[aria-label="Public Navigation"]';
/** Blau wie die Standardfarbe Heim im Ergebniskasten, mit der Höhe der Leiste hinter sie gelegt. */
const BLAU = 'rgb(37, 99, 235)';

async function oeffne(page: Page, thema: 'light' | 'dark', blauDahinter: boolean): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.emulateMedia({ colorScheme: thema });
  await installiereSaat(page.context(), leseSaat('hallencup-messlauf'));
  await page.goto('/#/live/MESS26');
  await expect(page.locator(NAV)).toBeVisible({ timeout: 25000 });
  if (blauDahinter) {
    // z-index unter der Leiste (1000), über dem Inhalt: wie ein Kasten, der beim Scrollen unter der Leiste liegt
    await page.evaluate((farbe) => {
      const kasten = document.createElement('div');
      kasten.dataset.testid = 'blauer-kasten-hinter-nav';
      kasten.style.cssText = `position:fixed;left:0;right:0;bottom:0;height:80px;z-index:999;background:${farbe}`;
      document.body.appendChild(kasten);
    }, BLAU);
    await expect(page.locator('[data-testid="blauer-kasten-hinter-nav"]')).toBeAttached();
  }
}

async function kontraste(page: Page): Promise<{ verstoesse: number; werte: number[] }> {
  const ergebnis = await new AxeBuilder({ page }).include(NAV).withRules(['color-contrast']).analyze();
  const knoten = ergebnis.violations.flatMap((v) => v.nodes);
  const werte = knoten.flatMap((n) => n.any.map((a) => Number((a.data as { contrastRatio?: number }).contrastRatio ?? 0)));
  return { verstoesse: knoten.length, werte };
}

for (const thema of ['dark', 'light'] as const) {
  test.describe(`Untere Navigation der Zuschauer-Seite, ${thema === 'dark' ? 'dunkel' : 'hell'}, 360 px`, () => {
    test.beforeEach(() => {
      test.skip(test.info().project.name !== 'desktop', 'setzt das Fenster selbst');
    });

    test('Beschriftung mit blauem Kasten dahinter: kein axe-Verstoß color-contrast (mindestens 4,5 : 1)', async ({ page }) => {
      await oeffne(page, thema, true);
      const { verstoesse, werte } = await kontraste(page);
      expect(verstoesse, `Kontrastwerte der Verstöße: ${werte.join(', ')} (Grenze ${String(MIN_KONTRAST)})`).toBe(0);
    });

    test('Gegenbeispiel: ohne Kasten dahinter ebenfalls kein Verstoß, Fläche der Leiste ist deckend', async ({ page }) => {
      await oeffne(page, thema, false);
      expect((await kontraste(page)).verstoesse).toBe(0);
      const alpha = await page.locator(NAV).evaluate((el) => {
        const farbe = getComputedStyle(el).backgroundColor;
        const teile = farbe.match(/[\d.]+/g) ?? [];
        return teile.length === 4 ? Number(teile[3]) : 1;
      });
      expect(alpha, 'Hintergrund der Leiste deckend').toBe(1);
    });
  });
}
