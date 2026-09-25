/**
 * Visual Regression: Login-Screen (Task T5)
 * Siehe dashboard.visual.spec.ts für die allgemeine Erklärung (Container-Pflicht, Ruling Y).
 *
 * Direkter Deep-Link auf /#/login (src/core/routing/routeRegistry.ts, App.tsx:565) -- ohne den
 * Mobile-Bottom-Sheet/Desktop-Button-Umweg aus tests/e2e/flows/auth.spec.ts#navigateToLogin, der
 * nur existiert, weil der Login-Screen im normalen Flow von der Dashboard-Seite aus geöffnet
 * wird; die Route selbst rendert ihn direkt.
 */

import { test, expect } from '../helpers/test-fixtures';
import { freezeClock, commonMasks } from './helpers';

test('Login-Screen', async ({ page }) => {
  await freezeClock(page);

  await page.goto('/#/login');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-testid="login-email-input"]')).toBeVisible({ timeout: 10000 });

  await expect(page).toHaveScreenshot('login.png', {
    fullPage: true,
    mask: commonMasks(page),
  });
});
