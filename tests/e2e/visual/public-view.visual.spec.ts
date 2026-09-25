/**
 * Visual Regression: Öffentliche Turnier-Ansicht (Task T5)
 * Siehe dashboard.visual.spec.ts für die allgemeine Erklärung (Container-Pflicht, Ruling Y).
 *
 * Ruling Y, Punkt 2: Für Public View gibt es zwei Routen mit unterschiedlicher Datenquelle
 * (src/core/routing/routeRegistry.ts):
 * - `/live/:shareCode` (publicLive) -- braucht einen echten Supabase-Stack (Cloud-Share).
 * - `/public/:tournamentId` (public) -- rendert denselben Screen (PublicTournamentViewScreen)
 *   rein aus IndexedDB, ganz ohne Supabase (siehe auch tests/e2e/flows/public-view.spec.ts, das
 *   diese Route bereits offline testet).
 * Diese Offline-Entsprechung erfüllt Ruling Y direkt -- kein `test.fixme` nötig, keine Lücke.
 */

import { test, expect } from '../helpers/test-fixtures';
import { freezeClock, commonMasks, buildVisualTournament } from './helpers';

test('Public View: Turnier mit Ergebnissen', async ({ page, seedIndexedDB }) => {
  await freezeClock(page);

  const tournament = buildVisualTournament({
    id: 'visual-public-tournament',
    title: 'Nordstadt Hallencup',
  });

  await seedIndexedDB({ tournaments: [tournament] });

  await page.goto('/#/public/visual-public-tournament');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /Nordstadt Hallencup/i }).first()).toBeVisible({ timeout: 10000 });

  await expect(page).toHaveScreenshot('public-view.png', {
    fullPage: true,
    mask: commonMasks(page),
  });
});
