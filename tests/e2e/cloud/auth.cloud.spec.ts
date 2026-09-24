/**
 * tests/e2e/cloud/auth.cloud.spec.ts — Task T4 (`.superpowers/sdd/2026-09-24-testumgebung/
 * task-T4-brief.md`), Spec 1.
 *
 * Läuft in `cloud-desktop` + `cloud-mobile` (Playwright startet den Standard-`page`-Fixture aus
 * `fixtures.ts`, kein `asRole()` nötig -- dieser Spec meldet sich selbst über die Oberfläche an,
 * das IST der Testgegenstand).
 *
 * Braucht einen laufenden lokalen Stack mit Seed-Daten (`npm run test:env:up`/`test:env:reset`
 * zuerst) UND die `supabase`-CLI im PATH (für `supabase status -o json`, Mailpit-URL).
 */

import { execSync } from 'node:child_process';
import { test, expect } from './fixtures';
import { gotoLogin, loginAsRole, logoutViaUi } from './helpers';
import { E2E_USERS } from './testData';

// =============================================================================
// MAILPIT (Brief: "Abfrage über die Mailpit/Inbucket-HTTP-API des lokalen Stacks, Port per
// `supabase status`") -- dieselbe Quelle wie `scripts/lib/localSupabaseStatus.ts`, hier per
// eigenem `execSync`-Aufruf statt Import, weil dieser Spec unter Playwright (Browser-Test-Runner)
// läuft, nicht unter `tsx`/Node-Skript-Kontext wie der Seed.
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

function getMailpitUrl(): string {
  const raw = execSync('supabase status -o json', { encoding: 'utf8' });
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('`supabase status -o json` lieferte kein Objekt.');
  }
  const mailpitUrl = (parsed as Record<string, unknown>).MAILPIT_URL;
  if (typeof mailpitUrl !== 'string') {
    throw new Error('`supabase status -o json` enthält kein MAILPIT_URL -- läuft der lokale Stack?');
  }
  return mailpitUrl;
}

async function clearMailpit(mailpitUrl: string): Promise<void> {
  const res = await fetch(`${mailpitUrl}/api/v1/messages`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Mailpit-Postfach leeren fehlgeschlagen: ${res.status} ${res.statusText}`);
  }
}

async function listMailpitMessages(mailpitUrl: string): Promise<MailpitMessage[]> {
  const res = await fetch(`${mailpitUrl}/api/v1/messages`);
  if (!res.ok) {
    throw new Error(`Mailpit-Abfrage fehlgeschlagen: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as MailpitMessagesResponse;
  return data.messages;
}

/** Wartet bis zu `timeoutMs` auf eine Mail an `toEmail`. Wirft mit Ist-Zustand bei Timeout. */
async function waitForMailpitMessage(
  mailpitUrl: string,
  toEmail: string,
  timeoutMs = 10000
): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;
  let lastCount = -1;
  while (Date.now() < deadline) {
    const messages = await listMailpitMessages(mailpitUrl);
    lastCount = messages.length;
    const match = messages.find((m) => m.To.some((to) => to.Address === toEmail));
    if (match) {
      return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(
    `waitForMailpitMessage: keine Mail an "${toEmail}" innerhalb von ${timeoutMs}ms ` +
    `(zuletzt ${lastCount} Nachricht(en) im Postfach insgesamt).`
  );
}

// =============================================================================
// TESTS
// =============================================================================

test.describe('Cloud-Auth', () => {
  test('Anmelden und Abmelden mit Passwort', async ({ page }) => {
    await loginAsRole(page, 'owner');
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
    const mailpitUrl = getMailpitUrl();
    await clearMailpit(mailpitUrl);

    await gotoLogin(page);
    await page.locator('[data-testid="login-email-input"]').fill(E2E_USERS.owner.email);
    await page.getByRole('button', { name: 'Passwort vergessen?' }).click();

    // LoginResetPasswordDialog (kein data-testid, aria-labelledby="reset-password-title", siehe
    // src/features/auth/components/LoginDialogs.tsx) -- Rollen-/Text-Selektor statt neuem Test-Hook.
    await expect(page.getByRole('dialog', { name: /E-Mail gesendet|Passwort zurücksetzen/i })).toBeVisible({
      timeout: 10000,
    });

    const message = await waitForMailpitMessage(mailpitUrl, E2E_USERS.owner.email);
    expect(message.Subject.toLowerCase()).toContain('reset');
  });

  test('Google-Testkonto: Hinweis statt Mail, kein Versand', async ({ page }) => {
    const mailpitUrl = getMailpitUrl();
    await clearMailpit(mailpitUrl);

    await gotoLogin(page);
    await page.locator('[data-testid="login-email-input"]').fill(E2E_USERS.google.email);
    await page.getByRole('button', { name: 'Passwort vergessen?' }).click();

    const errorMessage = page.locator('[data-testid="login-error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
    await expect(errorMessage).toContainText('Google');

    // Kein Reset-Dialog (kein resetPasswordSent-Zustand).
    await expect(page.getByRole('dialog', { name: /Passwort zurücksetzen/i })).toHaveCount(0);

    // Negativbeweis: keine Mail an das Google-Testkonto, auch nach kurzer Wartezeit. Ein leeres
    // Ergebnis nach 0ms wäre kein Beweis (die Anfrage könnte noch unterwegs sein) -- deshalb
    // kurz real warten, nicht sofort prüfen.
    await page.waitForTimeout(2000);
    const messages = await listMailpitMessages(mailpitUrl);
    expect(messages.some((m) => m.To.some((to) => to.Address === E2E_USERS.google.email))).toBe(false);
  });
});
