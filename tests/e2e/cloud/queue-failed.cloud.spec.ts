/**
 * tests/e2e/cloud/queue-failed.cloud.spec.ts — Teil B von "C-SYNC" (A-23, übernimmt C3b-3a §2
 * `:649`): Die TURNIER-Warteschlange (`mutation_queue_v1`) hat weiter Retry/Verwerfen
 * (`sync-failed-list`, `sync-retry-*`, `sync-discard-*`). Engine-Ablehnungen kennen nur
 * "Verstanden" (Teil A, `two-devices.cloud.spec.ts`, Cup REJECT).
 *
 * Deterministisch dauerhaft scheiternder Weg: ein direkt eingespeistes `UPDATE_TOURNAMENT_METADATA`
 * mit `status` außerhalb des DB-Constraints `tournaments_status_check` (Postgres 23514, kein RLS-
 * Silent-Drop, nicht transient). Der Client weist ihn lokal nicht ab (`updateTournamentMetadata`
 * reicht `status` unverändert durch). `MAX_RETRIES = 5` braucht 5 GETRENNTE `process()`-Anstöße;
 * synthetische `online`-Events lösen sie aus, ohne die Netzwerkverbindung anzufassen.
 */

import { test, expect } from './fixtures';
import { engineCupTarget, expectEngineMatchRunningUi, expectSeededEngineMatch, fetchUserIdByEmail, openCockpit } from './engineHelpers';
import { expectLegacyQueueKeysEmpty, queueKeys } from './helpers';
import { E2E_USERS, engineCupIds } from './testData';
import { HOLD_RETRY_MS } from '../../../src/core/services/mutationQueueRetry';

