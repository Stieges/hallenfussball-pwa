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
const ENTWURF_TEAM = '00000004-0000-4000-8000-000000000001';
const NUR_ERSTES_LADEN = { nurErstesLaden: true }; // sonst schreibt die Saat nach jedem Neuladen ihren Stand zurück

type GespeicherteFarbe = { gefunden: boolean; colors: { primary: string } | undefined };

/** Liest die Teamfarbe aus dem lokalen Speicher der App (IndexedDB `hallenfussball`/`cache`/`tournaments`), nicht aus der Oberfläche. */
async function gespeicherteFarbe(page: Page, turnierId: string, teamId: string): Promise<GespeicherteFarbe> {
  return page.evaluate(([tid, teamId2]) => new Promise<GespeicherteFarbe>((resolve, reject) => {
    const anfrage = indexedDB.open('hallenfussball');
    anfrage.onerror = () => reject(new Error('IndexedDB nicht lesbar'));
    anfrage.onsuccess = () => {
      const get = anfrage.result.transaction('cache', 'readonly').objectStore('cache').get('tournaments');
      get.onerror = () => reject(new Error('Eintrag nicht lesbar'));
      get.onsuccess = () => {
        const liste = (get.result?.value ?? []) as Array<{ id: string; teams: Array<{ id: string; colors?: { primary: string } }> }>;
        const team = liste.find((t) => t.id === tid)?.teams.find((x) => x.id === teamId2);
        resolve({ gefunden: team !== undefined, colors: team?.colors });
      };
    };
  }), [turnierId, teamId] as const);
}


async function bild(page: Page, name: string) {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${name}.png`), fullPage: false });
}

test.describe('@W3-042 Trikotfarbe wieder auf „Unbekannt“', () => {
  test('Reiter Teams: Schwarz bleibt nach dem Neuladen (Gegenprobe), „Unbekannt“ auch, im Speicher fehlt colors', async ({ page }) => {
    await installiereSaat(page.context(), leseSaat('hallencup-messlauf'), NUR_ERSTES_LADEN);
    await page.goto('/#/tournament/hallencup-messlauf/teams');
    const karte = page.getByTestId(`team-card-${TEAM}`);
    const ausloeser = karte.locator('button[aria-haspopup="true"]');
    await page.getByTestId(`team-expand-toggle-${TEAM}`).getByRole('button').click();

    await ausloeser.click();
    await page.getByRole('option', { name: 'Schwarz' }).click();
    await expect(page.getByTestId(`team-color-dot-${TEAM}`)).toHaveAttribute('data-accent', '#000000');
    await expect.poll(async () => (await gespeicherteFarbe(page, 'hallencup-messlauf', TEAM)).colors?.primary).toBe('#000000');
    // Gegenprobe: Neuladen behält die Farbe (zeigt, dass die Saat nicht zurückschreibt und der Test das Neuladen wirklich prüft)
    await neuLaden(page);
    await expect(page.getByTestId(`team-color-dot-${TEAM}`)).toHaveAttribute('data-accent', '#000000');

    await page.getByTestId(`team-expand-toggle-${TEAM}`).getByRole('button').click();
    await ausloeser.click();
    await bild(page, 'ablauf-farbauswahl-offen');
    const unbekannt = page.getByRole('option', { name: 'Trikotfarbe unbekannt' });
    expect((await unbekannt.boundingBox())?.height ?? 0, 'Touch ≥ 44 px').toBeGreaterThanOrEqual(44);
    await unbekannt.click();

    const punkt = page.getByTestId(`team-color-dot-${TEAM}`);
    await expect(punkt).toHaveAttribute('data-shirt-unknown', 'true');
    await expect(punkt).toHaveAccessibleName('Trikotfarbe unbekannt');
    await expect(ausloeser).toContainText('Unbekannt');
    // vor dem Neuladen: im lokalen Speicher fehlt die Farbe
    await expect.poll(async () => await gespeicherteFarbe(page, 'hallencup-messlauf', TEAM)).toEqual({ gefunden: true, colors: undefined });

    await neuLaden(page);
    await expect(page.getByTestId(`team-color-dot-${TEAM}`)).toHaveAttribute('data-shirt-unknown', 'true');
    expect(await gespeicherteFarbe(page, 'hallencup-messlauf', TEAM)).toEqual({ gefunden: true, colors: undefined });
  });

  test('Wizard, Schritt Teams: Schwarz bleibt nach Weiter und Neuladen (Gegenprobe), „Unbekannt“ auch, im Speicher fehlt colors', async ({ page }) => {
    await installiereSaat(page.context(), leseSaat('hallencup-messlauf'), NUR_ERSTES_LADEN);
    await page.goto('/#/tournament/hallencup-entwurf/edit?step=5');
    await page.getByRole('button', { name: /Farbe & Logo/ }).first().click();
    const ausloeser = page.locator('button[aria-haspopup="true"]').first();
    await ausloeser.click();
    await page.getByRole('option', { name: 'Farbe #000000' }).click();
    await expect(ausloeser).toContainText('#000000');

    // Gegenprobe: Weiter speichert den Entwurf, nach dem Neuladen steht Schwarz noch da
    await page.getByRole('button', { name: /^Weiter/ }).click();
    await expect(page).toHaveURL(/step=6/);
    await expect.poll(async () => (await gespeicherteFarbe(page, 'hallencup-entwurf', ENTWURF_TEAM)).colors?.primary).toBe('#000000');
    await page.goto('/#/tournament/hallencup-entwurf/edit?step=5');
    await neuLaden(page);
    await page.getByRole('button', { name: /Farbe & Logo/ }).first().click();
    await expect(page.locator('button[aria-haspopup="true"]').first()).toContainText('#000000');

    await page.locator('button[aria-haspopup="true"]').first().click();
    await bild(page, 'ablauf-wizard-farbauswahl-offen');
    await page.getByRole('option', { name: 'Trikotfarbe unbekannt' }).click();
    const unbekannt = page.locator('button[aria-haspopup="true"]').first();
    await expect(unbekannt).toHaveAccessibleName('Trikotfarbe unbekannt');
    await expect(unbekannt).toContainText('Unbekannt');
    expect(await unbekannt.getByTestId('color-picker-unknown-dot').evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('repeating-linear-gradient');

    await page.getByRole('button', { name: /^Weiter/ }).click();
    await expect(page).toHaveURL(/step=6/);
    await expect.poll(async () => await gespeicherteFarbe(page, 'hallencup-entwurf', ENTWURF_TEAM)).toEqual({ gefunden: true, colors: undefined });
    await page.goto('/#/tournament/hallencup-entwurf/edit?step=5');
    await neuLaden(page);
    await page.getByRole('button', { name: /Farbe & Logo/ }).first().click();
    const wieder = page.locator('button[aria-haspopup="true"]').first();
    await expect(wieder).toHaveAccessibleName('Trikotfarbe unbekannt');
    await expect(wieder).not.toContainText('#000000');
  });
});
