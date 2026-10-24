/**
 * E2E: Altersklasse im Assistenten, Schritt „Stammdaten“ (Record Wizard-Regelprofile, Mockup Variante B2).
 * Szenarien: @W2B-010, @W2B-022, @W2B-023, @W2B-024, @W2B-025. Ohne Anmeldung, ohne Cloud.
 */
import { test, expect } from '../helpers/test-fixtures';
import { t } from '../helpers/i18n';

const TID = 'wizard-age-class';

test.describe('Altersklasse im Assistenten', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/tournament/new');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId(TID)).toBeVisible();
  });

  test('@W2B-022 startet leer, freiwillig beschriftet, Hinweis statt Vorschau', async ({ page }) => {
    await expect(page.getByText(t('wizard:ageClassPicker.label'))).toBeVisible();
    await expect(page.locator(`[data-testid="${TID}"] [aria-pressed="true"]`)).toHaveCount(0);
    await expect(page.getByTestId(`${TID}-preview`)).toContainText(t('wizard:ageClassPicker.previewEmpty'));
  });

  test('@W2B-010 @W2B-023 Jugend: E-Jugend mit Stufe 2 ergibt „E2-Jugend“, erneut antippen hebt die Stufe auf', async ({ page }) => {
    await page.getByTestId(`${TID}-chip-E-Jugend`).click();
    await expect(page.getByTestId(`${TID}-preview`)).toContainText('E-Jugend');
    await page.getByTestId(`${TID}-level-2`).click();
    await expect(page.getByTestId(`${TID}-preview`)).toContainText('E2-Jugend');
    await page.getByTestId(`${TID}-level-2`).click();
    await expect(page.getByTestId(`${TID}-preview`)).not.toContainText('E2-Jugend');
  });

  test('@W2B-024 U-Klassen: U11 bleibt U11, keine Stufe', async ({ page }) => {
    await page.getByTestId(`${TID}-group-uClasses`).click();
    await page.getByTestId(`${TID}-chip-U11`).click();
    await expect(page.getByTestId(`${TID}-preview`)).toContainText('U11');
    await expect(page.getByTestId(`${TID}-preview`)).not.toContainText('E-Jugend');
    await expect(page.getByTestId(`${TID}-level`)).toHaveCount(0);
  });

  test('@W2B-010 Erwachsene: Sonstiges erlaubt freien Text', async ({ page }) => {
    await page.getByTestId(`${TID}-group-adults`).click();
    await page.getByTestId(`${TID}-chip-custom`).click();
    await page.getByTestId(`${TID}-custom-input`).fill('Firmenteams');
    await expect(page.getByTestId(`${TID}-preview`)).toContainText('Firmenteams');
  });

  test('@W2B-025 die zuletzt genutzte Schreibweise ist beim nächsten Turnier vorgewählt, das Feld leer', async ({ page }) => {
    await page.getByTestId(`${TID}-group-uClasses`).click();
    await page.getByTestId(`${TID}-chip-U9`).click();
    await page.goto('about:blank');
    await page.goto('/#/tournament/new');
    await expect(page.getByTestId(TID)).toBeVisible();
    await expect(page.getByTestId(`${TID}-group-uClasses`)).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator(`[data-testid="${TID}"] [aria-pressed="true"]`)).toHaveCount(0);
  });
});
