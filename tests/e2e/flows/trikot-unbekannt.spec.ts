/**
 * @W3-042 Reiter „Teams“ des laufenden Turniers: eine eingetragene Trikotfarbe lässt sich wieder auf „Unbekannt“ stellen.
 * Saat `hallencup-messlauf`, nur lokal (nie gegen Produktion). Bilder nur mit TRIKOT_BILDER.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { neuLaden } from '../helpers/neuLaden';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const BILDER = process.env.TRIKOT_BILDER;
const TEAM = '00000001-0000-4000-8000-000000000001';

async function bild(page: Page, name: string) {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${name}.png`), fullPage: false });
}

test.describe('@W3-042 Trikotfarbe wieder auf „Unbekannt“ (Reiter Teams)', () => {
  test('Schwarz wählen, dann „Unbekannt“: Farbpunkt zeigt das Muster, nach dem Neuladen bleibt es', async ({ page }) => {
    await installiereSaat(page.context(), leseSaat('hallencup-messlauf'));
    await page.goto('/#/tournament/hallencup-messlauf/teams');
    const karte = page.getByTestId(`team-card-${TEAM}`);
    await page.getByTestId(`team-expand-toggle-${TEAM}`).getByRole('button').click();

    await karte.locator('button[aria-haspopup="true"]').click();
    await page.getByRole('option', { name: 'Schwarz' }).click();
    await expect(page.getByTestId(`team-color-dot-${TEAM}`)).toHaveAttribute('data-accent', '#000000');

    await karte.locator('button[aria-haspopup="true"]').click();
    await bild(page, 'ablauf-farbauswahl-offen');
    const unbekannt = page.getByRole('option', { name: 'Trikotfarbe unbekannt' });
    expect((await unbekannt.boundingBox())?.height ?? 0, 'Touch ≥ 44 px').toBeGreaterThanOrEqual(44);
    await unbekannt.click();

    const punkt = page.getByTestId(`team-color-dot-${TEAM}`);
    await expect(punkt).toHaveAttribute('data-shirt-unknown', 'true');
    await expect(punkt).toHaveAccessibleName('Trikotfarbe unbekannt');
    await expect(karte.locator('button[aria-haspopup="true"]')).toContainText('Unbekannt');

    await neuLaden(page);
    await expect(page.getByTestId(`team-color-dot-${TEAM}`)).toHaveAttribute('data-shirt-unknown', 'true');
  });

  test('Wizard, Schritt Teams: Schwarz wählen, dann „Unbekannt“; Weiter übernimmt keine Farbe (nach Neuladen aus dem gespeicherten Stand)', async ({ page }) => {
    await installiereSaat(page.context(), leseSaat('hallencup-messlauf'));
    await page.goto('/#/tournament/hallencup-entwurf/edit?step=5');
    await page.getByRole('button', { name: /Farbe & Logo/ }).first().click();
    const ausloeser = page.locator('button[aria-haspopup="true"]').first();
    await ausloeser.click();
    await page.getByRole('option', { name: 'Farbe #000000' }).click();
    await expect(ausloeser).toContainText('#000000');

    await ausloeser.click();
    await bild(page, 'ablauf-wizard-farbauswahl-offen');
    await page.getByRole('option', { name: 'Trikotfarbe unbekannt' }).click();
    await expect(ausloeser).toHaveAccessibleName('Trikotfarbe unbekannt');
    await expect(ausloeser).toContainText('Unbekannt');
    await expect(ausloeser.getByTestId('color-picker-unknown-dot')).toBeVisible();
    expect(await ausloeser.getByTestId('color-picker-unknown-dot').evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('repeating-linear-gradient');

    await page.getByRole('button', { name: /^Weiter/ }).click();
    await expect(page).toHaveURL(/step=6/);
    // Der Weiter-Schritt speichert den Entwurf; nach dem Neuladen aus dem gespeicherten Stand bleibt keine Farbe
    await page.goto('/#/tournament/hallencup-entwurf/edit?step=5');
    await neuLaden(page);
    await page.getByRole('button', { name: /Farbe & Logo/ }).first().click();
    const wieder = page.locator('button[aria-haspopup="true"]').first();
    await expect(wieder).toHaveAccessibleName('Trikotfarbe unbekannt');
    await expect(wieder).not.toContainText('#000000');
  });
});
