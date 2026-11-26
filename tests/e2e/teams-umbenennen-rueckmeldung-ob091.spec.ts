/**
 * @OB-091 Umbenennen am Handy (412 Pixel): nach „Speichern“ schließt die Bearbeitung, „Name gespeichert“ erscheint, die Karte zeigt den neuen Namen,
 * und ein Tipp gleich danach auf „Umbenennen“ (dort liegt der Finger nach dem Layoutsprung) öffnet die Bearbeitung nicht erneut.
 * Saat: Messlauf-Turnier, lokal ohne Datenbank. Bild der Meldung nach TEAMS_BILDER (sonst Testausgabe).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat } from '../../scripts/visual-metrics/saat/lader.mjs';
import { messSaat, SCHRAEGSTRICH_NAME, TURNIER_ID } from './helpers/messlaufTaching';
import { animationenFertig } from './helpers/animationenFertig';

test('@OB-091 nach „Speichern“: Meldung „Name gespeichert“, neuer Name, Doppeltipp öffnet nichts erneut (412)', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 412, height: 900 });
  await installiereSaat(page.context(), messSaat());
  await page.goto(`/#/tournament/${TURNIER_ID}/teams`);
  const kopf = page.locator('[data-testid^="team-expand-toggle-"]').filter({ hasText: SCHRAEGSTRICH_NAME }).first();
  await expect(kopf).toBeVisible({ timeout: 25000 });
  const id = (await kopf.getAttribute('data-testid'))?.replace('team-expand-toggle-', '') ?? '';
  await page.getByTestId(`team-expand-arrow-${id}`).click();
  await page.getByTestId(`team-edit-button-${id}`).click();
  await page.getByTestId(`team-rename-input-${id}`).fill('SG Tengling/Taching');
  await page.getByTestId(`team-rename-save-${id}`).click();

  await expect(page.getByTestId(`team-rename-input-${id}`)).toHaveCount(0);
  await expect(page.getByText('Name gespeichert')).toBeVisible();
  await expect(page.getByTestId(`team-name-${id}`)).toHaveText('SG Tengling/Taching');
  await animationenFertig(page);
  const ordner = process.env.TEAMS_BILDER ?? testInfo.outputDir;
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, '412-meldung.png'), fullPage: false });

  // zweiter Tipp gleich danach auf „Umbenennen“
  await page.getByTestId(`team-edit-button-${id}`).click();
  await expect(page.getByTestId(`team-rename-input-${id}`)).toHaveCount(0);
});
