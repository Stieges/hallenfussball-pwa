/**
 * Visual Regression: Dashboard (Task T5)
 *
 * Läuft NUR in den visual-*-Projekten (playwright.config.ts, testMatch auf tests/e2e/visual/**).
 * Vorlagen entstehen ausschließlich im offiziellen Playwright-Container (CI-Job `visual` bzw.
 * Docker-Lauf via `npm run test:visual:update`) -- siehe Ruling Y,
 * .superpowers/sdd/2026-09-24-testumgebung/task-T5-brief.md.
 */

import { test, expect } from '../helpers/test-fixtures';
import { freezeClock, commonMasks, buildVisualTournament } from './helpers';

test('Dashboard mit Turnier-Liste', async ({ page, seedIndexedDB }) => {
  await freezeClock(page);

  const tournament = buildVisualTournament({
    id: 'visual-dashboard-tournament',
    title: 'Nordstadt Hallencup',
  });

  await seedIndexedDB({ tournaments: [tournament] });

  await page.goto('/#/');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Nordstadt Hallencup')).toBeVisible({ timeout: 10000 });

  await expect(page).toHaveScreenshot('dashboard.png', {
    fullPage: true,
    mask: commonMasks(page),
  });
});
