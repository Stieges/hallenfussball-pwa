/**
 * Handy-Kopf der Sortier-Tabellen (@TS-003, Entscheidung 27.11.): Alle Wörter der Kopfzeile stehen oben auf einer Linie, darunter steht eine feste
 * Pfeilreihe. Unsortiert gibt es keinen Pfeil; sortiert genau einen, zentriert unter dem Wort der gewählten Spalte. Die Kopfzeile ist mit und ohne
 * Sortierung gleich hoch. Vier Handy-Tabellen bei 390 Pixeln: Gruppe, Gesamtplatzierung (Turnierleitung), Endstand, Torschützen (Harness).
 * Läuft gegen den lokalen Dev-Server ohne Supabase; nie gegen die Produktion.
 */
import type { Locator } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const ID = 'hallencup-messlauf';
const BILDER = process.env.BILDER_ORDNER;
/** Vor-Push und CI prüfen den gebauten Stand (Preview); die Prüfstände unter `tests/e2e/harness/` gibt es nur am Dev-Server (wie `endstand-app-r3-5.spec.ts`). */
const imGebautenStand = !!process.env.CI_E2E_USE_PREVIEW;

interface Kopf { kopf: Locator; zeile: Locator; woerter: Locator; pfeile: Locator }

async function messe(k: Kopf) {
  const woerter = await k.woerter.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: r.top, links: r.left, breite: r.width, unten: r.bottom })));
  return { hoehe: (await k.zeile.boundingBox())?.height ?? 0, woerter, pfeile: await k.pfeile.count() };
}

async function pruefe(k: Kopf, waehle: () => Promise<unknown>, indexSortiert: number, name: string) {
  const vorher = await messe(k);
  if (BILDER && process.env.PREFIX) { await k.zeile.screenshot({ path: `${BILDER}/${process.env.PREFIX}-kopf-${name}-unsortiert.png` }); }
  expect(vorher.pfeile, `${name}: unsortiert kein Pfeil im Handy-Kopf`).toBe(0);
  const spitze = vorher.woerter.map((w) => w.top);
  expect(Math.max(...spitze) - Math.min(...spitze), `${name}: Oberkanten aller Wörter unsortiert gleich (±1 px)`).toBeLessThanOrEqual(1);
  await waehle();
  const nachher = await messe(k);
  if (BILDER && process.env.PREFIX) { await k.zeile.screenshot({ path: `${BILDER}/${process.env.PREFIX}-kopf-${name}-sortiert.png` }); }
  const spitze2 = nachher.woerter.map((w) => w.top);
  expect(Math.max(...spitze2) - Math.min(...spitze2), `${name}: Oberkanten aller Wörter sortiert gleich (±1 px)`).toBeLessThanOrEqual(1);
  expect(Math.abs(nachher.hoehe - vorher.hoehe), `${name}: Kopfhöhe sortiert == unsortiert (±1 px)`).toBeLessThanOrEqual(1);
  expect(nachher.pfeile, `${name}: sortiert genau ein Pfeil`).toBe(1);
  const pfeil = (await k.pfeile.first().boundingBox())!;
  const wort = nachher.woerter[indexSortiert];
  expect(Math.abs(pfeil.x + pfeil.width / 2 - (wort.links + wort.breite / 2)), `${name}: Pfeil zentriert unter dem Wort (±2 px)`).toBeLessThanOrEqual(2);
  expect(pfeil.y, `${name}: Pfeil unter dem Wort`).toBeGreaterThanOrEqual(wort.unten - 1);
}

test.describe('Handy-Kopf: Wörter auf einer Linie, Pfeilreihe darunter (390 Pixel)', () => {
  test.beforeEach(async ({ page, browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt das Fenster selbst (390 Pixel)');
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('@TS-003 Gruppentabelle (Zuschauer-Seite): Wörter auf einer Linie, Pfeil nur bei Sortierung unter „Pkt.“', async ({ page }) => {
    await installiereSaat(page.context(), leseSaat(ID), { nurErstesLaden: true });
    await page.goto('/#/live/MESS26?tab=standings');
    await expect(page.getByTestId('sort-picker-gA')).toBeVisible({ timeout: 25000 });
    const tabelle = page.locator('.standings-table').first().locator('.mobile-view');
    const k: Kopf = { kopf: tabelle.locator('thead th'), zeile: tabelle.locator('thead tr'), woerter: tabelle.locator('thead [data-sort-word]'), pfeile: tabelle.locator('thead svg') };
    await pruefe(k, () => page.getByTestId('sort-picker-gA').selectOption('pkt'), 4, 'gruppe');
  });

  test('@TS-003 Gesamtplatzierung (Turnierleitung): Wörter auf einer Linie, Pfeil nur bei Sortierung unter „Pkt.“', async ({ page }) => {
    await installiereSaat(page.context(), leseSaat(ID));
    await page.goto(`/#/tournament/${ID}/standings?ansicht=platzierung`);
    await expect(page.getByTestId('sort-picker-gesamt')).toBeVisible({ timeout: 25000 });
    const tabelle = page.locator('table:visible').first();
    const k: Kopf = { kopf: tabelle.locator('thead th'), zeile: tabelle.locator('thead tr'), woerter: tabelle.locator('thead [data-sort-word]'), pfeile: tabelle.locator('thead svg') };
    await pruefe(k, () => page.getByTestId('sort-picker-gesamt').selectOption('pkt'), 2, 'gesamt');
  });

  for (const [harness, liste, picker, wahl, index, name] of [
    ['endstand-app', 'final-standings-header', 'sort-picker-end', 'pkt', 4, 'endstand'],
    ['endstand-app', 'final-scorers-header', 'sort-picker-tor', 'tore', 2, 'torschuetzen'],
  ] as const) {
    test(`@TS-003 ${name} (Harness): Wörter auf einer Linie, Pfeil nur bei Sortierung`, async ({ page }) => {
      test.skip(imGebautenStand, 'Prüfstand nur am Dev-Server (gehört nicht in den Build)');
      await page.goto(`/tests/e2e/harness/${harness}.html?szene=klar`);
      await expect(page.getByTestId(picker)).toBeVisible({ timeout: 25000 });
      const zeile = page.getByTestId(liste);
      const k: Kopf = { kopf: zeile.getByRole('columnheader'), zeile, woerter: zeile.locator('[data-sort-word]'), pfeile: zeile.locator('svg') };
      await pruefe(k, () => page.getByTestId(picker).selectOption(wahl), index, name);
    });
  }
});
