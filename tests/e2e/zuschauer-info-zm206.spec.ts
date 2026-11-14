/**
 * @ZM-206 Die Info-Seite der Zuschauer-Seite zeigt nichts Technisches („Share-Code“) und nutzt die Symbole der App statt Emoji; jeder Text der Auswahl der Darstellung,
 * auch „(aktuell: Hell)“, hat mindestens 4,5 : 1 Kontrast, hell wie dunkel. Läuft in jedem Profil mit dessen Fenster. Saat: `helpers/messlaufTaching.ts`.
 */
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat } from '../../scripts/visual-metrics/saat/lader.mjs';
import { messSaat, ZUSCHAUER_CODE } from './helpers/messlaufTaching';
import { kontrastVon } from './helpers/kontrast';
import { animationenFertig } from './helpers/animationenFertig';

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}☀🔄🌙◐]/u;

async function oeffneInfo(page: Page, thema: 'light' | 'dark'): Promise<void> {
  await page.emulateMedia({ colorScheme: thema, reducedMotion: 'reduce' });
  await installiereSaat(page.context(), messSaat());
  await page.goto(`/#/live/${ZUSCHAUER_CODE}`);
  await expect(page.getByText('SG Taching/Tengling').filter({ visible: true }).first()).toBeVisible({ timeout: 25000 });
  await page.locator('nav[aria-label="Public Navigation"] button').nth(2).click();
  await expect(page.getByRole('radiogroup')).toBeVisible();
  await animationenFertig(page);
}

test.describe('@ZM-206 Info-Seite der Zuschauer-Seite', () => {
  test('@ZM-206 kein „Share-Code“ und keine technische Kennung auf der Seite', async ({ page }) => {
    await oeffneInfo(page, 'light');
    const text = await page.locator('main, body').first().innerText();
    expect(text).not.toMatch(/share|code/i);
    expect(text).not.toContain(ZUSCHAUER_CODE);
    await expect(page.getByText('Hallencup Messlauf').first()).toBeVisible();
  });

  test('@ZM-206 die Auswahl der Darstellung zeigt Symbole der App (SVG), keine Emoji', async ({ page }) => {
    await oeffneInfo(page, 'light');
    const auswahl = page.getByRole('radio');
    await expect(auswahl).toHaveCount(4);
    for (const eintrag of await auswahl.all()) {
      await expect(eintrag.locator('svg')).toHaveCount(1);
      expect(await eintrag.innerText()).not.toMatch(EMOJI);
    }
  });

  for (const thema of ['light', 'dark'] as const) {
    test(`@ZM-206 jeder Text der Auswahl, auch „(aktuell: …)“, hat mindestens 4,5 : 1, ${thema === 'dark' ? 'dunkel' : 'hell'}`, async ({ page }) => {
      await oeffneInfo(page, thema);
      const zusatz = page.getByText(/aktuell:/).first();
      await expect(zusatz).toBeVisible();
      expect(await kontrastVon(zusatz)).toBeGreaterThanOrEqual(4.5);
      const ergebnis = await new AxeBuilder({ page }).include('[role="radiogroup"]').withRules(['color-contrast']).analyze();
      const werte = ergebnis.violations.flatMap((v) => v.nodes).map((n) => n.any.map((a) => (a.data as { contrastRatio?: number }).contrastRatio));
      expect(ergebnis.violations, `axe color-contrast ${JSON.stringify(werte)}`).toEqual([]);
    });
  }
});
