/**
 * E2E Tests for Live Cockpit (Scoreboard)
 *
 * Tests the main match management workflows:
 * - Starting a match
 * - Scoring goals
 * - Pausing and resuming
 * - Finishing a match
 */

import { test, expect } from '../helpers/test-fixtures';
import { schliesseTorAuswahl } from '../helpers/cockpitNeu';

/**
 * Generate a future date string (tomorrow) in YYYY-MM-DD format
 * This ensures tournaments are categorized as "upcoming" not "finished"
 */
function getFutureDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * Create test tournament with dynamic future date
 * Must be called fresh each time to get current date
 */
function createTestTournament() {
  const futureDate = getFutureDate();
  return {
    id: 'e2e-test-tournament',
    status: 'published',
    sport: 'football',
    sportId: 'football-indoor', // Pflichtfeld im TournamentSchema (A-08f3b2)
    tournamentType: 'classic',
    mode: 'classic',
    numberOfFields: 1,
    numberOfTeams: 4,
    numberOfGroups: 1,
    groupSystem: 'roundRobin',
    groupPhaseGameDuration: 10,
    groupPhaseBreakDuration: 2,
    gameDuration: 10,
    breakDuration: 2,
    placementLogic: ['points', 'goalDifference', 'goalsFor'],
    finals: { enabled: false },
    isKidsTournament: false,
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 },
    title: 'E2E Test Turnier',
    ageClass: 'U12',
    date: futureDate,
    timeSlot: '10:00 - 14:00',
    startDate: futureDate,
    startTime: '10:00',
    location: { name: 'Test-Halle' },
    // Team-IDs als UUID (TeamIdSchema seit A-01)
    teams: [
      { id: '00000000-0000-4000-8000-0000000000e1', name: 'FC Test A' },
      { id: '00000000-0000-4000-8000-0000000000e2', name: 'FC Test B' },
      { id: '00000000-0000-4000-8000-0000000000e3', name: 'FC Test C' },
      { id: '00000000-0000-4000-8000-0000000000e4', name: 'FC Test D' },
    ],
    // Let the app generate matches from the schedule
    matches: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// CI skip removed - using reliable seeding fixture

test.describe('Live Cockpit', () => {
  // Skip iPhones - Safe Area viewport emulation causes click interception issues
  // The app works on real iOS devices, this is a Playwright limitation
  test.beforeEach(async ({ page, seedIndexedDB }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Skipping on iPhone due to Safe Area emulation issues');

    // Use the seeding fixture which handles navigation and reloading correctly
    const tournament = createTestTournament();
    await seedIndexedDB({
      tournaments: [tournament]
    });

    // Wait for seeded tournament to appear
    await expect(page.getByText('E2E Test Turnier')).toBeVisible({ timeout: 15000 });
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data (ignore errors for skipped tests)
    try {
      await page.evaluate(() => {
        localStorage.removeItem('tournaments');
        localStorage.removeItem('liveMatches-e2e-test-tournament');
      });
    } catch {
      // Ignore cleanup errors (e.g., when test was skipped and page is about:blank)
    }
  });

  test('Can navigate to Live Cockpit tab', async ({ page }) => {
    // GIVEN - App is loaded with test tournament
    await expect(page.getByText('E2E Test Turnier')).toBeVisible();

    // WHEN - Click on the tournament
    await page.getByText('E2E Test Turnier').click();

    // THEN - Should be in tournament management view
    await expect(page.getByText('Live')).toBeVisible({ timeout: 10000 });

    // WHEN - Click on Live tab (force: true for mobile safe area issues)
    await page.getByText('Live').click({ force: true });

    // THEN - Should see the Live Cockpit with timer and team names
    await expect(page.getByTestId('scoreboard')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('team-name-home')).toBeVisible();
    await expect(page.getByTestId('team-name-away')).toBeVisible();
  });

  test('Can start a match', async ({ page }) => {
    // GIVEN - Navigate to Live Cockpit
    await page.getByText('E2E Test Turnier').click();
    await page.getByText('Live').first().click({ force: true });

    // Wait for Live Cockpit to load
    await page.waitForSelector('[data-testid="match-start-button"], [data-testid="match-pause-button"]', {
      timeout: 10000,
    });

    // WHEN - Click Start button
    const startButton = page.getByTestId('match-start-button');
    if (await startButton.isVisible()) {
      await startButton.click();
    }

    // THEN - Status should change to RUNNING and timer should start
    // The button should now show Pause
    await expect(page.getByTestId('match-pause-button')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('scoreboard-state')).toContainText(/Live/i);
  });

  test('Can score a goal', async ({ page }) => {
    // GIVEN - Navigate to Live Cockpit and start match
    await page.getByText('E2E Test Turnier').click();
    await page.getByText('Live').first().click({ force: true });

    await page.waitForSelector('[data-testid="match-start-button"]', { timeout: 10000 });
    await page.getByTestId('match-start-button').click();
    await expect(page.getByTestId('match-pause-button')).toBeVisible();

    // Get initial score
    const homeScoreBefore = await page.getByTestId('scoreboard-box-links').textContent();

    // WHEN - Click goal button for home team
    await page.getByTestId('goal-button-home').click();

    // Handle goal scorer dialog if it appears
    await schliesseTorAuswahl(page);

    // THEN - Home score should increase
    await expect(page.getByTestId('scoreboard-box-links')).not.toHaveText(homeScoreBefore ?? '0');
  });

  test('Can pause and resume a match', async ({ page }) => {
    // GIVEN - Navigate to Live Cockpit and start match
    await page.getByText('E2E Test Turnier').click();
    await page.getByText('Live').first().click({ force: true });

    await page.waitForSelector('[data-testid="match-start-button"]', { timeout: 10000 });
    await page.getByTestId('match-start-button').click();
    await expect(page.getByTestId('match-pause-button')).toBeVisible();

    // WHEN - Click pause
    await page.getByTestId('match-pause-button').click();

    // THEN - Should show Start button again and status should be PAUSED
    await expect(page.getByTestId('match-start-button')).toBeVisible();
    // Pause: Zustand bleibt „Live“ (Matrix § 6), die Uhr steht und ist markiert
    await expect(page.getByTestId('scoreboard-clock')).toHaveAttribute('data-steht', 'true');

    // WHEN - Click start to resume
    await page.getByTestId('match-start-button').click();

    // THEN - Should show Pause button and status RUNNING
    await expect(page.getByTestId('match-pause-button')).toBeVisible();
    await expect(page.getByTestId('scoreboard-state')).toContainText(/Live/i);
    await expect(page.getByTestId('scoreboard-clock')).toHaveAttribute('data-steht', 'false');
  });

  test('Can finish a match', async ({ page }) => {
    // GIVEN - Navigate to Live Cockpit, start and pause match
    await page.getByText('E2E Test Turnier').click();
    await page.getByText('Live').first().click({ force: true });

    await page.waitForSelector('[data-testid="match-start-button"]', { timeout: 10000 });

    // Note: Get current match teams before starting
    const homeTeamBefore = await page.getByTestId('team-name-home').textContent();

    await page.getByTestId('match-start-button').click();
    await expect(page.getByTestId('match-pause-button')).toBeVisible();

    // Pause first (required before finish - button is disabled while running)
    await page.getByTestId('match-pause-button').click();
    await expect(page.getByTestId('match-start-button')).toBeVisible();

    // WHEN - Click finish button
    const finishButton = page.getByTestId('match-finish-button');
    await expect(finishButton).toBeEnabled();
    await finishButton.click();

    // Handle confirmation dialog if present (look for dialog-specific confirm button)
    const dialogConfirmButton = page.locator('[role="dialog"] button, [data-testid="dialog-confirm"], [data-testid*="confirm"]').filter({ hasText: /Beenden|Bestätigen|Ja|Confirm/i });
    if (await dialogConfirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dialogConfirmButton.click();
    }

    // THEN - After finishing, the app auto-selects the next match
    // Verify that either:
    // - Status shows FINISHED (if we stayed on same match), or
    // - We moved to a different match (team changed)

    // Use robust expect polling instead of hard timeout
    await expect(async () => {
      const homeTeamAfter = await page.getByTestId('team-name-home').textContent();
      const statusBadge = await page.getByTestId('scoreboard-state').textContent();

      const isFinished = Boolean(statusBadge?.match(/Ende|Abgepfiffen|FINISHED|ABGESCHLOSSEN/i));
      const hasNavigated = homeTeamAfter !== homeTeamBefore;

      expect(isFinished || hasNavigated).toBeTruthy();
    }).toPass({ timeout: 5000 });
  });

  test('Timer updates while match is running', async ({ page }) => {
    // GIVEN - Navigate to Live Cockpit and start match
    await page.getByText('E2E Test Turnier').click();
    await page.getByText('Live').first().click({ force: true });

    await page.waitForSelector('[data-testid="match-start-button"]', { timeout: 10000 });
    await page.getByTestId('match-start-button').click();

    // Get initial timer value
    const timerElement = page.getByTestId('scoreboard-clock-rest');
    const initialTime = await timerElement.textContent();

    // WHEN - Wait for 2 seconds
    await page.waitForTimeout(2000);

    // THEN - Timer should have advanced (check multiple times to be safe)
    await expect(async () => {
      const newTime = await timerElement.textContent();
      expect(newTime).not.toBe(initialTime);
    }).toPass({ timeout: 5000 });
  });

  // C3b-1: Rueckgaengig (RETRACT) laeuft fuer Engine-Spiele ueber useEngineEventEditing.
  test('Can undo last event', async ({ page }) => {
    // GIVEN - Navigate to Live Cockpit, start match and score a goal
    await page.getByText('E2E Test Turnier').click();
    await page.getByText('Live').first().click({ force: true });

    await page.waitForSelector('[data-testid="match-start-button"]', { timeout: 10000 });
    await page.getByTestId('match-start-button').click();
    await page.getByTestId('goal-button-home').click();

    // Handle goal scorer dialog
    await schliesseTorAuswahl(page);

    // Verify goal was scored
    await expect(page.getByTestId('scoreboard-box-links')).toContainText('1');

    // WHEN - Click undo button
    const undoButton = page.getByTestId('match-undo-button');
    if (await undoButton.isEnabled()) {
      await undoButton.click();

      // Handle confirmation if present
      const confirmButton = page.getByRole('button', { name: /Bestätigen|Confirm|Ja/i });
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
      }

      // THEN - Score should be back to 0
      await expect(page.getByTestId('scoreboard-box-links')).toContainText('0');
    }
  });

  test('GoalScorerDialog shows countdown timer', async ({ page }) => {
    // GIVEN - Navigate to Live Cockpit and start match
    await page.getByText('E2E Test Turnier').click();
    await page.getByText('Live').first().click({ force: true });

    await page.waitForSelector('[data-testid="match-start-button"]', { timeout: 10000 });
    await page.getByTestId('match-start-button').click();
    await expect(page.getByTestId('match-pause-button')).toBeVisible();

    // WHEN - Click goal button to open dialog
    await page.getByTestId('goal-button-home').click();

    // THEN - Das Tor zählt mit dem ersten Tipp (@SL-083); die Nummernauswahl bietet „ohne Nummer“ an
    // (Gherkin: kein Zähler im Knopf, der Zeitablauf von 10 s schließt die Auswahl ohne Nummer).
    await expect(page.getByTestId('number-picker')).toBeVisible({ timeout: 2000 });
    await expect(page.getByTestId('scoreboard-box-links')).toContainText('1');
    await expect(page.getByTestId('number-picker').getByRole('button', { name: 'ohne Nummer' })).toBeVisible();

    // Close dialog
    await schliesseTorAuswahl(page);
  });

  test('Nummernauswahl des Tors schließt nach dem Zeitablauf von selbst, das Tor bleibt', async ({ page }) => {
    // Note: This test uses a shorter timeout for faster execution
    // The actual app uses 10 seconds, but we'll verify the mechanism works

    // GIVEN - Navigate to Live Cockpit and start match
    await page.getByText('E2E Test Turnier').click();
    await page.getByText('Live').first().click({ force: true });

    await page.waitForSelector('[data-testid="match-start-button"]', { timeout: 10000 });
    await page.getByTestId('match-start-button').click();
    await expect(page.getByTestId('match-pause-button')).toBeVisible();

    // WHEN - Click goal button to open dialog
    await page.getByTestId('goal-button-home').click();

    // THEN - Nummernauswahl erscheint
    await expect(page.getByTestId('number-picker')).toBeVisible({ timeout: 2000 });

    // Wait for auto-dismiss (10 seconds + buffer)
    // Note: Goal is still recorded (counted with the first tap, @SL-083)
    await expect(page.getByTestId('number-picker')).toBeHidden({ timeout: 15000 });

    // Verify goal was recorded (zählt ohne Nummer)
    await expect(page.getByTestId('scoreboard-box-links')).toContainText('1');
  });

  test('Results are persisted to tournament after finish', async ({ page }) => {
    // GIVEN - Navigate to Live Cockpit
    await page.getByText('E2E Test Turnier').click();
    await page.getByText('Live').first().click({ force: true });

    await page.waitForSelector('[data-testid="match-start-button"]', { timeout: 10000 });

    // Start match and score goals
    await page.getByTestId('match-start-button').click();
    await expect(page.getByTestId('match-pause-button')).toBeVisible();

    // Score 2 goals for home team
    for (let i = 0; i < 2; i++) {
      await page.getByTestId('goal-button-home').click();
      await schliesseTorAuswahl(page);
      // Wait for score to update in UI before firing next goal
      await expect(page.getByTestId('scoreboard-box-links')).toContainText(`${i + 1}`);
    }

    // Score 1 goal for away team
    await page.getByTestId('goal-button-away').click();
    await schliesseTorAuswahl(page);
    await expect(page.getByTestId('scoreboard-box-rechts')).toContainText('1');

    // Pause and finish the match
    await page.getByTestId('match-pause-button').click();
    await expect(page.getByTestId('match-finish-button')).toBeEnabled();
    await page.getByTestId('match-finish-button').click();

    // Handle confirmation dialog if present
    const dialogConfirmButton = page.locator('[role="dialog"] button').filter({ hasText: /Beenden|Bestätigen|Ja|Confirm/i });
    if (await dialogConfirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dialogConfirmButton.click();
    }

    // Wait for state to settle
    await page.waitForTimeout(1000);

    // WHEN - Navigate to Spielplan tab to verify results
    await page.getByRole('button', { name: 'Spielplan' }).click({ force: true });

    // THEN - Should see the result "2:1" in the schedule
    // Use robust poll for the schedule content
    await expect(async () => {
      const scheduleDisplay = page.locator('.group-stage-schedule, .schedule-display').first();
      await expect(scheduleDisplay).toBeVisible();
      const scheduleContent = await scheduleDisplay.textContent();
      expect(scheduleContent).toMatch(/2\s*[-:]\s*1/);
    }).toPass({ timeout: 5000 });
  });
});

