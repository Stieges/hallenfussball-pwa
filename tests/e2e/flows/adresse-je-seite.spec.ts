/**
 * Paket RT „Adresse je Seite“ – @OB-029 (Direktaufruf), @OB-030 (Neu laden), @OB-031 (Zurück).
 * Gastmodus auf der Saat `hallencup-messlauf` (kein Server, kein Konto): Spielplan der Turnierleitung
 * gefiltert auf Gruppe B (`?g=B`) und Wizard-Schritt in der Adresse (`?step=3`, alle Schritte).
 * Läuft nur im Projekt `desktop` (setzt das Fenster selbst).
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const TURNIER = 'hallencup-messlauf';
const DESKTOP = { width: 1280, height: 900 };

async function oeffne(page: Page, route: string) {
  await page.setViewportSize(DESKTOP);
  await installiereSaat(page.context(), leseSaat(TURNIER));
  await page.goto(route);
}

test.describe('@OB-029 Direktaufruf: Spielplan der Turnierleitung', () => {
  test('@OB-029 ?g=B öffnet den Spielplan gefiltert auf Gruppe B, die Adresse bleibt', async ({ page }) => {
    await oeffne(page, `/#/tournament/${TURNIER}/schedule?g=B`);
    await expect(page.locator('[data-testid="filter-group"]')).toHaveValue('B', { timeout: 25000 });
    await expect(page.locator('[data-testid="filter-phase"]')).toBeVisible();
    expect(page.url()).toContain('g=B');
  });

  test('@OB-030 Neu laden behält Gruppe und Feld', async ({ page }) => {
    await oeffne(page, `/#/tournament/${TURNIER}/schedule?g=B`);
    await expect(page.locator('[data-testid="filter-group"]')).toHaveValue('B', { timeout: 25000 });
    await page.locator('[data-testid="filter-field"]').selectOption('2');
    await expect.poll(() => page.url()).toContain('f=2');
    await page.reload();
    await expect(page.locator('[data-testid="filter-group"]')).toHaveValue('B', { timeout: 25000 });
    await expect(page.locator('[data-testid="filter-field"]')).toHaveValue('2');
  });

  test('Zurück stellt den vorigen Filter wieder her (Verlauf der Filter)', async ({ page }) => {
    await oeffne(page, `/#/tournament/${TURNIER}/schedule`);
    await expect(page.locator('[data-testid="filter-group"]')).toBeVisible({ timeout: 25000 });
    await page.locator('[data-testid="filter-group"]').selectOption('A');
    await page.locator('[data-testid="filter-group"]').selectOption('B');
    await expect.poll(() => page.url()).toContain('g=B');
    await page.goBack();
    await expect(page.locator('[data-testid="filter-group"]')).toHaveValue('A');
  });

  test('@OB-029 Gegenbeispiel: unbekannte Gruppe wird ignoriert, der Spielplan öffnet ungefiltert', async ({ page }) => {
    await oeffne(page, `/#/tournament/${TURNIER}/schedule?g=ZZ&f=abc`);
    await expect(page.locator('[data-testid="filter-group"]')).toHaveValue('', { timeout: 25000 });
    await expect(page.locator('[data-testid="filter-field"]')).toHaveValue('');
  });
});

test.describe('@OB-029 Direktaufruf: Wizard-Schritt', () => {
  for (const schritt of [1, 2, 3, 4, 5, 6]) {
    test(`@OB-029 ?step=${schritt} öffnet Schritt ${schritt}`, async ({ page }) => {
      await oeffne(page, `/#/tournament/${TURNIER}/edit?step=${schritt}`);
      const reiter = page.locator('[role="tab"]');
      await expect(reiter.nth(schritt - 1)).toHaveAttribute('aria-current', 'step', { timeout: 25000 });
      expect(page.url()).toContain(schritt === 1 ? '/edit' : `step=${schritt}`);
    });
  }

  test('@OB-029 Weiter schreibt den Schritt in die Adresse, Neu laden bleibt auf dem Schritt (@OB-030)', async ({ page }) => {
    await oeffne(page, `/#/tournament/${TURNIER}/edit?step=2`);
    await expect(page.locator('[role="tab"]').nth(1)).toHaveAttribute('aria-current', 'step', { timeout: 25000 });
    await page.getByRole('button', { name: /^weiter/i }).click();
    await expect.poll(() => page.url()).toContain('step=3');
    await page.reload();
    await expect(page.locator('[role="tab"]').nth(2)).toHaveAttribute('aria-current', 'step', { timeout: 25000 });
  });
});

// Projektregel „kein Geister-Bildschirm“: Zurück führt Seite für Seite über die besuchten Seiten.
test.describe('@OB-031 Zurück-Taste über die besuchten Seiten', () => {
  test('@OB-031 Startseite, Spielplan, Tabellen, Admin Center, dreimal Zurück: Tabellen, Spielplan, Startseite, keine unbesuchte Seite', async ({ page }) => {
    await oeffne(page, '/#/');
    await page.locator(`[data-testid="tournament-card-${TURNIER}"]`).click({ timeout: 25000 });
    await expect(page.locator('[data-testid="filter-group"]')).toBeVisible({ timeout: 25000 });
    const spielplan = new RegExp(`/tournament/${TURNIER}(/schedule)?$`);
    expect(page.url()).toMatch(spielplan);
    await page.getByRole('button', { name: 'Tabellen', exact: true }).click();
    await expect.poll(() => page.url()).toContain(`/tournament/${TURNIER}/standings`);
    await page.getByRole('button', { name: /Admin Center/i }).click();
    await expect.poll(() => page.url()).toContain(`/tournament/${TURNIER}/admin`);

    await page.goBack();
    await expect.poll(() => page.url()).toContain(`/tournament/${TURNIER}/standings`);
    await page.goBack();
    await expect.poll(() => page.url()).toMatch(spielplan);
    await expect(page.locator('[data-testid="filter-group"]')).toBeVisible();
    await page.goBack();
    await expect.poll(() => new URL(page.url()).hash).toMatch(/^#?\/?$/);
  });
});
