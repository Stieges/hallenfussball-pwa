/**
 * @ZM-198 Tabelle der Zuschauer-Seite vor dem ersten beendeten Spiel: „–“ statt sechsmal „1“ ·
 * @ZM-205 Tabelle am Handy (360 Pixel): „Sp.“ in der Zeile, Aufklapp-Symbol der App statt „▶“ mit Vorlesetext und mindestens 44 Pixeln Tippfläche, Tordifferenz mit mindestens
 * 4,5 : 1 Kontrast (hell wie dunkel); nichts läuft über, auch nicht mit dem 50-Zeichen-Namen der Saat.
 * Läuft in jedem Profil mit dessen Fenster: bis 768 Pixel gilt die Handy-Tabelle, darüber die breite Tabelle mit allen Spalten. Saat: `helpers/messlaufTaching.ts`.
 */
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../scripts/visual-metrics/saat/lader.mjs';
import { messSaat, ZUSCHAUER_CODE } from './helpers/messlaufTaching';
import { seitenUeberlauf } from './helpers/wortbruch';
import { kontrastVon } from './helpers/kontrast';
import { animationenFertig } from './helpers/animationenFertig';

const MIN_KONTRAST = 4.5;

async function oeffneTabelle(page: Page, thema: 'light' | 'dark', vorErstemSpiel = false, kurzeNamen = false): Promise<boolean> {
  await page.emulateMedia({ colorScheme: thema, reducedMotion: 'reduce' });
  await installiereSaat(page.context(), kurzeNamen ? leseSaat('hallencup-messlauf') : messSaat({ vorErstemSpiel }));
  await page.goto(`/#/live/${kurzeNamen ? 'PHASES' : ZUSCHAUER_CODE}`);
  await expect(page.locator('nav[aria-label="Public Navigation"]')).toBeVisible({ timeout: 25000 });
  await expect(page.locator('[data-teamname]').filter({ visible: true }).first()).toBeVisible();
  await page.locator('nav[aria-label="Public Navigation"] button').nth(1).click();
  await expect(page.locator('.standings-table').first()).toBeVisible();
  await animationenFertig(page);
  return page.locator('.mobile-view').first().isVisible();
}

/** Platzziffern der sichtbaren Tabellen, je Zeile die erste Zelle. */
async function plaetze(page: Page, handy: boolean): Promise<string[]> {
  const wurzel = handy ? '.mobile-view' : '.desktop-view';
  return page.locator(`.standings-table ${wurzel} tbody tr`).evaluateAll((zeilen) => zeilen
    .filter((tr) => tr.querySelectorAll('td').length > 1)
    .map((tr) => tr.querySelector('td')?.textContent?.trim() ?? ''));
}

test.describe('@ZM-198 Tabelle der Zuschauer-Seite ohne Platz vor dem ersten beendeten Spiel', () => {
  test('@ZM-198 kein Spiel beendet: bei allen Teams „–“, nirgends „1“ als Platz', async ({ page }) => {
    const handy = await oeffneTabelle(page, 'light', true);
    const liste = await plaetze(page, handy);
    expect(liste.length).toBe(8);
    expect(liste.every((p) => p === '–'), `Plätze: ${liste.join(' ')}`).toBe(true);
  });

  test('@ZM-198 Gegenbeispiel: mitten im Turnier stehen die Plätze nach der Wertung da, kein „–“', async ({ page }) => {
    const handy = await oeffneTabelle(page, 'light', false);
    const liste = await plaetze(page, handy);
    expect(liste).not.toContain('–');
    expect(liste).toContain('1');
  });
});

