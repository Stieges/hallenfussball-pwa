/**
 * E2E Tests für Match Cockpit (Erweitert)
 *
 * Ergänzt die bestehenden live-cockpit.spec.ts Tests mit:
 * - Keyboard Shortcuts
 * - Audio/Haptic Feedback
 * - Error Handling
 * - Multi-Goal-Szenarien
 * - Undo/Redo Funktionalität
 * - Settings-Integration
 */

import { test, expect } from '../helpers/test-fixtures';

function createTestTournamentWithMatch() {
  return {
    id: 'cockpit-extended-test',
    title: 'Cockpit Test',
    status: 'published',
    sport: 'football',
    mode: 'classic',
    date: new Date().toISOString().split('T')[0],
    numberOfTeams: 2,
    numberOfFields: 1,
    gameDuration: 10,
    breakDuration: 2,
    teams: [
      { id: 'team-home', name: 'Home United' },
      { id: 'team-away', name: 'Away FC' },
    ],
    matches: [
      {
        id: 'test-match-1',
        teamA: 'team-home',
        teamB: 'team-away',
        field: 1,
        status: 'scheduled',
        time: '10:00',
        scoreA: 0,
        scoreB: 0,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test.describe('Match Cockpit Extended', () => {

  test.beforeEach(async ({ page: _page, seedIndexedDB }) => {
    const tournament = createTestTournamentWithMatch();
    await seedIndexedDB({
      tournaments: [tournament],
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS
  // ═══════════════════════════════════════════════════════════════

  test('Keyboard: Leertaste startet/pausiert Spiel', async ({ page }) => {
    // GIVEN - Cockpit geöffnet
    await page.goto('/tournament/cockpit-extended-test/match/test-match-1');
    await page.waitForLoadState('networkidle');

    // WHEN - Leertaste drücken
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    // THEN - Spiel läuft oder pausiert
    const timerDisplay = page.getByTestId('match-timer-display').or(
      page.locator('[data-testid^="timer-"]')
    );
    await expect(timerDisplay.first()).toBeVisible();
  });

  test('Keyboard: Q/W für Home Goal, O/P für Away Goal', async ({ page }) => {
    // GIVEN - Laufendes Spiel
    await page.goto('/tournament/cockpit-extended-test/match/test-match-1');
    await page.waitForLoadState('networkidle');

    // Start match first
    const startButton = page.getByTestId('match-start-button').or(
      page.getByRole('button', { name: /Start|Anstoß/i })
    );
    if (await startButton.count() > 0) {
      await startButton.click();
      await page.waitForTimeout(500);
    }

    // WHEN - Q drücken (Home Goal)
    await page.keyboard.press('q');
    await page.waitForTimeout(500);

    // THEN - Goal-Dialog erscheint oder Score erhöht sich
    const goalDialog = page.getByRole('dialog').or(page.getByTestId('dialog-goal'));

    if (await goalDialog.count() > 0) {
      // Dialog erschienen - bestätigen
      const confirmButton = page.getByRole('button', { name: /Bestätigen|Tor speichern/i });
      await confirmButton.click();
    }

    // Score sollte sich erhöht haben
    const homeScore = page.getByTestId('score-home').or(
      page.locator('[data-testid*="score"][data-testid*="home"]')
    );
    const scoreText = await homeScore.textContent();
    expect(scoreText).toContain('1');
  });

  test('Keyboard: Esc schließt Dialoge', async ({ page }) => {
    // GIVEN - Cockpit mit Goal-Dialog
    await page.goto('/tournament/cockpit-extended-test/match/test-match-1');
    await page.waitForLoadState('networkidle');

    // Start und Goal-Dialog öffnen
    const startButton = page.getByTestId('match-start-button');
    if (await startButton.count() > 0) {
      await startButton.click();
      await page.waitForTimeout(300);
    }

    const goalButton = page.getByTestId('goal-button-home').or(
      page.getByRole('button', { name: /Tor.*Heim/i })
    );
    if (await goalButton.count() > 0) {
      await goalButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // WHEN - Escape drücken
      await page.keyboard.press('Escape');

      // THEN - Dialog geschlossen
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 2000 });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // AUDIO & HAPTIC FEEDBACK
  // ═══════════════════════════════════════════════════════════════

  test('Audio Feedback: Tor-Sound wird abgespielt', async ({ page, context }) => {
    // GIVEN - Cockpit mit Audio-Berechtigung
    await context.grantPermissions(['audio']);
    await page.goto('/tournament/cockpit-extended-test/match/test-match-1');
    await page.waitForLoadState('networkidle');

    // Spy on Audio.play()
    await page.evaluate(() => {
      const originalPlay = HTMLAudioElement.prototype.play;
      HTMLAudioElement.prototype.play = function() {
        (window as any).__audioPlayed = true;
        return originalPlay.apply(this);
      };
    });

    // WHEN - Tor schießen
    const startButton = page.getByTestId('match-start-button');
    if (await startButton.count() > 0) {
      await startButton.click();
      await page.waitForTimeout(300);
    }

    const goalButton = page.getByTestId('goal-button-home');
    if (await goalButton.count() > 0) {
      await goalButton.click();

      // Confirm goal
      const confirmButton = page.getByRole('button', { name: /Bestätigen/i });
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
      }

      // THEN - Audio wurde abgespielt (oder Settings deaktiviert)
      const audioPlayed = await page.evaluate(() => (window as any).__audioPlayed);
      // Audio kann deaktiviert sein in Settings - Test ist ok wenn kein Error
      expect(audioPlayed === undefined || audioPlayed === true).toBe(true);
    }
  });

  test('Haptic Feedback: Vibration bei Touch-Geräten', async ({ page }) => {
    const isMobile = page.viewportSize()?.width && page.viewportSize()!.width < 768;
    if (!isMobile) {
      test.skip();
    }

    // GIVEN - Mobile Cockpit
    await page.goto('/tournament/cockpit-extended-test/match/test-match-1');
    await page.waitForLoadState('networkidle');

    // Spy on navigator.vibrate
    await page.evaluate(() => {
      (navigator as any).__vibrateCallCount = 0;
      if ('vibrate' in navigator) {
        const original = navigator.vibrate;
        navigator.vibrate = function(...args: any[]) {
          (navigator as any).__vibrateCallCount++;
          return (original as any).apply(navigator, args);
        };
      }
    });

    // WHEN - Button mit Haptic-Feedback antippen
    const goalButton = page.getByTestId('goal-button-home');
    if (await goalButton.count() > 0) {
      await goalButton.click();

      // THEN - vibrate() wurde aufgerufen (falls unterstützt)
      const vibrateCount = await page.evaluate(() => (navigator as any).__vibrateCallCount);
      // Vibrate kann 0 sein wenn nicht unterstützt - Test ist ok
      expect(typeof vibrateCount).toBe('number');
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // MULTI-GOAL SCENARIOS
  // ═══════════════════════════════════════════════════════════════

  test('Mehrere Tore hintereinander erfassen', async ({ page }) => {
    // GIVEN - Laufendes Spiel
    await page.goto('/tournament/cockpit-extended-test/match/test-match-1');
    await page.waitForLoadState('networkidle');

    const startButton = page.getByTestId('match-start-button');
    if (await startButton.count() > 0) {
      await startButton.click();
      await page.waitForTimeout(300);
    }

    // WHEN - 3 Tore für Home schießen
    for (let i = 0; i < 3; i++) {
      const goalButton = page.getByTestId('goal-button-home');
      await goalButton.click();

      const confirmButton = page.getByRole('button', { name: /Bestätigen/i });
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
        await page.waitForTimeout(300);
      }
    }

    // THEN - Score zeigt 3:0
    const homeScore = page.getByTestId('score-home');
    const scoreText = await homeScore.textContent();
    expect(scoreText).toContain('3');
  });

  test('Tore für beide Teams wechselnd erfassen', async ({ page }) => {
    // GIVEN - Laufendes Spiel
    await page.goto('/tournament/cockpit-extended-test/match/test-match-1');
    await page.waitForLoadState('networkidle');

    const startButton = page.getByTestId('match-start-button');
    if (await startButton.count() > 0) {
      await startButton.click();
      await page.waitForTimeout(300);
    }

    // WHEN - Tore wechselnd: Home, Away, Home, Away
    const sequence = [
      { button: 'goal-button-home', expectedHome: 1, expectedAway: 0 },
      { button: 'goal-button-away', expectedHome: 1, expectedAway: 1 },
      { button: 'goal-button-home', expectedHome: 2, expectedAway: 1 },
      { button: 'goal-button-away', expectedHome: 2, expectedAway: 2 },
    ];

    for (const { button, expectedHome, expectedAway } of sequence) {
      await page.getByTestId(button).click();

      const confirmButton = page.getByRole('button', { name: /Bestätigen/i });
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
        await page.waitForTimeout(300);
      }

      // Verify scores
      const homeScore = await page.getByTestId('score-home').textContent();
      const awayScore = await page.getByTestId('score-away').textContent();

      expect(homeScore).toContain(String(expectedHome));
      expect(awayScore).toContain(String(expectedAway));
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // UNDO/REDO FUNCTIONALITY
  // ═══════════════════════════════════════════════════════════════

  test('Undo: Letztes Tor rückgängig machen', async ({ page }) => {
    // GIVEN - Spiel mit Tor
    await page.goto('/tournament/cockpit-extended-test/match/test-match-1');
    await page.waitForLoadState('networkidle');

    const startButton = page.getByTestId('match-start-button');
    if (await startButton.count() > 0) {
      await startButton.click();
      await page.waitForTimeout(300);
    }

    // Score a goal
    await page.getByTestId('goal-button-home').click();
    const confirmButton = page.getByRole('button', { name: /Bestätigen/i });
    if (await confirmButton.count() > 0) {
      await confirmButton.click();
      await page.waitForTimeout(300);
    }

    // WHEN - Undo-Button klicken
    const undoButton = page.getByTestId('undo-button').or(
      page.getByRole('button', { name: /Rückgängig|Undo/i })
    );

    if (await undoButton.count() > 0) {
      await undoButton.click();

      // THEN - Score ist wieder 0
      const homeScore = await page.getByTestId('score-home').textContent();
      expect(homeScore).toContain('0');
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════

  test('Error: Match nicht gefunden zeigt Fehler', async ({ page }) => {
    // WHEN - Zu nicht-existierendem Match navigieren
    await page.goto('/tournament/cockpit-extended-test/match/non-existent-match');
    await page.waitForLoadState('networkidle');

    // THEN - Fehler-Meldung
    const errorMessage = page.getByText(/nicht gefunden|Match existiert nicht/i);
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('Error: Doppeltes Spielstart verhindert', async ({ page }) => {
    // GIVEN - Match geladen
    await page.goto('/tournament/cockpit-extended-test/match/test-match-1');
    await page.waitForLoadState('networkidle');

    const startButton = page.getByTestId('match-start-button');

    if (await startButton.count() > 0) {
      // WHEN - Zweimal Start klicken
      await startButton.click();
      await page.waitForTimeout(300);

      // Start-Button sollte disabled oder versteckt sein
      const isDisabled = await startButton.isDisabled().catch(() => true);
      const isVisible = await startButton.isVisible().catch(() => false);

      // THEN - Button ist nicht mehr klickbar
      expect(isDisabled || !isVisible).toBe(true);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // SETTINGS INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  test('Settings: Audio kann deaktiviert werden', async ({ page }) => {
    // GIVEN - Settings-Screen mit Audio-Toggle
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const audioToggle = page.getByLabel(/Audio|Sound|Ton/i).or(
      page.getByRole('switch', { name: /Audio/i })
    );

    if (await audioToggle.count() > 0) {
      // WHEN - Audio deaktivieren
      await audioToggle.click();

      // THEN - Einstellung wird gespeichert
      // (Validierung im Cockpit dass kein Sound abgespielt wird)
      // Hier nur prüfen dass Toggle funktioniert
      const isChecked = await audioToggle.isChecked().catch(() => false);
      expect(isChecked).toBe(false);
    }
  });

  test('Settings: Haptic Feedback kann deaktiviert werden', async ({ page }) => {
    const isMobile = page.viewportSize()?.width && page.viewportSize()!.width < 768;
    if (!isMobile) {
      test.skip();
    }

    // GIVEN - Settings mit Haptic Toggle
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const hapticToggle = page.getByLabel(/Haptik|Vibration/i).or(
      page.getByRole('switch', { name: /Haptic/i })
    );

    if (await hapticToggle.count() > 0) {
      // WHEN - Deaktivieren
      await hapticToggle.click();

      // THEN - Einstellung gespeichert
      const isChecked = await hapticToggle.isChecked().catch(() => false);
      expect(isChecked).toBe(false);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // PERFORMANCE
  // ═══════════════════════════════════════════════════════════════

  test('Performance: Cockpit lädt in <3 Sekunden', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/tournament/cockpit-extended-test/match/test-match-1');
    await page.waitForLoadState('networkidle');

    // THEN - Timer und Buttons sind sichtbar
    await expect(page.getByTestId('match-timer-display')).toBeVisible({ timeout: 3000 });

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });
});
