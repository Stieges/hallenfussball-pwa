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

  // @OB-021: Die Startseite ist auf jedem Gerät der Geräteliste (ab 360 Bildpunkten Breite) ohne waagerechtes
  // Scrollen bedienbar. Vorher schob die Kopfzeile (Titel + Offline-Marke + Konto-Knopf) die Seite bei 360 px auf 395 px.
  test('Startseite ohne waagerechtes Scrollen (@OB-021)', async ({ page }) => {
    await page.goto('/#/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('dashboard-import-trigger')).toBeVisible();
    const breiten = await page.evaluate(() => ({
      inhalt: document.documentElement.scrollWidth,
      sichtbar: document.documentElement.clientWidth,
    }));
    expect(breiten.inhalt, `Inhalt ${breiten.inhalt} px breiter als ${breiten.sichtbar} px`).toBeLessThanOrEqual(breiten.sichtbar);

    // Daniel 16.10.: Titel einzeilig und ohne Silbentrennung, vollständig sichtbar (Gegenbeispiel: hyphens:auto → zwei Zeilen)
    const titel = await page.locator('h1').first().evaluate((h1) => {
      const bereich = document.createRange();
      bereich.selectNodeContents(h1);
      const zeilen = new Set(Array.from(bereich.getClientRects()).map((r) => Math.round(r.top)));
      const rechts = h1.getBoundingClientRect().right;
      return {
        zeilen: zeilen.size,
        abgeschnitten: h1.scrollWidth > h1.clientWidth + 1,
        rechts,
        text: h1.textContent ?? '',
      };
    });
    expect(titel.zeilen, `Titel „${titel.text}“ einzeilig`).toBe(1);
    expect(titel.abgeschnitten, 'Titel nicht abgeschnitten').toBe(false);
    const marke = page.getByTestId('auth-offline-badge');
    if (await marke.isVisible()) {
      const kasten = await marke.boundingBox();
      expect(kasten?.width ?? 0, 'Offline-Marke ≥ 44 px').toBeGreaterThanOrEqual(44);
      expect(kasten?.height ?? 0, 'Offline-Marke ≥ 44 px').toBeGreaterThanOrEqual(44);
      expect(titel.rechts, 'Titel überlappt die Marke nicht').toBeLessThanOrEqual((kasten?.x ?? 0) + 0.5);
    }
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
