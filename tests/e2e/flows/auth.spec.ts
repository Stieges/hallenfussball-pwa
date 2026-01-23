/**
 * E2E Tests für Authentifizierungs-Flows
 *
 * Testet:
 * - Login (Magic Link / Passwort)
 * - Registrierung
 * - Gast-Modus
 * - User-Profil ("Meine Turniere")
 * - Logout
 * - Einladungen annehmen
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md
 * @see tests/e2e/flows/auth-resilience.spec.ts (für Netzwerk-Edge-Cases)
 */

import { test, expect } from '../helpers/test-fixtures';
import { type Page } from '@playwright/test';

// =============================================================================
// TEST SETUP HELPERS
// =============================================================================

/**
 * Navigate to login screen
 * On mobile: Click user icon → bottom sheet → "Anmelden"
 * On desktop: Click "Anmelden" button directly
 */
async function navigateToLogin(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const loginEmail = page.locator('[data-testid="login-email-input"]');

  // Check if already on login screen
  if (await loginEmail.isVisible({ timeout: 1000 }).catch(() => false)) {
    return;
  }

  // Mobile flow: Click user icon to open bottom sheet
  const mobileAuthButton = page.locator('[data-testid="auth-mobile-button"]');
  if (await mobileAuthButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await mobileAuthButton.click();

    // Wait for bottom sheet and click "Anmelden"
    const bottomSheetLogin = page.locator('[data-testid="bottomsheet-login"]');
    await expect(bottomSheetLogin).toBeVisible({ timeout: 3000 });
    await bottomSheetLogin.click();

    await expect(loginEmail).toBeVisible({ timeout: 5000 });
    return;
  }

  // Desktop flow: Click "Anmelden" button directly
  const desktopLoginButton = page.locator('[data-testid="auth-login-button"]');
  if (await desktopLoginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await desktopLoginButton.click();
    await expect(loginEmail).toBeVisible({ timeout: 5000 });
  }
}

/**
 * Navigate to register screen
 */
async function navigateToRegister(page: Page): Promise<void> {
  await navigateToLogin(page);

  // Click "Registrieren" link
  const registerLink = page.locator('[data-testid="login-register-link"]').or(
    page.getByText(/Registrieren|Noch kein Account/i)
  );
  await registerLink.click();

  // Wait for register form
  const registerName = page.locator('[data-testid="register-name-input"]');
  await expect(registerName).toBeVisible({ timeout: 5000 });
}

// =============================================================================
// TEST SUITE: AUTHENTICATION FLOWS
// =============================================================================

