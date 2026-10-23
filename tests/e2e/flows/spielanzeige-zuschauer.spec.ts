/**
 * Aufgabe 5.1a (Spielanzeige): nur die Restzeit beim Stand (@ZM-162, @OB-067, @OB-066, @ZM-040, @ZM-039, @ZM-044).
 *
 * Saat `hallencup-messlauf`: das Finale läuft seit 320 s (eine Spielzeit von 10 min) – die Restzeit steht bei etwa 4:40,
 * nie die gespielte Zeit (5:2x). Die Phasen-Turniere (Code PHASEH Halbzeitpause, PHASEV Verlängerung) tragen `live_state`.
 * Die Saat rechnet ihre Zeiten relativ zum Laden; deshalb Bereiche statt fester Werte.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const HANDY = { width: 360, height: 640 };
const FINALE = '00000003-0000-4000-8000-000000000016';
const RESTZEIT_FINALE = /^4:(3\d|40)$/;
const KEINE_GESPIELTE_ZEIT = /5:2\d|05:2\d|5:3\d|05:3\d/;

async function oeffne(page: Page, route: string, erwarte: string) {
  await page.setViewportSize(HANDY);
  await installiereSaat(page.context(), leseSaat('hallencup-messlauf'));
  await page.goto(route);
  await expect(page.locator(erwarte).first()).toBeAttached({ timeout: 25000 });
}

const karte = (page: Page) => page.locator(`[data-testid="final-card-${FINALE}"]`);

test.describe('@ZM-162 Restzeit statt Spielzeit', () => {
  test('@ZM-162 Zuschauer-Seite: Karte des Finales trägt „Live“ ohne Zeit und die Restzeit beim Stand, nie 5:2x', async ({ page }) => {
    await oeffne(page, '/#/live/MESS26', '[data-testid^="final-card-"]');
    await karte(page).scrollIntoViewIfNeeded();
    await expect(karte(page).locator(`[data-testid="final-live-${FINALE}"]`)).toHaveText(/^Live$/);
    await expect(karte(page).locator('[data-testid="match-clock"]')).toHaveText(RESTZEIT_FINALE);
    expect(await karte(page).innerText()).not.toMatch(KEINE_GESPIELTE_ZEIT);
  });

  test('@ZM-162 Verwaltung (Turnierleitung): dieselbe Restzeit beim Stand, Abzeichen ohne Zeit', async ({ page }) => {
    await oeffne(page, '/#/tournament/hallencup-messlauf/schedule', '[data-testid^="final-card-"]');
    await karte(page).scrollIntoViewIfNeeded();
    await expect(karte(page).locator(`[data-testid="final-live-${FINALE}"]`)).toHaveText(/^Live$/);
    await expect(karte(page).locator('[data-testid="match-clock"]')).toHaveText(RESTZEIT_FINALE);
    expect(await karte(page).innerText()).not.toMatch(KEINE_GESPIELTE_ZEIT);
  });

  test('@ZM-162 Gegenbeispiel: beendete und geplante Karten tragen keine Uhr', async ({ page }) => {
    await oeffne(page, '/#/live/MESS26', '[data-testid^="final-card-"]');
    await expect(page.locator('[data-testid^="final-card-"] [data-testid="match-clock"]')).toHaveCount(1);
  });

  test('@OB-067 Karte 360×640: Stand und Restzeit in Schriftstärke 800 bzw. gleich breiten Ziffern, die Restzeit ist größter Text', async ({ page }) => {
    await oeffne(page, '/#/live/MESS26', '[data-testid^="final-card-"]');
    const zeit = karte(page).locator('[data-testid="match-clock"]');
    await expect(zeit).toBeAttached();
    const stil = await zeit.evaluate((el) => {
      const s = getComputedStyle(el);
      const groesste = Array.from(el.closest('[data-testid^="final-card-"]')?.querySelectorAll<HTMLElement>('*') ?? [])
        .filter((e) => (e.textContent ?? '').trim() !== '' && e.children.length === 0)
        .map((e) => parseFloat(getComputedStyle(e).fontSize));
      return { gewicht: s.fontWeight, ziffern: s.fontVariantNumeric, groesse: parseFloat(s.fontSize), maximum: Math.max(...groesste) };
    });
    expect(stil.gewicht).toBe('800');
    expect(stil.ziffern).toContain('tabular-nums');
    expect(stil.groesse).toBeGreaterThanOrEqual(stil.maximum);
  });
});

test.describe('@OB-066 Pause und Verlängerung mit Restzeit', () => {
  test('@OB-066 @ZM-115 Halbzeitpause: Abzeichen „Halbzeit“, Pausen-Restzeit mit „Pause · Halbzeit“', async ({ page }) => {
    await oeffne(page, '/#/live/PHASEH', '[data-testid^="final-live-"]');
    await expect(page.locator('[data-testid^="final-live-"]')).toHaveText('Halbzeit');
    await expect(page.locator('[data-testid="match-clock-section"]')).toHaveText('Halbzeit');
    await expect(page.locator('[data-testid="match-clock"]')).toHaveText(/^0:\d\d$/);
  });

  test('@ZM-039 Verlängerung: Abzeichen „Verlängerung“, die Restzeit der Verlängerung zählt herunter', async ({ page }) => {
    await oeffne(page, '/#/live/PHASEV', '[data-testid^="final-live-"]');
    await expect(page.locator('[data-testid^="final-live-"]')).toHaveText('Verlängerung');
    await expect(page.locator('[data-testid="match-clock-section"]')).toHaveText('Verlängerung');
    await expect(page.locator('[data-testid="match-clock"]')).toHaveText(/^[0-4]:\d\d$/);
  });

  test('@OB-066 Strafstoßschießen: keine Uhr, nur das Abzeichen', async ({ page }) => {
    await oeffne(page, '/#/live/PHASES', '[data-testid^="final-live-"]');
    await expect(page.locator('[data-testid^="final-live-"]')).toHaveText('Strafstoßschießen');
    await expect(page.locator('[data-testid="match-clock"]')).toHaveCount(0);
  });
});
