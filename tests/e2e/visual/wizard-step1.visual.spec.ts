/**
 * Visual Regression: Tournament Creation Wizard, Schritt 1 (Stammdaten) (Task T5)
 * Siehe dashboard.visual.spec.ts für die allgemeine Erklärung (Container-Pflicht, Ruling Y).
 */

import { test, expect } from '../helpers/test-fixtures';
import { t } from '../helpers/i18n';
import { freezeClock, commonMasks } from './helpers';

test('Wizard Schritt 1: Stammdaten (leer)', async ({ page }) => {
  await freezeClock(page);

  await page.goto('/#/tournament/new');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: t('wizard:step3.title') })).toBeVisible();

  await expect(page).toHaveScreenshot('wizard-step1.png', {
    fullPage: true,
    mask: commonMasks(page),
  });
});
