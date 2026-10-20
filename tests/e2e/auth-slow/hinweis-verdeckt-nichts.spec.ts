/**
 * C-HINWEIS-LANGSAM-VERDECKT: Hinweise verdecken keine Bedienelemente und keine Überschrift
 * (Regel: docs/anforderungen/2026-10-02_oberflaeche.md). Szenarien der Hinweise: @AN-019, @AN-032, @AN-024.
 *
 * Misst Bounding-Boxen: Der Hinweis darf sich mit keiner sichtbaren Überschrift, keinem Knopf und keinem
 * Link der Seite überlappen (Handy 360×640, Laptop 1280×720). Läuft mit `playwright.auth-slow.config.ts`.
 * Bildschirmfotos nur, wenn AUTH_SLOW_SHOTS_DIR gesetzt ist.
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
const JSON_HEADERS = { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' };

async function seed(page: Page, expired: boolean): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + (expired ? -60 : 3600);
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'user-a', role: 'authenticated', exp })}.sig`;
  const session = JSON.stringify({
    access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp,
    refresh_token: 'refresh-a', user: USER,
  });
  const cached = JSON.stringify({ id: 'user-a', email: 'a@example.test', name: 'Olli Beispiel', globalRole: 'user' });
  await page.addInitScript(([k, s, c]) => {
    window.localStorage.setItem(k, s);
    window.localStorage.setItem('auth:cachedUser', c);
  }, [TOKEN_KEY, session, cached]);
}

/** Überlappende sichtbare Überschriften/Knöpfe/Links außerhalb des Hinweises (Selektoren der Treffer). */
async function overlaps(page: Page, noticeTestId: string): Promise<string[]> {
  return page.evaluate((id) => {
    const notice = document.querySelector(`[data-testid="${id}"]`);
    if (!notice) { return ['Hinweis fehlt']; }
    const n = notice.getBoundingClientRect();
    const hits: string[] = [];
    document.querySelectorAll('h1, h2, h3, button, a, [role="button"]').forEach((el) => {
      if (notice.contains(el)) { return; }
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || style.visibility === 'hidden' || style.display === 'none') { return; }
      const cut = r.left < n.right && r.right > n.left && r.top < n.bottom - 1 && r.bottom > n.top + 1;
      if (cut) { hits.push(`${el.tagName} ${(el.textContent ?? '').trim().slice(0, 30)} ${el.getAttribute('data-testid') ?? ''}`); }
    });
    return hits;
  }, noticeTestId);
}

test.describe('Hinweise verdecken nichts', () => {
  test('@AN-019 @AN-032 „Server antwortet langsam“ verdeckt weder Überschrift noch Profil-Knopf; danach rückt der Inhalt zurück', async ({ page }, testInfo) => {
    await seed(page, false);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route(`${SUPABASE}/**`, async (route) => {
      const url = route.request().url();
      if (url.includes('/rest/v1/profiles')) {
        await gate;
        await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify({ display_name: 'Olli Beispiel', avatar_url: null, role: 'user' }) });
        return;
      }
      if (url.includes('/auth/v1/user')) {
        await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify(USER) });
        return;
      }
      await route.fulfill({ status: 200, headers: JSON_HEADERS, body: '[]' });
    });
    await page.clock.install();
    await page.goto('/');
    await page.clock.runFor(30_000);
    await expect(page.getByTestId('server-slow')).toBeVisible();
    const heading = page.getByRole('heading', { name: 'Turnierverwaltung' });
    await expect(heading).toBeVisible();
    const withNotice = (await heading.boundingBox())?.y ?? 0;
    expect(await overlaps(page, 'server-slow')).toEqual([]);
    if (SHOTS) { await page.screenshot({ path: `${SHOTS}/server-antwortet-langsam-${testInfo.project.name}.png` }); }

    release();
    await page.clock.runFor(1_000);
    await expect(page.getByTestId('server-slow')).toBeHidden();
    const without = (await heading.boundingBox())?.y ?? 0;
    expect(without).toBeLessThan(withNotice);
  });

  test('@AN-024 „von einem anderen Gerät aus abgemeldet“ verdeckt weder Überschrift noch Knöpfe', async ({ page }, testInfo) => {
    await seed(page, true);
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
    await expect(page.getByTestId('signed-out-elsewhere').first()).toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState('networkidle');
    expect(await overlaps(page, 'signed-out-elsewhere')).toEqual([]);
    if (SHOTS) { await page.screenshot({ path: `${SHOTS}/abgemeldet-anderes-geraet-${testInfo.project.name}.png` }); }
    await page.getByTestId('signed-out-elsewhere-dismiss').click();
    await expect(page.getByTestId('signed-out-elsewhere')).toHaveCount(0);
  });

  test('@AN-032 Anmeldeseite: „Erneut versuchen“ verdeckt nichts', async ({ page }, testInfo) => {
    await seed(page, true);
    await page.route(`${SUPABASE}/**`, () => new Promise<void>(() => undefined));
    await page.clock.install();
    await page.goto('/#/login');
    await page.clock.runFor(20_000);
    await expect(page.getByTestId('connecting-indicator-retry')).toBeVisible();
    const hits = await page.evaluate(() => {
      const retry = document.querySelector('[data-testid="connecting-indicator-retry"]');
      const box = retry?.closest('[data-testid]')?.parentElement ?? retry;
      const n = (box ?? document.body).getBoundingClientRect();
      const out: string[] = [];
      document.querySelectorAll('h1, h2, h3, button, a, input, [role="button"]').forEach((el) => {
        if (box?.contains(el)) { return; }
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') { return; }
        if (r.left < n.right && r.right > n.left && r.top < n.bottom - 1 && r.bottom > n.top + 1) { out.push(el.tagName + (el.getAttribute('data-testid') ?? '')); }
      });
      return out;
    });
    expect(hits).toEqual([]);
    if (SHOTS) { await page.screenshot({ path: `${SHOTS}/anmeldeseite-erneut-versuchen-${testInfo.project.name}.png` }); }
  });
});
