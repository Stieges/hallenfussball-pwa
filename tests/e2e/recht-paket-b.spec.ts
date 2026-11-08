/**
 * Paket B Recht – @RE-001 (Einstieg frei, Impressum und Datenschutz überall), @RE-003 (keine fremden Server).
 * Offline-Server (kein Supabase), Saat `hallencup-messlauf` (Zuschauer-Seite /live/MESS26, Verwaltung, Wizard).
 * Geräte: Handy 360×640 und 390×844, Desktop 1280×720. Läuft nur im Projekt `desktop` (setzt das Fenster selbst).
 * Bilder (optional): Ordner aus RECHT_B_BILDER.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../scripts/visual-metrics/saat/lader.mjs';
import { neuLaden } from './helpers/neuLaden';

const BILDER = process.env.RECHT_B_BILDER;
const TURNIER = 'hallencup-messlauf';

const GERAETE = [
  { name: 'handy-360', width: 360, height: 640 },
  { name: 'handy-390', width: 390, height: 844 },
  { name: 'desktop-1280', width: 1280, height: 720 },
] as const;

/** Seiten mit Fußzeile: Zuschauer, Helfer-Einstieg, Anmeldung, Registrierung, Einstellungen, Verwaltung (Übersicht, Turnier, Wizard). */
const FUSS = { impressum: 'footer-impressum-link', datenschutz: 'footer-datenschutz-link', dialog: false };
/** Anmeldung und Registrierung SIND Dialoge (sie verdecken die Fußzeile): dort stehen die Links im Dialog selbst. */
const IM_DIALOG = { impressum: 'auth-impressum-link', datenschutz: 'auth-datenschutz-link', dialog: true };
const SEITEN = [
  { id: 'zuschauer', route: `/#/live/MESS26`, einstieg: '[data-testid^="final-card-"]', ...FUSS },
  { id: 'helfer-einstieg', route: '/#/join/ABCD2345', einstieg: 'main, body', ...FUSS },
  { id: 'anmeldung', route: '/#/login', einstieg: '[data-testid="login-email-input"]', ...IM_DIALOG },
  { id: 'registrierung', route: '/#/register', einstieg: 'form', ...IM_DIALOG },
  { id: 'einstellungen', route: '/#/settings', einstieg: '[data-testid="settings-error-reports-toggle"]', ...FUSS },
  { id: 'verwaltung-uebersicht', route: '/#/', einstieg: 'main, body', ...FUSS },
  { id: 'verwaltung-spielplan', route: `/#/tournament/${TURNIER}/schedule`, einstieg: 'main, body', ...FUSS },
  { id: 'verwaltung-wizard', route: `/#/tournament/${TURNIER}/edit?step=1`, einstieg: '[role="tab"]', ...FUSS },
] as const;

async function oeffne(page: Page, g: { width: number; height: number }, route: string) {
  await page.setViewportSize({ width: g.width, height: g.height });
  await installiereSaat(page.context(), leseSaat(TURNIER));
  // Echter erster Besuch: die Saat bringt einen alten Einwilligungs-Eintrag mit, der früher den Dialog verhindert hätte
  await page.addInitScript(() => { try { window.localStorage.removeItem('app:consent'); } catch { /* gesperrt */ } });
  await page.goto(route);
}

