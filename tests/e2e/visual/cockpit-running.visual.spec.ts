/**
 * Visual Regression: Live-Cockpit mit laufendem Spiel (Task T5)
 * Siehe dashboard.visual.spec.ts für die allgemeine Erklärung (Container-Pflicht, Ruling Y).
 *
 * Der "laufende"-Zustand wird NICHT durch einen echten Start-Klick erzeugt (das wäre am
 * Klick-Zeitpunkt gekoppelt und damit nicht deterministisch), sondern direkt in die
 * `liveMatches-<tournamentId>`-localStorage-Quelle geseedet, die das Live-Tab tatsächlich liest
 * (src/hooks/useLiveMatches.ts -- eine von der IndexedDB-Turnierdaten GETRENNTE Quelle, siehe
 * seedRunningLiveMatch() in ./helpers.ts). `timerStartTime` liegt exakt 320s vor der
 * eingefrorenen Uhr (FIXED_NOW), die Spieluhr zeigt deshalb bei jedem Lauf denselben Stand.
 *
 * Route: /tournament/:id/live (TAB_PATHS.management, src/features/tournament-management/utils/
 * tournamentTabUtils.ts) -- direkter Deep-Link, kein Klick durch die Tabs nötig. ManagementTab
 * wählt das laufende Spiel automatisch (kein Match ohne Ergebnis mit höherer Priorität als ein
 * Live-Match, src/features/tournament-management/ManagementTab.tsx:199-212).
 */

import { test, expect } from '../helpers/test-fixtures';
import { freezeClock, commonMasks, buildVisualTournament, seedRunningLiveMatch, FIXED_NOW } from './helpers';

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
        teamA: 'team-1',
        teamB: 'team-2',
        field: 1,
        matchStatus: 'running',
        scheduledTime: '2026-03-14T09:20:00.000Z',
      },
    ],
  });

  await seedIndexedDB({ tournaments: [tournament] });

  await seedRunningLiveMatch(page, TOURNAMENT_ID, {
    id: MATCH_ID,
    number: 2,
    phaseLabel: 'Gruppe A',
    fieldId: 'field-1',
    field: 1,
    scheduledKickoff: '2026-03-14T09:20:00.000Z',
    durationSeconds: 600,
    homeTeam: { id: 'team-1', name: 'FC Nordstadt' },
    awayTeam: { id: 'team-2', name: 'SV Südpark' },
    homeScore: 2,
    awayScore: 1,
    elapsedSeconds: 320,
    // FIXED_NOW - 320s
    timerStartTime: new Date(FIXED_NOW.getTime() - 320_000).toISOString(),
  });

  await page.goto(`/#/tournament/${TOURNAMENT_ID}/live`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('match-timer-display')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('match-status-badge')).toContainText(/Läuft|RUNNING|LAUFEND/i);
  await expect(page.getByTestId('score-home')).toContainText('2');
  await expect(page.getByTestId('score-away')).toContainText('1');

  await expect(page).toHaveScreenshot('cockpit-running.png', {
    fullPage: true,
    mask: commonMasks(page),
  });
});
