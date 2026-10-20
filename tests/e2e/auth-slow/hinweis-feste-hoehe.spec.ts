/**
 * C-HINWEIS-LANGSAM-VERDECKT (Nachprüfung): Der Hinweis „Server antwortet langsam“ steht im Fluss vor der Seite.
 * Seiten mit fester Höhe (Live-Cockpit, Assistent, Monitor) dürfen dadurch weder Bedienelemente unter die
 * Bildschirmkante schieben noch einen zweiten Scrollbalken bekommen. Der Hallenmonitor (Zuschauer-Anzeige, Kiosk)
 * zeigt keine Anmelde-Hinweise. Szenarien der Hinweise: @AN-019, @AN-032.
 *
 * Läuft nur mit `playwright.auth-slow.config.ts`. Bilder nur mit AUTH_SLOW_SHOTS_DIR.
 */

import { expect, type Page } from '@playwright/test';
import { test } from '../helpers/test-fixtures';
import { buildVisualTournament } from '../visual/helpers';

const SUPABASE = 'http://127.0.0.1:59999';
const TOKEN_KEY = 'sb-127-auth-token';
const SHOTS = process.env.AUTH_SLOW_SHOTS_DIR;
const USER = {
  id: 'user-a', aud: 'authenticated', email: 'a@example.test',
  app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z',
};
const JSON_HEADERS = { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' };
const TID = 'hinweis-turnier';
const A1 = '00000000-0000-4000-8000-0000000000a1';
const A2 = '00000000-0000-4000-8000-0000000000a2';

interface Snapshot {
  /** Überstand der Seite über den Bildschirm (0 = kein Seiten-Scrollbalken). */
  pageScroll: number;
  /** Lässt sich die Seite bis zu ihrem Ende scrollen (nichts durch „overflow: hidden“ abgeschnitten)? */
  reachable: boolean;
  /** Innere Scrollbereiche, die tatsächlich scrollen. */
  innerScrollers: number;
  /** Fest stehende Knöpfe/Links/Felder (fixed, z. B. Daumenleiste, Fußleiste), die nicht ganz im Bild liegen. */
  fixedOutside: string[];
}

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(async () => {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const root = document.documentElement;
    let innerScrollers = 0;
    document.querySelectorAll('body *').forEach((el) => {
      const s = getComputedStyle(el);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0) {
        innerScrollers += 1;
      }
    });
    const fixedOutside: string[] = [];
    document.querySelectorAll('button, a, input, select, textarea, [role="button"]').forEach((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none') { return; }
      let fixed = false;
      for (let p: Element | null = el; p; p = p.parentElement) {
        if (getComputedStyle(p).position === 'fixed') { fixed = true; break; }
      }
      if (fixed && (r.bottom > vh + 1 || r.right > vw + 1 || r.top < -1 || r.left < -1)) {
        fixedOutside.push(`${el.tagName} ${el.getAttribute('data-testid') ?? (el.textContent ?? '').trim().slice(0, 20)}`);
      }
    });
    const pageScroll = Math.max(0, root.scrollHeight - vh);
    window.scrollTo(0, root.scrollHeight);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    const reachable = window.scrollY >= pageScroll - 1;
    window.scrollTo(0, 0);
    return { pageScroll, reachable, innerScrollers, fixedOutside };
  });
}

