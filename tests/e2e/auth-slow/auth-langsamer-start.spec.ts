/**
 * C-SITZUNG-STILL: Hinweise bei langsamem Start und abgelaufener Anmeldung (T2-UI).
 * Szenarien: Anmelden @AN-019 (langsamer Server meldet niemanden ab), @AN-032 (langsam ≠ offline),
 * @AN-021 / Ü1.2 (abgelaufene Anmeldung mit klarer Meldung).
 *
 * Läuft nur mit `playwright.auth-slow.config.ts` (erfundene Supabase-Adresse, alle Antworten per
 * `page.route`). Bildschirmfotos nur, wenn AUTH_SLOW_SHOTS_DIR gesetzt ist.
 */

import { expect, type Page } from '@playwright/test';
import { test } from '../helpers/test-fixtures';

const SUPABASE = 'http://127.0.0.1:59999';
const TOKEN_KEY = 'sb-127-auth-token';
const SHOTS = process.env.AUTH_SLOW_SHOTS_DIR;

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
  const cached = JSON.stringify({ id: 'user-a', email: 'a@example.test', name: 'A', globalRole: 'user' });
  await page.addInitScript(([key, session, cachedUser]) => {
    window.localStorage.setItem(key, session);
    window.localStorage.setItem('auth:cachedUser', cachedUser);
  }, [TOKEN_KEY, raw, cached]);
}

const JSON_HEADERS = { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' };

test.describe('Auth: langsamer Server und abgelaufene Anmeldung', () => {
  test('@AN-019 @AN-032 Hinweis „Server antwortet langsam“ erscheint nach 5 s, ist nicht „offline“ und verschwindet bei Antwort', async ({ page }, testInfo) => {
    await seedStoredSession(page, false);
    await page.route(`${SUPABASE}/**`, async (route) => {
      const url = route.request().url();
      if (url.includes('/rest/v1/profiles')) {
        await new Promise((r) => setTimeout(r, 14_000));
        await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify({ display_name: 'A', avatar_url: null, role: 'user' }) });
        return;
      }
      if (url.includes('/auth/v1/user')) {
        await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify(USER) });
        return;
      }
      await route.fulfill({ status: 200, headers: JSON_HEADERS, body: '[]' });
    });

    await page.goto('/');
    await expect(page.getByTestId('server-slow')).toHaveCount(0);

    const hint = page.getByTestId('server-slow');
    await expect(hint).toBeVisible({ timeout: 9_000 });
    await expect(hint).toHaveText('Server antwortet langsam');
    await expect(hint).not.toContainText(/offline|keine Verbindung/i);
    expect(await page.evaluate((k) => window.localStorage.getItem(k), TOKEN_KEY)).not.toBeNull();
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/server-antwortet-langsam-${testInfo.project.name}.png` });
    }

    await expect(hint).toBeHidden({ timeout: 20_000 });
  });

  test('@AN-021 abgelaufene Anmeldung (Server lehnt Erneuerung ab) zeigt „Anmeldung abgelaufen“', async ({ page }, testInfo) => {
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
    const notice = page.getByTestId('session-expired').first();
    await expect(notice).toBeVisible({ timeout: 10_000 });
    await expect(notice).toContainText('Deine Anmeldung ist abgelaufen – bitte melde dich neu an');
    await expect(page.getByTestId('signed-out-elsewhere')).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Lade...')).toHaveCount(0);
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/anmeldung-abgelaufen-${testInfo.project.name}.png` });
    }
  });
});
