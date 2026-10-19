/**
 * Visual Regression: Spielanzeige für Zuschauer (Plan 2026-10-18, Aufgabe 2.3).
 * Siehe dashboard.visual.spec.ts für die allgemeine Erklärung (Container-Pflicht, Ruling Y).
 *
 * Bereich „Anzeige für Zuschauer“ auf `/tournament/:id/admin/visibility` (Vorbelegung Blau/Rot; Blau/Navy mit Hinweis „zu ähnlich“,
 * @ZM-152, @ZM-153). Aufgenommen wird nur der Bereich, nicht die ganze Seite (QR-Code und Teilen-Link sind hier ohne Belang).
 * Rechte: ohne Konto gilt die Person lokal als Eigentümer (useMyTournamentRole), die Eingaben sind da.
 */

import { test, expect } from '../helpers/test-fixtures';
import { freezeClock, buildVisualTournament } from './helpers';

const TOURNAMENT_ID = 'visual-anzeige-tournament';

test('Anzeige für Zuschauer: Vorbelegung (Blau/Rot, kein Hinweis)', async ({ page, seedIndexedDB }) => {
  await freezeClock(page);
  await seedIndexedDB({ tournaments: [buildVisualTournament({ id: TOURNAMENT_ID, title: 'Nordstadt Hallencup' })] });

  await page.goto(`/#/tournament/${TOURNAMENT_ID}/admin/visibility`);
  await page.waitForLoadState('networkidle');
  const bereich = page.getByTestId('spectator-display-section');
  await expect(page.getByTestId('spectator-display-preview')).toBeVisible({ timeout: 10000 });

  await expect(bereich).toHaveScreenshot('anzeige-vorbelegung.png');
});

test('Anzeige für Zuschauer: Blau/Navy mit Hinweis „zu ähnlich“', async ({ page, seedIndexedDB }) => {
  await freezeClock(page);
  await seedIndexedDB({ tournaments: [buildVisualTournament({ id: TOURNAMENT_ID, title: 'Nordstadt Hallencup' })] });

  await page.goto(`/#/tournament/${TOURNAMENT_ID}/admin/visibility`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('spectator-display-preview')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('spectator-display-away-color').getByRole('button').first().click();
  await page.getByRole('option', { name: 'Farbe #0D1B4C' }).click();
  await expect(page.getByTestId('spectator-display-similar-hint')).toBeVisible();

  await expect(page.getByTestId('spectator-display-section')).toHaveScreenshot('anzeige-navy.png');
});
