/**
 * Visual Regression: Live-Cockpit mit laufendem Spiel (Task T5)
 * Siehe dashboard.visual.spec.ts für die allgemeine Erklärung (Container-Pflicht, Ruling Y).
 *
 * Seit A-08 liest das Live-Tab nur noch die Spiel-Engine bzw. deren lokalen Ereignis-Speicher
 * (kein `liveMatches-<id>`-localStorage-Altweg mehr). Der "laufende"-Zustand entsteht deshalb
 * über die Oberfläche (Anpfiff, zwei Heim-Tore, ein Auswärts-Tor), analog zu
 * tests/e2e/flows/live-cockpit.spec.ts. Determinismus: `freezeClock()` friert `Date.now()` ein,
 * die Spieluhr (Differenz zu `Date.now()`) steht dadurch bei jedem Lauf auf demselben Stand.
 *
 * Route: /tournament/:id/live (TAB_PATHS.management) -- direkter Deep-Link.
 */

import { test, expect } from '../helpers/test-fixtures';
import { freezeClock, commonMasks, buildVisualTournament, FIXED_NOW } from './helpers';

const TOURNAMENT_ID = 'visual-cockpit-tournament';
const MATCH_ID = 'visual-cockpit-running-match';

test('Live-Cockpit: laufendes Spiel', async ({ page, seedIndexedDB }) => {
  await freezeClock(page);

  const tournament = buildVisualTournament({
    id: TOURNAMENT_ID,
    title: 'Nordstadt Hallencup',
    matches: [
      {
        id: MATCH_ID,
        round: 1,
        teamA: '00000000-0000-4000-8000-0000000000a1',
        teamB: '00000000-0000-4000-8000-0000000000a2',
        field: 1,
        matchStatus: 'scheduled',
        scheduledTime: '2026-03-14T09:20:00.000Z',
      },
    ],
  });

  await seedIndexedDB({ tournaments: [tournament] });

  await page.goto(`/#/tournament/${TOURNAMENT_ID}/live`);
  await page.waitForLoadState('networkidle');

  await page.getByTestId('match-start-button').click({ timeout: 15000 });
  await expect(page.getByTestId('match-pause-button')).toBeVisible({ timeout: 10000 });
  for (const side of ['home', 'home', 'away'] as const) {
    await page.getByTestId(`goal-button-${side}`).click();
    const skip = page.getByTestId('dialog-skip-button');
    if (await skip.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skip.click();
      await expect(skip).toBeHidden();
    }
  }

  await expect(page.getByTestId('score-home')).toContainText('2');
  await expect(page.getByTestId('score-away')).toContainText('1');
  // Cockpit-Toasts (Spiel gestartet, Tor ...) schliessen sich bei laufender Spieluhr nicht von
  // selbst (Timer wird bei jedem Uhr-Render neu gesetzt) -- per Schliessen-Knopf entfernen.
  const closeButtons = page.getByRole('button', { name: '×', exact: true });
  await expect(async () => {
    while ((await closeButtons.count()) > 0) {
      await closeButtons.first().click({ timeout: 2000 });
    }
    await expect(closeButtons).toHaveCount(0);
  }).toPass({ timeout: 20000 });
  // Uhr nach dem Anpfiff um feste 320 s vorrücken (Referenzstand 04:40 Restzeit bei 10:00 Spielzeit)
  await page.clock.setFixedTime(new Date(FIXED_NOW.getTime() + 320_000));
  await expect(page.getByTestId('match-timer-display')).toHaveText('04:40');
  await expect(closeButtons).toHaveCount(0);

  await expect(page.getByTestId('match-timer-display')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('match-status-badge')).toContainText(/Läuft|RUNNING|LAUFEND/i);
  await expect(page.getByTestId('score-home')).toContainText('2');
  await expect(page.getByTestId('score-away')).toContainText('1');

  await expect(page).toHaveScreenshot('cockpit-running.png', {
    fullPage: true,
    mask: commonMasks(page),
  });
});
