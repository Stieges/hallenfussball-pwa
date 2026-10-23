/**
 * tests/e2e/cloud/klaerungsliste-360.cloud.spec.ts — B-50 T2-UI: Klärungsliste bei 360 × 640 (VISUAL-DESIGN Fassung 2,
 * Regeln 1, 2, 6; Review #355 § 6). Olli (Eigentümer) im geseedeten Live-Cup; `list_match_reviews` kommt als FESTE Antwort
 * (`page.route`), weil die Migration 20261117_005 im lokalen Stack fehlt. Der Stack wird nur gelesen (Anmeldung, Turnier),
 * nicht gestartet, zurückgesetzt oder gesät.
 *
 * Gemessen: Kopf mit Knopf ohne waagrechten Überlauf; Dialog mit 3-Einträge-Fall aufgeklappt und mit Vorschau ohne Überlauf;
 * Häkchen-Zeilen ≥ 44 px; „Speichern“ (`data-primary`) ≥ 56 px; jede Taste im Dialog ≥ 44 px.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { E2E_LIVE_CUP_ID } from './testData';

const MATCH = '00000000-0000-4000-8000-0000000000b5';
const eintrag = (eventId: string, type: string, clockMs: number, payload: Record<string, unknown> = {}) => ({
  eventId, matchId: MATCH, matchNumber: 9, field: 2, kind: 'review', reason: 'CONTROL_LOST', detail: { timing: 'after' },
  receivedAt: 1_790_000_000_000, author: 'Tom Mustermann-Langname', deviceLabel: 'Handy',
  entry: { type, teamId: null, section: 1, clockMs, payload, targetId: null, deviceAt: 1_790_000_000_000 }, decision: null,
});
const ANTWORT = [
  eintrag('00000000-0000-4000-8000-0000000000e1', 'GOAL', 60_000),
  eintrag('00000000-0000-4000-8000-0000000000e2', 'GOAL', 70_000),
  eintrag('00000000-0000-4000-8000-0000000000e3', 'YELLOW_CARD', 80_000, { playerNumber: 5 }),
];

async function ohneUeberlauf(page: Page): Promise<void> {
  const breiten = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, fenster: window.innerWidth }));
  expect(breiten.scroll, 'waagrechter Überlauf').toBeLessThanOrEqual(breiten.fenster);
}

test('B-50 T2-UI: Klärungsliste bei 360 px – kein Überlauf, Zeilen ≥ 44 px, „Speichern“ ≥ 56 px', async ({ asRole }) => {
  const page = await asRole('owner');
  await page.setViewportSize({ width: 360, height: 640 });
  await page.route('**/rest/v1/rpc/list_match_reviews', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ANTWORT) }));
  await page.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/schedule`);

  const knopf = page.getByTestId('klaerungsliste-knopf');
  await expect(knopf).toBeVisible({ timeout: 20_000 });
  await expect(knopf).toContainText('3');
  expect((await knopf.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await ohneUeberlauf(page);
  await page.screenshot({ path: 'test-results/b50-360-kopf.png' });

  await knopf.click();
  const fall = page.getByTestId('klaerung-fall-00000000-0000-4000-8000-0000000000e1');
  await expect(fall).toContainText('3 Einträge von Tom Mustermann-Langname nach Übernahme');
  await page.getByTestId('klaerung-fall-00000000-0000-4000-8000-0000000000e1-aufklappen').click();
  for (const zeile of await page.locator('[data-testid="klaerungsliste"] label').all()) {
    expect((await zeile.boundingBox())?.height ?? 0, 'Häkchen-Zeile').toBeGreaterThanOrEqual(44);
  }
  await ohneUeberlauf(page);
  await page.getByTestId('klaerung-fall-00000000-0000-4000-8000-0000000000e1-uebernehmen').click();
  const speichern = page.getByTestId('klaerung-fall-00000000-0000-4000-8000-0000000000e1-speichern');
  await expect(speichern).toHaveAttribute('data-primary', /.*/);
  expect((await speichern.boundingBox())?.height ?? 0, '„Speichern“').toBeGreaterThanOrEqual(56);
  for (const taste of await page.locator('[data-testid="klaerungsliste"] button').all()) {
    expect((await taste.boundingBox())?.height ?? 0, 'Taste im Dialog').toBeGreaterThanOrEqual(44);
  }
  await ohneUeberlauf(page);
  await page.screenshot({ path: 'test-results/b50-360-dialog.png', fullPage: true });
});
