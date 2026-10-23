/**
 * Spielanzeige 2.3 Fixrunde 3: Die feste Fußleiste „Speichern“ der Anzeige für Zuschauer ist ab der Breite mit Inhaltsspalte
 * bündig mit der Karte (linke und rechte Kante des Knopfs = Karte, 1 px Toleranz), am Handy (360×640) so breit wie das Fenster.
 * Bilder nur mit SA23_BILDER (Vorsatz fix3).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const BILDER = process.env.SA23_BILDER;

async function oeffne(page: Page, width: number, height: number, thema: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: thema });
  await installiereSaat(page.context(), leseSaat('hallencup-messlauf'));
  await page.setViewportSize({ width, height });
  await page.goto('/#/tournament/hallencup-messlauf/admin/visibility');
  await expect(page.getByTestId('spectator-display-footer')).toBeVisible({ timeout: 25000 });
}

async function kanten(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { links: r.left, rechts: r.right, breite: r.width };
  });
}

async function bild(page: Page, name: string) {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.getByTestId('spectator-display-section').evaluate((el) => {
    el.scrollIntoView({ block: 'start' });
    for (let p = el.parentElement; p !== null; p = p.parentElement) {
      if (p.scrollTop > 0) { p.scrollTop -= 72; break; }
    }
  });
  await page.screenshot({ path: join(BILDER, `${name}.png`), fullPage: false });
}

for (const [width, height] of [[768, 1024], [1280, 720], [1440, 900]] as const) {
  test(`@ZM-152 ${width}×${height}: Speichern-Knopf bündig mit der Karte`, async ({ page }) => {
    await oeffne(page, width, height, 'light');
    const karte = await kanten(page, 'spectator-display-section');
    const knopf = await kanten(page, 'spectator-display-save');
    expect(Math.abs(knopf.links - karte.links), 'linke Kante').toBeLessThanOrEqual(1);
    expect(Math.abs(knopf.rechts - karte.rechts), 'rechte Kante').toBeLessThanOrEqual(1);
  });
}

test('@ZM-152 360×640: die Leiste hat die volle Fensterbreite', async ({ page }) => {
  await oeffne(page, 360, 640, 'light');
  const leiste = await kanten(page, 'spectator-display-footer');
  expect(leiste.links).toBeLessThanOrEqual(1);
  expect(Math.abs(leiste.breite - 360)).toBeLessThanOrEqual(1);
});

test.describe('Bilder der Fußleiste', () => {
  test.skip(!BILDER, 'nur mit SA23_BILDER');
  for (const [width, height] of [[1280, 720], [360, 640]] as const) {
    for (const thema of ['light', 'dark'] as const) {
      test(`Bild ${width}x${height} ${thema}`, async ({ page }) => {
        await oeffne(page, width, height, thema);
        await bild(page, `einstellung-${width}x${height}-${thema === 'light' ? 'hell' : 'dunkel'}`);
      });
    }
  }
});