async function prepare(page: Page, seedIndexedDB: (d: Record<string, unknown>) => Promise<void>): Promise<void> {
  let armed = false;
  await page.route(`${SUPABASE}/**`, async (route) => {
    // Ab „armed“ antwortet der Server auf die Erneuerung der Anmeldung nicht mehr.
    if (armed && route.request().url().includes('/auth/v1/token')) {
      await new Promise<void>(() => undefined);
      return;
    }
    await route.fulfill({ status: 200, headers: JSON_HEADERS, body: '[]' });
  });
  const tournament = buildVisualTournament({
    id: TID,
    title: 'Nordstadt Hallencup',
    matches: [{ id: 'hm-1', round: 1, teamA: A1, teamB: A2, field: 1, matchStatus: 'scheduled', scheduledTime: '2026-03-14T09:20:00.000Z' }],
    monitors: [{
      id: 'hm-monitor', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500,
      theme: 'dark', performanceMode: 'auto',
      slides: [{ id: 's1', type: 'live', config: { fieldId: 'field-1' }, duration: null, order: 0 }],
      createdAt: '2026-03-01T08:00:00.000Z', updatedAt: '2026-03-14T09:00:00.000Z',
    }],
  });
  // Die Seite wartet beim Anlegen der Testdaten auf „networkidle“: erst danach kommt die gespeicherte Anmeldung.
  await seedIndexedDB({ tournaments: [tournament] });
  const exp = Math.floor(Date.now() / 1000) - 60;
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'user-a', role: 'authenticated', exp })}.sig`;
  const session = JSON.stringify({
    access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp,
    refresh_token: 'refresh-a', user: USER,
  });
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [TOKEN_KEY, session]);
  armed = true;
}

const SEITEN: Array<{ name: string; hash: string; ready: string; kiosk?: boolean; nur?: string }> = [
  { name: 'cockpit', hash: `/tournament/${TID}/live`, ready: 'match-start-button' },
  { name: 'assistent-schritt1', hash: '/tournament/new', ready: 'wizard-age-class' },
  { name: 'monitor', hash: `/display/${TID}/hm-monitor`, ready: 'monitor-slide', kiosk: true },
];

for (const seite of SEITEN) {
  test(`@AN-019 Hinweis „Server antwortet langsam“ auf ${seite.name}: ${seite.kiosk ? 'am Monitor nicht sichtbar' : 'nichts rutscht aus dem Bild, kein zweiter Scrollbalken'}`, async ({ page, seedIndexedDB }, testInfo) => {
    if (seite.name === 'monitor') {
      await page.setViewportSize({ width: 1920, height: 1080 });
    }
        await prepare(page, seedIndexedDB);
    await page.clock.install();
    // Neuer Seitenaufruf nötig: nur der Hash-Teil wechselt sonst ohne Neustart der App.
    await page.goto('about:blank');
    await page.goto(`/#${seite.hash}`);
    await page.clock.runFor(20_000); // über die Zeitgrenze des Starts (15 s): die Seite ist geladen, der Hinweis steht noch
    await page.waitForTimeout(500);
    const notice = page.getByTestId('server-slow');
    await expect(page.getByTestId(seite.ready).first()).toBeVisible({ timeout: 10_000 });
    if (seite.kiosk) {
      await expect(notice).toHaveCount(0);
      if (SHOTS) { await page.screenshot({ path: `${SHOTS}/${seite.name}-ohne-hinweis-${testInfo.project.name}.png` }); }
      return;
    }
    await expect(notice).toBeVisible();
    const mit = await snapshot(page);
    if (SHOTS) { await page.screenshot({ path: `${SHOTS}/${seite.name}-hinweis-${testInfo.project.name}.png` }); }
    // Vergleichsstand ohne Hinweis: derselbe Zustand der Seite, nur der Hinweis ausgeblendet.
    await notice.evaluate((el) => { (el as HTMLElement).style.display = 'none'; });
    const ohne = await snapshot(page);
    // Fest stehende Bedienelemente bleiben im Bild, die Seite ist bis zum Ende erreichbar, und es entsteht
    // kein zweiter Scrollbalken (innerer Bereich zusätzlich zur Seite).
    expect(mit.fixedOutside.filter((x) => !ohne.fixedOutside.includes(x))).toEqual([]);
    expect(mit.reachable).toBe(true);
    expect(mit.innerScrollers).toBeLessThanOrEqual(ohne.innerScrollers);
    expect(mit.pageScroll > 0 && mit.innerScrollers > 0).toBe(ohne.pageScroll > 0 && ohne.innerScrollers > 0);
  });
}

test('@AN-024 Hallenmonitor zeigt auch „von einem anderen Gerät aus abgemeldet“ nicht', async ({ page, seedIndexedDB }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.route(`${SUPABASE}/**`, async (route) => {
    await route.fulfill({ status: 200, headers: JSON_HEADERS, body: '[]' });
  });
  await seedIndexedDB({ tournaments: [buildVisualTournament({ id: TID, title: 'Nordstadt Hallencup' })] });
  // Erst nach dem Anlegen der Testdaten: gespeicherte, abgelaufene Anmeldung, die der Server ablehnt.
  await page.unroute(`${SUPABASE}/**`);
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
  const exp = Math.floor(Date.now() / 1000) - 60;
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'user-a', role: 'authenticated', exp })}.sig`;
  const session = JSON.stringify({ access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresh-a', user: USER });
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [TOKEN_KEY, session]);
  await page.goto('about:blank');
  await page.goto(`/#/display/${TID}/hm-monitor`);
  await page.waitForLoadState('networkidle');
  // Beweis, dass der Merker gesetzt ist: derselbe Zustand zeigt den Hinweis auf dem Dashboard.
  await page.evaluate(() => { window.location.hash = '#/'; });
  await expect(page.getByTestId('signed-out-elsewhere').first()).toBeVisible({ timeout: 10_000 });
  await page.evaluate((id) => { window.location.hash = `#/display/${id}/hm-monitor`; }, TID);
  await expect(page.getByTestId('signed-out-elsewhere')).toHaveCount(0);
});
