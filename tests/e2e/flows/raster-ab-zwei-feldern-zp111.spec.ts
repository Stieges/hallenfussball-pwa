/**
 * E2E (G3-N, Regel T2-UI): @ZP-111 Der Umschalter „Tabelle | Grid“ und die Rasteransicht gibt es nur ab 1280 Bildpunkten Breite
 * UND ab zwei Feldern; sonst nur die Liste. Wird das Fenster schmaler, während das Raster gezeigt wird, wechselt der Spielplan auf
 * die Liste. Offline (Gast = Turnierleitung, Wegwerf-Turnier im lokalen Speicher), ohne Datenbank.
 * Die Liste erkennt man an der Filterzeile (`schedule-filter-bar`, nur in der Liste), das Raster an ihrem Fehlen.
 */
import { test, expect } from '../helpers/test-fixtures';
import { cup, ID } from '../helpers/laptopCup';

const umschalter = (page: import('@playwright/test').Page) => page.getByTestId('schedule-view-grid');
const liste = (page: import('@playwright/test').Page) => page.getByTestId('schedule-filter-bar');

test.describe('@ZP-111 Raster nur ab 1280 Bildpunkten und ab zwei Feldern', () => {
  async function oeffne(page: import('@playwright/test').Page, seedIndexedDB: (d: Record<string, unknown>) => Promise<void>, felder: number, breite: number, hoehe: number) {
    await seedIndexedDB({ tournaments: [cup({ felder })] });
    await page.setViewportSize({ width: breite, height: hoehe });
    await page.goto(`/#/tournament/${ID}/schedule`);
    await expect(liste(page)).toBeVisible({ timeout: 15_000 });
  }

  test('zwei Felder, 1280×720: der Umschalter ist da und zeigt das Raster', async ({ page, seedIndexedDB }) => {
    await oeffne(page, seedIndexedDB, 2, 1280, 720);
    await expect(umschalter(page)).toBeVisible();
    await expect(page.getByTestId('schedule-view-table')).toBeVisible();
    await umschalter(page).click();
    await expect(liste(page)).toHaveCount(0);
  });

  for (const [name, breite, hoehe] of [['Tablet quer 1024×768', 1024, 768], ['1279×720', 1279, 720], ['Handy 390×844', 390, 844]] as const) {
    test(`zwei Felder, ${name}: kein Umschalter, die Liste`, async ({ page, seedIndexedDB }) => {
      await oeffne(page, seedIndexedDB, 2, breite, hoehe);
      await expect(umschalter(page)).toHaveCount(0);
      await expect(page.getByTestId('schedule-view-table')).toHaveCount(0);
    });
  }

  test('ein Feld, Laptop 1440×900: kein Umschalter, die Liste', async ({ page, seedIndexedDB }) => {
    await oeffne(page, seedIndexedDB, 1, 1440, 900);
    await expect(umschalter(page)).toHaveCount(0);
    await expect(liste(page)).toBeVisible();
  });

  test('Verkleinern im Raster (1280 → 1024): der Spielplan wechselt auf die Liste, der Umschalter verschwindet', async ({ page, seedIndexedDB }) => {
    await oeffne(page, seedIndexedDB, 2, 1280, 720);
    await umschalter(page).click();
    await expect(liste(page)).toHaveCount(0);
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(liste(page)).toBeVisible();
    await expect(umschalter(page)).toHaveCount(0);
  });
});
