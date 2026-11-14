/**
 * Zuschauer-Seite vor dem Versand der Spielpläne: @ZM-209 (vor dem Anpfiff kein Stand), @ZM-210 (Wann und Wo, Einzelheiten zuklappbar),
 * @RE-005 („Zurück“ auf Impressum/Datenschutz bleibt in der App). Saat: `helpers/leibchenSaat.ts` (Turnierdatum hier auf den 28.11.2026 gesetzt).
 * Bilder: SONNTAG_BILDER=<Ordner> (Vorsatz SONNTAG_PHASE, Vorgabe „nachher“); warten auf fertige Animationen, nie auf feste Zeiten.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';
import { animationenFertig } from '../helpers/animationenFertig';
import { neuLaden } from '../helpers/neuLaden';
import { LEIBCHEN_SHARE_CODE, leibchenSaat, type Szene } from '../helpers/leibchenSaat';

const BILDER = process.env.SONNTAG_BILDER;
const PHASE = process.env.SONNTAG_PHASE ?? 'nachher';
const LANGER_ORT = 'Dreifachsporthalle am Schulzentrum Waging am See';

test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });

interface SaatTurnier { date: string; startDate: string; location: unknown; organizer?: string; title: string }

/** Saat der Leibchen-Anzeige als Turnier in zwei Wochen (28.11.2026) mit Ort und Veranstalter. */
function saat(szene: Szene, ort = 'Sporthalle Waging'): unknown {
  const s = leibchenSaat(szene) as { datenbanken: Array<{ eintraege: { tournaments: SaatTurnier[] } }> };
  const t = s.datenbanken[0].eintraege.tournaments[0];
  Object.assign(t, {
    date: '2026-11-28', startDate: '2026-11-28', title: 'Nikolaus-Turnier', ageClass: 'D-Junioren', groupPhaseGameDuration: 9, organizer: 'TSV Waging',
    location: { name: ort, street: 'Mozartstraße 9', postalCode: '83329', city: 'Waging am See' },
  });
  return s;
}

async function oeffne(page: Page, szene: Szene, groesse = { width: 390, height: 664 }, ort?: string, dunkel = false): Promise<void> {
  await page.setViewportSize(groesse);
  await page.emulateMedia({ colorScheme: dunkel ? 'dark' : 'light', reducedMotion: 'reduce' });
  await installiereSaat(page.context(), saat(szene, ort));
  await page.goto(`/#/live/${LEIBCHEN_SHARE_CODE}`);
  await expect(page.getByTestId('public-head-when-where')).toBeVisible({ timeout: 25000 });
  await animationenFertig(page);
}

