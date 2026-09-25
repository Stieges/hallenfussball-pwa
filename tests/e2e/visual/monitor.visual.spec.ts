/**
 * Visual Regression: Monitor-Anzeige (Task T5)
 * Siehe dashboard.visual.spec.ts für die allgemeine Erklärung (Container-Pflicht, Ruling Y).
 *
 * Route: /display/:tournamentId/:monitorId (MonitorDisplayPage). Anders als das Live-Cockpit
 * liest der Monitor die Match-Timer-Felder DIREKT aus `tournament.matches`, nicht aus der
 * `liveMatches-<id>`-localStorage-Quelle (toLiveMatch(), src/features/monitor-display/
 * MonitorDisplayPage.tsx:237-277) -- deshalb reicht hier das normale IndexedDB-Seeding.
 * `matchStatus: 'running'` ist der einzige von toLiveMatch()s statusMap erkannte Wert für
 * "läuft" (die Werte 'playing'/'RUNNING' aus anderen bestehenden Specs, z.B.
 * tests/e2e/flows/monitor-display.spec.ts, werden dort NICHT erkannt und fallen still auf
 * NOT_STARTED zurück -- für diesen Screenshot bewusst der laut statusMap korrekte Wert).
 *
 * Pixel-Shift (usePixelShift, src/hooks/usePixelShift.ts) bleibt dank freezeClock() auf der
 * Initialposition (siehe helpers.ts-Kommentar) -- kein zusätzlicher CSS-Mask nötig.
 */

import { test, expect } from '../helpers/test-fixtures';
import { freezeClock, commonMasks, buildVisualTournament, FIXED_NOW } from './helpers';

const TOURNAMENT_ID = 'visual-monitor-tournament';

test('Monitor: laufendes Spiel', async ({ page, seedIndexedDB }) => {
  await freezeClock(page);

  const tournament = buildVisualTournament({
    id: TOURNAMENT_ID,
    title: 'Nordstadt Hallencup',
    matches: [
      {
        id: 'visual-monitor-match',
        round: 1,
        teamA: 'team-1',
        teamB: 'team-2',
        field: 1,
        matchStatus: 'running',
        scoreA: 2,
        scoreB: 1,
        scheduledTime: '2026-03-14T09:20:00.000Z',
        // FIXED_NOW - 320s
        timerStartTime: new Date(FIXED_NOW.getTime() - 320_000).toISOString(),
        timerElapsedSeconds: 0,
      },
    ],
    monitors: [
      {
        id: 'visual-monitor-1',
        name: 'Haupthalle Monitor',
        defaultSlideDuration: 15,
        transition: 'fade',
        transitionDuration: 500,
        theme: 'dark',
        performanceMode: 'auto',
        slides: [
          {
            id: 'slide-live',
            type: 'live',
            config: { fieldId: 'field-1' },
            duration: null,
            order: 0,
          },
        ],
        createdAt: '2026-03-01T08:00:00.000Z',
        updatedAt: '2026-03-14T09:00:00.000Z',
      },
    ],
  });

  await seedIndexedDB({ tournaments: [tournament] });

  await page.goto(`/#/display/${TOURNAMENT_ID}/visual-monitor-1`);
  await page.waitForLoadState('networkidle');
  // Fehler-/Leerzustand darf nicht auftreten -- sonst würde ein leerer Monitor-Screen geprüft.
  await expect(page.getByTestId('monitor-error-state')).not.toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('monitor-no-slides-state')).not.toBeVisible({ timeout: 5000 });
  await expect(page.getByText('FC Nordstadt')).toBeVisible({ timeout: 10000 });

  await expect(page).toHaveScreenshot('monitor.png', {
    fullPage: true,
    mask: commonMasks(page),
  });
});
