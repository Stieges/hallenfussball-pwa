/**
 * E2E Tests for Live Cockpit (Scoreboard)
 *
 * Tests the main match management workflows:
 * - Starting a match
 * - Scoring goals
 * - Pausing and resuming
 * - Finishing a match
 */

import { test, expect } from '@playwright/test';

// Minimal but valid tournament structure for E2E testing
// Using empty matches array to let the app generate the schedule
const TEST_TOURNAMENT = {
  id: 'e2e-test-tournament',
  status: 'published',
  sport: 'football',
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
  date: '2025-01-15',
  timeSlot: '10:00 - 14:00',
  startDate: '2025-01-15',
  startTime: '10:00',
  location: { name: 'Test-Halle' },
  teams: [
    { id: 'team-1', name: 'FC Test A' },
    { id: 'team-2', name: 'FC Test B' },
    { id: 'team-3', name: 'FC Test C' },
    { id: 'team-4', name: 'FC Test D' },
  ],
  // Let the app generate matches from the schedule
  matches: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test.describe('Live Cockpit', () => {
  // Skip iPhones - Safe Area viewport emulation causes click interception issues
  // The app works on real iOS devices, this is a Playwright limitation
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Skipping on iPhone due to Safe Area emulation issues');

    // Seed localStorage BEFORE navigating
    await page.addInitScript((tournament) => {
      localStorage.setItem('tournaments', JSON.stringify([tournament]));
    }, TEST_TOURNAMENT);

    // Navigate to app
    await page.goto('/');
    await page.waitForLoadState('networkidle');
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
    await expect(page.getByTestId('match-timer-display')).toBeVisible({ timeout: 10000 });
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
    await expect(page.getByTestId('match-status-badge')).toContainText(/Läuft|RUNNING/i);
  });

  test('Can score a goal', async ({ page }) => {
    // GIVEN - Navigate to Live Cockpit and start match
    await page.getByText('E2E Test Turnier').click();
    await page.getByText('Live').first().click({ force: true });

    await page.waitForSelector('[data-testid="match-start-button"]', { timeout: 10000 });
    await page.getByTestId('match-start-button').click();
    await expect(page.getByTestId('match-pause-button')).toBeVisible();

    // Get initial score
    const homeScoreBefore = await page.getByTestId('score-home').textContent();

    // WHEN - Click goal button for home team
    await page.getByTestId('goal-button-home').click();

    // Handle goal scorer dialog if it appears
    const skipButton = page.getByTestId('dialog-skip-button');
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click();
    }

    // THEN - Home score should increase
    await expect(page.getByTestId('score-home')).not.toHaveText(homeScoreBefore ?? '0');
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
    await expect(page.getByTestId('match-status-badge')).toContainText(/Pause|PAUSED|PAUSIERT/i);

    // WHEN - Click start to resume
    await page.getByTestId('match-start-button').click();

    // THEN - Should show Pause button and status RUNNING
    await expect(page.getByTestId('match-pause-button')).toBeVisible();
    await expect(page.getByTestId('match-status-badge')).toContainText(/Läuft|RUNNING|LAUFEND/i);
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
    await page.waitForTimeout(500); // Wait for state update

    const homeTeamAfter = await page.getByTestId('team-name-home').textContent();
    const statusBadge = await page.getByTestId('match-status-badge').textContent();

    // Either the status changed to finished, or we auto-navigated to next match
    const matchFinishedOrNavigated =
      Boolean(statusBadge?.match(/Beendet|FINISHED|ABGESCHLOSSEN/i)) ||
      homeTeamAfter !== homeTeamBefore;

    expect(matchFinishedOrNavigated).toBeTruthy();
  });

  test('Timer updates while match is running', async ({ page }) => {
    // GIVEN - Navigate to Live Cockpit and start match
    await page.getByText('E2E Test Turnier').click();
    await page.getByText('Live').first().click({ force: true });

    await page.waitForSelector('[data-testid="match-start-button"]', { timeout: 10000 });
    await page.getByTestId('match-start-button').click();

    // Get initial timer value
    const timerElement = page.getByTestId('match-timer-display');
    const initialTime = await timerElement.textContent();

    // WHEN - Wait for 2 seconds
    await page.waitForTimeout(2000);

    // THEN - Timer should have advanced
    const newTime = await timerElement.textContent();
    expect(newTime).not.toBe(initialTime);
  });

  test('Can undo last event', async ({ page }) => {
    // GIVEN - Navigate to Live Cockpit, start match and score a goal
    await page.getByText('E2E Test Turnier').click();
    await page.getByText('Live').first().click({ force: true });

    await page.waitForSelector('[data-testid="match-start-button"]', { timeout: 10000 });
    await page.getByTestId('match-start-button').click();
    await page.getByTestId('goal-button-home').click();

    // Handle goal scorer dialog
    const skipButton = page.getByTestId('dialog-skip-button');
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click();
    }

    // Verify goal was scored
    await expect(page.getByTestId('score-home')).toContainText('1');

    // WHEN - Click undo button
    const undoButton = page.getByTestId('match-undo-button');
    if (await undoButton.isEnabled()) {
      await undoButton.click();

      // Handle confirmation if present
      const confirmButton = page.getByRole('button', { name: /Bestätigen|Confirm|Ja/i });
      if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmButton.click();
      }

      // THEN - Score should be back to 0
      await expect(page.getByTestId('score-home')).toContainText('0');
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

    // THEN - Dialog should appear with countdown timer on skip button
    const skipButton = page.getByTestId('dialog-skip-button');
    await expect(skipButton).toBeVisible({ timeout: 2000 });

    // Skip button should show countdown (e.g., "Ohne Nr. (10s)" or "(9s)")
    const buttonText = await skipButton.textContent();
    expect(buttonText).toMatch(/\(\d+s\)/);

    // Close dialog
    await skipButton.click();
  });

  test('GoalScorerDialog auto-dismisses after timeout', async ({ page }) => {
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

    // THEN - Dialog should appear
    const skipButton = page.getByTestId('dialog-skip-button');
    await expect(skipButton).toBeVisible({ timeout: 2000 });

    // Wait for auto-dismiss (10 seconds + buffer)
    // Note: Goal is still recorded even when dialog auto-dismisses
    await expect(skipButton).toBeHidden({ timeout: 12000 });

    // Verify goal was recorded (auto-dismiss saves as "incomplete")
    await expect(page.getByTestId('score-home')).toContainText('1');
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
      const skipButton = page.getByTestId('dialog-skip-button');
      if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await skipButton.click();
      }
      await page.waitForTimeout(300); // Small delay between goals
    }

    // Score 1 goal for away team
    await page.getByTestId('goal-button-away').click();
    const skipButton = page.getByTestId('dialog-skip-button');
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click();
    }

    // Verify scores before finish
    await expect(page.getByTestId('score-home')).toContainText('2');
    await expect(page.getByTestId('score-away')).toContainText('1');

    // Pause and finish the match
    await page.getByTestId('match-pause-button').click();
    await page.getByTestId('match-finish-button').click();

    // Handle confirmation dialog if present
    const dialogConfirmButton = page.locator('[role="dialog"] button').filter({ hasText: /Beenden|Bestätigen|Ja|Confirm/i });
    if (await dialogConfirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dialogConfirmButton.click();
    }

    await page.waitForTimeout(500);

    // WHEN - Navigate to Spielplan tab to verify results
    await page.getByText('Spielplan').click({ force: true });
    await page.waitForTimeout(500);

    // THEN - Should see the result "2:1" in the schedule
    // Look for the score in the schedule display area
    const scheduleDisplay = page.locator('.group-stage-schedule, .schedule-display').first();
    await expect(scheduleDisplay).toBeVisible();
    const scheduleContent = await scheduleDisplay.textContent();
    expect(scheduleContent).toMatch(/2\s*[-:]\s*1/);
  });
});

test.describe('Live Cockpit - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  // Skip iPhones - Safe Area viewport emulation causes click interception issues
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Skipping on iPhone due to Safe Area emulation issues');

    // Seed localStorage BEFORE navigating
    await page.addInitScript((tournament) => {
      localStorage.setItem('tournaments', JSON.stringify([tournament]));
    }, TEST_TOURNAMENT);
  });

  test('Touch targets are appropriately sized on mobile', async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByText('E2E Test Turnier').click();

    // On mobile, navigation might be different (bottom nav)
    // Use force: true to handle safe area overlays on iOS
    const liveNavItem = page.getByText('Live').first();
    await liveNavItem.click({ force: true });

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
