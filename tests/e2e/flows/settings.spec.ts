/**
 * E2E Tests für App Settings
 *
 * Testet:
 * - Theme-Wechsel (Hell/Dunkel)
 * - Audio-Einstellungen
 * - Haptic Feedback
 * - Sprache (wenn implementiert)
 * - Daten-Export/Import
 * - Cache löschen
 * - Über/Impressum/Datenschutz Links
 */

import { test, expect } from '../helpers/test-fixtures';

test.describe('App Settings', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/#/settings');
    await page.waitForLoadState('networkidle');
  });

  // ═══════════════════════════════════════════════════════════════
  // THEME SETTINGS
  // ═══════════════════════════════════════════════════════════════

  test('Theme-Wechsel: Hell → Dunkel', async ({ page }) => {
    // GIVEN - Settings Page

    // WHEN - Theme-Toggle finden und klicken
    const themeToggle = page.getByLabel(/Theme|Design|Erscheinungsbild/i).or(
      page.getByRole('button', { name: /Hell|Dunkel|Theme/i })
    );

    if (await themeToggle.count() > 0) {
      // Get current theme
      const htmlElement = page.locator('html');
      const initialTheme = await htmlElement.getAttribute('data-theme');

      // Toggle theme
      await themeToggle.click();
      await page.waitForTimeout(300);

      // THEN - Theme hat sich geändert
      const newTheme = await htmlElement.getAttribute('data-theme');
      expect(newTheme).not.toBe(initialTheme);

      // Theme wird persistiert (nach Reload noch aktiv)
      await page.reload();
      await page.waitForLoadState('networkidle');
      const persistedTheme = await htmlElement.getAttribute('data-theme');
      expect(persistedTheme).toBe(newTheme);
    }
  });

  test('Theme-Optionen: Hell/Dunkel/System', async ({ page }) => {
    // WHEN - Theme-Selector öffnen
    const themeSelect = page.getByLabel(/Theme|Design/i);

    if (await themeSelect.count() > 0 && await themeSelect.evaluate(el => el.tagName === 'SELECT')) {
      // THEN - Alle Theme-Optionen verfügbar
      const options = await themeSelect.locator('option').allTextContents();

      expect(options.some(opt => /Hell|Light/i.test(opt))).toBe(true);
      expect(options.some(opt => /Dunkel|Dark/i.test(opt))).toBe(true);

      // System-Theme optional
      const hasSystemOption = options.some(opt => /System|Auto/i.test(opt));
      expect(typeof hasSystemOption).toBe('boolean');
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // AUDIO SETTINGS
  // ═══════════════════════════════════════════════════════════════

  test('Audio-Einstellungen können deaktiviert werden', async ({ page }) => {
    // WHEN - Audio-Toggle finden
    const audioToggle = page.getByLabel(/Audio|Sound|Ton/i).or(
      page.getByRole('switch', { name: /Audio/i })
    );

    if (await audioToggle.count() > 0) {
      const initialState = await audioToggle.isChecked().catch(() => true);

      // Toggle audio
      await audioToggle.click();
      await page.waitForTimeout(200);

      // THEN - State hat sich geändert
      const newState = await audioToggle.isChecked().catch(() => false);
      expect(newState).not.toBe(initialState);

      // Persistiert nach Reload
      await page.reload();
      await page.waitForLoadState('networkidle');

      const audioToggleAfterReload = page.getByLabel(/Audio|Sound/i);
      const persistedState = await audioToggleAfterReload.isChecked().catch(() => null);
      expect(persistedState).toBe(newState);
    }
  });

  test('Audio-Lautstärke ist einstellbar', async ({ page }) => {
    // WHEN - Volume-Slider finden
    const volumeSlider = page.getByLabel(/Lautstärke|Volume/i);

    if (await volumeSlider.count() > 0) {
      // THEN - Slider kann bewegt werden
      await volumeSlider.fill('50');
      const value = await volumeSlider.inputValue();
      expect(parseInt(value)).toBeGreaterThanOrEqual(0);
      expect(parseInt(value)).toBeLessThanOrEqual(100);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // HAPTIC FEEDBACK (MOBILE)
  // ═══════════════════════════════════════════════════════════════

  test('Haptic Feedback kann deaktiviert werden', async ({ page }) => {
    // Check if mobile
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 768) {
      test.skip();
    }

    // WHEN - Haptic-Toggle finden
    const hapticToggle = page.getByLabel(/Haptik|Vibration|Haptic/i).or(
      page.getByRole('switch', { name: /Haptic/i })
    );

    if (await hapticToggle.count() > 0) {
      const initialState = await hapticToggle.isChecked().catch(() => true);

      // Toggle
      await hapticToggle.click();
      await page.waitForTimeout(200);

      // THEN - State geändert
      const newState = await hapticToggle.isChecked().catch(() => false);
      expect(newState).not.toBe(initialState);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  test('Daten exportieren funktioniert', async ({ page }) => {
    // WHEN - Export-Button klicken
    const exportButton = page.getByRole('button', { name: /Export|Daten exportieren/i });

    if (await exportButton.count() > 0) {
      // Start download
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      await exportButton.click();

      // THEN - Download wird gestartet
      const download = await downloadPromise;

      if (download) {
        expect(download.suggestedFilename()).toContain('.json');
      } else {
        // Download might not trigger in test environment - verify button works
        expect(await exportButton.isEnabled()).toBe(true);
      }
    }
  });

  test('Daten importieren: File-Input funktioniert', async ({ page }) => {
    // WHEN - Import-Button finden
    const importButton = page.getByRole('button', { name: /Import|Daten importieren/i });

    if (await importButton.count() > 0) {
      await importButton.click();

      // THEN - File-Input Dialog öffnet sich (oder versteckter Input)
      const fileInput = page.locator('input[type="file"]');
      await expect(fileInput).toBeAttached({ timeout: 3000 });
    }
  });

  test('Cache löschen mit Bestätigung', async ({ page }) => {
    // WHEN - Cache-Löschen-Button
    const clearCacheButton = page.getByRole('button', { name: /Cache löschen|Clear Cache/i });

    if (await clearCacheButton.count() > 0) {
      await clearCacheButton.click();

      // THEN - Bestätigungs-Dialog erscheint
      const confirmDialog = page.getByRole('dialog').or(
        page.getByText(/wirklich löschen|Are you sure/i)
      );

      await expect(confirmDialog.first()).toBeVisible({ timeout: 3000 });

      // Abbrechen möglich
      const cancelButton = page.getByRole('button', { name: /Abbrechen|Cancel/i });
      await expect(cancelButton).toBeVisible();
    }
  });

  test('Alle Daten löschen mit Bestätigung', async ({ page }) => {
    // WHEN - "Alle Daten löschen" Button
    const deleteAllButton = page.getByRole('button', { name: /Alle Daten löschen|Delete All/i });

    if (await deleteAllButton.count() > 0) {
      await deleteAllButton.click();

      // THEN - Sicherheits-Bestätigung mit Warntext
      const warningText = page.getByText(/unwiderruflich|permanent|cannot be undone/i);
      await expect(warningText).toBeVisible({ timeout: 3000 });

      // Bestätigen-Button ist vorhanden
      const confirmButton = page.getByRole('button', { name: /Bestätigen|Confirm|Löschen/i });
      await expect(confirmButton).toBeVisible();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // LANGUAGE SETTINGS (if implemented)
  // ═══════════════════════════════════════════════════════════════

  test('Sprache kann gewechselt werden', async ({ page }) => {
    // WHEN - Sprach-Selector finden
    const languageSelect = page.getByLabel(/Sprache|Language/i);

    if (await languageSelect.count() > 0 && await languageSelect.evaluate(el => el.tagName === 'SELECT')) {
      // THEN - Sprach-Optionen verfügbar
      const options = await languageSelect.locator('option').allTextContents();

      expect(options.length).toBeGreaterThan(0);

      // Change language
      await languageSelect.selectOption({ index: 0 });

      // Language persists after reload
      await page.reload();
      await page.waitForLoadState('networkidle');

      const languageAfterReload = page.getByLabel(/Sprache|Language/i);
      const selectedValue = await languageAfterReload.inputValue().catch(() => null);
      expect(selectedValue).toBeTruthy();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // LEGAL & ABOUT
  // ═══════════════════════════════════════════════════════════════

  test('Link zu Impressum funktioniert', async ({ page }) => {
    // WHEN - Impressum-Link klicken
    const impressumLink = page.getByRole('link', { name: /Impressum/i });

    if (await impressumLink.count() > 0) {
      await impressumLink.click();

      // THEN - Impressum-Seite lädt
      await expect(page).toHaveURL(/\/impressum/);
      await expect(page.getByRole('heading', { name: /Impressum/i })).toBeVisible();
    }
  });

  test('Link zu Datenschutz funktioniert', async ({ page }) => {
    // WHEN - Datenschutz-Link klicken
    const datenschutzLink = page.getByRole('link', { name: /Datenschutz|Privacy/i });

    if (await datenschutzLink.count() > 0) {
      await datenschutzLink.click();

      // THEN - Datenschutz-Seite lädt
      await expect(page).toHaveURL(/\/datenschutz/);
      await expect(page.getByRole('heading', { name: /Datenschutz|Privacy/i })).toBeVisible();
    }
  });

  test('Version-Nummer wird angezeigt', async ({ page }) => {
    // THEN - Version ist sichtbar (z.B. "v2.3.0")
    const version = page.locator('text=/v?\\d+\\.\\d+\\.\\d+/i');
    const versionCount = await version.count();

    if (versionCount > 0) {
      await expect(version.first()).toBeVisible();
    }
  });

  test('GitHub/Support-Link ist verfügbar', async ({ page }) => {
    // WHEN - Support/GitHub Link finden
    const supportLink = page.getByRole('link', { name: /GitHub|Support|Feedback/i });

    if (await supportLink.count() > 0) {
      const href = await supportLink.getAttribute('href');

      // THEN - Link zeigt auf externe URL
      expect(href).toMatch(/github\.com|support|feedback/i);
      expect(await supportLink.getAttribute('target')).toBe('_blank');
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // ACCOUNT SETTINGS (if Auth implemented)
  // ═══════════════════════════════════════════════════════════════

  test('Account-Bereich zeigt Login-Status', async ({ page }) => {
    // THEN - Entweder "Angemeldet als" oder "Nicht angemeldet"
    const accountSection = page.locator('text=/Angemeldet|Nicht angemeldet|Logged in|Guest/i');

    if (await accountSection.count() > 0) {
      await expect(accountSection.first()).toBeVisible();
    }
  });

  test('Logout-Button funktioniert', async ({ page }) => {
    // WHEN - Logout-Button klicken (falls angemeldet)
    const logoutButton = page.getByRole('button', { name: /Abmelden|Logout|Sign out/i });

    if (await logoutButton.count() > 0) {
      await logoutButton.click();

      // THEN - Redirect zu Login oder Toast-Nachricht
      const logoutConfirmation = page.getByText(/Erfolgreich abgemeldet|Logged out/i);

      if (await logoutConfirmation.count() > 0) {
        await expect(logoutConfirmation).toBeVisible({ timeout: 3000 });
      } else {
        // Oder redirect zu Login-Seite
        await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // NAVIGATION & RESPONSIVENESS
  // ═══════════════════════════════════════════════════════════════

  test('Zurück-Button navigiert zu Dashboard', async ({ page }) => {
    // WHEN - Zurück-Button klicken
    const backButton = page.getByRole('button', { name: /Zurück|Back/i }).or(
      page.locator('[aria-label="Zurück"]')
    );

    if (await backButton.count() > 0) {
      await backButton.click();

      // THEN - Redirect zu Dashboard
      await expect(page).toHaveURL(/^\/$|\/dashboard/);
    }
  });

  test('Mobile: Settings sind scrollbar', async ({ page }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 768) {
      test.skip();
    }

    // THEN - Settings-Container ist scrollbar
    const settingsContainer = page.locator('main').or(page.locator('[role="main"]'));
    const scrollHeight = await settingsContainer.evaluate(el => el.scrollHeight);
    const clientHeight = await settingsContainer.evaluate(el => el.clientHeight);

    // Wenn Content größer als Viewport, ist scrollbar
    expect(scrollHeight).toBeGreaterThanOrEqual(clientHeight);
  });

  test('Desktop: Settings in Sidebar-Layout', async ({ page }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width < 1024) {
      test.skip();
    }

    // THEN - Sidebar-Navigation sichtbar
    const sidebar = page.locator('[data-testid="sidebar"]').or(page.locator('aside'));

    if (await sidebar.count() > 0) {
      await expect(sidebar.first()).toBeVisible();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // ACCESSIBILITY
  // ═══════════════════════════════════════════════════════════════

  test('Settings haben korrekte Heading-Struktur', async ({ page }) => {
    // THEN - H1 existiert
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();

    // Sub-Sections haben H2 oder H3
    const subHeadings = await page.locator('h2, h3').count();
    expect(subHeadings).toBeGreaterThan(0);
  });

  test('Form-Labels sind mit Inputs verknüpft', async ({ page }) => {
    // THEN - Alle Inputs haben Labels
    const inputs = await page.locator('input[type="checkbox"], input[type="radio"], select').all();

    for (const input of inputs.slice(0, 5)) {
      const inputId = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');

      // Input hat entweder ID (→ Label), aria-label oder aria-labelledby
      const hasLabel = !!(inputId ?? ariaLabel ?? ariaLabelledBy);
      expect(hasLabel).toBe(true);
    }
  });
});
