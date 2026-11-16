/**
 * @RZ-024 @RZ-026 @RZ-029 Zuschauer-Seite mit Kanal-Zusatz (ohne Datenbank, Profil „offline“: Saat im lokalen Speicher):
 * der Zusatz „k=…“ überlebt die Umleitung der kurzen Adresse, die Seite zeigt den Spielplan und der Zusatz steht danach nicht mehr in der
 * Adresszeile (andere Teile bleiben). Ohne Supabase tut die Zählung nichts – es verlässt kein Zählaufruf das Gerät; ein blockierter
 * Zählaufruf ändert nichts an der Seite. Das Senden selbst (Felder, Takt, Fehler) prüfen die Vitest-Tests und der Cloud-Test
 * `tests/e2e/cloud/zuschauer-zaehlung.cloud.spec.ts`.
 */
import { test, expect, type Page } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';
import { messSaat, ZUSCHAUER_CODE } from '../helpers/messlaufTaching';

const ZAEHL_URL = '**/rest/v1/rpc/count_public_view*';

async function spielplanSichtbar(page: Page): Promise<void> {
  await expect(page.locator('nav[aria-label="Public Navigation"]')).toBeVisible({ timeout: 25000 });
  await expect(page.getByText('Hallencup Messlauf').first()).toBeVisible();
}

for (const kanal of ['q', 'l'] as const) {
  test(`@RZ-024 /#/live/CODE?k=${kanal}: Spielplan steht, der Zusatz verschwindet aus der Adresszeile, andere Teile bleiben`, async ({ page }) => {
    const zaehlAufrufe: string[] = [];
    await page.route(ZAEHL_URL, (route) => { zaehlAufrufe.push(route.request().url()); return route.abort(); });
    await installiereSaat(page.context(), messSaat());
    await page.goto(`/#/live/${ZUSCHAUER_CODE}?p=all&k=${kanal}`);
    await spielplanSichtbar(page);
    await expect.poll(() => new URL(page.url()).hash).toBe(`#/live/${ZUSCHAUER_CODE}?p=all`);
    expect(page.url()).not.toContain('k=');
    expect(zaehlAufrufe, 'ohne Supabase verlässt keine Zählmeldung das Gerät').toEqual([]);
  });
}

test('@RZ-029 die kurze Adresse /live/CODE?k=q überlebt die Umleitung auf /#/live/CODE und verliert den Zusatz erst danach', async ({ page }) => {
  const adressen: string[] = [];
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) { adressen.push(frame.url()); } });
  await installiereSaat(page.context(), messSaat());
  await page.goto(`/live/${ZUSCHAUER_CODE}?k=q`);
  await spielplanSichtbar(page);
  expect(adressen.some((u) => u.includes(`/#/live/${ZUSCHAUER_CODE}?k=q`)), `Adressen: ${adressen.join(' → ')}`).toBe(true);
  await expect.poll(() => new URL(page.url()).hash).toBe(`#/live/${ZUSCHAUER_CODE}`);
  expect(new URL(page.url()).pathname).toBe('/');
});

test('@RZ-026 Gegenbeispiel: ein blockierter Zählaufruf ändert nichts – Spielplan, keine Fehlermeldung, kein Hinweis', async ({ page }) => {
  await page.route(ZAEHL_URL, (route) => route.abort());
  const meldungen: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') { meldungen.push(m.text()); } });
  await installiereSaat(page.context(), messSaat());
  await page.goto(`/#/live/${ZUSCHAUER_CODE}?k=q`);
  await spielplanSichtbar(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(meldungen.filter((t) => t.includes('count_public_view'))).toEqual([]);
});

test('@RZ-024 ohne Zusatz bleibt die Adresse unverändert (Kanal „direkt“)', async ({ page }) => {
  await installiereSaat(page.context(), messSaat());
  await page.goto(`/#/live/${ZUSCHAUER_CODE}?p=all`);
  await spielplanSichtbar(page);
  await expect.poll(() => new URL(page.url()).hash).toBe(`#/live/${ZUSCHAUER_CODE}?p=all`);
});
