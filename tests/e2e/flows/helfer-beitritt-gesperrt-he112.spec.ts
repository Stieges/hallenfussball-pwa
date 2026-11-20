/**
 * @HE-112 Beitritt ohne Konto nicht freigeschaltet (`2026-09-24_helfer-am-turniertag.md`).
 * Ohne Datenbank: eigene Vorschau der App mit Scheinadresse für den Server (Netz-Stub, 127.0.0.1, nie Produktion); die
 * Antwort auf `/auth/v1/signup` ist nachgestellt. Läuft nur im Projekt `desktop`, die Größe setzt der Test selbst (390×844).
 * Bilder (hell/dunkel) nur mit gesetztem HE112_BILDER.
 */
import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen
import { starteApp } from '../../../scripts/visual-metrics/app-server.mjs';
// @ts-expect-error – .mjs ohne Typen
import { STUB_URL, installiereStub } from '../../../scripts/visual-metrics/stub.mjs';

const BILDER = process.env.HE112_BILDER;
const MELDUNG = 'Beitritt ohne Konto ist gerade nicht freigeschaltet. Bitte der Turnierleitung Bescheid sagen.';
const INFO = { json: { state: 'open', relation: 'none', tournament: { id: 't-cup', title: 'Live-Cup', date: '2026-11-28' }, shareCode: 'SHARE1' } };

interface App { basisUrl: string; stop: () => Promise<void> }
let app: App;

test.describe('@HE-112 Beitritt ohne Konto (Netz-Stub)', () => {
  test.describe.configure({ mode: 'serial' });
  // eslint-disable-next-line no-empty-pattern -- Playwright verlangt für den ersten Parameter ein Destrukturierungsmuster
  test.beforeAll(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'eigene Größe; nur im Projekt desktop');
    test.setTimeout(300_000);
    app = await starteApp({ stubUrl: STUB_URL, log: () => undefined });
  });
  test.afterAll(async () => { await app?.stop(); });
  test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

  for (const code of ['anonymous_provider_disabled', 'signup_disabled']) {
    for (const schema of ['light', 'dark'] as const) {
      test(`@HE-112 Server antwortet ${code} → Meldung, keine Taste „Erneut versuchen“ (${schema})`, async ({ page, context }) => {
        await page.emulateMedia({ colorScheme: schema });
        await installiereStub(context, { name: 'he112', zustand: { einwilligung: true, signup: `fehler:${code}`, rpc: { join_code_info: INFO } } });
        const anfragen: string[] = [];
        page.on('request', (r) => { if (r.url().includes('request_helper_access')) { anfragen.push(r.url()); } });
        await page.goto(`${app.basisUrl}/#/join/CODE123456`);
        await page.getByTestId('join-name').fill('Tom');
        await page.getByTestId('join-submit').click();
        await expect(page.getByTestId('join-anonymous-disabled')).toContainText(MELDUNG, { timeout: 20000 });
        await expect(page.getByTestId('join-retry')).toHaveCount(0);
        expect(anfragen).toEqual([]);
        if (BILDER && code === 'anonymous_provider_disabled') {
          mkdirSync(BILDER, { recursive: true });
          await page.screenshot({ path: `${BILDER}/he112-beitritt-gesperrt-390-${schema}.png` });
        }
      });
    }
  }

  for (const code of ['anonymous_provider_disabled', 'signup_disabled']) {
    test(`@HE-112 aktuelles Server-Format (code im Körper, Kopfzeile x-supabase-api-version): ${code} → Meldung, keine Taste „Erneut versuchen“`, async ({ page, context }) => {
      await installiereStub(context, { name: 'he112', zustand: { einwilligung: true, signup: `fehler-neu:${code}`, rpc: { join_code_info: INFO } } });
      const anfragen: string[] = [];
      page.on('request', (r) => { if (r.url().includes('request_helper_access')) { anfragen.push(r.url()); } });
      await page.goto(`${app.basisUrl}/#/join/CODE123456`);
      await page.getByTestId('join-name').fill('Tom');
      await page.getByTestId('join-submit').click();
      await expect(page.getByTestId('join-anonymous-disabled')).toContainText(MELDUNG, { timeout: 20000 });
      await expect(page.getByTestId('join-retry')).toHaveCount(0);
      expect(anfragen).toEqual([]);
    });
  }

  test('@HE-112 Bild bei 360×640 (hell)', async ({ page, context }) => {
    test.skip(!BILDER, 'Bild nur mit HE112_BILDER');
    await page.setViewportSize({ width: 360, height: 640 });
    await page.emulateMedia({ colorScheme: 'light' });
    await installiereStub(context, { name: 'he112', zustand: { einwilligung: true, signup: 'fehler:anonymous_provider_disabled', rpc: { join_code_info: INFO } } });
    await page.goto(`${app.basisUrl}/#/join/CODE123456`);
    await page.getByTestId('join-name').fill('Tom');
    await page.getByTestId('join-submit').click();
    await expect(page.getByTestId('join-anonymous-disabled')).toContainText(MELDUNG, { timeout: 20000 });
    mkdirSync(BILDER ?? '.', { recursive: true });
    await page.screenshot({ path: `${BILDER}/he112-beitritt-gesperrt-360-light.png` });
  });

  test('@HE-112 Gegenbeispiel: Netzfehler bei der Anmeldung → Netz-Meldung mit „Erneut versuchen“', async ({ page, context }) => {
    await installiereStub(context, { name: 'he112', zustand: { einwilligung: true, signup: 'netz', rpc: { join_code_info: INFO } } });
    await page.goto(`${app.basisUrl}/#/join/CODE123456`);
    await page.getByTestId('join-name').fill('Tom');
    await page.getByTestId('join-submit').click();
    await expect(page.getByTestId('join-offline')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('join-retry')).toBeVisible();
    await expect(page.getByTestId('join-anonymous-disabled')).toHaveCount(0);
  });
});
