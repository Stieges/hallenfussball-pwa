import { test, expect } from '../helpers/test-fixtures';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility (WCAG AA)', () => {

  test('Homepage hat keine kritischen A11y Violations', async ({ page }) => {
    await page.goto('/#/');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    // Nur kritische und ernste Violations als Fehler
    const critical = results.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(critical).toEqual([]);
  });

  test('Alle Bilder haben alt-Text', async ({ page }) => {
    await page.goto('/#/');

    const images = await page.locator('img').all();

    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');

      // Entweder alt-Text oder role="presentation"
      const hasAlt = alt !== null && alt !== '';
      const isDecorative = role === 'presentation' || role === 'none';

      expect(hasAlt || isDecorative).toBe(true);
    }
  });

  test('Fokus ist sichtbar', async ({ page }) => {
    await page.goto('/#/');

    // Tab zum ersten fokussierbaren Element
    await page.keyboard.press('Tab');

    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) { return null; }
      const style = window.getComputedStyle(el);
      return {
        outline: style.outline,
        boxShadow: style.boxShadow,
      };
    });

    // Fokus sollte sichtbar sein (outline oder box-shadow)
    /* eslint-disable @typescript-eslint/prefer-nullish-coalescing -- Boolean OR: true if any focus indicator exists */
    const hasFocusIndicator =
      (focusedElement?.outline && focusedElement.outline !== 'none') ||
      (focusedElement?.boxShadow && focusedElement.boxShadow !== 'none');
    /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */

    expect(hasFocusIndicator).toBe(true);
  });

  test('Escape schließt Dialoge', async ({ page }) => {
    await page.goto('/#/');

    // Suche nach einem Button der einen Dialog öffnet
    const dialogTrigger = page.locator('[data-testid*="dialog"], [aria-haspopup="dialog"]').first();

    if (await dialogTrigger.isVisible()) {
      await dialogTrigger.click();
      await page.waitForTimeout(300);

      // Dialog sollte offen sein
      const dialog = page.locator('[role="dialog"], [aria-modal="true"]').first();
      if (await dialog.isVisible()) {
        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible();
      }
    }
  });

});
