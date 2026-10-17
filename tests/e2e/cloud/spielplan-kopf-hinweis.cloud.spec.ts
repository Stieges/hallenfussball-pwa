/**
 * tests/e2e/cloud/spielplan-kopf-hinweis.cloud.spec.ts — A-08f3e3 Fixrunde 1 (I-4, M-4, I-2): Kopf der
 * Turnierverwaltung bei 360×640 mit wartendem bzw. nicht übernommenem Direkteintrag. Unter 400 px nur Symbol
 * mit Zahl (@OB-021: keine Überlappung, Titel bleibt lesbar), Liste nennt Spiel und Teams (@FU-004), nach der
 * Ablehnung zeigt die Zeile wieder „VS“. Der Server bekommt nie einen Eintrag (abgefangen bzw. mit `rejected`
 * beantwortet) -- der Engine-Cup KOPFHINWEIS wird nicht verbraucht. Bilder für die Sichtprüfung:
 * `E2E_SCREENSHOT_DIR` (gesetzt nur beim Fixrunden-Lauf). Nur cloud-desktop.
 */
import path from 'node:path';
import type { Locator, Page, Route } from '@playwright/test';
import { test, expect } from './fixtures';
import { engineCupTarget, expectSeededEngineMatch, fetchEngineRows, newRoleContext } from './engineHelpers';
import { engineCupIds } from './testData';

const APPEND_RPC_PATTERN = '**/rest/v1/rpc/append_match_events';
const ids = engineCupIds('KOPFHINWEIS');

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) { throw new Error('Element nicht sichtbar'); }
  return b;
}
function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env.E2E_SCREENSHOT_DIR;
  if (dir) { await page.screenshot({ path: path.join(dir, name) }); }
}

async function enter31(page: Page): Promise<void> {
  await page.goto(`/#/tournament/${ids.tournamentId}/schedule`);
  await page.waitForLoadState('networkidle');
  // Unter 768 px rendert der Spielplan die mobile Karte; die Desktop-Karte ist ausgeblendet.
  const card = page.locator('[data-match-card]:visible').filter({ hasText: ids.homeTeamName }).first();
  await card.getByText(ids.homeTeamName).first().click();
  const expand = card.getByTestId('quick-score-expand');
  // Bei 360 px liegen die schwebenden Tasten „Teilen“/„Als PDF“ über der Schnelleingabe (Nebenbefund, älterer
  // Code); dieser Test prüft den Kopf, die Tasten werden deshalb direkt ausgelöst.
  const tap = async (target: Locator): Promise<void> => {
    await target.dispatchEvent('click');
  };
  for (let i = 0; i < 3; i++) { await tap(expand.getByLabel(`${ids.homeTeamName} Tor hinzufügen`)); }
  await tap(expand.getByLabel(`${ids.awayTeamName} Tor hinzufügen`));
  await tap(expand.getByTestId('quick-score-save-btn'));
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function expectHeaderClean(page: Page, badge: Locator): Promise<void> {
  const header = page.locator('header').first();
  const title = header.getByText('Engine-Cup KOPFHINWEIS', { exact: true });
  const admin = header.getByTitle('Admin Center öffnen');
  const [t, a, b] = [await box(title), await box(admin), await box(badge)];
  expect(t.width, 'Titel bleibt lesbar').toBeGreaterThanOrEqual(80);
  expect(overlaps(t, a), 'Titel und Admin-Knopf überlappen nicht').toBe(false);
  expect(overlaps(t, b), 'Titel und Hinweis überlappen nicht').toBe(false);
  expect(overlaps(a, b), 'Admin-Knopf und Hinweis überlappen nicht').toBe(false);
  expect(b.width).toBeGreaterThanOrEqual(44);
  expect(b.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`Kopf-Hinweis 360×640 (${scheme})`, () => {
    // eslint-disable-next-line no-empty-pattern
    test.beforeEach(async ({}, testInfo) => {
      test.skip(!testInfo.project.name.includes('desktop'), 'Engine-Cups nur auf cloud-desktop.');
    });

    test(`@OB-021 @FU-002 wartender Eintrag: „1 Eintrag wartet“ als Symbol mit Zahl, keine Überlappung (${scheme})`, async ({ browser }) => {
      test.setTimeout(90_000);
      await expectSeededEngineMatch(engineCupTarget('KOPFHINWEIS'));
      const owner = await newRoleContext(browser, 'owner');
      try {
        const page = owner.page;
        await page.setViewportSize({ width: 360, height: 640 });
        await page.emulateMedia({ colorScheme: scheme });
        await page.route(APPEND_RPC_PATTERN, (route: Route) => route.abort('internetdisconnected'));
        await enter31(page);
        const waiting = page.getByTestId('engine-outbox-waiting');
        await expect(waiting).toHaveAttribute('aria-label', '1 Eintrag wartet', { timeout: 10000 });
        await expect(waiting).toHaveText('⏳1');
        await expectHeaderClean(page, waiting);
        await shot(page, `fix1-waiting-360x640-${scheme}-kopf.png`);
        expect(await fetchEngineRows(ids.matchId)).toEqual([]);
      } finally {
        await owner.context.close();
      }
    });

    test(`@OB-021 @FU-004 abgelehnter Eintrag: Symbol mit Zahl, Liste mit Spiel und Teams, Zeile wieder „VS“ (${scheme})`, async ({ browser }) => {
      test.setTimeout(90_000);
      await expectSeededEngineMatch(engineCupTarget('KOPFHINWEIS'));
      const owner = await newRoleContext(browser, 'owner');
      try {
        const page = owner.page;
        await page.setViewportSize({ width: 360, height: 640 });
        await page.emulateMedia({ colorScheme: scheme });
        await page.route(APPEND_RPC_PATTERN, (route: Route) => {
          const body = route.request().postDataJSON() as { p_events: Array<{ id: string }> };
          return route.fulfill({ json: { results: body.p_events.map((event) => ({ id: event.id, status: 'rejected', code: 'INVALID_TRANSITION' })), state: null, serverTime: Date.now() } });
        });
        await enter31(page);
        const rejected = page.getByTestId('sync-status-rejected');
        await expect(rejected).toHaveAttribute('aria-label', '1 nicht übernommen', { timeout: 10000 });
        await expectHeaderClean(page, rejected);
        // I-2: ohne Neuladen zeigt die Zeile kein 3:1 mehr.
        await expect(page.locator(`[data-testid="match-circle-${ids.matchId}"]`)).not.toContainText('3:1', { timeout: 10000 });
        await shot(page, `fix1-rejected-360x640-${scheme}-kopf.png`);
        await rejected.click();
        const item = page.getByTestId('outbox-rejected-item').first();
        await expect(item).toContainText(`Ergebnis eingetragen · Spiel`);
        await expect(item).toContainText(`${ids.homeTeamName} – ${ids.awayTeamName} 3:1`);
        await expect(item).not.toContainText('Minute');
        await shot(page, `fix1-rejected-360x640-${scheme}-liste.png`);
        expect(await fetchEngineRows(ids.matchId)).toEqual([]);
      } finally {
        await owner.context.close();
      }
    });
  });
}