async function bild(page: Page, name: string) {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${name}.png`), fullPage: false });
}

/** Ein Element ist nicht verdeckt: an seiner Mitte liegt es selbst (oder ein Teil davon) obenauf. */
async function istOben(page: Page, selektor: string | Locator): Promise<boolean> {
  const stelle = typeof selektor === 'string' ? page.locator(selektor).first() : selektor;
  return stelle.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return oben !== null && (el === oben || el.contains(oben));
  });
}

test.describe('@RE-001 Einstieg frei, Impressum und Datenschutz überall', () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt Fenster selbst)');
  });

  for (const g of GERAETE) {
    test(`@RE-001 Zuschauer-Seite beim ersten Besuch, ${g.name}: kein Dialog, Spielplan sofort sichtbar, Fuß mit beiden Links`, async ({ page }) => {
      await oeffne(page, g, '/#/live/MESS26');
      const erste = page.getByRole('heading', { name: 'Teilnehmer' });
      await expect(erste).toBeVisible({ timeout: 25000 });
      await expect(page.locator('[role="dialog"], [aria-modal="true"]')).toHaveCount(0);
      expect(await page.evaluate(() => window.localStorage.getItem('app:consent'))).toBeNull();
      // Mittig scrollen: „sichtbar im Fenster“ schließt die fest stehende Tab-Leiste am unteren Rand ein (erlaubtes Randelement)
      await erste.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      expect(await istOben(page, erste), 'nichts liegt über dem Spielplan').toBe(true);
      await bild(page, `zuschauer-erster-besuch-${g.name}`);

      const impressum = page.getByTestId('footer-impressum-link');
      const datenschutz = page.getByTestId('footer-datenschutz-link');
      await impressum.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await expect(impressum).toBeVisible();
      await expect(datenschutz).toBeVisible();
      expect(await istOben(page, '[data-testid="footer-impressum-link"]'), 'Link „Impressum“ ist nicht verdeckt').toBe(true);
      expect(await istOben(page, '[data-testid="footer-datenschutz-link"]'), 'Link „Datenschutz“ ist nicht verdeckt').toBe(true);
      const box = await impressum.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      await bild(page, `zuschauer-fuss-${g.name}`);
    });
  }

  for (const seite of SEITEN) {
    for (const g of GERAETE) {
      test(`@RE-001 ${seite.id}, ${g.name}: keine Einwilligungsabfrage über dem Einstieg, Impressum und Datenschutz ohne Anmeldung erreichbar`, async ({ page }) => {
        await oeffne(page, g, seite.route);
        await expect(page.locator(seite.einstieg).first()).toBeAttached({ timeout: 25000 });
        // Außer Anmeldung/Registrierung (die Seite selbst ist ein Dialog) liegt nie ein Dialog über der Seite
        await expect(page.locator('[role="dialog"], [aria-modal="true"]')).toHaveCount(seite.dialog ? 1 : 0);
        if (seite.dialog) {
          await expect(page.locator('[role="dialog"] input').first()).toBeVisible();
        }

        const impressum = page.getByTestId(seite.impressum);
        await impressum.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await expect(impressum).toBeVisible();
        await expect(page.getByTestId(seite.datenschutz)).toBeVisible();

        await impressum.click();
        await expect(page).toHaveURL(/#\/impressum$/);
        await expect(page.getByRole('heading', { level: 1, name: 'Impressum' })).toBeVisible();
        await page.goBack();

        const datenschutz = page.getByTestId(seite.datenschutz);
        await datenschutz.scrollIntoViewIfNeeded();
        await datenschutz.click();
        await expect(page).toHaveURL(/#\/datenschutz$/);
        await expect(page.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' })).toBeVisible();
      });
    }
  }

  test('@RE-001 Gegenbeispiel: Monitor/Kiosk bleibt ohne Fußzeile und ohne Dialog', async ({ page }) => {
    await oeffne(page, { width: 1280, height: 720 }, `/#/display/${TURNIER}/monitor-1`);
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('footer-impressum-link')).toHaveCount(0);
    await expect(page.getByTestId('footer-datenschutz-link')).toHaveCount(0);
    await expect(page.locator('[role="dialog"], [aria-modal="true"]')).toHaveCount(0);
  });

  for (const g of GERAETE) {
    test(`@RE-001 Impressum und Datenschutz selbst, ${g.name}: Text vollständig lesbar, keine waagrechte Rollleiste`, async ({ page }) => {
      for (const [route, titel, name] of [['/#/impressum', 'Impressum', 'impressum'], ['/#/datenschutz', 'Datenschutzerklärung', 'datenschutz']] as const) {
        await oeffne(page, g, route);
        await expect(page.getByRole('heading', { level: 1, name: titel })).toBeVisible({ timeout: 25000 });
        await expect(page.getByTestId('legal-stand')).toHaveText('Stand: November 2026');
        const breite = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, fenster: window.innerWidth }));
        expect(breite.scroll, `${name}: keine waagrechte Rollleiste`).toBeLessThanOrEqual(breite.fenster);
        await bild(page, `${name}-${g.name}`);
      }
    });
  }
});

