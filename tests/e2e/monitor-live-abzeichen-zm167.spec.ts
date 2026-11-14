/**
 * @ZM-167 Am Monitor steht das Live-Abzeichen links in der Kopfzeile, nur so breit wie sein Text, dunkelrot (Rose 800) mit weißer Schrift (mindestens 7 : 1) und weißem Punkt davor ·
 * @ZM-168 ohne Bewegung pulsiert der Punkt nicht; auf dem Handy (Zuschauer-Seite) bleibt das Abzeichen im bisherigen Live-Rot.
 * Gemessen am fertigen Bild in 1920×1080 und 1280×720, auf der Live-Folie (Kopf) und in der Zeile „Live“ der Listen-Folie „Spielplan eines Felds“ (@ZM-189) – beide trugen vorher
 * hellrosa mit schwarzer Schrift, der Kopf zusätzlich auf Spaltenbreite gezogen. Nur Profil `desktop` (setzt das Fenster selbst). Saat: `helpers/messlaufTaching.ts`.
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat } from '../../scripts/visual-metrics/saat/lader.mjs';
import { messSaat, TURNIER_ID, ZUSCHAUER_CODE } from './helpers/messlaufTaching';
import { kontrastVon } from './helpers/kontrast';
import { animationenFertig } from './helpers/animationenFertig';

const ROSE_800 = 'rgb(159, 18, 57)';
const WEISS = 'rgb(255, 255, 255)';
const GROESSEN = [{ w: 1920, h: 1080 }, { w: 1280, h: 720 }] as const;

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop', 'setzt das Fenster selbst');
});

async function oeffneMonitor(page: Page, monitor: string, w: number, h: number, bewegung = true): Promise<void> {
  await page.setViewportSize({ width: w, height: h });
  await page.emulateMedia({ reducedMotion: bewegung ? 'no-preference' : 'reduce' });
  await installiereSaat(page.context(), messSaat());
  await page.goto(`/#/display/${TURNIER_ID}/${monitor}`);
  await expect(page.getByTestId('match-status-badge').first()).toBeVisible({ timeout: 25000 });
  await animationenFertig(page);
}

/** Breite des Inhalts (Punkt und Wort) plus Innenabstand: so breit ist ein Abzeichen, das nur seinen Text umschließt. */
async function inhaltsbreite(abzeichen: Locator): Promise<{ breite: number; inhalt: number }> {
  return abzeichen.evaluate((el) => {
    const stil = getComputedStyle(el);
    const bereich = document.createRange();
    bereich.selectNodeContents(el);
    const kinder = [...bereich.getClientRects()].filter((r) => r.width > 0);
    const links = Math.min(...kinder.map((r) => r.left));
    const rechts = Math.max(...kinder.map((r) => r.right));
    return { breite: el.getBoundingClientRect().width, inhalt: rechts - links + parseFloat(stil.paddingLeft) + parseFloat(stil.paddingRight) + parseFloat(stil.borderLeftWidth) + parseFloat(stil.borderRightWidth) };
  });
}

for (const { w, h } of GROESSEN) {
  test.describe(`@ZM-167 Live-Abzeichen am Monitor, ${String(w)}×${String(h)}`, () => {
    test('@ZM-167 Live-Folie: links in der Kopfzeile, nur so breit wie sein Text, Rose 800 mit weißer Schrift, mindestens 7 : 1', async ({ page }) => {
      await oeffneMonitor(page, 'mon-live', w, h);
      const abzeichen = page.getByTestId('live-header').getByTestId('match-status-badge');
      await expect(abzeichen).toHaveText('Live');
      await expect(abzeichen).toHaveCSS('background-color', ROSE_800);
      await expect(abzeichen).toHaveCSS('color', WEISS);
      expect(await kontrastVon(abzeichen)).toBeGreaterThanOrEqual(7);
      const { breite, inhalt } = await inhaltsbreite(abzeichen);
      expect(breite, `Breite ${String(breite)} gegen Inhalt ${String(inhalt)}`).toBeLessThanOrEqual(inhalt + 1);
      const kasten = await abzeichen.boundingBox();
      expect((kasten?.x ?? 9999) < w / 4, 'links in der Kopfzeile').toBe(true);
      await expect(page.getByTestId('match-status-badge-dot')).toHaveCSS('background-color', WEISS);
    });

    test('@ZM-167 Listen-Folie „Spielplan eines Felds“: die Zeile „Live“ trägt ebenfalls Rose 800 mit weißer Schrift, 7 : 1', async ({ page }) => {
      await oeffneMonitor(page, 'mon-plan-feld', w, h);
      const live = page.locator('[data-testid="match-status-badge"][data-state="live"]').first();
      await expect(live).toBeVisible();
      await expect(live).toHaveCSS('background-color', ROSE_800);
      await expect(live).toHaveCSS('color', WEISS);
      expect(await kontrastVon(live)).toBeGreaterThanOrEqual(7);
    });

    test('@ZM-168 ohne Bewegung (Gerät auf „Bewegung reduzieren“) pulsiert der Punkt nicht, das Abzeichen bleibt dunkelrot', async ({ page }) => {
      await oeffneMonitor(page, 'mon-live', w, h, false);
      const punkt = page.getByTestId('match-status-badge-dot');
      const dauer = await punkt.evaluate((el) => parseFloat(getComputedStyle(el).animationDuration) * (getComputedStyle(el).animationDuration.endsWith('ms') ? 0.001 : 1));
      expect(dauer, 'Animationsdauer praktisch null').toBeLessThan(0.01);
      await expect(page.getByTestId('live-header').getByTestId('match-status-badge')).toHaveCSS('background-color', ROSE_800);
    });

    test('@ZM-167 Gegenbeispiel Handy: mit Bewegung läuft der Puls des Punktes (Animation gesetzt)', async ({ page }) => {
      await oeffneMonitor(page, 'mon-live', w, h, true);
      const dauer = await page.getByTestId('match-status-badge-dot').evaluate((el) => getComputedStyle(el).animationDuration);
      expect(dauer).not.toBe('0s');
    });
  });
}

test('@ZM-168 Gegenbeispiel: auf der Zuschauer-Seite am Handy bleibt „Live“ im bisherigen Live-Rot, nicht Rose 800', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installiereSaat(page.context(), messSaat());
  await page.goto(`/#/live/${ZUSCHAUER_CODE}`);
  const live = page.locator('[data-state="live"]').first();
  await expect(live).toBeVisible({ timeout: 25000 });
  const erwartet = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--color-status-live)';
    document.body.appendChild(probe);
    const farbe = getComputedStyle(probe).color;
    probe.remove();
    return farbe;
  });
  await expect(live).toHaveCSS('background-color', erwartet);
  expect(erwartet).not.toBe(ROSE_800);
});
