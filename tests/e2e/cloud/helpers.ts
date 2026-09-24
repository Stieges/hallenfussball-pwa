/**
 * tests/e2e/cloud/helpers.ts — gemeinsame Helfer für die "cloud"-E2E-Tests (Task T3,
 * .superpowers/sdd/2026-09-24-testumgebung/task-T3-brief.md).
 *
 * Importiert ausschließlich aus `tests/e2e/cloud/testData.ts` (einzige Quelle für
 * E-Mails/Passwort/Rollen) — keine Werte hier verstreut nochmal literal.
 */

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { E2E_USERS, E2E_TEST_PASSWORD, type E2EUserKey } from './testData';

// =============================================================================
// LOGIN (über die Oberfläche, Brief Abschnitt 2)
// =============================================================================

/**
 * Öffnet den Login-Screen. Gleiche Logik wie `tests/e2e/flows/auth.spec.ts#navigateToLogin`
 * (dort für die offline-Suite, hier für die cloud-Suite dupliziert statt geteilt importiert —
 * die offline-Datei liegt außerhalb von `tests/e2e/cloud`, das die cloud-Projekte laut Brief
 * exklusiv als `testDir` nutzen).
 */
export async function gotoLogin(page: Page): Promise<void> {
  await page.goto('/#/');
  await page.waitForLoadState('networkidle');

  const loginEmail = page.locator('[data-testid="login-email-input"]');
  if (await loginEmail.isVisible({ timeout: 1000 }).catch(() => false)) {
    return;
  }

  const mobileAuthButton = page.locator('[data-testid="auth-mobile-button"]');
  if (await mobileAuthButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await mobileAuthButton.click({ force: true });
    const bottomSheetLogin = page.locator('[data-testid="bottomsheet-login"]');
    await expect(bottomSheetLogin).toBeVisible({ timeout: 3000 });
    await bottomSheetLogin.click();
    await expect(loginEmail).toBeVisible({ timeout: 5000 });
    return;
  }

  const desktopLoginButton = page.locator('[data-testid="auth-login-button"]');
  await desktopLoginButton.click({ force: true });
  await expect(loginEmail).toBeVisible({ timeout: 5000 });
}

/**
 * Meldet `userKey` über die Oberfläche an (login-email-input/login-password-input/
 * login-submit-button, Brief-Vorgabe — kein direkter Supabase-Client-Aufruf). Wartet danach auf
 * ein sichtbares "angemeldet"-Merkmal (`auth-avatar-button`, gesetzt sobald `isAuthenticated`).
 *
 * `userKey` muss ein Konto mit Passwort haben (`E2E_USERS`, alle außer `google` — Login per
 * Passwort, `google` hat bewusst keines, siehe `scripts/e2e-seed.ts`).
 */
export async function loginAsRole(page: Page, userKey: Exclude<E2EUserKey, 'google'>): Promise<void> {
  const user = E2E_USERS[userKey];
  await gotoLogin(page);

  await page.locator('[data-testid="login-email-input"]').fill(user.email);
  await page.locator('[data-testid="login-password-input"]').fill(E2E_TEST_PASSWORD);
  await page.locator('[data-testid="login-submit-button"]').click();

  await expect(page.locator('[data-testid="auth-avatar-button"]')).toBeVisible({ timeout: 15000 });
}

// =============================================================================
// SYNC-STATUS (Brief Abschnitt 3)
// =============================================================================

export interface WaitForSyncOptions {
  /** Timeout in ms, Default 15000. */
  timeoutMs?: number;
}

/**
 * Wartet, bis die `SyncStatusBar` (`data-testid="sync-status"`) `data-state="idle"` UND
 * `data-pending="0"` meldet. Nutzt `page.waitForFunction`, weil beide Attribute gleichzeitig
 * erfüllt sein müssen (kein reines `toHaveAttribute`, das nur ein Attribut auf einmal prüft).
 *
 * Wirft mit einer sprechenden Fehlermeldung (aktueller state/pending), wenn das Timeout
 * abläuft — kein stilles Timeout von Playwright selbst.
 */
export async function waitForSync(page: Page, options: WaitForSyncOptions = {}): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 15000;
  const locator = page.locator('[data-testid="sync-status"]');
  await expect(locator).toBeVisible({ timeout: timeoutMs });

  try {
    await expect(locator).toHaveAttribute('data-state', 'idle', { timeout: timeoutMs });
    await expect(locator).toHaveAttribute('data-pending', '0', { timeout: timeoutMs });
  } catch {
    const state = await locator.getAttribute('data-state');
    const pending = await locator.getAttribute('data-pending');
    throw new Error(
      `waitForSync: sync-status wurde nicht idle innerhalb von ${timeoutMs}ms ` +
      `(data-state="${state}", data-pending="${pending}").`
    );
  }
}