test('Cup QUEUE: eine dauerhaft abgelehnte Turnier-Mutation ist innerhalb von 10s als gescheitert sichtbar, retry/verwerfen wirken (Task A4, C-SYNC Teil B)', async ({ asRole }, testInfo) => {
  test.skip(!testInfo.project.name.includes('desktop'), 'Engine-Cups nur auf cloud-desktop.');
  const ids = engineCupIds('QUEUE');
  await expectSeededEngineMatch(engineCupTarget('QUEUE'));
  const ownerPage = await asRole('owner');
  await openCockpit(ownerPage, ids.tournamentId, ids.matchId);
  await expectEngineMatchRunningUi(ownerPage);
  await expect(ownerPage.locator('[data-testid="sync-status"]')).toBeVisible({ timeout: 10000 });

  const badMutationId = `a4-test-${Date.now()}`;
  const keys = queueKeys(await fetchUserIdByEmail(E2E_USERS.owner.email));
  await ownerPage.evaluate(
    ({ id, tournamentId, queueKey }) => {
      const item = {
        id,
        type: 'UPDATE_TOURNAMENT_METADATA',
        payload: { tournamentId, metadata: { status: 'A4_TEST_INVALID_STATUS' } },
        timestamp: Date.now(),
        retryCount: 0,
      };
      window.localStorage.setItem(queueKey, JSON.stringify([item]));
    },
    { id: badMutationId, tournamentId: ids.tournamentId, queueKey: keys.queue }
  );
  // Uhr der Seite steuerbar machen (läuft normal weiter, bis `fastForward` sie über die 30-s-Pause schiebt).
  await ownerPage.clock.install();
  // Neu laden: eine frische Queue lädt den Eintrag und unternimmt (online) den ersten von 5 Versuchen.
  await ownerPage.reload();
  await ownerPage.waitForLoadState('networkidle');
  await expectEngineMatchRunningUi(ownerPage);
  await expectLegacyQueueKeysEmpty(ownerPage);

  const readQueueState = () =>
    ownerPage.evaluate(({ queueKey, failedKey }) => {
      const failedRaw = window.localStorage.getItem(failedKey);
      const failed = failedRaw ? (JSON.parse(failedRaw) as unknown[]) : [];
      if (failed.length > 0) { return { retryCount: -1, deadLettered: true }; }
      const queuedRaw = window.localStorage.getItem(queueKey);
      const queued = queuedRaw ? (JSON.parse(queuedRaw) as Array<{ retryCount?: number }>) : [];
      return { retryCount: queued[0]?.retryCount ?? 0, deadLettered: false };
    }, { queueKey: keys.queue, failedKey: keys.failed });

  await expect.poll(async () => (await readQueueState()).retryCount, { message: 'Anstoß 1 (Neuladen): retryCount soll 1 sein', timeout: 8000 }).toBeGreaterThanOrEqual(1);
  let lastRetryCount = (await readQueueState()).retryCount;
  for (let attempt = 2; attempt <= 5; attempt++) {
    if ((await readQueueState()).deadLettered) { break; }
    // Seit A-06d2 wartet jeder Anstoß (online/enqueue) die 30-s-Pause nach einem echten Fehler ab; der
    // Zeitgeber der Queue sendet danach selbst. Die Uhr der Seite springt über die Pause (kein echtes Warten).
    await ownerPage.clock.fastForward(HOLD_RETRY_MS + 1000);
    await expect.poll(async () => {
      const state = await readQueueState();
      return state.deadLettered || state.retryCount > lastRetryCount;
    }, { message: `Anstoß ${attempt}: retryCount soll über ${lastRetryCount} steigen (oder Dead-Letter)`, timeout: 8000 }).toBe(true);
    lastRetryCount = (await readQueueState()).retryCount;
  }

  const syncStatus = ownerPage.locator('[data-testid="sync-status"]');
  await expect(syncStatus).toHaveAttribute('data-state', 'error', { timeout: 10000 });
  await syncStatus.click();
  const failedList = ownerPage.locator('[data-testid="sync-failed-list"]');
  await expect(failedList).toBeVisible({ timeout: 2000 });
  await expect(failedList).toContainText('tournaments_status_check');

  // "Erneut versuchen": der Eintrag verlässt die Fehlerliste und landet wieder in der Warteschlange.
  await ownerPage.locator(`[data-testid="sync-retry-${badMutationId}"]`).click();
  await expect.poll(async () => (await readQueueState()).deadLettered, { message: '„erneut versuchen": Eintrag verlässt die Fehlerliste sofort', timeout: 5000 }).toBe(false);
  await expect(syncStatus).not.toHaveAttribute('data-state', 'error', { timeout: 5000 });

  // "Verwerfen": für den isolierten Nachweis ein direkt gesetzter Dead-Letter-Eintrag.
  await ownerPage.evaluate(
    ({ id, queueKey, failedKey }) => {
      const item = {
        id,
        type: 'UPDATE_TOURNAMENT_METADATA',
        payload: {},
        timestamp: Date.now(),
        retryCount: 5,
        failedAt: Date.now(),
        lastError: 'new row for relation "tournaments" violates check constraint "tournaments_status_check"',
      };
      window.localStorage.setItem(queueKey, '[]');
      window.localStorage.setItem(failedKey, JSON.stringify([item]));
    },
    { id: badMutationId, queueKey: keys.queue, failedKey: keys.failed }
  );
  await ownerPage.reload();
  await ownerPage.waitForLoadState('networkidle');
  await expectEngineMatchRunningUi(ownerPage);
  await expect(syncStatus).toHaveAttribute('data-state', 'error', { timeout: 10000 });
  await syncStatus.click();
  await expect(failedList).toBeVisible({ timeout: 2000 });
  await ownerPage.locator(`[data-testid="sync-discard-${badMutationId}"]`).click();
  await ownerPage.locator('[data-testid="confirm-dialog-confirm"]').click();
  await expect(syncStatus).toHaveAttribute('data-state', 'idle', { timeout: 5000 });
  const failedAfterDiscard = await ownerPage.evaluate((failedKey) => window.localStorage.getItem(failedKey), keys.failed);
  await expectLegacyQueueKeysEmpty(ownerPage);
  expect(failedAfterDiscard === null || failedAfterDiscard === '[]').toBe(true);
});
