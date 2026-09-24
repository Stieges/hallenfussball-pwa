/**
 * tests/e2e/cloud/auth.cloud.spec.ts — Task T4 (`.superpowers/sdd/2026-09-24-testumgebung/
 * task-T4-brief.md`), Spec 1.
 *
 * Läuft in `cloud-desktop` + `cloud-mobile` (Playwright startet den Standard-`page`-Fixture aus
 * `fixtures.ts`, kein `asRole()` nötig -- dieser Spec meldet sich selbst über die Oberfläche an,
 * das IST der Testgegenstand).
 *
 * Braucht einen laufenden lokalen Stack mit Seed-Daten (`npm run test:env:up`/`test:env:reset`
 * zuerst).
 *
 * Fixrunde 1 (C1, Ruling U): Der Logout-Test meldet NICHT `owner` ab -- `supabase.auth.signOut()`
 * läuft ohne `scope`-Option (`src/features/auth/context/authActions.ts:507`), Supabase-JS
 * Standard ist `scope: 'global'`. Das beendet ALLE Sessions dieses Kontos, auch die aus
 * `playwright/.auth/owner.json`, die sich jeder andere Owner-Test über `asRole('owner')` teilt --
 * das war die wahrscheinliche Ursache der "Owner-Flakiness" im Volllauf (siehe Report). Statt das
 * App-Verhalten zu ändern (Produktfrage, siehe Report), bekommt der Logout-Test einen EIGENEN
 * Seed-Nutzer (`logouttest`, `testData.ts`), den kein anderer Spec über `asRole()` verwendet.
 */

import { test, expect } from './fixtures';
import { gotoLogin, loginAsRole, logoutViaUi } from './helpers';
import { getLocalServiceRoleClient } from './helpers';
import { E2E_USERS } from './testData';

// =============================================================================
// MAILPIT (Brief: "Abfrage über die Mailpit/Inbucket-HTTP-API des lokalen Stacks, Port per
// `supabase status`") -- `getLocalServiceRoleClient()` liefert `mailpitUrl` aus derselben Quelle
// wie alles andere (Fixrunde 1, M1: keine eigene `execSync`-Kopie mehr).
//
// Fixrunde 1 (M7): KEIN globales `DELETE /api/v1/messages` mehr -- `cloud-desktop` und
// `cloud-mobile` laufen `fullyParallel` im selben Mailpit-Postfach, ein Test könnte die Mail
// löschen, auf die ein anderer (paralleler) Test wartet. Stattdessen: Testbeginn-Zeitstempel
// merken und beim Suchen nach `Created` filtern -- jeder Test sieht nur Mails, die NACH seinem
// eigenen Start verschickt wurden.
// =============================================================================

interface MailpitAddress {
  Address: string;
}

interface MailpitMessage {
  To: MailpitAddress[];
  Subject: string;
  Created: string;
}

interface MailpitMessagesResponse {
  messages: MailpitMessage[];
}