test.describe('@RE-002 Einstellungen: Schalter „Fehlerberichte senden“', () => {
  test('Vorbelegung an, ausschalten bleibt nach Neuladen aus', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt Fenster selbst)');
    await oeffne(page, GERAETE[0], '/#/settings');
    const schalter = page.getByTestId('settings-error-reports-toggle');
    await expect(schalter).toHaveAttribute('aria-checked', 'true', { timeout: 25000 });
    await schalter.scrollIntoViewIfNeeded();
    await bild(page, 'einstellungen-schalter-an-handy-360');
    await schalter.click();
    await expect(schalter).toHaveAttribute('aria-checked', 'false');
    await neuLaden(page);
    await expect(page.getByTestId('settings-error-reports-toggle')).toHaveAttribute('aria-checked', 'false');
    await page.getByTestId('settings-error-reports-toggle').scrollIntoViewIfNeeded();
    await bild(page, 'einstellungen-schalter-aus-handy-360');
  });
});

test.describe('@RE-003 Keine fremden Server', () => {
  const ERLAUBT_ALS_PROTOKOLL = new Set(['data:', 'blob:', 'about:']);

  for (const seite of [{ id: 'dashboard', route: '/#/' }, { id: 'zuschauer', route: '/#/live/MESS26' }, { id: 'helfer-einstieg', route: '/#/join/ABCD2345' }, { id: 'anmeldung', route: '/#/login' }, { id: 'impressum', route: '/#/impressum' }, { id: 'datenschutz', route: '/#/datenschutz' }, { id: 'monitor', route: `/#/display/${TURNIER}/mon-live` }, { id: 'wizard', route: `/#/tournament/${TURNIER}/edit?step=1` }, { id: 'einstellungen', route: '/#/settings' }]) {
    test(`@RE-003 ${seite.id}: Anfragen gehen nur an die App selbst (Datenbank und Fehlerbericht-Dienst gibt es offline nicht)`, async ({ page, baseURL }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt Fenster selbst)');
      const eigene = new URL(baseURL ?? 'http://localhost:3000').origin;
      const fremde: string[] = [];
      page.on('request', (anfrage) => {
        const url = new URL(anfrage.url());
        if (ERLAUBT_ALS_PROTOKOLL.has(url.protocol)) { return; }
        if (url.origin !== eigene) { fremde.push(anfrage.url()); }
      });
      await oeffne(page, GERAETE[0], seite.route);
      await page.waitForLoadState('networkidle');
      // die Anzeigeschrift wird nur geladen, wenn sie gebraucht wird: erzwingen, damit eine fremde Schriftquelle auffiele
      const schrift = await page.evaluate(async () => {
        const geladen = await document.fonts.load('16px "Bebas Neue"');
        return geladen.length;
      });
      expect(schrift, 'Bebas Neue ist als Schrift der App vorhanden').toBeGreaterThan(0);
      await page.waitForLoadState('networkidle');
      expect(fremde, `Anfragen an fremde Herkunft (${seite.id})`).toEqual([]);
    });
  }

  test('@RE-002 aus der Datenschutzerklärung führt „Einstellungen der App“ ohne Anmeldung zum Schalter', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt Fenster selbst)');
    await oeffne(page, GERAETE[0], '/#/datenschutz');
    await page.getByTestId('datenschutz-einstellungen-link').click();
    await expect(page).toHaveURL(/#\/settings$/);
    await expect(page.getByTestId('settings-error-reports-toggle')).toBeVisible();
  });

  test('@RE-003 die Anzeigeschrift kommt als Datei von der App selbst', async ({ page, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt Fenster selbst)');
    const schriftAnfragen: string[] = [];
    page.on('request', (anfrage) => { if (/\.(woff2?|ttf|otf)(\?|$)/.test(anfrage.url())) { schriftAnfragen.push(anfrage.url()); } });
    await oeffne(page, GERAETE[0], '/#/');
    await page.evaluate(() => document.fonts.load('16px "Bebas Neue"'));
    await page.waitForLoadState('networkidle');
    const eigene = new URL(baseURL ?? 'http://localhost:3000').origin;
    expect(schriftAnfragen.some((u) => /bebas/i.test(u)), 'Bebas-Neue-Datei wurde geladen').toBe(true);
    expect(schriftAnfragen.every((u) => new URL(u).origin === eigene), 'alle Schriftdateien von der eigenen Herkunft').toBe(true);
  });
});
