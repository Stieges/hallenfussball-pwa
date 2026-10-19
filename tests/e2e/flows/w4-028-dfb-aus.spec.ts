/**
 * @W4-028 – DFB-Schlüssel wird nicht angeboten, solange er nicht exakt umgesetzt ist.
 *
 * Gegeben die exakten DFB-Schlüssel (@W4-015) sind noch nicht umgesetzt,
 * wenn die Turnierleitung im Assistenten die Spielplan-Art wählt (Schritt Modus & Spielsystem),
 * dann sieht sie keinen DFB-Schalter.
 */

import { test, expect } from '../helpers/test-fixtures';
import { t } from '../helpers/i18n';

test.describe('@W4-028 DFB-Schlüssel im Schritt Modus & Spielsystem', () => {
  test('@W4-028 Schritt Modus/System zeigt keinen DFB-Schalter', async ({ page }) => {
    // GIVEN - Schritt 3 (Modus & Spielsystem) direkt per Deep-Link
    await page.goto('/#/tournament/new?step=3');
    await expect(page.getByRole('heading', { name: t('wizard:step2.title') })).toBeVisible();

    // THEN - kein DFB-Schalter und keine Musterauswahl sichtbar
    await expect(page.locator('#dfb-description')).toHaveCount(0);
    await expect(page.getByText(t('wizard:dfb.checkboxLabel'), { exact: true })).toHaveCount(0);
  });
});
