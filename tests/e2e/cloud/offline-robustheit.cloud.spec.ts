/**
 * tests/e2e/cloud/offline-robustheit.cloud.spec.ts — A-06l: Offline-Robustheit des Ausgangs.
 *
 * Szenarien (docs/anforderungen/plattform/2026-09-24_fundament-gemeinsamer-stand.md):
 *   @FU-013 WLAN verbunden, aber ohne Internet
 *   @FU-016 Hängende Übertragung blockiert nicht
 *   @FU-015 Rückkehr aus dem Ruhezustand
 *
 * Das Netz wird NICHT per `setOffline` getrennt (dann wäre `navigator.onLine` false): die
 * Übertragung `append_match_events` wird per `page.route` abgefangen, das Gerät hält sich für
 * online. Jeder Fall hat sein eigenes Turnier ("Engine-Cup", `engineCups.ts`); ein verbrauchter
 * Cup braucht `npm run test:env:seed`.
 */

import { test, expect } from './fixtures';
import {
  blockAppendRpcNoInternet,
  engineCupTarget,
  expectEngineMatchRunningUi,
  expectOutboxSettled,
  expectSeededEngineMatch,
  fetchEngineRows,
  holdFirstAppendRpc,
  newRoleContext,
  openCockpit,
  simulateWakeFromSleep,
  swallowOnlineEvents,
} from './engineHelpers';
import { enterGoal } from './helpers';
import { engineCupIds } from './testData';

const ENTRIES = 8;

test.describe('Offline-Robustheit des Ausgangs', () => {
  // Playwright verlangt syntaktisch ein Destrukturierungs-Muster als erstes Argument.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Engine-Cups nur auf cloud-desktop.');
  });

  test('@FU-013 WLAN ohne Internet: 8 Einträge warten, nichts scheitert, nach Rückkehr kommen alle an', async ({ browser }) => {
    test.setTimeout(150_000);
    const ids = engineCupIds('OFFLINEWLAN');
    const baseRows = await expectSeededEngineMatch(engineCupTarget('OFFLINEWLAN'));
    const { context, page } = await newRoleContext(browser, 'owner');
    try {
      await openCockpit(page, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(page);
      const syncStatus = page.locator('[data-testid="sync-status"]');
      await expect(syncStatus).toBeVisible({ timeout: 10000 });
      await expectOutboxSettled(page);

      const block = await blockAppendRpcNoInternet(page);
      for (let i = 0; i < ENTRIES; i++) {
        await enterGoal(page, i % 2 === 0 ? 'home' : 'away');
      }
      await expect(syncStatus).toHaveAttribute('data-pending', String(ENTRIES), { timeout: 10000 });
      expect(await page.evaluate(() => navigator.onLine)).toBe(true);

      await syncStatus.click();
      await expect(page.locator('[data-testid="sync-wait-details"]')).toContainText(`${ENTRIES} Einträge warten – kein Internet`, { timeout: 5000 });

      // Gegenbeispiel: während der Sperre nichts in der DB und nichts als gescheitert aufgegeben.
      await page.waitForTimeout(60_000);
      await expect(syncStatus).toHaveAttribute('data-pending', String(ENTRIES));
      await expect(page.locator('[data-testid="sync-status-rejected"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="sync-failed-list"]')).toHaveCount(0);
      expect(block.count()).toBeGreaterThan(1);
      expect((await fetchEngineRows(ids.matchId)).length).toBe(baseRows);

      await block.release();
      await expect(syncStatus).toHaveAttribute('data-pending', '0', { timeout: 15000 });
      await expect.poll(async () => (await fetchEngineRows(ids.matchId)).length, { timeout: 10000 }).toBe(baseRows + ENTRIES);
    } finally {
      await context.close();
    }
  });

  test('@FU-016 hängende Anfrage: nach höchstens 20 s zweiter Versuch, beide Einträge kommen an', async ({ browser }) => {
    test.setTimeout(90_000);
    const ids = engineCupIds('HAENGT');
    const baseRows = await expectSeededEngineMatch(engineCupTarget('HAENGT'));
    const { context, page } = await newRoleContext(browser, 'owner');
    try {
      await openCockpit(page, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(page);
      const syncStatus = page.locator('[data-testid="sync-status"]');
      await expect(syncStatus).toBeVisible({ timeout: 10000 });
      await expectOutboxSettled(page);

      const held = await holdFirstAppendRpc(page);
      await enterGoal(page, 'home');
      await expect(syncStatus).toHaveAttribute('data-pending', '1', { timeout: 5000 });
      await expect.poll(() => held.count(), { timeout: 5000 }).toBe(1);
      // Gegenbeispiel: solange die erste Anfrage hängt, ist nichts in der DB und nichts abgelehnt.
      expect((await fetchEngineRows(ids.matchId)).length).toBe(baseRows);
      await expect(page.locator('[data-testid="sync-failed-list"]')).toHaveCount(0);

      // @FU-016 "die anderen wartenden Einträge bleiben nicht dauerhaft stehen": ein zweiter Eintrag
      // entsteht, während die erste Anfrage noch hängt, und muss mit dem zweiten Versuch ebenfalls ankommen.
      await enterGoal(page, 'away');
      await expect(syncStatus).toHaveAttribute('data-pending', '2', { timeout: 5000 });
      expect((await fetchEngineRows(ids.matchId)).length).toBe(baseRows);

      await expect.poll(() => held.count(), { timeout: 20_000, intervals: [500] }).toBeGreaterThanOrEqual(2);
      await expect(syncStatus).toHaveAttribute('data-pending', '0', { timeout: 10000 });
      await expect.poll(async () => (await fetchEngineRows(ids.matchId)).length, { timeout: 10000 }).toBe(baseRows + 2);
      await expect(page.locator('[data-testid="sync-status-rejected"]')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('@FU-015 Rückkehr aus dem Ruhezustand: wartende Einträge gehen ohne Klick raus', async ({ browser }) => {
    test.setTimeout(120_000);
    const ids = engineCupIds('RUHEZUSTAND');
    const baseRows = await expectSeededEngineMatch(engineCupTarget('RUHEZUSTAND'));
    const { context, page } = await newRoleContext(browser, 'owner');
    await swallowOnlineEvents(context);
    try {
      await openCockpit(page, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(page);
      const syncStatus = page.locator('[data-testid="sync-status"]');
      await expect(syncStatus).toBeVisible({ timeout: 10000 });
      await expectOutboxSettled(page);

      const block = await blockAppendRpcNoInternet(page);
      await enterGoal(page, 'home');
      await enterGoal(page, 'away');
      await expect(syncStatus).toHaveAttribute('data-pending', '2', { timeout: 5000 });

      // Backoff auf Deckel (1 s, 2 s, 5 s, 5 s ...) laufen lassen; danach liegt der nächste
      // eigene Versuch frühestens ~5 s nach dem letzten abgefangenen -- der Resync muss schneller sein.
      await page.waitForTimeout(12_000);
      const seen = block.count();
      await expect.poll(() => block.count(), { timeout: 10_000, intervals: [50] }).toBeGreaterThan(seen);
      await block.release();
      await simulateWakeFromSleep(page);
      await expect(syncStatus).toHaveAttribute('data-pending', '0', { timeout: 3000 });
      await expect.poll(async () => (await fetchEngineRows(ids.matchId)).length, { timeout: 10000 }).toBe(baseRows + 2);
    } finally {
      await context.close();
    }
  });
});
