/**
 * @ZM-208 Die Adresse unter dem QR-Code der Monitor-Folie „Zuschauer-QR“ ist aus der Halle lesbar und kurz: mindestens 3 % der Bildhöhe, eine Zeile, ohne „https://“ und
 * so, wie sie beim Eintippen wirklich zur Zuschauer-Seite führt (der Start leitet `/live/CODE` auf `/#/live/CODE` um, `core/routing/shortLiveRedirect`).
 * Ohne „#/“. 1920×1080 und 1280×720; nur Profil `desktop`.
 */
import { test, expect } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat } from '../../scripts/visual-metrics/saat/lader.mjs';
import { messSaat, TURNIER_ID, ZUSCHAUER_CODE } from './helpers/messlaufTaching';
import { animationenFertig } from './helpers/animationenFertig';

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop', 'setzt das Fenster selbst');
});

for (const { w, h } of [{ w: 1920, h: 1080 }, { w: 1280, h: 720 }]) {
  test(`@ZM-208 Adresse unter dem QR-Code bei ${String(w)}×${String(h)}: mindestens 3 % der Bildhöhe, eine Zeile, ohne „https://“, ohne Überlauf`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installiereSaat(page.context(), messSaat());
    await page.goto(`/#/display/${TURNIER_ID}/mon-qr`);
    const adresse = page.getByTestId('qr-address');
    await expect(adresse).toBeVisible({ timeout: 25000 });
    await animationenFertig(page);
    const mass = await adresse.evaluate((el) => {
      const stil = getComputedStyle(el);
      const kasten = el.getBoundingClientRect();
      return { schrift: parseFloat(stil.fontSize), hoehe: kasten.height, zeilenhoehe: parseFloat(stil.lineHeight) || parseFloat(stil.fontSize) * 1.5, ueberlauf: el.scrollWidth - el.clientWidth, rechts: kasten.right, text: el.textContent ?? '' };
    });
    expect(mass.schrift / h, `Schrift ${String(mass.schrift)} px bei ${String(h)} px Bildhöhe`).toBeGreaterThanOrEqual(0.03);
    expect(mass.hoehe, 'eine Zeile').toBeLessThanOrEqual(mass.zeilenhoehe * 1.5);
    expect(mass.ueberlauf).toBeLessThanOrEqual(0);
    expect(mass.rechts).toBeLessThanOrEqual(w);
    expect(mass.text).not.toMatch(/^https?:/);
    expect(mass.text).toBe(`${new URL(page.url()).host}/live/${ZUSCHAUER_CODE}`);
  });
}

test('@ZM-208 die gezeigte Adresse führt beim Eintippen zur Zuschauer-Seite, auch bei Suche; der QR-Code trägt weiter die Hash-Adresse', async ({ page }) => {
  await installiereSaat(page.context(), messSaat());
  await page.goto(`/#/display/${TURNIER_ID}/mon-qr`);
  const gezeigt = (await page.getByTestId('qr-address').textContent()) ?? '';
  expect(gezeigt).toBe(`${new URL(page.url()).host}/live/${ZUSCHAUER_CODE}`);
  expect(gezeigt).not.toContain('#');
  await page.goto(`http://${gezeigt}`);
  await expect(page.locator('nav[aria-label="Public Navigation"]')).toBeVisible({ timeout: 25000 });
  await expect(page.getByText('Hallencup Messlauf').first()).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/#/live/${ZUSCHAUER_CODE}$`));
});

test('@ZM-208 Gegenbeispiele: bestehende Hash-Adresse bleibt, andere Pfade werden nicht umgeleitet, der Auth-Callback bleibt unberührt', async ({ page }) => {
  await installiereSaat(page.context(), messSaat());
  await page.goto(`/#/live/${ZUSCHAUER_CODE}`);
  await expect(page.locator('nav[aria-label="Public Navigation"]')).toBeVisible({ timeout: 25000 });
  await expect(page).toHaveURL(new RegExp(`/#/live/${ZUSCHAUER_CODE}$`));
  await page.goto('/tournament/hallencup-messlauf');
  await expect.poll(() => new URL(page.url()).pathname).toBe('/tournament/hallencup-messlauf');
  await expect.poll(() => new URL(page.url()).hash).not.toContain('live');
  // Der Auth-Callback wird nicht zur Zuschauer-Seite umgeleitet. Ohne Anmeldecode führt die App ihn selbst weiter
  // (über `/#/auth/callback` zur Startseite `/#/`); geprüft wird deshalb der Endzustand, nicht die Zwischenadresse.
  await page.goto('/auth/callback');
  await expect(page).toHaveURL(/\/#\/(auth\/callback)?$/);
  await expect.poll(() => page.url()).not.toContain('/live');
});
