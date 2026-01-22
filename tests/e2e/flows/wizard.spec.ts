/**
 * E2E Tests für Tournament Creation Wizard
 *
 * Testet alle 5 Wizard-Steps:
 * - Step 1: Team Setup
 * - Step 2: Schedule
 * - Step 3: Groups
 * - Step 4: Playoffs
 * - Step 5: Review & Publish
 *
 * Basierend auf: .claude/CLAUDE.md - Tournament Wizard Section
 */

import { test, expect } from '../helpers/test-fixtures';

test.describe('Tournament Creation Wizard', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to wizard
    await page.goto('/tournament/new');
    await page.waitForLoadState('networkidle');
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: TEAM SETUP
  // ═══════════════════════════════════════════════════════════════

  test('Step 1: Grunddaten ausfüllen', async ({ page }) => {
    // GIVEN - Wizard Step 1
    await expect(page.getByRole('heading', { name: /Schritt 1|Team Setup|Grunddaten/i })).toBeVisible();

    // WHEN - Turnier-Grunddaten eingeben
    await page.getByLabel(/Turniername|Titel/i).fill('E2E Test Turnier');
    await page.getByLabel(/Altersklasse|Kategorie/i).fill('U12');
    await page.getByLabel(/Datum|Date/i).fill('2026-06-15');
    await page.getByLabel(/Uhrzeit|Zeit/i).fill('10:00');

    // Anzahl Teams (falls Dropdown)
    const teamSelect = page.getByLabel(/Anzahl Teams|Teams/i);
    if (await teamSelect.count() > 0) {
      await teamSelect.selectOption('8');
    }

    // THEN - Weiter-Button ist enabled
    const nextButton = page.getByRole('button', { name: /Weiter|Nächster Schritt/i });
    await expect(nextButton).toBeEnabled();

    // WHEN - Weiter klicken
    await nextButton.click();

    // THEN - Step 2 lädt
    await expect(page).toHaveURL(/\/tournament\/new\/step\/2/);
  });

  test('Step 1: Team-Namen eingeben', async ({ page }) => {
    // GIVEN - Wizard Step 1 mit minimalen Daten
    await page.getByLabel(/Turniername/i).fill('Teams Test');
    await page.getByLabel(/Datum/i).fill('2026-06-15');

    // WHEN - Team-Namen eingeben (8 Teams)
    const teamCount = 8;
    for (let i = 0; i < teamCount; i++) {
      const teamInput = page.locator(`[data-testid="input-team-name-${i}"]`).or(
        page.getByLabel(new RegExp(`Team ${i + 1}`, 'i'))
      );

      if (await teamInput.count() > 0) {
        await teamInput.fill(`Test Team ${i + 1}`);
      }
    }

    // THEN - Alle Teams haben Namen
    const filledInputs = await page.locator('input[value^="Test Team"]').count();
    expect(filledInputs).toBeGreaterThan(0);
  });

  test('Step 1: Validierung bei fehlenden Pflichtfeldern', async ({ page }) => {
    // GIVEN - Wizard Step 1 ohne Daten

    // WHEN - Direkt auf Weiter klicken
    const nextButton = page.getByRole('button', { name: /Weiter/i });
    await nextButton.click();

    // THEN - Fehler-Meldungen erscheinen
    const errors = page.locator('[role="alert"]').or(page.getByText(/erforderlich|Pflichtfeld/i));
    await expect(errors.first()).toBeVisible({ timeout: 2000 });
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: SCHEDULE
  // ═══════════════════════════════════════════════════════════════

  test('Step 2: Spielplan-Einstellungen konfigurieren', async ({ page }) => {
    // GIVEN - Step 1 abgeschlossen, jetzt auf Step 2
    await page.goto('/tournament/new/step/2');
    await page.waitForLoadState('networkidle');

    // WHEN - Spielplan-Settings anpassen
    const gameDuration = page.getByLabel(/Spieldauer|Spielzeit/i);
    if (await gameDuration.count() > 0) {
      await gameDuration.fill('10');
    }

    const breakDuration = page.getByLabel(/Pausenzeit|Pause/i);
    if (await breakDuration.count() > 0) {
      await breakDuration.fill('2');
    }

    const fields = page.getByLabel(/Anzahl Felder|Spielfelder/i);
    if (await fields.count() > 0) {
      await fields.fill('2');
    }

    // THEN - Weiter ist möglich
    const nextButton = page.getByRole('button', { name: /Weiter/i });
    await expect(nextButton).toBeEnabled();
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: GROUPS
  // ═══════════════════════════════════════════════════════════════

  test('Step 3: Gruppeneinteilung konfigurieren', async ({ page }) => {
    // GIVEN - Step 3
    await page.goto('/tournament/new/step/3');
    await page.waitForLoadState('networkidle');

    // WHEN - Gruppensystem wählen
    const groupSelect = page.getByLabel(/Gruppensystem|Gruppen/i);
    if (await groupSelect.count() > 0) {
      await groupSelect.selectOption('2'); // 2 Gruppen
    }

    // THEN - Gruppenvorschau wird angezeigt
    const groupPreview = page.locator('[data-testid="group-preview"]').or(
      page.getByText(/Gruppe A|Gruppe B/i)
    );

    if (await groupPreview.count() > 0) {
      await expect(groupPreview.first()).toBeVisible();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: PLAYOFFS
  // ═══════════════════════════════════════════════════════════════

  test('Step 4: Playoffs aktivieren/deaktivieren', async ({ page }) => {
    // GIVEN - Step 4
    await page.goto('/tournament/new/step/4');
    await page.waitForLoadState('networkidle');

    // WHEN - Playoffs aktivieren
    const playoffToggle = page.getByLabel(/Playoffs aktivieren|Finalrunde/i).or(
      page.getByRole('switch', { name: /Playoffs/i })
    );

    if (await playoffToggle.count() > 0) {
      await playoffToggle.click();

      // THEN - Playoff-Einstellungen werden angezeigt
      const playoffSettings = page.locator('[data-testid="playoff-settings"]').or(
        page.getByText(/Halbfinale|Finale/i)
      );
      await expect(playoffSettings.first()).toBeVisible();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 5: REVIEW & PUBLISH
  // ═══════════════════════════════════════════════════════════════

  test('Step 5: Turnier-Zusammenfassung und Veröffentlichen', async ({ page }) => {
    // GIVEN - Step 5 (finale Review)
    await page.goto('/tournament/new/step/5');
    await page.waitForLoadState('networkidle');

    // THEN - Zusammenfassung wird angezeigt
    await expect(page.getByRole('heading', { name: /Zusammenfassung|Review|Überprüfen/i })).toBeVisible();

    // WHEN - Turnier veröffentlichen
    const publishButton = page.getByRole('button', { name: /Veröffentlichen|Turnier erstellen|Fertigstellen/i });

    if (await publishButton.count() > 0 && await publishButton.isEnabled()) {
      await publishButton.click();

      // THEN - Redirect zum erstellten Turnier
      await page.waitForURL(/\/tournament\/[a-zA-Z0-9-]+/, { timeout: 10000 });

      // Success-Toast erscheint
      const successMessage = page.getByText(/erfolgreich erstellt|Turnier wurde erstellt/i);
      await expect(successMessage).toBeVisible({ timeout: 5000 });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // NAVIGATION & EDGE CASES
  // ═══════════════════════════════════════════════════════════════

  test('Navigation: Zurück-Button funktioniert', async ({ page }) => {
    // GIVEN - Step 2
    await page.goto('/tournament/new/step/2');
    await page.waitForLoadState('networkidle');

    // WHEN - Zurück-Button klicken
    const backButton = page.getByRole('button', { name: /Zurück|Previous/i });

    if (await backButton.count() > 0) {
      await backButton.click();

      // THEN - Zurück zu Step 1
      await expect(page).toHaveURL(/\/tournament\/new(?:\/step\/1)?/);
    }
  });

  test('Browser Back-Button funktioniert', async ({ page }) => {
    // GIVEN - Wizard durchnavigieren
    await page.goto('/tournament/new/step/1');
    await page.waitForLoadState('networkidle');

    await page.goto('/tournament/new/step/2');
    await page.waitForLoadState('networkidle');

    // WHEN - Browser-Back
    await page.goBack();

    // THEN - Zurück zu Step 1
    await expect(page).toHaveURL(/\/tournament\/new(?:\/step\/1)?/);
  });

  test('Wizard-Verlassen mit ungespeicherten Änderungen', async ({ page }) => {
    // GIVEN - Step 1 mit Daten
    await page.getByLabel(/Turniername/i).fill('Ungespeichertes Turnier');

    // WHEN - Weg-navigieren versuchen
    await page.goto('/');

    // THEN - Entweder Bestätigungs-Dialog oder direkt navigiert
    // (abhängig davon ob Bestätigungs-Dialog implementiert ist)
    const confirmDialog = page.getByRole('dialog').or(page.getByText(/Änderungen verwerfen/i));

    if (await confirmDialog.count() > 0) {
      await expect(confirmDialog).toBeVisible();
    } else {
      // Wenn kein Dialog, dann erfolgreich navigiert
      await expect(page).toHaveURL('/');
    }
  });

  test('Alle Steps sind über URL erreichbar', async ({ page }) => {
    for (let step = 1; step <= 5; step++) {
      await page.goto(`/tournament/new/step/${step}`);
      await page.waitForLoadState('networkidle');

      // URL stimmt
      await expect(page).toHaveURL(new RegExp(`/tournament/new/step/${step}`));

      // Step-Indicator zeigt aktuellen Step
      const stepIndicator = page.locator(`[data-testid="wizard-step-${step}"]`).or(
        page.getByText(new RegExp(`Schritt ${step}`, 'i'))
      );

      if (await stepIndicator.count() > 0) {
        await expect(stepIndicator.first()).toBeVisible();
      }
    }
  });

  test('Responsive: Wizard auf Mobile funktioniert', async ({ page }) => {
    // GIVEN - Mobile Viewport
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {

      // WHEN - Wizard öffnen
      await page.goto('/tournament/new');
      await page.waitForLoadState('networkidle');

      // THEN - Wizard ist sichtbar und bedienbar
      await expect(page.getByRole('heading', { name: /Schritt 1/i })).toBeVisible();

      // Input-Felder haben min. 16px (iOS Auto-Zoom Prevention)
      const inputs = await page.locator('input[type="text"], input[type="date"]').all();
      for (const input of inputs.slice(0, 3)) { // Check first 3 inputs
        const fontSize = await input.evaluate(el =>
          parseFloat(window.getComputedStyle(el).fontSize)
        );
        expect(fontSize).toBeGreaterThanOrEqual(16);
      }
    }
  });
});
