/**
 * Paket KP – @W5-028 (Name „(Probe)“, änderbar) und @W5-027 (Kopie archivieren) im echten Bedienweg, ohne Server (Saat).
 * Bilder: Ordner aus KP_BILDER, je Größe Handy 360×640 und Laptop 1280×720. Läuft nur im Projekt `desktop` (setzt Fenster selbst).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const BILDER = process.env.KP_BILDER;
const GROESSEN = [{ name: '360x640', width: 360, height: 640 }, { name: '1280x720', width: 1280, height: 720 }];
const ORIGINAL = 'hallencup-phase-halbzeit';

async function bild(page: Page, name: string, groesse: string) {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${name}-${groesse}.png`) });
}

async function oeffneKopieDialog(page: Page, groesse: { width: number; height: number }) {
  await page.setViewportSize(groesse);
  await installiereSaat(page.context(), leseSaat('hallencup-messlauf'));
  await page.goto('/#/');
  const trigger = page.getByTestId(`tournament-${ORIGINAL}-actions-trigger`);
  await expect(trigger).toBeVisible({ timeout: 20000 });
  await trigger.click();
  await page.getByTestId('action-menu-item-copy').click();
  await expect(page.getByTestId('copy-dialog-name')).toBeVisible();
}

for (const groesse of GROESSEN) {
  test.describe(`Kopie fürs Proben ${groesse.name}`, () => {
    test('@W5-028 der Dialog schlägt „(Probe)“ vor; Speichern legt die Kopie auf die Startseite', async ({ page }) => {
      await oeffneKopieDialog(page, groesse);
      const feld = page.getByTestId('copy-dialog-name');
      const vorschlag = await feld.inputValue();
      expect(vorschlag).toMatch(/ \(Probe\)$/);
      await bild(page, '1-kopie-dialog', groesse.name);

      await page.getByTestId('copy-dialog-confirm').click();
      await expect(page.getByTestId('copy-dialog-name')).toBeHidden();
      await expect(page.getByText(vorschlag, { exact: true })).toBeVisible();
      await bild(page, '2-startseite-mit-probe-kopie', groesse.name);
    });

    test('@W5-028 der Name lässt sich vor dem Speichern ändern', async ({ page }) => {
      await oeffneKopieDialog(page, groesse);
      await page.getByTestId('copy-dialog-name').fill('Generalprobe Samstag');
      await page.getByTestId('copy-dialog-confirm').click();
      await expect(page.getByText('Generalprobe Samstag', { exact: true })).toBeVisible();
    });

    test('@W5-027 die gespielte Probe-Kopie wird archiviert: weg von der Startseite, im Archiv, Original bleibt', async ({ page }) => {
      await oeffneKopieDialog(page, groesse);
      const kopieName = await page.getByTestId('copy-dialog-name').inputValue();
      await page.getByTestId('copy-dialog-confirm').click();
      const karte = page.locator('[data-testid^="tournament-card-"]', { hasText: kopieName });
      await expect(karte).toBeVisible();
      const kopieId = (await karte.getAttribute('data-testid'))?.replace('tournament-card-', '') ?? '';
      expect(kopieId).not.toBe('');

      await page.goto(`/#/tournament/${kopieId}/admin/danger-zone`);
      await page.getByRole('button', { name: /Turnier archivieren/i }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('textbox').fill('ARCHIVIEREN');
      await dialog.getByRole('button', { name: /Turnier archivieren/i }).click();
      await expect(dialog).toBeHidden();

      await page.goto('/#/');
      await expect(page.getByTestId(`tournament-${ORIGINAL}-actions-trigger`)).toBeVisible();
      await expect(page.locator('[data-testid^="tournament-card-"]', { hasText: kopieName })).toHaveCount(0);

      await page.goto('/#/archiv');
      await expect(page.locator('[data-testid^="tournament-card-"]', { hasText: kopieName })).toBeVisible();
      await bild(page, '3-archiv', groesse.name);
    });
  });
}
