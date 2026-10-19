/**
 * C-SITZUNG-STILL: Hinweise bei langsamem Start und abgelaufener Anmeldung (T2-UI).
 * Szenarien: Anmelden @AN-019 (30 s ohne Antwort meldet niemanden ab), @AN-032 (langsam ≠ offline),
 * @AN-024 (abgelehnte Erneuerung: „von einem anderen Gerät aus abgemeldet“, nicht „abgelaufen“).
 *
 * Läuft nur mit `playwright.auth-slow.config.ts` (erfundene Supabase-Adresse, alle Antworten per
 * `page.route`). Bildschirmfotos nur, wenn AUTH_SLOW_SHOTS_DIR gesetzt ist.
 */

import { expect, type Page } from '@playwright/test';
import { test } from '../helpers/test-fixtures';

const SUPABASE = 'http://127.0.0.1:59999';
const TOKEN_KEY = 'sb-127-auth-token';
const SHOTS = process.env.AUTH_SLOW_SHOTS_DIR;
const OLLI = 'Olli Beispiel';

const USER = {
  id: 'user-a', aud: 'authenticated', email: 'a@example.test',
  app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z',
};

function sessionJson(expired: boolean): string {
  const exp = Math.floor(Date.now() / 1000) + (expired ? -60 : 3600);
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'user-a', role: 'authenticated', exp })}.sig`;
  return JSON.stringify({
    access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp,
    refresh_token: 'refresh-a', user: USER,
  });
}

async function seedStoredSession(page: Page, expired: boolean): Promise<void> {
  const raw = sessionJson(expired);
  const cached = JSON.stringify({ id: 'user-a', email: 'a@example.test', name: OLLI, globalRole: 'user' });
  await page.addInitScript(([key, session, cachedUser]) => {
    window.localStorage.setItem(key, session);
    window.localStorage.setItem('auth:cachedUser', cachedUser);
  }, [TOKEN_KEY, raw, cached]);
}

const JSON_HEADERS = { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' };

test.describe('Auth: langsamer Server und abgelehnte Erneuerung', () => {
  test('@AN-019 @AN-032 30 s ohne Antwort: Hinweis „Server antwortet langsam“, kein „offline“, angemeldet; endet bei Antwort', async ({ page }, testInfo) => {
    await seedStoredSession(page, false);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route(`${SUPABASE}/**`, async (route) => {
      const url = route.request().url();
      if (url.includes('/rest/v1/profiles')) {
        await gate; // der Server antwortet nicht, bis der Test es erlaubt
        await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify({ display_name: OLLI, avatar_url: null, role: 'user' }) });
        return;
      }
      if (url.includes('/auth/v1/user')) {
        await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify(USER) });
        return;
      }
      await route.fulfill({ status: 200, headers: JSON_HEADERS, body: '[]' });
    });

    await page.clock.install(); // Fake-Zeit: 30 s ohne Antwort in Millisekunden
    await page.goto('/');
    await page.clock.runFor(4_000);
    await expect(page.getByTestId('server-slow')).toHaveCount(0);

    await page.clock.runFor(26_000); // insgesamt 30 s ohne Antwort
    const hint = page.getByTestId('server-slow');
    await expect(hint).toBeVisible();
    await expect(hint).toHaveText('Server antwortet langsam');
    await expect(page.getByText(/offline|keine Verbindung/i)).toHaveCount(0);
    expect(await page.evaluate((k) => window.localStorage.getItem(k), TOKEN_KEY)).not.toBeNull();
    await expect(page.getByTestId('signed-out-elsewhere')).toHaveCount(0);
    // Olli bleibt angemeldet (N1): Avatar im Kopf, kein „Anmelden“, die Nutzerkopie ist noch da.
    await expect(page.getByTestId('auth-avatar-button')).toBeVisible();
    await expect(page.getByTestId('auth-login-button')).toHaveCount(0);
    await expect(page.getByTestId('auth-mobile-button')).toHaveCount(0);
    if (!testInfo.project.name.startsWith('handy')) {
      await expect(page.getByText(OLLI, { exact: true })).toBeVisible();
    }
    expect(await page.evaluate(() => window.localStorage.getItem('auth:cachedUser'))).not.toBeNull();
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/server-antwortet-langsam-${testInfo.project.name}.png` });
    }

    release();
    await page.clock.runFor(1_000);
    await expect(hint).toBeHidden();
  });

  test('@AN-024 Server lehnt die Erneuerung ab: „Du wurdest von einem anderen Gerät aus abgemeldet“, nicht „abgelaufen“', async ({ page }, testInfo) => {
    await seedStoredSession(page, true);
    await page.route(`${SUPABASE}/**`, async (route) => {
      if (route.request().url().includes('/auth/v1/token')) {
        await route.fulfill({
          status: 400, headers: JSON_HEADERS,
          body: JSON.stringify({ code: 'refresh_token_not_found', message: 'Invalid Refresh Token: Refresh Token Not Found' }),
        });
        return;
      }
      await route.fulfill({ status: 200, headers: JSON_HEADERS, body: '[]' });
    });

    await page.goto('/');
    const notice = page.getByTestId('signed-out-elsewhere').first();
    await expect(notice).toBeVisible({ timeout: 10_000 });
    await expect(notice).toContainText('Du wurdest von einem anderen Gerät aus abgemeldet');
    await expect(page.getByText(/abgelaufen/i)).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Lade...')).toHaveCount(0);
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/abgemeldet-anderes-geraet-${testInfo.project.name}.png` });
    }
  });
});
