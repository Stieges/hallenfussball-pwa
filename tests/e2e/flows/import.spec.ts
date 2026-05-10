/**
 * E2E Tests für Tournament Import Flow (HP-1 Task B)
 *
 * Testet den Import-Dialog vom Dashboard aus:
 * - Happy Path: gültige JSON-Datei → Preview → Import → Navigation
 * - Error Path: ungültige JSON-Datei → Fehleranzeige
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { test, expect } from '../helpers/test-fixtures';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

test.describe('Tournament Import Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/');
    await page.waitForLoadState('networkidle');
  });

  test('Happy Path: Gültige JSON-Datei importieren', async ({ page }) => {
    // Dialog öffnen
    await page.locator('[data-testid="dashboard-import-trigger"]').click();

    // Hidden file input mit Fixture befüllen
    const fileInput = page.locator('[data-testid="import-file-input"]');
    await fileInput.setInputFiles(path.join(FIXTURES_DIR, 'sample-tournament.json'));

    // Warnings-Step: Der Importer hängt immer eine EXTERNAL_IMPORT-Info-Warning an,
    // also läuft jeder valide Import durch diesen Step.
    await expect(page.locator('[data-testid="import-warnings-continue"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="import-warnings-continue"]').click();

    // Preview-Step
    await expect(page.locator('[data-testid="import-confirm"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="import-confirm"]').click();

    // Success-Step → Navigation
    await expect(page.locator('[data-testid="import-success-go"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="import-success-go"]').click();

    // App routet zu /tournament/{id}/edit?step=2 für Imports ohne matches
    await expect(page).toHaveURL(/\/tournament\/[^/]+\/edit\?step=2/, { timeout: 10000 });
  });

  test('Error Path: Korruptes JSON zeigt Fehlermeldung', async ({ page }) => {
    await page.locator('[data-testid="dashboard-import-trigger"]').click();

    const fileInput = page.locator('[data-testid="import-file-input"]');
    await fileInput.setInputFiles(path.join(FIXTURES_DIR, 'corrupt-tournament.json'));

    // Error-Element wird sichtbar; Dialog bleibt im select-Step
    await expect(page.locator('[data-testid="import-error"]')).toBeVisible({ timeout: 5000 });

    // Preview-Button darf NICHT erscheinen
    await expect(page.locator('[data-testid="import-confirm"]')).toHaveCount(0);
  });
});