test.describe('@ZM-205 Tabelle der Zuschauer-Seite am Handy', () => {
  test('@ZM-205 Platz, Name, „Sp.“, „Diff.“ und „Pkt.“ stehen in der Zeile, ohne dass etwas überläuft (auch mit dem 50-Zeichen-Namen: die Seite läuft nie über, die Tabelle scrollt höchstens in ihrem Kasten, kein Wort wird zerrissen, @ZM-088)', async ({ page }) => {
    const handy = await oeffneTabelle(page, 'light');
    test.skip(!handy, 'die Handy-Tabelle gilt bis 768 Pixel Breite');
    const kopf = await page.locator('.standings-table .mobile-view thead tr').first().locator('th [aria-hidden="true"]').allTextContents();
    expect(kopf).toEqual(['#', 'Sp.', 'Diff.', 'Pkt.']);
    expect(await seitenUeberlauf(page), 'kein waagerechtes Scrollen der Seite').toBe(0);
    const aufgeklappt = await page.locator('.standings-table .mobile-view tbody td').filter({ hasText: /Siege|Unentschieden|Niederlagen/ }).count();
    expect(aufgeklappt, 'Siege, Unentschieden, Niederlagen und Tore stehen erst im aufgeklappten Bereich').toBe(0);
  });

  test('@ZM-205 mit kurzen Namen scrollt keine Tabelle im Kasten, die Spalte „Sp.“ und die Taste passen in 360 Pixel', async ({ page }) => {
    const handy = await oeffneTabelle(page, 'light', false, true);
    test.skip(!handy, 'die Handy-Tabelle gilt bis 768 Pixel Breite');
    const ueberlauf = await page.locator('.standings-table .mobile-view').evaluateAll((l) => l.filter((el) => el.scrollWidth > el.clientWidth + 1).length);
    expect(ueberlauf, 'keine Tabelle scrollt im Kasten').toBe(0);
    expect(await seitenUeberlauf(page)).toBe(0);
  });

  test('@ZM-205 Aufklapp-Symbol der App statt „▶“: Vorlesetext „Details zu … anzeigen“, Tippfläche mindestens 44 Pixel, öffnet die Details', async ({ page }) => {
    const handy = await oeffneTabelle(page, 'light');
    test.skip(!handy, 'die Handy-Tabelle gilt bis 768 Pixel Breite');
    const taste = page.locator('.standings-table .mobile-view tbody button').first();
    await expect(taste).toHaveAttribute('aria-label', /^Details zu .+ anzeigen$/);
    await expect(taste).toHaveAttribute('aria-expanded', 'false');
    await expect(taste.locator('svg')).toHaveCount(1);
    const kasten = await taste.boundingBox();
    expect(kasten?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(kasten?.height ?? 0).toBeGreaterThanOrEqual(44);
    await taste.click();
    await expect(taste).toHaveAttribute('aria-expanded', 'true');
    await expect(taste).toHaveAttribute('aria-label', /^Details zu .+ ausblenden$/);
    await expect(page.locator('.standings-table .mobile-view').getByText('Siege').first()).toBeVisible();
    expect(await page.locator('.standings-table').first().innerText(), 'kein grünes Dreieck als Text').not.toMatch(/[▶▼▲►]/);
  });

  for (const thema of ['light', 'dark'] as const) {
    test(`@ZM-205 Tordifferenz „−3“ hat zum Hintergrund mindestens 4,5 : 1, ${thema === 'dark' ? 'dunkel' : 'hell'}`, async ({ page }) => {
      const handy = await oeffneTabelle(page, thema);
      test.skip(!handy, 'die Handy-Tabelle gilt bis 768 Pixel Breite');
      const negativ = page.locator('.standings-table .mobile-view tbody tr').locator('td:nth-child(4)').filter({ hasText: /^-\d/ });
      expect(await negativ.count(), 'die Saat hat Teams mit negativer Tordifferenz').toBeGreaterThan(0);
      for (const zelle of await negativ.all()) {
        const wert = await kontrastVon(zelle.locator('span').first());
        expect(wert, `Kontrast von „${await zelle.innerText()}“`).toBeGreaterThanOrEqual(MIN_KONTRAST);
      }
      const ergebnis = await new AxeBuilder({ page }).include('.standings-table .mobile-view').withRules(['color-contrast']).analyze();
      const werte = ergebnis.violations.flatMap((v) => v.nodes).map((n) => n.any.map((a) => (a.data as { contrastRatio?: number }).contrastRatio));
      expect(ergebnis.violations, `axe color-contrast ${JSON.stringify(werte)}`).toEqual([]);
    });
  }

  test('@ZM-205 Gegenbeispiel: auf Tablet und Laptop zeigt die breite Tabelle weiter alle Spalten und keine Aufklapp-Taste', async ({ page }) => {
    const handy = await oeffneTabelle(page, 'light');
    test.skip(handy, 'die breite Tabelle gilt ab 769 Pixel Breite');
    const kopf = await page.locator('.standings-table .desktop-view thead tr').first().locator('th [aria-hidden="true"]').allTextContents();
    expect(kopf).toEqual(['#', 'Sp.', 'S', 'U', 'N', 'Diff.', 'Pkt.']);
    await expect(page.locator('.standings-table .desktop-view button')).toHaveCount(0);
  });
});
