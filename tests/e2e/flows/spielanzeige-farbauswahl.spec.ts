/**
 * Spielanzeige 2.3 Fixrunde A3: Die Farbauswahl (`ColorPicker`, Auslöser jetzt mindestens 44 px hoch) im Assistenten Schritt 5 (Teams)
 * und auf der Teams-Karte der Verwaltung: Auslöser ≥ 44 px, das aufgeklappte Feld liegt im Fenster und überdeckt nichts Wichtiges.
 * Saat `hallencup-messlauf` (Verwaltung) und `hallencup-entwurf` (Assistent). Bilder nur mit SA23_BILDER, 360×640 hell und dunkel.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const BILDER = process.env.SA23_BILDER;
const TEAM = '00000001-0000-4000-8000-000000000001';

async function bild(page: Page, name: string) {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${name}.png`), fullPage: false });
}

async function pruefe(page: Page, name: string) {
  const ausloeser = page.locator('button[aria-haspopup="true"]').first();
  await ausloeser.scrollIntoViewIfNeeded();
  const kasten = await ausloeser.boundingBox();
  expect(kasten?.height ?? 0, 'Auslöser mindestens 44 px hoch').toBeGreaterThanOrEqual(44);
  await ausloeser.click();
  const feld = page.getByRole('dialog', { name: 'Farbauswahl' });
  await expect(feld).toBeVisible();
  const f = await feld.boundingBox();
  const fenster = page.viewportSize();
  expect(f).not.toBeNull();
  expect(f!.x).toBeGreaterThanOrEqual(0);
  expect(f!.x + f!.width, 'Farbfeld ragt nicht über den rechten Rand').toBeLessThanOrEqual(fenster!.width);
  const a = await ausloeser.boundingBox();
  expect(f!.y, 'Farbfeld überdeckt den Auslöser nicht').toBeGreaterThanOrEqual(a!.y + a!.height - 1);
  await bild(page, name);
}

for (const thema of ['light', 'dark'] as const) {
  const t = thema === 'light' ? 'hell' : 'dunkel';
  test.describe(`@ZM-152 Farbauswahl 360×640 ${t}`, () => {
    test(`Assistent Schritt 5 (Teams), aufgeklappte Teamzeile ${t}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: thema });
      await page.setViewportSize({ width: 360, height: 640 });
      await installiereSaat(page.context(), leseSaat('hallencup-messlauf'));
      await page.goto('/#/tournament/hallencup-entwurf/edit?step=5');
      await page.getByRole('button', { name: /Farbe & Logo/ }).first().click();
      await pruefe(page, `wizard-teams-farbauswahl-360x640-${t}`);
    });

    test(`Teams-Karte der Verwaltung, aufgeklappt ${t}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: thema });
      await page.setViewportSize({ width: 360, height: 640 });
      await installiereSaat(page.context(), leseSaat('hallencup-messlauf'));
      await page.goto('/#/tournament/hallencup-messlauf/teams');
      await page.getByTestId(`team-expand-toggle-${TEAM}`).getByRole('button').click();
      await pruefe(page, `teams-karte-farbauswahl-360x640-${t}`);
    });
  });
}
