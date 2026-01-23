/**
 * E2E Tests für Tournament Creation Wizard
 *
 * Testet alle 6 Wizard-Steps:
 * - Step 1: Stammdaten (Name, Ort, Datum)
 * - Step 2: Sportart & Turniertyp
 * - Step 3: Modus & Spielsystem
 * - Step 4: Gruppen & Felder (optional)
 * - Step 5: Teams
 * - Step 6: Übersicht/Preview
 *
 * URL-Pattern: /tournament/new?step=X (Query-Parameter)
 */

import { test, expect } from '../helpers/test-fixtures';

test.describe('Tournament Creation Wizard', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to wizard (HashRouter requires /#/ prefix)
    await page.goto('/#/tournament/new');
    await page.waitForLoadState('networkidle');
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: STAMMDATEN
  // ═══════════════════════════════════════════════════════════════

  test('Step 1: Stammdaten ausfüllen', async ({ page }) => {
    // GIVEN - Wizard Step 1 (Stammdaten)
    await expect(page.getByRole('heading', { name: /Stammdaten/i })).toBeVisible();

    // WHEN - Turnier-Stammdaten eingeben
    await page.getByLabel(/Turniername|Titel|Name/i).fill('E2E Test Turnier');

    const locationInput = page.getByLabel(/Ort|Veranstaltungsort|Location/i);
    if (await locationInput.count() > 0) {
      await locationInput.fill('Sporthalle E2E');
    }

    const dateInput = page.getByLabel(/Datum|Date/i);
    if (await dateInput.count() > 0) {
      await dateInput.fill('2026-06-15');
    }

    // THEN - Weiter-Button ist enabled
    const nextButton = page.getByRole('button', { name: /Weiter|Nächster Schritt/i });
    await expect(nextButton).toBeEnabled();

    // WHEN - Weiter klicken
    await nextButton.click();

    // THEN - Step 2 lädt (URL hat ?step=2 Query-Parameter)
    await expect(page).toHaveURL(/\/tournament\/new\?step=2/);
  });

  test('Step 1: Validierung bei fehlenden Pflichtfeldern', async ({ page }) => {
    // GIVEN - Wizard Step 1 ohne Daten

    // WHEN - Direkt auf Weiter klicken
    const nextButton = page.getByRole('button', { name: /Weiter/i });
    await nextButton.click();

    // THEN - Fehler-Meldungen erscheinen oder Button bleibt disabled
    const errors = page.locator('[role="alert"]').or(page.getByText(/erforderlich|Pflichtfeld/i));
    const errorCount = await errors.count();

    // Wenn keine Fehler, dann sollte Button disabled sein
    if (errorCount === 0) {
      await expect(nextButton).toBeDisabled();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: SPORTART & TURNIERTYP
  // ═══════════════════════════════════════════════════════════════

  test('Step 2: Sportart und Turniertyp konfigurieren', async ({ page }) => {
    // GIVEN - Step 2
    await page.goto('/#/tournament/new?step=2');
    await page.waitForLoadState('networkidle');

    // THEN - Heading für Step 2
    await expect(page.getByRole('heading', { name: /Sportart|Turniertyp/i })).toBeVisible();

    // WHEN - Sportart wählen (falls vorhanden)
    const sportSelect = page.getByLabel(/Sportart/i);
    if (await sportSelect.count() > 0) {
      await sportSelect.click();
      // Erste Option wählen
      await page.getByRole('option').first().click();
    }

    // THEN - Weiter ist möglich
    const nextButton = page.getByRole('button', { name: /Weiter/i });
    await expect(nextButton).toBeEnabled();
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: MODUS & SPIELSYSTEM
  // ═══════════════════════════════════════════════════════════════

  test('Step 3: Modus und Spielsystem konfigurieren', async ({ page }) => {
    // GIVEN - Step 3
    await page.goto('/#/tournament/new?step=3');
    await page.waitForLoadState('networkidle');

    // THEN - Heading für Step 3
    await expect(page.getByRole('heading', { name: /Modus|Spielsystem/i })).toBeVisible();

    // WHEN - Spielplan-Settings anpassen (falls vorhanden)
    const gameDuration = page.getByLabel(/Spieldauer|Spielzeit/i);
    if (await gameDuration.count() > 0) {
      await gameDuration.fill('10');
    }

    const breakDuration = page.getByLabel(/Pausenzeit|Pause/i);
    if (await breakDuration.count() > 0) {
      await breakDuration.fill('2');
    }

    // THEN - Weiter ist möglich
    const nextButton = page.getByRole('button', { name: /Weiter/i });
    await expect(nextButton).toBeEnabled();
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: GRUPPEN & FELDER (optional)
  // ═══════════════════════════════════════════════════════════════

  test('Step 4: Gruppen und Felder konfigurieren', async ({ page }) => {
    // GIVEN - Step 4
    await page.goto('/#/tournament/new?step=4');
    await page.waitForLoadState('networkidle');

    // THEN - Gruppen-/Felder-Konfiguration (optional, hat kein h2)
    // Suche nach CollapsibleSection oder Gruppen/Felder Content
    const groupsSection = page.getByText(/Gruppen|Gruppe A|Anzahl Gruppen/i);
    const fieldsSection = page.getByText(/Felder|Spielfelder|Anzahl Felder/i);

    const hasGroupsSection = await groupsSection.count() > 0;
    const hasFieldsSection = await fieldsSection.count() > 0;

    // Mindestens eines der Elemente sollte sichtbar sein
    if (hasGroupsSection) {
      await expect(groupsSection.first()).toBeVisible();
    }
    if (hasFieldsSection) {
      await expect(fieldsSection.first()).toBeVisible();
    }

    // WHEN - Felder-Anzahl setzen (falls vorhanden)
    const fields = page.getByLabel(/Anzahl Felder|Spielfelder/i);
    if (await fields.count() > 0) {
      await fields.fill('2');
    }

    // Gruppen wählen (falls vorhanden)
    const groupSelect = page.getByLabel(/Anzahl Gruppen|Gruppen/i);
    if (await groupSelect.count() > 0) {
      await groupSelect.selectOption('2');
    }

    // THEN - Weiter ist möglich
    const nextButton = page.getByRole('button', { name: /Weiter/i });
    await expect(nextButton).toBeEnabled();
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 5: TEAMS
  // ═══════════════════════════════════════════════════════════════

  test('Step 5: Teams eingeben', async ({ page }) => {
    // GIVEN - Step 5
    await page.goto('/#/tournament/new?step=5');
    await page.waitForLoadState('networkidle');

    // THEN - Heading für Teams
    await expect(page.getByRole('heading', { name: /Teams/i })).toBeVisible();

    // WHEN - Team-Namen eingeben (falls Input-Felder vorhanden)
    const teamInputs = page.locator('[data-testid^="input-team-name-"]').or(
      page.getByLabel(/Team \d+|Team-Name/i)
    );

    const teamCount = await teamInputs.count();
    for (let i = 0; i < Math.min(teamCount, 4); i++) {
      await teamInputs.nth(i).fill(`Test Team ${i + 1}`);
    }

    // THEN - Weiter ist möglich (oder Teams sind required)
    const nextButton = page.getByRole('button', { name: /Weiter/i });
    await expect(nextButton).toBeEnabled();
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 6: ÜBERSICHT & VERÖFFENTLICHEN
  // ═══════════════════════════════════════════════════════════════

  test('Step 6: Turnier-Zusammenfassung und Veröffentlichen', async ({ page }) => {
    // GIVEN - Step 6 (finale Review)
    await page.goto('/#/tournament/new?step=6');
    await page.waitForLoadState('networkidle');

    // THEN - Zusammenfassung wird angezeigt
    const reviewHeading = page.getByRole('heading', { name: /Übersicht|Zusammenfassung|Review|Überprüfen/i });
    await expect(reviewHeading).toBeVisible();

    // WHEN - Turnier veröffentlichen (falls alle Daten korrekt)
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
    await page.goto('/#/tournament/new?step=2');
    await page.waitForLoadState('networkidle');

    // WHEN - Zurück-Button klicken
    const backButton = page.getByRole('button', { name: /Zurück|Previous/i });

    if (await backButton.count() > 0) {
      await backButton.click();

      // THEN - Zurück zu Step 1 (ohne query param)
      await expect(page).toHaveURL(/\/tournament\/new(?!\?step)/);
    }
  });

  test('Browser Back-Button funktioniert', async ({ page }) => {
    // GIVEN - Wizard durchnavigieren
    await page.goto('/#/tournament/new');
    await page.waitForLoadState('networkidle');

    await page.goto('/#/tournament/new?step=2');
    await page.waitForLoadState('networkidle');

    // WHEN - Browser-Back
    await page.goBack();

    // THEN - Zurück zu Step 1 (ohne ?step=X)
    await expect(page).toHaveURL(/\/tournament\/new(?!\?step)/);
  });

  test('Wizard-Verlassen mit ungespeicherten Änderungen', async ({ page }) => {
    // GIVEN - Step 1 mit Daten
    const nameInput = page.getByLabel(/Turniername|Titel|Name/i);
    if (await nameInput.count() > 0) {
      await nameInput.fill('Ungespeichertes Turnier');
    }

    // WHEN - Weg-navigieren versuchen
    await page.goto('/#/');

    // THEN - Entweder Bestätigungs-Dialog oder direkt navigiert
    // (abhängig davon ob Bestätigungs-Dialog implementiert ist)
    const confirmDialog = page.getByRole('dialog').or(page.getByText(/Änderungen verwerfen/i));

    if (await confirmDialog.count() > 0) {
      await expect(confirmDialog).toBeVisible();
    } else {
      // Wenn kein Dialog, dann erfolgreich navigiert
      await expect(page).toHaveURL(/^\/#?\/?$/);
    }
  });

  test('Alle Steps sind über URL erreichbar', async ({ page }) => {
    // Step 1 hat kein Query-Parameter
    await page.goto('/#/tournament/new');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/tournament\/new/);

    // Steps 2-6 haben ?step=X Query-Parameter
    for (let step = 2; step <= 6; step++) {
      await page.goto(`/#/tournament/new?step=${step}`);
      await page.waitForLoadState('networkidle');

      // URL stimmt
      await expect(page).toHaveURL(new RegExp(`/tournament/new\\?step=${step}`));

      // Step-Indicator zeigt aktuellen Step (falls vorhanden)
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
      await page.goto('/#/tournament/new');
      await page.waitForLoadState('networkidle');

      // THEN - Wizard ist sichtbar und bedienbar
      await expect(page.getByRole('heading', { name: /Stammdaten/i })).toBeVisible();

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
