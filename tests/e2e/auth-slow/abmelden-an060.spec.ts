/**
 * @AN-060 (docs/anforderungen/2026-10-02_anmelden.md): Nach dem Abmelden auf einer Turnierseite landet man auf der Startseite mit „Anmelden“,
 * nicht auf einem Bildschirm „Turnier nicht gefunden“. Beide Wege: das Konto-Menü oben und die Profil-Seite.
 * Echte App, erfundene Supabase-Adresse (siehe playwright.auth-slow.config.ts); Antworten und die angemeldete Sitzung stellt der Test.
 * Lauf: AUTH_SLOW_PORT=5230 npx playwright test -c playwright.auth-slow.config.ts abmelden-an060 --project=laptop-1280x720
 */
import { expect, type Page } from '@playwright/test';
import { test } from '../helpers/test-fixtures';
import { buildVisualTournament } from '../visual/helpers';

const SUPABASE = 'http://127.0.0.1:59999';
const TOKEN_KEY = 'sb-127-auth-token';
const USER = { id: 'user-a', aud: 'authenticated', email: 'olli@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const JSON_HEADERS = { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' };
const ID = 'konto-menue-turnier';
const TEAMS = ['FC Nordstadt', 'SV Südpark', 'TSV Westtal', 'BSC Ostring', 'SG Hafen', 'VfL Mitte'].map((name, i) => ({ id: `00000000-0000-4000-8000-0000000000c${i + 1}`, name }));

async function meldeAn(page: Page): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'user-a', role: 'authenticated', exp })}.sig`;
  const session = JSON.stringify({ access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresh-a', user: USER });
  const cached = JSON.stringify({ id: 'user-a', email: 'olli@example.test', name: 'Olli Beispiel', globalRole: 'user' });
  await page.addInitScript(([k, s, c]) => { window.localStorage.setItem(k, s); window.localStorage.setItem('auth:cachedUser', c); }, [TOKEN_KEY, session, cached]);
  await page.route(`${SUPABASE}/**`, async (route) => {
    const url = route.request().url();
    if (url.includes('/rest/v1/profiles')) { await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify({ display_name: 'Olli Beispiel', avatar_url: null, role: 'user' }) }); return; }
    if (url.includes('/auth/v1/user')) { await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify(USER) }); return; }
    await route.fulfill({ status: 200, headers: JSON_HEADERS, body: '[]' });
  });
}

/** Jeder gegen jeden mit 6 Teams: 15 Spiele, damit hinter dem Menü Karten, Tasten und Text liegen. */
function spiele() {
  const liste = [];
  let nr = 0;
  for (let i = 0; i < TEAMS.length; i++) {
    for (let j = i + 1; j < TEAMS.length; j++) {
      nr += 1;
      const min = nr * 12;
      liste.push({ id: `km-${nr}`, round: nr, teamA: TEAMS[i].id, teamB: TEAMS[j].id, field: 1, matchStatus: 'scheduled' as const, scheduledTime: `2026-03-14T${String(9 + Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00.000Z` });
    }
  }
  return liste;
}


async function oeffneTurnier(page: Page, seedIndexedDB: (d: Record<string, unknown>) => Promise<void>): Promise<void> {
  await meldeAn(page);
  const turnier = buildVisualTournament({ id: ID, title: 'Nikolaus-Turnier', matches: spiele(), extra: { teams: TEAMS, numberOfTeams: 6, ownerId: 'user-a' } });
  await seedIndexedDB({ tournaments: [turnier] });
  await page.goto(`/#/tournament/${ID}/schedule`);
  await expect(page.getByTestId('auth-avatar-button')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('schedule-current-card-km-1')).toBeVisible();
}

async function pruefeStartseite(page: Page): Promise<void> {
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByTestId('auth-avatar-button'), 'abgemeldet: die Rundtaste ist weg').toHaveCount(0);
  await expect(page.getByText('Anmelden').first()).toBeVisible();
  await expect(page.getByText('Turnier nicht gefunden')).toHaveCount(0);
}

test.describe('@AN-060 Nach dem Abmelden auf einer Turnierseite zur Startseite', () => {
  test('@AN-060 das Konto-Menü oben: Startseite mit „Anmelden“, kein „Turnier nicht gefunden“', async ({ page, seedIndexedDB }, testInfo) => {
    test.skip(testInfo.project.name !== 'laptop-1280x720', 'ein Projekt genügt');
    await oeffneTurnier(page, seedIndexedDB);
    await page.getByTestId('auth-avatar-button').click();
    await page.getByTestId('auth-logout-button').click();
    await pruefeStartseite(page);
  });

  test('@AN-060 die Profil-Seite: Startseite mit „Anmelden“, kein „Turnier nicht gefunden“', async ({ page, seedIndexedDB }, testInfo) => {
    test.skip(testInfo.project.name !== 'laptop-1280x720', 'ein Projekt genügt');
    await oeffneTurnier(page, seedIndexedDB);
    await page.getByTestId('auth-avatar-button').click();
    await page.getByTestId('auth-profile-button').click();
    await expect(page).toHaveURL(/#\/profile$/);
    await page.getByRole('button', { name: /Abmelden/ }).click();
    await pruefeStartseite(page);
  });
});