async function bild(page: Page, name: string): Promise<void> {
  if (!BILDER) { return; }
  await animationenFertig(page);
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${PHASE}-${name}.png`), fullPage: false });
}

const kopf = (page: Page) => page.getByTestId('public-current');
const einzelheiten = (page: Page) => page.getByTestId('public-head-details');

test.describe('@ZM-209 Vor dem Anpfiff zeigt die Zuschauer-Seite keinen Stand', () => {
  test('keine Leibchen bestätigt: „–“ bei beiden Teams in Karte und Spielplan, keine Kästen, kein „0 : 0“', async ({ page }) => {
    await oeffne(page, 'vor-gleiche-farbe');
    await expect(kopf(page).getByTestId(/^match-goals-kopf-.*-home$/)).toHaveText('–');
    await expect(kopf(page).getByTestId(/^match-goals-kopf-.*-away$/)).toHaveText('–');
    await expect(page.getByTestId(/^match-box-/)).toHaveCount(0);
    await bild(page, 'zm209-vor-anpfiff');
  });

  test('Ausnahme: Leibchen bestätigt – Kästen mit Weste und „0“ bleiben (Karte und Spielplan)', async ({ page }) => {
    await oeffne(page, 'vor-leibchen');
    await expect(kopf(page).getByTestId(/^match-box-kopf-.*-away-bib$/)).toBeVisible();
    await expect(kopf(page).getByTestId(/^match-box-kopf-.*-home-digits$/)).toHaveText('0');
    await expect(page.locator('.mobile-view').getByTestId(/^match-box-.*-away-bib$/)).toBeVisible();
    await bild(page, 'zm209-leibchen-bestaetigt');
  });

  test('Gegenbeispiel: das laufende Spiel zeigt weiter Kästen mit Stand', async ({ page }) => {
    await oeffne(page, 'laeuft');
    await expect(kopf(page).getByTestId(/^match-box-kopf-.*-home$/)).toBeVisible();
    await expect(kopf(page).getByTestId(/^match-box-kopf-.*-home-digits$/)).toHaveText('1');
    await bild(page, 'zm209-laeuft');
  });
});

test.describe('@ZM-210 Wann und Wo im Kopf, Einzelheiten zuklappbar', () => {
  test('erster Besuch vor dem Anpfiff: Zeile mit Pfeil (≥ 44 px), Einzelheiten aufgeklappt', async ({ page }) => {
    await oeffne(page, 'vor-gleiche-farbe');
    const taste = page.getByTestId('public-head-when-where');
    await expect(taste).toContainText('Sa, 28.11. · ab 08:40 Uhr · Sporthalle Waging');
    await expect(taste).toHaveAttribute('aria-expanded', 'true');
    expect((await taste.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect(einzelheiten(page)).toBeVisible();
    await expect(page.getByTestId('public-head-duration')).toContainText('9 Minuten je Spiel');
    await expect(page.getByTestId('public-head-teams')).toContainText('6 Teams');
    await bild(page, 'zm210-aufgeklappt');
  });

  test('erstes Spiel angepfiffen: zugeklappt, die Zeile bleibt sichtbar; eigene Wahl überlebt das Neuladen', async ({ page }) => {
    await oeffne(page, 'laeuft');
    const taste = page.getByTestId('public-head-when-where');
    await expect(taste).toHaveAttribute('aria-expanded', 'false');
    await expect(taste).toBeVisible();
    await expect(einzelheiten(page)).toBeHidden();
    await bild(page, 'zm210-zugeklappt');
    await taste.click();
    await expect(einzelheiten(page)).toBeVisible();
    await neuLaden(page);
    await expect(taste).toBeVisible({ timeout: 25000 });
    await expect(taste).toHaveAttribute('aria-expanded', 'true');
  });

  test('Petra klappt vor dem Anpfiff zu und öffnet neu: zugeklappt', async ({ page }) => {
    await oeffne(page, 'vor-gleiche-farbe');
    await page.getByTestId('public-head-when-where').click();
    await expect(einzelheiten(page)).toBeHidden();
    await neuLaden(page);
    await expect(page.getByTestId('public-head-when-where')).toHaveAttribute('aria-expanded', 'false', { timeout: 25000 });
  });

  test('langer Ortsname bricht um, ohne „…“ und ohne waagrechtes Scrollen (360×640)', async ({ page }) => {
    await oeffne(page, 'vor-gleiche-farbe', { width: 360, height: 640 }, LANGER_ORT);
    const m = await page.getByTestId('public-head-when-where').evaluate((el) => {
      const s = getComputedStyle(el.firstElementChild!);
      return { ellipsis: s.textOverflow === 'ellipsis', rechts: el.getBoundingClientRect().right, seite: document.documentElement.scrollWidth };
    });
    expect(m.ellipsis).toBe(false);
    expect(m.rechts).toBeLessThanOrEqual(360);
    expect(m.seite).toBeLessThanOrEqual(360);
    await expect(page.getByTestId('public-head-when-where')).toContainText(LANGER_ORT);
    await bild(page, 'zm210-langer-ort');
  });

  test('Höhe des Kopfes aufgeklappt gegenüber zugeklappt bei 360×640 (Messung für @ZM-196)', async ({ page }) => {
    await oeffne(page, 'laeuft', { width: 360, height: 640 });
    const hoehe = () => page.getByTestId('public-head-when-where').evaluate((el) => el.parentElement!.getBoundingClientRect().height);
    const zu = await hoehe();
    await page.getByTestId('public-head-when-where').click();
    const auf = await hoehe();
    test.info().annotations.push({ type: 'kopfhoehe', description: `zugeklappt ${String(Math.round(zu))} px, aufgeklappt ${String(Math.round(auf))} px` });
    expect(auf).toBeGreaterThan(zu);
  });
});

test.describe('@RE-005 „Zurück“ auf Datenschutz und Impressum bleibt in der App', () => {
  for (const seite of [{ pfad: 'datenschutz', link: 'footer-datenschutz-link' }, { pfad: 'impressum', link: 'footer-impressum-link' }]) {
    test(`${seite.pfad}: vom Reiter „Info“ aus – Zurück führt wieder in den Reiter „Info“`, async ({ page }) => {
      await oeffne(page, 'laeuft');
      await page.locator('nav[aria-label="Public Navigation"] button').nth(2).click();
      await expect(page.getByRole('radiogroup')).toBeVisible();
      const url = page.url();
      await page.getByTestId(seite.link).scrollIntoViewIfNeeded();
      await page.getByTestId(seite.link).click();
      await expect(page).toHaveURL(new RegExp(`#/${seite.pfad}$`));
      await page.getByTestId('legal-back-button').click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole('radiogroup')).toBeVisible();
    });

    test(`${seite.pfad}: direkt geöffnet – Zurück öffnet die Startseite, verlässt die App nicht`, async ({ page }) => {
      await page.goto(`/#/${seite.pfad}`);
      await page.getByTestId('legal-back-button').click();
      await expect(page).toHaveURL(/\/#\/$/);
      expect(new URL(page.url()).origin).toBe(new URL(page.context().pages()[0]?.url() ?? page.url()).origin);
      await expect(page.getByTestId('legal-back-button')).toHaveCount(0);
    });
  }

  test('die Taste „Zurück“ ist am Ende der langen Seite ohne Hochscrollen im Bild und erreichbar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 664 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#/datenschutz');
    const taste = page.getByTestId('legal-back-button');
    await expect(taste).toBeVisible({ timeout: 25000 });
    await bild(page, 're005-datenschutz-oben');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(500);
    const r = await taste.boundingBox();
    expect(r?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect(r?.height ?? 0).toBeGreaterThanOrEqual(44);
    await bild(page, 're005-datenschutz-ende');
    await taste.click();
    await expect(page).toHaveURL(/\/#\/$/);
  });
});
