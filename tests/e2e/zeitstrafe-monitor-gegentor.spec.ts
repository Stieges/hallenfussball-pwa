/**
 * Zeitstrafe endet beim Gegentor am Monitor im Browser (Befund C-ZEITSTRAFE-GEGENTOR-FEHLT) – über den Prüfstand
 * tests/e2e/harness/zeitstrafe-monitor.html (Server und Cloud fehlen offline; die Antwort des echten Servers prüft der Cloud-Test
 * monitor-zeitstrafe.cloud.spec.ts). Echte Live-Folie, Tokens, Texte, Monitor 1920×1080.
 * @ZM-192: das Tor von FC Nord beendet die Strafe von SV Süd, der Kreis verschwindet. @W2A-015: Regel aus → der Kreis bleibt.
 * @ZM-194: Live-Stand aus → kein Kreis. Bilder: Ordner aus ZSG_BILDER.
 */
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const BILDER = process.env.ZSG_BILDER ?? '';
// Der Prüfstand liegt nur am Dev-Server; der gebaute Stand der CI (CI_E2E_USE_PREVIEW) hat die Seite nicht (wie alle-tabellen-monitor.spec.ts)
const imGebautenStand = !!process.env.CI_E2E_USE_PREVIEW;
const kreise = '[data-testid="live-penalties-away"] [data-zeitstrafe]';

async function zeige(page: import('@playwright/test').Page, szene: string, bild?: string): Promise<void> {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/tests/e2e/harness/zeitstrafe-monitor.html?szene=${szene}`);
  await expect(page.getByTestId('live-block-away')).toBeVisible({ timeout: 15_000 });
  if (BILDER !== '' && bild !== undefined) {
    mkdirSync(BILDER, { recursive: true });
    await page.screenshot({ path: join(BILDER, `${bild}.png`) });
  }
}

test.describe('Zeitstrafe am Monitor endet beim Gegentor (@ZM-192, @W2A-015, @ZM-194)', () => {
  test.skip(imGebautenStand, 'Prüfstand nur am Dev-Server (gehört nicht in den Build)');

  test.beforeEach(async ({ browserName: _b }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Monitor 1920×1080: ein Projekt genügt');
  });

  test('@ZM-192 vor dem Tor: SV Süd hat einen Kreis mit „5“', async ({ page }) => {
    await zeige(page, 'vorGegentor', 'monitor-1080-vor-gegentor');
    await expect(page.locator(kreise)).toHaveCount(1);
    await expect(page.locator(kreise)).toHaveText('5');
  });

  test('@ZM-192 @W2A-013 nach dem Tor von FC Nord (gleiche Daten wie „vorher“): der Kreis ist weg', async ({ page }) => {
    await zeige(page, 'nachGegentor', 'monitor-1080-nach-gegentor');
    await expect(page.locator('[data-zeitstrafe]')).toHaveCount(0);
  });

  test('@W2A-015 Regel aus: nach dem Tor bleibt der Kreis', async ({ page }) => {
    await zeige(page, 'regelAus', 'monitor-1080-nach-gegentor-regel-aus');
    await expect(page.locator(kreise)).toHaveCount(1);
  });

  test('@ZM-194 Live-Stand aus: kein Kreis, obwohl die Strafe läuft', async ({ page }) => {
    await zeige(page, 'liveStandAus');
    await expect(page.locator('[data-zeitstrafe]')).toHaveCount(0);
  });
});
