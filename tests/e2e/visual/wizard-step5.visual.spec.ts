/**
 * Visual Regression: Tournament Creation Wizard, Schritt 5 (Teams) (Task T5)
 * Siehe dashboard.visual.spec.ts für die allgemeine Erklärung (Container-Pflicht, Ruling Y).
 *
 * Direkter Deep-Link auf ?step=5 (wie tests/e2e/flows/wizard.spec.ts, "Step 5: Teams eingeben")
 * -- rendert den Step direkt ohne die vorherigen Steps durchzuklicken (F-321-Fix macht das
 * möglich, siehe wizard.spec.ts).
 */

import { test, expect } from '../helpers/test-fixtures';
import { freezeClock, commonMasks } from './helpers';

test('Wizard Schritt 5: Teams (leer)', async ({ page }) => {
  await freezeClock(page);

  await page.goto('/#/tournament/new?step=5');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/Teams|Team-Namen|Mannschaften/i).first()).toBeVisible({ timeout: 5000 });

  await expect(page).toHaveScreenshot('wizard-step5.png', {
    fullPage: true,
    mask: commonMasks(page),
  });
});
