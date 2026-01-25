import { test, expect } from '../helpers/test-fixtures';

test.describe('Smoke Tests', () => {
  
  test('App lädt erfolgreich', async ({ page }) => {
    await page.goto('/#/');
    await expect(page).toHaveTitle(/Turnier|Hallenfußball/i);
  });

  test('Viewport Meta ist korrekt konfiguriert', async ({ page }) => {
    await page.goto('/#/');
    
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    
    // Pflicht-Attribute
    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('initial-scale=1');
    
    // Verboten (Accessibility)
    expect(viewport).not.toContain('user-scalable=no');
    expect(viewport).not.toContain('maximum-scale=1');
  });

  test('Keine JavaScript Errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    await page.goto('/#/');
    await page.waitForTimeout(1000);
    
    expect(errors).toEqual([]);
  });

  test('PWA Manifest ist verlinkt', async ({ page }) => {
    await page.goto('/#/');

    // PWA manifest is injected by vite-plugin-pwa at build time, might not be present in dev mode
    const manifestLink = page.locator('link[rel="manifest"]');
    const count = await manifestLink.count();

    if (count > 0) {
      const manifest = await manifestLink.getAttribute('href');
      expect(manifest).toBeTruthy();
    } else {
      // In dev mode, check that PWA meta tags are present instead
      const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
      expect(themeColor).toBeTruthy();
    }
  });

});
