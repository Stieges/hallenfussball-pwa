/**
 * @AN-058 (docs/anforderungen/2026-10-02_anmelden.md), Befund C-KONTOMENUE-DURCHSICHTIG: Das Konto-Menü ist auf jedem Gerät lesbar,
 * und „Abmelden“ lässt sich treffen. Grundriss: Handy 360 und 390 px dunkel, Handy 390 px hell, Laptop 1440 px dunkel – je auf der
 * Turnierliste und im geöffneten Turnier (dort liegen Karten, Taste und Text hinter dem Menü).
 * Echte App, erfundene Supabase-Adresse (siehe playwright.auth-slow.config.ts); Antworten und die angemeldete Sitzung stellt der Test.
 * Bilder nur, wenn KONTO_BILDER gesetzt ist (Dateiname `${KONTO_PHASE}-<gerät>-<seite>.png`).
 * Lauf: npx playwright test -c playwright.auth-slow.config.ts konto-menue-an058 --project=laptop-1280x720
 */
import { mkdirSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { test } from '../helpers/test-fixtures';
import { kontrastVon } from '../helpers/kontrast';
import { buildVisualTournament } from '../visual/helpers';

const SUPABASE = 'http://127.0.0.1:59999';
const TOKEN_KEY = 'sb-127-auth-token';
const BILDER = process.env.KONTO_BILDER;
const PHASE = process.env.KONTO_PHASE ?? 'nachher';
const USER = { id: 'user-a', aud: 'authenticated', email: 'olli@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const JSON_HEADERS = { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' };
const ID = 'konto-menue-turnier';
const TEAMS = ['FC Nordstadt', 'SV Südpark', 'TSV Westtal', 'BSC Ostring', 'SG Hafen', 'VfL Mitte'].map((name, i) => ({ id: `00000000-0000-4000-8000-0000000000c${i + 1}`, name }));
const EINTRAEGE = ['auth-profile-button', 'auth-settings-button', 'auth-logout-button'] as const;

const GERAETE = [
  { name: 'handy360-dunkel', width: 360, height: 800, schema: 'dark', touch: true },
  { name: 'handy390-dunkel', width: 390, height: 844, schema: 'dark', touch: true },
  { name: 'handy390-hell', width: 390, height: 844, schema: 'light', touch: true },
  { name: 'laptop1440-dunkel', width: 1440, height: 900, schema: 'dark', touch: false },
] as const;
const SEITEN = [{ name: 'liste', pfad: '/#/' }, { name: 'turnier', pfad: `/#/tournament/${ID}/schedule` }] as const;

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

for (const g of GERAETE) {
  test.describe(`@AN-058 ${g.name}`, () => {
    test.use({ hasTouch: g.touch, isMobile: g.touch });
    for (const s of SEITEN) {
      test(`${s.name}: Menü deckend, lesbar, ganz im Bild, 44 px hoch; Tipp auf „Abmelden“ meldet ab`, async ({ page, seedIndexedDB }, testInfo) => {
        test.skip(testInfo.project.name !== 'laptop-1280x720', 'setzt Fenstergröße und Eingabeart selbst, ein Projekt genügt');
        await page.setViewportSize({ width: g.width, height: g.height });
        await page.emulateMedia({ colorScheme: g.schema });
        await meldeAn(page);
        const turnier = buildVisualTournament({ id: ID, title: 'Nikolaus-Turnier', matches: spiele(), extra: { teams: TEAMS, numberOfTeams: 6, ownerId: 'user-a' } });
        await seedIndexedDB({ tournaments: [turnier] });
        await page.goto(s.pfad);
        const avatar = page.getByTestId('auth-avatar-button');
        await expect(avatar).toBeVisible({ timeout: 20_000 });
        if (s.name === 'turnier') { await expect(page.getByTestId('schedule-current-card-km-1')).toBeVisible(); }
        else { await expect(page.getByText('Nikolaus-Turnier')).toBeVisible(); }
        await (g.touch ? avatar.tap() : avatar.click());
        const menue = page.getByTestId('auth-dropdown-menu');
        await expect(menue).toBeVisible();

        // deckend: berechnete Hintergrundfarbe hat Deckkraft 1, vom Seiteninhalt scheint nichts durch
        const alpha = await menue.evaluate((el) => {
          const zahlen = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [];
          return zahlen.length > 3 ? zahlen[3] : 1;
        });
        expect(alpha, 'Menü-Hintergrund deckend').toBe(1);

        // lesbar: jeder Eintrag mindestens 4,5 : 1 gegen die (jetzt deckende) Menüfläche
        for (const id of EINTRAEGE) { expect(await kontrastVon(page.getByTestId(id)), `Kontrast ${id}`).toBeGreaterThanOrEqual(4.5); }

        // ganz im Bild, jeder Eintrag mindestens 44 Bildpunkte hoch
        const box = await menue.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(g.width);
        expect(box!.y + box!.height).toBeLessThanOrEqual(g.height);
        for (const id of EINTRAEGE) { expect((await page.getByTestId(id).boundingBox())!.height, `Höhe ${id}`).toBeGreaterThanOrEqual(44); }

        // „Abmelden“ ist an seiner Stelle das oberste Element: kein Element dahinter bekommt den Tipp
        const abmelden = page.getByTestId('auth-logout-button');
        for (const id of EINTRAEGE) {
          const oben = await page.getByTestId(id).evaluate((el) => {
            const r = el.getBoundingClientRect();
            const treffer = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return treffer !== null && el.contains(treffer);
          });
          expect(oben, `${id} ist das oberste Element an seiner Stelle`).toBe(true);
        }
        if (BILDER) { mkdirSync(BILDER, { recursive: true }); await page.screenshot({ path: `${BILDER}/${PHASE}-${g.name}-${s.name}.png` }); }

        await (g.touch ? abmelden.tap() : abmelden.click());
        await expect(avatar, 'abgemeldet: die Rundtaste ist weg').toHaveCount(0);
      });
    }

    test('Gegenbeispiel: ein Tipp neben das Menü schließt es, ohne abzumelden', async ({ page, seedIndexedDB }, testInfo) => {
      test.skip(testInfo.project.name !== 'laptop-1280x720' || g.name !== 'handy390-dunkel', 'ein Gerät genügt');
      await page.setViewportSize({ width: g.width, height: g.height });
      await meldeAn(page);
      await seedIndexedDB({ tournaments: [] });
      await page.goto('/#/');
      await page.getByTestId('auth-avatar-button').tap();
      await expect(page.getByTestId('auth-dropdown-menu')).toBeVisible();
      await page.touchscreen.tap(20, g.height - 200);
      await expect(page.getByTestId('auth-dropdown-menu')).toHaveCount(0);
      await expect(page.getByTestId('auth-avatar-button')).toBeVisible();
    });
  });
}