async function listMailpitMessagesSince(mailpitUrl: string, sinceIso: string): Promise<MailpitMessage[]> {
  const res = await fetch(`${mailpitUrl}/api/v1/messages`);
  if (!res.ok) {
    throw new Error(`Mailpit-Abfrage fehlgeschlagen: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as MailpitMessagesResponse;
  return data.messages.filter((m) => m.Created >= sinceIso);
}

/** Wartet bis zu `timeoutMs` auf eine Mail an `toEmail`, verschickt NACH `sinceIso`. */
async function waitForMailpitMessageSince(
  mailpitUrl: string,
  toEmail: string,
  sinceIso: string,
  timeoutMs = 10000
): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;
  let lastCount = -1;
  while (Date.now() < deadline) {
    const messages = await listMailpitMessagesSince(mailpitUrl, sinceIso);
    lastCount = messages.length;
    const match = messages.find((m) => m.To.some((to) => to.Address === toEmail));
    if (match) {
      return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(
    `waitForMailpitMessageSince: keine Mail an "${toEmail}" seit ${sinceIso} innerhalb von ${timeoutMs}ms ` +
    `(zuletzt ${lastCount} Nachricht(en) seither im Postfach).`
  );
}

/**
 * Fixrunde 1 (M6): EINE Regex für Erfolgs- UND Fehlschlag-Prüfung des Reset-Dialogs -- vorher
 * prüfte die Positiv-Seite `/E-Mail gesendet|Passwort zurücksetzen/i` und die Negativ-Seite nur
 * `/Passwort zurücksetzen/i`. Hieße der Erfolgsdialog nur "E-Mail gesendet", hätte die
 * Negativ-Prüfung nie etwas gefunden UND nie etwas widerlegt (immer "nicht sichtbar" richtig,
 * aber aus dem falschen Grund).
 */
const RESET_PASSWORD_DIALOG_NAME = /E-Mail gesendet|Passwort zurücksetzen/i;

// =============================================================================
// TESTS
// =============================================================================

test.describe('Cloud-Auth', () => {
  test('Anmelden und Abmelden mit Passwort', async ({ page }) => {
    // C1/Ruling U: eigener Seed-Nutzer, den kein anderer Spec über asRole() teilt -- signOut()
    // (scope: 'global', unverändert) darf hier niemand anderen betreffen.
    await loginAsRole(page, 'logouttest');
    await logoutViaUi(page);
  });

  test('falsches Passwort zeigt login-error-message', async ({ page }) => {
    await gotoLogin(page);
    await page.locator('[data-testid="login-email-input"]').fill(E2E_USERS.owner.email);
    await page.locator('[data-testid="login-password-input"]').fill('definitiv-falsches-passwort');
    await page.locator('[data-testid="login-submit-button"]').click();

    await expect(page.locator('[data-testid="login-error-message"]')).toBeVisible({ timeout: 10000 });
    // Muss ein Fehler zum Login sein, nicht irgendein Text -- und darf keinen Erfolg vortäuschen.
    await expect(page.locator('[data-testid="auth-avatar-button"]')).toHaveCount(0);
  });

  test('Passwort vergessen (owner): Reset-Mail kommt im lokalen Postfach an', async ({ page }) => {
    const { mailpitUrl } = getLocalServiceRoleClient();
    const testStartIso = new Date().toISOString();

    await gotoLogin(page);
    await page.locator('[data-testid="login-email-input"]').fill(E2E_USERS.owner.email);
    await page.getByRole('button', { name: 'Passwort vergessen?' }).click();

    // LoginResetPasswordDialog (kein data-testid, aria-labelledby="reset-password-title", siehe
    // src/features/auth/components/LoginDialogs.tsx) -- Rollen-/Text-Selektor statt neuem Test-Hook.
    await expect(page.getByRole('dialog', { name: RESET_PASSWORD_DIALOG_NAME })).toBeVisible({
      timeout: 10000,
    });

    const message = await waitForMailpitMessageSince(mailpitUrl, E2E_USERS.owner.email, testStartIso);
    expect(message.Subject.toLowerCase()).toContain('reset');
  });

  test('Google-Testkonto: Hinweis statt Mail, kein Versand', async ({ page }) => {
    const { mailpitUrl } = getLocalServiceRoleClient();
    const testStartIso = new Date().toISOString();

    await gotoLogin(page);
    await page.locator('[data-testid="login-email-input"]').fill(E2E_USERS.google.email);
    await page.getByRole('button', { name: 'Passwort vergessen?' }).click();

    const errorMessage = page.locator('[data-testid="login-error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
    await expect(errorMessage).toContainText('Google');

    // Kein Reset-Dialog (kein resetPasswordSent-Zustand) -- dieselbe Regex wie die Erfolgsprüfung
    // oben (M6).
    await expect(page.getByRole('dialog', { name: RESET_PASSWORD_DIALOG_NAME })).toHaveCount(0);

    // Negativbeweis: keine Mail an das Google-Testkonto seit Testbeginn, auch nach kurzer
    // Wartezeit. Ein leeres Ergebnis nach 0ms wäre kein Beweis (die Anfrage könnte noch
    // unterwegs sein) -- deshalb kurz real warten, nicht sofort prüfen.
    await page.waitForTimeout(2000);
    const messages = await listMailpitMessagesSince(mailpitUrl, testStartIso);
    expect(messages.some((m) => m.To.some((to) => to.Address === E2E_USERS.google.email))).toBe(false);
  });
});
