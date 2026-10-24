/**
 * Visual Regression: „Zeiten verschieben“ (B-26, Mockup „Zeiten verschieben“, abgenommen 2026-10-24).
 * Siehe dashboard.visual.spec.ts für die allgemeine Erklärung (Container-Pflicht, Ruling Y).
 * Turnier aus `buildVisualTournament`: Spiel 1 beendet, Spiel 2 läuft, Spiel 3 geplant; Uhr fest auf FIXED_NOW.
 * Zwei Bilder: der Dialog nach „Zeiten verschieben“ (@ZP-094) und der Spielplan mit Streifen nach dem Bestätigen (@ZP-012).
 */
import { test, expect } from '../helpers/test-fixtures';
import { freezeClock, commonMasks, buildVisualTournament } from './helpers';

// Uhrzeit im Zeitfeld wie auf deutschen Geräten (24 h), unabhängig von der Sprache des Containers (Review B7)
test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin', launchOptions: { args: ['--lang=de-DE'], env: { ...process.env, LANG: 'de_DE.UTF-8', LANGUAGE: 'de_DE' } } });

test('Zeiten verschieben: Dialog und Streifen', async ({ page, seedIndexedDB }) => {
  await freezeClock(page);
  await seedIndexedDB({ tournaments: [buildVisualTournament({ id: 'visual-zeiten-verschieben', title: 'Nordstadt Hallencup' })] });

  await page.goto('/#/tournament/visual-zeiten-verschieben/schedule');
  await page.waitForLoadState('networkidle');
  await page.getByTestId('schedule-shift-button').click();
  await expect(page.getByTestId('time-shift-summary')).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveScreenshot('zeiten-verschieben-dialog.png', { mask: commonMasks(page) });

  await page.getByTestId('time-shift-proceed').click();
  await page.getByTestId('time-shift-confirm').click();
  await expect(page.getByTestId('time-shift-strip')).toBeVisible();
  // der Toast verschwindet nach einigen Sekunden; der Streifen bleibt
  await expect(page.locator('[role="status"]').filter({ hasText: 'später' })).toHaveCount(0, { timeout: 8000 });
  await page.getByTestId('time-shift-strip').scrollIntoViewIfNeeded();
  await expect(page).toHaveScreenshot('zeiten-verschieben-streifen.png', { mask: commonMasks(page) });
});
