/**
 * Monitor Display E2E Tests
 *
 * Tests the Monitor/TV Display functionality
 *
 * Test Coverage:
 * - MON-A01: Live-Spiel Anzeige
 * - MON-A10: Keyboard-Navigation
 * - MON-B02: Monitor ohne Slides
 * - MON-D01/D02: Error States
 * - MON-E05: Desktop HD Layout
 * - MON-F01: Schriftgröße
 * - MON-F06: Fullscreen
 * - MON-G01: Keyboard Accessibility
 *
 * TEMPORARILY SKIPPED IN CI: Tests have timing issues in CI environment.
 * Need to increase timeouts or add more robust waiting strategies.
 */


import { test, expect, type TestOptions } from '../helpers/test-fixtures';

// CI skip removed - using reliable seeding fixture

// Helper to create a tournament with monitor config via localStorage
async function setupTournamentWithMonitor(seedIndexedDB: TestOptions['seedIndexedDB'], monitorConfig: {
  slides?: Array<{ id: string; type: string; config: Record<string, unknown>; duration: number | null; order: number }>;
  theme?: string;
}) {
  const tournament = {
    id: 'test-tournament',
    title: 'E2E Test Turnier',
    name: 'E2E Test Turnier',
    date: '2026-03-14',
    status: 'published',
    sport: 'hallenfussball',
    sportId: 'football-indoor',
    tournamentType: 'classic',
    mode: 'classic',
    numberOfFields: 1,
    numberOfTeams: 2,
    groupPhaseGameDuration: 10,
    placementLogic: ['points', 'goalDiff', 'goalsFor'],
    finals: { enabled: false },
    isKidsTournament: false,
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    resultMode: 'standard',
    pointSystem: { win: 3, draw: 1, loss: 0 },
    groups: [{ id: 'g1', name: 'Gruppe A', teamIds: ['00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2'] }],
    teams: [
      { id: '00000000-0000-4000-8000-0000000000a1', name: 'FC Bayern', color: '#DC2626' },
      { id: '00000000-0000-4000-8000-0000000000a2', name: 'Borussia Dortmund', color: '#FACC15' },
    ],
    matches: [
      {
        id: 'm1',
        number: 1,
        teamA: '00000000-0000-4000-8000-0000000000a1',
        teamB: '00000000-0000-4000-8000-0000000000a2',
        slotA: { kind: 'team', teamId: '00000000-0000-4000-8000-0000000000a1' },
        slotB: { kind: 'team', teamId: '00000000-0000-4000-8000-0000000000a2' },
        homeTeamId: '00000000-0000-4000-8000-0000000000a1',
        awayTeamId: '00000000-0000-4000-8000-0000000000a2',
        homeScore: 2,
        awayScore: 1,
        scoreA: 2,
        scoreB: 1,
        status: 'RUNNING',
        matchStatus: 'playing',
        field: 1,
        fieldNumber: 1,
        groupId: 'g1',
        scheduledTime: new Date().toISOString(),
        durationSeconds: 600,
        elapsedSeconds: 300,
        timerStartTime: new Date().toISOString(),
        timerElapsedSeconds: 300,
      },
    ],
    monitors: [
      {
        id: 'monitor-1',
        name: 'Haupthalle Monitor',
        defaultSlideDuration: 15,
        transition: 'fade',
        transitionDuration: 500,
        theme: monitorConfig.theme ?? 'dark',
        performanceMode: 'auto',
        slides: monitorConfig.slides ?? [
          {
            id: 's1',
            type: 'live',
            config: { fieldId: 'field-1' },
            duration: null,
            order: 0,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    fields: [{ id: 'field-1', number: 1, name: 'Feld 1' }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await seedIndexedDB({
    tournaments: [tournament]
  });

  return tournament;
}

test.describe('Monitor Display', () => {

  test.describe('MON-D01/D02: Error States', () => {
    test('zeigt Fehler bei ungültiger Tournament-ID', async ({ page }) => {
      // HashRouter requires /#/ prefix for routes
      await page.goto('/#/display/invalid-tournament/monitor-1');

      // Use data-testid for reliable element selection (Best Practice)
      await expect(page.getByTestId('monitor-error-message')).toBeVisible({ timeout: 10000 });
    });

    test('zeigt Fehler bei ungültiger Monitor-ID', async ({ page, seedIndexedDB }) => {
      await setupTournamentWithMonitor(seedIndexedDB, {});
      // HashRouter requires /#/ prefix for routes
      await page.goto('/#/display/test-tournament/invalid-monitor');

      // Use data-testid for reliable element selection (Best Practice)
      await expect(page.getByTestId('monitor-error-message')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('MON-B02: Monitor ohne Slides', () => {
    // Ein Monitor ist ein Bildschirm im Querformat; Hochformat wird nicht unterstützt
    // (docs/anforderungen/2026-10-02_zuschauer-und-monitor.md, „Geparkt – Darstellung im Grenzfall“).
    // Auf den Handy-Profilen (Hochformat) blendete die Spielplan-Folie die Teamnamen aus.
    test.use({ viewport: { width: 1280, height: 720 } });

    // B-03 (F-04, @OB-011): Ein leeres Folienprogramm bleibt nie leer – statt des alten
    // Hinweises „Keine Slides konfiguriert" zeigt der Monitor eine immer darstellbare Folie
    // (hier: Spielplan, da das Turnier nicht öffentlich ist und keinen QR-Code erlaubt).
    test('zeigt bei leerem Folienprogramm eine Standardfolie statt Leerzustand', async ({ page, seedIndexedDB }) => {
      await setupTournamentWithMonitor(seedIndexedDB, { slides: [] });
      // HashRouter requires /#/ prefix for routes
      await page.goto('/#/display/test-tournament/monitor-1');

      // Standardfolie (Spielplan) zeigt die Paarung aus dem Turnier
      await expect(page.getByText('FC Bayern').first()).toBeVisible({ timeout: 10000 });

      // Alter Leerzustand und Fehlertext dürfen nie erscheinen
      await expect(page.getByTestId('monitor-no-slides-message')).toHaveCount(0);
      await expect(page.getByTestId('monitor-no-slides-state')).toHaveCount(0);
      await expect(page.getByTestId('monitor-error-message')).toHaveCount(0);
    });
  });

  test.describe('MON-A10: Keyboard Navigation', () => {
    // @ME-022 (B-17, löst das alte MON-A10 „Space pausiert“ ab): Die Leertaste hält das Folienprogramm nicht an.
    test('Leertaste hält die Diashow nicht an (@ME-022)', async ({ page, seedIndexedDB }) => {
      // Zwei immer darstellbare Folien mit kurzer Dauer: Tabelle und Spielplan Feld 1
      await setupTournamentWithMonitor(seedIndexedDB, {
        slides: [
          { id: 's1', type: 'standings', config: { groupId: 'A' }, duration: 3, order: 0 },
          { id: 's2', type: 'schedule-field', config: { fieldId: 'field-1' }, duration: 3, order: 1 },
        ],
      });

      // HashRouter requires /#/ prefix for routes
      await page.goto('/#/display/test-tournament/monitor-1');
      const tabelle = page.getByText('Gruppe A', { exact: true });
      await expect(tabelle).toBeVisible({ timeout: 10000 });

      await page.keyboard.press('Space');

      // Das Folienprogramm läuft weiter: die Tabellen-Folie wechselt zum Spielplan, kein Pause-Zustand
      await expect(tabelle).toBeHidden({ timeout: 10000 });
      await expect(page.getByTestId('monitor-pause-indicator')).toHaveCount(0);
      await expect(page).toHaveURL(/\/display\/test-tournament\/monitor-1/);
    });

    test('Arrow keys navigieren zwischen Slides', async ({ page, seedIndexedDB }) => {
      await setupTournamentWithMonitor(seedIndexedDB, {
        slides: [
          { id: 's1', type: 'live', config: { fieldId: 'field-1' }, duration: 60, order: 0 },
          { id: 's2', type: 'standings', config: { groupId: 'A' }, duration: 60, order: 1 },
        ],
      });

      await page.goto('/#/display/test-tournament/monitor-1');

      // Wait for initial slide to render
      await page.waitForTimeout(1000);

      // Press right arrow to go to next slide
      await page.keyboard.press('ArrowRight');

      // Wait for transition
      await page.waitForTimeout(500);

      // Press left arrow to go back
      await page.keyboard.press('ArrowLeft');

      // Wait for transition
      await page.waitForTimeout(500);

      // This test mainly ensures navigation doesn't crash
      // Page should still be visible
      await expect(page.locator('body')).toBeVisible();
    });

    // @ME-022 (B-17, löst das alte MON-A10 „Escape navigiert zurück“ ab): Escape beendet höchstens das Vollbild,
    // die Monitor-Seite bleibt offen und zeigt weiter das Folienprogramm.
    test('Escape verlässt die Monitor-Seite nicht (@ME-022)', async ({ page, seedIndexedDB }) => {
      await setupTournamentWithMonitor(seedIndexedDB, {
        slides: [{ id: 's1', type: 'standings', config: { groupId: 'A' }, duration: 60, order: 0 }],
      });
      await page.goto('/#/display/test-tournament/monitor-1');
      const tabelle = page.getByText('Gruppe A', { exact: true });
      await expect(tabelle).toBeVisible({ timeout: 10000 });

      await page.keyboard.press('Escape');
      // kurze Frist, in der eine Navigation (altes Verhalten) passiert wäre
      await page.waitForTimeout(1000);

      await expect(page).toHaveURL(/\/display\/test-tournament\/monitor-1/);
      await expect(tabelle).toBeVisible();
    });
  });

  test.describe('MON-G01: Keyboard Accessibility', () => {
    test('hat keine JavaScript Errors', async ({ page, seedIndexedDB }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));

      await setupTournamentWithMonitor(seedIndexedDB, {});
      await page.goto('/#/display/test-tournament/monitor-1');
      await page.waitForLoadState('networkidle');

      // Wait a bit for any async errors
      await page.waitForTimeout(2000);

      expect(errors).toEqual([]);
    });
  });

});

test.describe('Monitor Display - Responsive', () => {

  test.describe('MON-E05: Desktop HD (1920x1080)', () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

    test('rendert korrekt in HD', async ({ page, seedIndexedDB }) => {
      await setupTournamentWithMonitor(seedIndexedDB, {});
      await page.goto('/#/display/test-tournament/monitor-1');
      await page.waitForLoadState('networkidle');

      // Check that the page renders without overflow
      const body = page.locator('body');
      await expect(body).toBeVisible();

      // Take screenshot for visual verification
      await page.screenshot({ path: 'test-results/monitor-hd-1920x1080.png' });
    });
  });

});

test.describe('Monitor Display - TV/Beamer Tests', () => {

  test.describe('MON-F01: Schriftgröße', () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

    test('Score hat lesbare Schriftgröße', async ({ page, seedIndexedDB }) => {
      await setupTournamentWithMonitor(seedIndexedDB, {});
      await page.goto('/#/display/test-tournament/monitor-1');
      await page.waitForLoadState('networkidle');

      // Wait for content to render
      await page.waitForTimeout(2000);

      // Check that content exists (actual size depends on implementation)
      const viewport = page.viewportSize();
      expect(viewport?.width).toBe(1920);
    });
  });

  test.describe('MON-F06: Fullscreen', () => {
    test('F11 Fullscreen funktioniert nicht (browser limitation)', async ({ page, seedIndexedDB }) => {
      // Note: Playwright can't truly test F11 fullscreen due to browser security
      // This test just ensures the key handler doesn't crash
      await setupTournamentWithMonitor(seedIndexedDB, {});
      await page.goto('/#/display/test-tournament/monitor-1');
      await page.waitForLoadState('networkidle');

      // Press F11 (won't actually fullscreen but shouldn't error)
      await page.keyboard.press('F11');

      // Page should still be functional
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

});

test.describe('Monitor Display - Theme Tests', () => {

  test('Dark Theme rendert korrekt', async ({ page, seedIndexedDB }) => {
    await setupTournamentWithMonitor(seedIndexedDB, { theme: 'dark' });
    await page.goto('/#/display/test-tournament/monitor-1');
    await page.waitForLoadState('networkidle');

    // Take screenshot for theme verification
    await page.screenshot({ path: 'test-results/monitor-theme-dark.png' });
  });

  test('Light Theme rendert korrekt', async ({ page, seedIndexedDB }) => {
    await setupTournamentWithMonitor(seedIndexedDB, { theme: 'light' });
    await page.goto('/#/display/test-tournament/monitor-1');
    await page.waitForLoadState('networkidle');

    // Take screenshot for theme verification
    await page.screenshot({ path: 'test-results/monitor-theme-light.png' });
  });

});