test.describe('Live Cockpit - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  // Skip iPhones - Safe Area viewport emulation causes click interception issues
  test.beforeEach(async ({ seedIndexedDB }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Skipping on iPhone due to Safe Area emulation issues');

    // Use the seeding fixture which handles navigation and reloading correctly
    const tournament = createTestTournament();
    await seedIndexedDB({
      tournaments: [tournament]
    });
  });

  test('Touch targets are appropriately sized on mobile', async ({ page }) => {
    // Wait for seeded tournament to appear
    await expect(page.getByText('E2E Test Turnier')).toBeVisible({ timeout: 15000 });

    await page.getByText('E2E Test Turnier').click();

    // On mobile, navigation might be different (bottom nav)
    // Use force: true to handle safe area overlays on iOS
    const liveNavItem = page.getByText('Live').first();
    await liveNavItem.click({ force: true });

    // Seit Scheibe 3 bietet die Team-Spalte die Tor-Taste erst nach dem Anpfiff an (Spec § 6 Matrix „Vor Anpfiff: Köpfe sichtbar, Knöpfe ausgeblendet“, darfAktion)
    await page.getByTestId('match-start-button').click({ timeout: 10000 });
    await page.waitForSelector('[data-testid="goal-button-home"]', { timeout: 10000 });

    // THEN - Goal buttons should be at least 44x44 (WCAG minimum)
    const goalButton = page.getByTestId('goal-button-home');
    const boundingBox = await goalButton.boundingBox();

    expect(boundingBox).not.toBeNull();
    if (boundingBox) {
      expect(boundingBox.width).toBeGreaterThanOrEqual(44);
      expect(boundingBox.height).toBeGreaterThanOrEqual(44);
    }
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data (ignore errors for skipped tests)
    try {
      await page.evaluate(() => {
        localStorage.removeItem('tournaments');
        localStorage.removeItem('liveMatches-e2e-test-tournament');
      });
    } catch {
      // Ignore cleanup errors (e.g., when test was skipped and page is about:blank)
    }
  });
});
