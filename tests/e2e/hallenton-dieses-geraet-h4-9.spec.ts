/**
 * H4-9 (@HT-001, @HT-002, @HT-015, @HT-043, @HT-056): „Dieses Gerät“ im Unterpunkt „Hallenton“ am Prüfstand
 * tests/e2e/harness/hallenton-dieses-geraet.html (echte Seitenleiste, echte Seitenansicht mit dem echten Abschnitt, Daten von Hand), bei
 * 360×640 und 1280×720, hell und dunkel. Fälle: leer (Einrichtung mit Schritten), eingerichtet (Fußleiste „Ton aktivieren“), bereit,
 * Ablösen-Rückfrage, abgelöst, Anleitung, zweites Turnier (ohne Mockup). Je Fall: die Wortlaute des Records stehen da, nichts läuft über,
 * jede Taste ≥ 44 px (Haupttaste ≥ 56), kein HART-Befund der Messung von `npm run visual:metrics`.
 * Bilder: Ordner aus H49_BILDER (sonst Testausgabe). Läuft nur im Projekt `desktop` am Dev-Server (setzt das Fenster selbst).
 */
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { GERAETE, hartBefunde, speichereBild } from './helpers/hallentonPruefstand';

const bild = (page: Page, outputDir: string, name: string): Promise<void> => speichereBild(page, outputDir, 'H49_BILDER', name);

const FAELLE = ['leer', 'eingerichtet', 'bereit', 'abloesen', 'abgeloest', 'anleitung', 'wechseln'] as const;
type Fall = (typeof FAELLE)[number];

async function pruefeWortlaute(page: Page, fall: Fall): Promise<void> {
  switch (fall) {
    case 'leer': {
      const titel = await page.getByTestId('hallenton-einrichtung').getByRole('heading', { level: 3 }).allTextContents();
      expect(titel.length, '@HT-043 vier Schritte').toBe(4);
      ['App installieren', 'Schalter einschalten', 'Ton aktivieren', 'Testton in der Halle'].forEach((erwartet, i) => expect(titel[i], `@HT-043 Schritt ${i + 1}`).toContain(erwartet));
      await expect(page.getByRole('switch', { name: 'Dieses Gerät ist Hallen-Lautsprecher für Feld …' })).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByTestId('hallenton-fussleiste')).toHaveCount(0);
      await expect(page.getByTestId('hallenton-anleitung')).toBeVisible();
      break;
    }
    case 'eingerichtet': {
      const taste = page.getByTestId('ton-aktivieren');
      await expect(taste).toHaveText('Ton aktivieren');
      expect((await taste.boundingBox())?.height ?? 0, 'Haupttaste ≥ 56 px').toBeGreaterThanOrEqual(56);
      await expect(page.locator('[data-primary]')).toHaveCount(1);
      await expect(page.getByTestId('geraet-banner-tonNichtAktiv')).toContainText('Grund: Ton nicht aktiviert'); // H4-10: großer Zustand statt des kleinen Banners
      break;
    }
    case 'bereit':
      await expect(page.getByTestId('geraet-banner-bereit')).toContainText('Lautsprecher bereit');
      await expect(page.getByTestId('geraet-banner-bereit')).toContainText('Feld 1 · Laptop Turnierleitung');
      await expect(page.getByTestId('hallenton-fussleiste')).toHaveCount(0);
      break;
    case 'abloesen':
      await expect(page.getByText('Feld 1 hat schon einen Hallen-Lautsprecher (Hallenmonitor Halle). Ablösen?')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ablösen' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Abbrechen' })).toBeVisible();
      break;
    case 'abgeloest':
      await expect(page.getByTestId('geraet-banner-uebernommen')).toContainText('Feld 1 von einem anderen Gerät übernommen');
      await expect(page.getByTestId('geraet-banner-uebernommen')).toContainText('Hallenmonitor Halle gibt jetzt den Ton für Feld 1');
      await expect(page.getByRole('button', { name: /zurückholen|wieder übernehmen/i }), '@HT-015 kein Knopf zum Zurückholen').toHaveCount(0);
      break;
    case 'anleitung':
      await page.getByTestId('hallenton-anleitung').getByRole('button').first().click();
      await expect(page.getByTestId('anleitung-chrome')).toContainText('Diese Websites immer aktiv lassen');
      await expect(page.getByTestId('anleitung-einstellung-text')).toHaveText('chrome://settings/performance');
      await expect(page.getByTestId('anleitung-app-text')).toHaveText('hallenfussball-pwa.vercel.app');
      break;
    case 'wechseln':
      await expect(page.getByText('Dieses Gerät ist schon Hallen-Lautsprecher für ‚Hallencup Süd‘. Wechseln?')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Wechseln' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Abbrechen' })).toBeVisible();
      break;
  }
}

test.describe('@HT-001 @HT-002 @HT-015 @HT-043 @HT-056 H4-9 „Dieses Gerät“ (Prüfstand)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstand nur am Dev-Server (im gebauten Stand nicht vorhanden)');
  });

  for (const fall of FAELLE) {
    for (const g of GERAETE) {
      for (const thema of ['light', 'dark'] as const) {
        test(`@HT-043 ${fall} ${g.name}, ${thema}: Wortlaute, Tasten ≥ 44 px, nichts läuft über`, async ({ page }, testInfo) => {
          await page.setViewportSize({ width: g.width, height: g.height });
          await page.emulateMedia({ colorScheme: thema });
          await page.goto(`/tests/e2e/harness/hallenton-dieses-geraet.html?fall=${fall}`);
          await expect(page.getByTestId('hallenton-seite')).toBeVisible();
          await pruefeWortlaute(page, fall);
          for (const k of await page.locator('[data-testid="hallenton-seite"] button').all()) {
            const box = await k.boundingBox();
            expect(box?.height ?? 0, `Taste ${await k.textContent()}`).toBeGreaterThanOrEqual(44);
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'kein waagerechtes Scrollen').toBe(true);
          const ueberlauf = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="hallenton-seite"] *')).filter((el) => el.scrollWidth - el.clientWidth > 1).map((el) => el.textContent));
          expect(ueberlauf, 'kein Überlauf').toEqual([]);
          if (fall === 'eingerichtet') {
            // die feste Fußleiste liegt am unteren Fensterrand und verdeckt keinen Inhalt der Seite
            const leiste = await page.getByTestId('hallenton-fussleiste').boundingBox();
            expect(Math.round((leiste?.y ?? 0) + (leiste?.height ?? 0)), 'Fußleiste am unteren Rand').toBe(g.height);
          }
          await page.evaluate(() => window.scrollTo(0, 0)); // die Anleitung öffnen scrollt die längere Seite (Regler seit H4-10); gemessen wird vom Seitenanfang
          await page.waitForTimeout(400);
          for (const b of await hartBefunde(page, g.art)) {
            testInfo.annotations.push({ type: 'befund-gesamt', description: b });
          }
          await page.addStyleTag({ content: 'aside { visibility: hidden; }' });
          expect(await hartBefunde(page, g.art), 'kein HART-Befund der visuellen Messung (Seite ohne Seitenleiste)').toEqual([]);
          await page.addStyleTag({ content: 'aside { visibility: visible; }' });
          await bild(page, testInfo.outputDir, `h4-9-${fall}-${g.name}-${thema}`);
        });
      }
    }
  }
});
