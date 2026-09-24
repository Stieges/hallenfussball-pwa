/**
 * tests/e2e/flows/production-lockout.spec.ts — Beweis, dass das offline-Projekt (Port 3000)
 * die Produktion NIEMALS erreicht (Task T3, Brief Abschnitt 1, Nachweis 2).
 *
 * Läuft ausschließlich in den offline-Projekten (playwright.config.ts: webServer "offline"
 * setzt `env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }` EXPLIZIT — unabhängig
 * davon, ob lokal eine `.env.local` mit echten Werten existiert. Diese Datei selbst liest
 * `.env.local` nie.
 *
 * Zwei Nachweise:
 *  1. `isSupabaseConfigured === false`: Kein direkter Zugriff auf das Modul (das wäre ein
 *     Test-Hook im Produktionscode) — stattdessen ein bereits vorhandenes, sichtbares Merkmal:
 *     `login()`/`register()` (`src/features/auth/context/authActions.ts`) geben bei
 *     `!isSupabaseConfigured` GENAU `AUTH_ERRORS.CLOUD_NOT_AVAILABLE_GUEST` zurück (i18n-Key
 *     `auth:cloudNotAvailableGuest`, deutscher Text "Cloud-Funktionen sind nicht verfügbar.
 *     Bitte als Gast fortfahren."), angezeigt über `[data-testid="login-error-message"]`. Ein
 *     Login-Versuch, der GENAU diesen Text zeigt, kann nur zustande kommen, wenn
 *     `isSupabaseConfigured === false` ist (die einzige Stelle, die diesen Fehler erzeugt).
 *  2. Netzwerk-Mitschnitt über den gesamten Testlauf dieser Datei: keine Anfrage an
 *     `*.supabase.co` — auch nicht während normaler Navigation (Dashboard, Login-Formular).
 */

import { test, expect } from '../helpers/test-fixtures';

test.describe('Produktions-Sperre (offline-Projekt)', () => {
  test('isSupabaseConfigured === false UND keine Anfrage an *.supabase.co im ganzen Lauf', async ({ page }) => {
    const supabaseRequests: string[] = [];
    const allRequestUrls: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      allRequestUrls.push(url);
      if (url.includes('.supabase.co')) {
        supabaseRequests.push(url);
      }
    });

    // Navigation durch mehrere Screens -- nicht nur den Login-Screen -- damit der Mitschnitt
    // "über den ganzen Lauf" (Brief) wirklich mehrere App-Bereiche abdeckt.
    await page.goto('/#/');
    await page.waitForLoadState('networkidle');

    // Zum Login-Screen (gleiche Logik wie tests/e2e/flows/auth.spec.ts#navigateToLogin).
    const loginEmail = page.locator('[data-testid="login-email-input"]');
    if (!(await loginEmail.isVisible({ timeout: 1000 }).catch(() => false))) {
      const mobileAuthButton = page.locator('[data-testid="auth-mobile-button"]');
      if (await mobileAuthButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await mobileAuthButton.click({ force: true });
        await page.locator('[data-testid="bottomsheet-login"]').click();
      } else {
        await page.locator('[data-testid="auth-login-button"]').click({ force: true });
      }
      await expect(loginEmail).toBeVisible({ timeout: 5000 });
    }

    // Nachweis 1: Login-Versuch (irgendeine E-Mail/Passwort -- der Guard in authActions.ts
    // greift VOR jedem Netzwerkaufruf) zeigt exakt die "Cloud nicht verfügbar"-Meldung.
    await page.locator('[data-testid="login-email-input"]').fill('offline-probe@example.com');
    await page.locator('[data-testid="login-password-input"]').fill('irrelevant-Passwort-1!');
    await page.locator('[data-testid="login-submit-button"]').click();

    const errorMessage = page.locator('[data-testid="login-error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    await expect(errorMessage).toHaveText('Cloud-Funktionen sind nicht verfügbar. Bitte als Gast fortfahren.');

    // Weitere Navigation (Gast-Modus, "Meine Turniere" wäre ohne Konto nicht erreichbar -- also
    // zurück zum Dashboard), damit der Mitschnitt mehr als nur den Login-Screen abdeckt.
    await page.goto('/#/');
    await page.waitForLoadState('networkidle');

    // Nachweis 2: über den gesamten Lauf keine einzige Anfrage an *.supabase.co.
    expect(
      supabaseRequests,
      `Erwartet: keine Anfrage an *.supabase.co. Gefunden: ${JSON.stringify(supabaseRequests)}. ` +
      `Insgesamt ${allRequestUrls.length} Anfragen beobachtet.`
    ).toEqual([]);
    // Sicherheitsnetz: die Anfrageliste war nicht leer (der Mitschnitt hat tatsächlich etwas
    // erfasst) -- sonst wäre ein leeres supabaseRequests-Array kein Beweis, nur ein
    // funktionsunfähiger Listener.
    expect(allRequestUrls.length).toBeGreaterThan(0);
  });
});
