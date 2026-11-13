/**
 * E2E: Der Import übernimmt die Trikotfarben der Teams (@W1-043, Befund C-IMPORT-OHNE-TRIKOTFARBEN).
 * Weg: Startseite → Import-Dialog mit „d.json“ (Nikolaus-Wochenende) → Assistent bis zum Veröffentlichen → Cockpit.
 * „Waging 1“ und „Fridolfing“ tragen beide Blau und haben das erste Spiel: das Cockpit zeigt „Gleiche Trikotfarbe“.
 * Bilder: IMPORT_FARBEN_BILDER=<Ordner>.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/utils/__tests__/fixtures/nikolaus');
const BILDER = process.env.IMPORT_FARBEN_BILDER;
const BLAU_RGB = 'rgb(21, 101, 192)';

async function importiere(page: Page, datei: { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
  await page.goto('/#/');
  await page.getByTestId('dashboard-import-trigger').click();
  await page.getByTestId('import-file-input').setInputFiles(datei);
}

async function bild(page: Page, name: string): Promise<void> {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: path.join(BILDER, `${name}.png`) });
}

test.describe('@W1-043 Import übernimmt die Trikotfarben', () => {
  test.beforeEach(async ({ browserName: _b }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Profile mobile-sm, mobile-md, tablet-portrait, desktop genügen');
  });

  test('d.json: Waging 1 und Fridolfing tragen Blau im Assistenten und im Cockpit, das erste Spiel warnt vor gleicher Trikotfarbe', async ({ page }) => {
    await importiere(page, { name: 'd.json', mimeType: 'application/json', buffer: readFileSync(path.join(FIXTURES, 'd.json')) });
    await page.getByTestId('import-warnings-continue').click();
    await page.getByTestId('import-confirm').click();
    await page.getByTestId('import-success-go').click();
    await expect(page).toHaveURL(/\/tournament\/[^/]+\/edit\?step=2/);

    // Schritt „Teams“: jedes Team trägt den Punkt in seiner Farbe
    await page.goto(page.url().replace('step=2', 'step=5'));
    const punkte = page.locator('[data-testid^="wizard-team-details-"][data-testid$="-dot"]');
    await expect(punkte).toHaveCount(6);
    await expect(punkte.nth(0)).toHaveCSS('background-color', BLAU_RGB);
    await expect(punkte.nth(5)).toHaveCSS('background-color', BLAU_RGB);
    await bild(page, `teams-${test.info().project.name}`);

    // Assistent zu Ende, veröffentlichen
    await page.getByTestId('wizard-footer-bar').getByRole('button', { name: 'Weiter' }).click();
    await page.getByTestId('wizard-show-preview').click();
    await page.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page).toHaveURL(/\/tournament\/[^/]+$/);
    const id = /tournament\/([^/?]+)/.exec(page.url())?.[1];

    // Cockpit: Spiel 1 ist Waging 1 gegen Fridolfing
    await page.goto(`/#/tournament/${id}/live`);
    await expect(page.getByText('Waging 1').first()).toBeVisible();
    await expect(page.getByText('Fridolfing').first()).toBeVisible();
    await expect(page.getByTestId('scoreboard-box-links')).toHaveAttribute('data-color', '#1565C0');
    await expect(page.getByTestId('scoreboard-box-rechts')).toHaveAttribute('data-color', '#1565C0');
    await expect(page.getByText('Gleiche Trikotfarbe')).toBeVisible();
  });

  test('ungültige Farbangabe: Klartext mit Team und Angabe, keine Vorschau, nichts gespeichert', async ({ page }) => {
    const datei = JSON.parse(readFileSync(path.join(FIXTURES, 'd.json'), 'utf8')) as { teams: Array<{ colors?: { primary: string } }> };
    datei.teams[2].colors = { primary: 'blau' };
    await importiere(page, { name: 'd-blau.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(datei)) });

    await expect(page.getByTestId('import-error')).toHaveText('Team „Kammer“: „blau“ ist keine gültige Farbangabe (erwartet wird z. B. #1565C0)');
    await expect(page.getByTestId('import-warnings-continue')).toHaveCount(0);
    await expect(page.getByTestId('import-confirm')).toHaveCount(0);
  });
});