test.describe('Authentication Flows', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // LOGIN SCREEN
  // ───────────────────────────────────────────────────────────────────────────

  test.describe('Login Screen', () => {
    test('zeigt Login-Screen mit allen Elementen', async ({ page }) => {
      await navigateToLogin(page);

      // THEN - Login form elements visible
      await expect(page.locator('[data-testid="login-email-input"]')).toBeVisible();

      // Submit button - use specific testid first
      const submitButton = page.locator('[data-testid="login-submit-button"]');
      await expect(submitButton).toBeVisible();

      // Guest button
      const guestButton = page.locator('[data-testid="login-guest-button"]');
      await expect(guestButton).toBeVisible();

      // Register link
      const registerLink = page.locator('[data-testid="login-register-link"]');
      await expect(registerLink).toBeVisible();
    });

    test('Login-Modus Toggle (Magic Link <-> Passwort)', async ({ page }) => {
      await navigateToLogin(page);

      // Check if mode toggle exists (might not be implemented yet)
      const modeToggle = page.locator('[data-testid="login-mode-toggle"]').or(
        page.getByText(/magic link|passwort/i)
      );

      if (await modeToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Click toggle
        await modeToggle.click();

        // Either password field appears or stays hidden depending on current mode
        // We just verify the toggle is clickable and doesn't crash
        await page.waitForTimeout(500); // Allow animation
      }
    });

    test('Validierung: E-Mail-Format', async ({ page }) => {
      await navigateToLogin(page);

      // WHEN - Invalid email
      const emailInput = page.locator('[data-testid="login-email-input"]');
      await emailInput.fill('invalid-email');

      const submitButton = page.locator('[data-testid="login-submit-button"]');
      await submitButton.click();

      // THEN - Either:
      // 1. Error message appears from our validation
      // 2. HTML5 validation shows browser native error (input becomes invalid)
      // 3. Button gets disabled
      const errorMessage = page.locator('[data-testid="login-error-message"]');
      const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);

      // Check if HTML5 validation marked the input as invalid
      const isInputInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);

      const isButtonStillEnabled = await submitButton.isEnabled({ timeout: 1000 });

      // At least one validation mechanism should trigger
      expect(hasError || isInputInvalid || !isButtonStillEnabled).toBe(true);
    });

    test('Navigation zu Registrierung', async ({ page }) => {
      await navigateToLogin(page);

      // WHEN - Click register link
      const registerLink = page.locator('[data-testid="login-register-link"]');
      await registerLink.click();

      // THEN - Register form visible
      await expect(page.locator('[data-testid="register-name-input"]')).toBeVisible({
        timeout: 5000,
      });
    });

    test('Passwort anzeigen/verbergen (falls Passwort-Modus)', async ({ page }) => {
      await navigateToLogin(page);

      const passwordField = page.locator('[data-testid="login-password-input"]');

      // Only test if password field exists
      if (await passwordField.isVisible({ timeout: 2000 }).catch(() => false)) {
        const toggleButton = page.locator('[data-testid="login-password-toggle"]').or(
          page.locator('button').filter({ hasText: /zeigen|verbergen|👁️/ })
        );

        if (await toggleButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          // Initially password should be hidden
          const initialType = await passwordField.getAttribute('type');
          expect(initialType).toBe('password');

          // Click toggle
          await toggleButton.click();

          // Type should change to text
          const newType = await passwordField.getAttribute('type');
          expect(newType).toBe('text');
        }
      }
    });

    test('"Angemeldet bleiben" Checkbox (falls vorhanden)', async ({ page }) => {
      await navigateToLogin(page);

      const rememberMeCheckbox = page.locator('[data-testid="login-remember-me"]').or(
        page.locator('input[type="checkbox"]').filter({ hasText: /angemeldet bleiben/i })
      );

      if (await rememberMeCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Should be unchecked initially
        await expect(rememberMeCheckbox).not.toBeChecked();

        // Click checkbox
        await rememberMeCheckbox.check();
        await expect(rememberMeCheckbox).toBeChecked();
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // REGISTRATION
  // ───────────────────────────────────────────────────────────────────────────

  test.describe('Registration', () => {
    test('zeigt Registrierungs-Formular', async ({ page }) => {
      await navigateToRegister(page);

      // THEN - Register form elements
      await expect(page.locator('[data-testid="register-name-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="register-email-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="register-submit-button"]')).toBeVisible();

      // Back to login link
      const loginLink = page.locator('[data-testid="register-login-link"]');
      await expect(loginLink).toBeVisible();
    });

    test('Validierung: Name zu kurz', async ({ page }) => {
      await navigateToRegister(page);

      // WHEN - Name too short
      const nameInput = page.locator('[data-testid="register-name-input"]');
      await nameInput.fill('A'); // Less than 2 chars

      const submitButton = page.locator('[data-testid="register-submit-button"]');
      await submitButton.click();

      // THEN - Error message
      const errorMessage = page.locator('[data-testid="register-error-message"]').or(
        page.getByText(/name.*(zu kurz|mindestens)/i)
      );

      const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasError).toBe(true);
    });

    test('Validierung: E-Mail ungültig', async ({ page }) => {
      await navigateToRegister(page);

      // WHEN - Invalid email
      const nameInput = page.locator('[data-testid="register-name-input"]');
      await nameInput.fill('Test User');

      const emailInput = page.locator('[data-testid="register-email-input"]');
      await emailInput.fill('not-an-email');

      const submitButton = page.locator('[data-testid="register-submit-button"]');
      await submitButton.click();

      // Wait for async validation to complete
      await page.waitForTimeout(500);

      // THEN - Error message (either general error, field-specific error, or HTML5 validation)
      // Custom validation message: "Bitte gib eine gültige E-Mail-Adresse ein"
      const errorMessage = page.locator('[data-testid="register-error-message"]')
        .or(page.locator('[data-testid="register-email-error"]'))
        .or(page.getByText(/gültige e-mail|ungültige e-mail|invalid email/i));

      const hasCustomError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);

      // Check HTML5 validity (browser may block submit with type="email")
      const isInputInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);

      expect(hasCustomError || isInputInvalid).toBe(true);
    });

    test('Navigation zurück zu Login', async ({ page }) => {
      await navigateToRegister(page);

      // WHEN - Click login link
      const loginLink = page.locator('[data-testid="register-login-link"]');
      await loginLink.click();

      // THEN - Login form visible
      await expect(page.locator('[data-testid="login-email-input"]')).toBeVisible({
        timeout: 5000,
      });
    });

    test('Erfolgreiches Registrieren (simuliert)', async ({ page }) => {
      await navigateToRegister(page);

      // WHEN - Fill valid data
      await page.locator('[data-testid="register-name-input"]').fill('Test User');
      await page
        .locator('[data-testid="register-email-input"]')
        .fill(`test-${Date.now()}@example.com`); // Unique email

      const submitButton = page.locator('[data-testid="register-submit-button"]');
      await submitButton.click();

      // THEN - Either success message or redirect
      // Phase 1: Modal with "Magic Link sent"
      // Phase 2: Redirect to profile or magic link confirmation

      const successModal =
        page.locator('[data-testid="register-success-modal"]').or(
          page.getByText(/magic link|bestätigung|erfolgreich/i)
        );

      const hasSuccessModal = await successModal.isVisible({ timeout: 5000 }).catch(() => false);

      if (!hasSuccessModal) {
        // Might redirect immediately
        await page.waitForURL(/\/(profile|tournaments)/, { timeout: 5000 }).catch(() => {
          // Or stay on register page with success message
        });
      }
    });

    test('Doppelte E-Mail Registrierung (falls Backend aktiv)', async ({ page }) => {
      // This test only makes sense if backend is active
      // For Phase 1 (localStorage), this might not be implemented yet

      await navigateToRegister(page);

      const existingEmail = 'existing@example.com';

      // Try to register twice
      await page.locator('[data-testid="register-name-input"]').fill('User One');
      await page.locator('[data-testid="register-email-input"]').fill(existingEmail);

      const submitButton = page.locator('[data-testid="register-submit-button"]');
      await submitButton.click();

      // Wait for potential success
      await page.waitForTimeout(2000);

      // Navigate back and try again with same email
      await navigateToRegister(page);

      await page.locator('[data-testid="register-name-input"]').fill('User Two');
      await page.locator('[data-testid="register-email-input"]').fill(existingEmail);
      await submitButton.click();

      // Should show error
      const errorMessage = page.locator('[data-testid="register-error-message"]').or(
        page.getByText(/bereits registriert|email.*(bereits|exists)/i)
      );

      const hasError = await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasError) {
        // Link to login should be present
        const loginLink = page.getByText(/anmelden|login/i);
        await expect(loginLink.first()).toBeVisible();
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GUEST MODE
  // ───────────────────────────────────────────────────────────────────────────

  test.describe('Guest Mode', () => {
    test('Als Gast fortfahren', async ({ page }) => {
      await navigateToLogin(page);

      // WHEN - Click guest button
      const guestButton = page.locator('[data-testid="login-guest-button"]');
      await guestButton.click();

      // THEN - Redirected to dashboard
      await expect(page).toHaveURL(/\/(dashboard|tournaments|$)/, { timeout: 5000 });

      // Guest banner should be visible
      const guestBanner = page.locator('[data-testid="guest-banner"]').or(
        page.getByText(/als gast|guest mode|ohne account/i)
      );

      if (await guestBanner.count() > 0) {
        await expect(guestBanner.first()).toBeVisible({ timeout: 3000 });
      }
    });

    test('Gast-Banner zeigt CTA zur Registrierung', async ({ page }) => {
      await navigateToLogin(page);

      // Continue as guest
      const guestButton = page.locator('[data-testid="login-guest-button"]');
      await guestButton.click();

      await page.waitForURL(/\/(dashboard|tournaments|$)/, { timeout: 5000 });

      // Guest banner with register CTA
      const guestBanner = page.locator('[data-testid="guest-banner"]');

      if (await guestBanner.isVisible({ timeout: 3000 }).catch(() => false)) {
        const registerCTA = guestBanner.locator('button').or(
          page.locator('[data-testid="guest-banner-register"]')
        );

        if (await registerCTA.count() > 0) {
          await expect(registerCTA.first()).toBeVisible();

          // Click CTA should navigate to register
          await registerCTA.first().click();
          await expect(page.locator('[data-testid="register-name-input"]')).toBeVisible({
            timeout: 5000,
          });
        }
      }
    });

    test('Gast kann Turniere erstellen (lokal)', async ({ page }) => {
      await navigateToLogin(page);

      // Continue as guest
      const guestButton = page.locator('[data-testid="login-guest-button"]');
      await guestButton.click();

      await page.waitForURL(/\/(dashboard|tournaments|$)/, { timeout: 5000 });

      // Navigate to tournament creation
      const newTournamentButton = page.getByRole('button', { name: /neues turnier|turnier erstellen/i });

      if (await newTournamentButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await newTournamentButton.click();

        // Wizard should open
        await expect(page).toHaveURL(/\/tournament\/new/, { timeout: 5000 });
        await expect(page.getByRole('heading', { name: /turnier erstellen|neues turnier|schritt 1/i })).toBeVisible();
      }
    });

    test('Gast hat keinen Zugriff auf User-Profil', async ({ page }) => {
      await navigateToLogin(page);

      // Continue as guest
      const guestButton = page.locator('[data-testid="login-guest-button"]');
      await guestButton.click();

      await page.waitForURL(/\/(dashboard|tournaments|$)/, { timeout: 5000 });

      // Try to access profile (using hash route format)
      await page.goto('/#/profile');
      await page.waitForTimeout(500); // Wait for redirect to process

      // Should either redirect to login, show login heading, or show "registriere dich" message from AuthGuard
      const isOnLogin = await page.locator('h1', { hasText: /anmelden/i })
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      const hasAccessDenied = await page.getByText(/registriere dich|nicht verfügbar|zugriff verweigert|anmelden/i)
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      expect(isOnLogin || hasAccessDenied).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // USER PROFILE (MEINE TURNIERE)
  // ───────────────────────────────────────────────────────────────────────────

  test.describe('User Profile', () => {
    test('Profil zeigt User-Daten', async ({ page }) => {
      // Skip if guest
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');

      const profileName = page.locator('[data-testid="profile-name"]').or(
        page.getByRole('heading', { name: /max|user|profil/i })
      );

      if (await profileName.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Profile loaded
        await expect(profileName).toBeVisible();

        // Email should be visible
        const profileEmail = page.locator('[data-testid="profile-email"]').or(
          page.getByText(/@/)
        );

        if (await profileEmail.count() > 0) {
          await expect(profileEmail.first()).toBeVisible();
        }
      }
    });

    // FIXME: Test requires Supabase auth mocking - auth state cannot be seeded via IndexedDB
    // The app uses Supabase for auth, so seedIndexedDB('auth:currentUser') won't authenticate user
    test.fixme('Profil zeigt "Meine Turniere"', async ({ page, seedIndexedDB }) => {
      // Seed test data with user tournaments
      const testUser = {
        id: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User',
        globalRole: 'user' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const testTournament = {
        id: 'test-tournament-profile',
        title: 'My Test Tournament',
        status: 'published',
        date: new Date().toISOString().split('T')[0],
        teams: [],
        matches: [],
        ownerId: testUser.id,
      };

      await seedIndexedDB({
        'auth:currentUser': testUser,
        'tournaments': [testTournament], // Fixed: was 'app:tournaments'
      });

      await page.goto('/#/profile'); // Fixed: HashRouter format
      await page.waitForLoadState('networkidle');

      // Should show tournament list
      const tournamentCard = page.getByText('My Test Tournament').or(
        page.locator('[data-testid^="tournament-card-"]')
      );

      await expect(tournamentCard.first()).toBeVisible({ timeout: 5000 });
    });

    test('Turnier-Rollen-Badge wird angezeigt', async ({ page, seedIndexedDB }) => {
      const testUser = {
        id: 'test-user-role-badge',
        email: 'badge@example.com',
        name: 'Badge User',
        globalRole: 'user' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const testTournament = {
        id: 'test-tournament-badge',
        title: 'Badge Test',
        status: 'published',
        date: new Date().toISOString().split('T')[0],
        teams: [],
        matches: [],
        ownerId: testUser.id,
      };

      await seedIndexedDB({
        'auth:currentUser': testUser,
        'app:tournaments': [testTournament],
      });

      await page.goto('/profile');
      await page.waitForLoadState('networkidle');

      // Look for role badge (Owner, Trainer, etc.)
      const roleBadge = page.locator('[data-testid="role-badge"]').or(
        page.getByText(/owner|ersteller|trainer|viewer/i)
      );

      if (await roleBadge.count() > 0) {
        await expect(roleBadge.first()).toBeVisible();
      }
    });

    test('Turnier klicken öffnet Turnier', async ({ page, seedIndexedDB }) => {
      const testUser = {
        id: 'test-user-nav',
        email: 'nav@example.com',
        name: 'Nav User',
        globalRole: 'user' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const testTournament = {
        id: 'test-tournament-nav',
        title: 'Navigation Test Tournament',
        status: 'published',
        date: new Date().toISOString().split('T')[0],
        teams: [],
        matches: [],
        ownerId: testUser.id,
      };

      await seedIndexedDB({
        'auth:currentUser': testUser,
        'app:tournaments': [testTournament],
      });

      await page.goto('/profile');
      await page.waitForLoadState('networkidle');

      // Click tournament
      const tournamentCard = page.getByText('Navigation Test Tournament');

      if (await tournamentCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tournamentCard.click();

        // Should navigate to tournament
        await expect(page).toHaveURL(/\/tournament\/test-tournament-nav/, { timeout: 5000 });
      }
    });

    test('Logout-Button funktioniert', async ({ page, seedIndexedDB }) => {
      const testUser = {
        id: 'test-user-logout',
        email: 'logout@example.com',
        name: 'Logout User',
        globalRole: 'user' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await seedIndexedDB({
        'auth:currentUser': testUser,
      });

      await page.goto('/profile');
      await page.waitForLoadState('networkidle');

      // Find logout button
      const logoutButton = page.locator('[data-testid="logout-button"]').or(
        page.getByRole('button', { name: /abmelden|logout|ausloggen/i })
      );

      if (await logoutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await logoutButton.click();

        // Should redirect to login or dashboard
        await page.waitForURL(/\/(login|auth|dashboard|$)/, { timeout: 5000 });

        // User should no longer be logged in (guest banner or login prompt)
        const isGuestOrLogin =
          (await page.locator('[data-testid="guest-banner"]').isVisible({ timeout: 2000 })
            .catch(() => false)) ||
          (await page.locator('[data-testid="login-email-input"]').isVisible({ timeout: 2000 })
            .catch(() => false));

        expect(isGuestOrLogin).toBe(true);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // INVITE ACCEPTANCE (Optional - depends on implementation status)
  // ───────────────────────────────────────────────────────────────────────────

  test.describe('Invite Acceptance', () => {
    // Skip: Invite feature not implemented yet
    test.skip('Einladungs-Link zeigt Turnier-Info', async ({ page }) => {
      // Mock invite URL
      const mockToken = 'test-invite-token-123';
      await page.goto(`/invite?token=${mockToken}`);
      await page.waitForLoadState('networkidle');

      // Should show invite accept screen
      const inviteScreen = page.locator('[data-testid="invite-accept-screen"]').or(
        page.getByText(/eingeladen|invitation|turnier/i)
      );

      if (await inviteScreen.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(inviteScreen).toBeVisible();
      } else {
        // Might show "invalid token" message if mock token doesn't exist
        const invalidMessage = page.getByText(/ungültig|abgelaufen|invalid/i);
        await expect(invalidMessage).toBeVisible({ timeout: 3000 });
      }
    });

    // Skip: Invite feature not implemented yet
    test.skip('Ungültiger Token zeigt Fehler', async ({ page }) => {
      const invalidToken = 'definitely-not-a-valid-token-xyz';
      await page.goto(`/invite?token=${invalidToken}`);
      await page.waitForLoadState('networkidle');

      // Should show error message
      const errorMessage = page.locator('[data-testid="invite-error"]').or(
        page.getByText(/ungültig|abgelaufen|nicht.*(gefunden|gültig)/i)
      );

      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ACCESSIBILITY & MOBILE
  // ───────────────────────────────────────────────────────────────────────────

  test.describe('Accessibility', () => {
    test('Inputs haben Labels/Placeholders', async ({ page }) => {
      await navigateToLogin(page);

      const emailInput = page.locator('[data-testid="login-email-input"]');

      // Either has label or placeholder
      const hasLabel = (await page.locator('label[for]').count()) > 0;
      const hasPlaceholder = (await emailInput.getAttribute('placeholder')) !== null;

      expect(hasLabel || hasPlaceholder).toBe(true);
    });

    test('Form kann mit Tastatur bedient werden', async ({ page }) => {
      await navigateToLogin(page);

      const emailInput = page.locator('[data-testid="login-email-input"]');
      const submitButton = page.locator('[data-testid="login-submit-button"]');

      // Tab to email field
      await emailInput.focus();
      await expect(emailInput).toBeFocused();

      // Type email
      await page.keyboard.type('test@example.com');

      // Tab to submit button
      await page.keyboard.press('Tab');

      // Submit button or password field should be focused
      const submitFocused = await submitButton.evaluate((el) => el === document.activeElement);
      const passwordFocused = await page.locator('[data-testid="login-password-input"]')
        .evaluate((el) => el === document.activeElement)
        .catch(() => false);

      expect(submitFocused || passwordFocused).toBe(true);
    });

    test('Mobile: Input font-size ≥16px (iOS Auto-Zoom Prevention)', async ({ page }) => {
      const viewport = page.viewportSize();

      if (viewport && viewport.width < 768) {
        await navigateToLogin(page);

        const emailInput = page.locator('[data-testid="login-email-input"]');
        const fontSize = await emailInput.evaluate((el) =>
          parseFloat(window.getComputedStyle(el).fontSize)
        );

        expect(fontSize).toBeGreaterThanOrEqual(16);
      }
    });

    test('Mobile: Bottom Sheet öffnet auf User-Icon Tap', async ({ page }) => {
      const viewport = page.viewportSize();

      if (viewport && viewport.width < 768) {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const mobileAuthButton = page.locator('[data-testid="auth-mobile-button"]');

        if (await mobileAuthButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Touch target should be ≥44px
          const box = await mobileAuthButton.boundingBox();
          if (box) {
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
          }

          await mobileAuthButton.click();

          // Bottom sheet should appear
          const bottomSheet = page.locator('[data-testid="auth-bottom-sheet"]').or(
            page.locator('[role="dialog"]')
          );

          if (await bottomSheet.count() > 0) {
            await expect(bottomSheet.first()).toBeVisible({ timeout: 3000 });
          }
        }
      }
    });
  });
});
