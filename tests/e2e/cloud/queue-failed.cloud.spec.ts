/**
 * tests/e2e/cloud/queue-failed.cloud.spec.ts — Teil B von "C-SYNC" (A-23, übernimmt C3b-3a §2
 * `:649`): Die TURNIER-Warteschlange (`mutation_queue_v1`) hat weiter Retry/Verwerfen
 * (`sync-failed-list`, `sync-retry-*`, `sync-discard-*`). Engine-Ablehnungen kennen nur
 * "Verstanden" (Teil A, `two-devices.cloud.spec.ts`, Cup REJECT).
 *
 * Seit BP-1 (Befund C-ENDGUELTIG-SOFORT-MELDEN, Controller-Entscheidung F2) gilt je nach Art der Ablehnung:
 * - @FU-126 eindeutig (Konflikt, Postgres-Klasse 22/23, HF002/HF003, Team noch referenziert): beim ERSTEN Versuch
 *   „nicht übernommen“ mit Grund, keine Wiederholung, statt „Erneut versuchen“ nur „Verwerfen und aktuellen Stand laden“.
 * - @FU-127 unklar (z. B. 42501, unbekannte Codes): wird wiederholt; in der Fehlerliste bleibt „Erneut versuchen“.
 *
 * Deterministisch eindeutig scheiternder Weg: ein direkt eingespeistes `UPDATE_TOURNAMENT_METADATA` mit `status` außerhalb
 * des DB-Constraints `tournaments_status_check` (Postgres 23514 = Klasse 23, ungültiger Wert). Der Client weist ihn lokal nicht
 * ab (`updateTournamentMetadata` reicht `status` unverändert durch). Früher erwartete dieser Test 5 Versuche à 30 s – das
 * ist mit @FU-126 bewusst entfallen. Der Weg „unklar → Erneut versuchen“ wird mit einem direkt gesetzten Eintrag ohne Grund
 * geprüft.
 */

import { test, expect } from './fixtures';
import { engineCupTarget, expectEngineMatchRunningUi, expectSeededEngineMatch, fetchUserIdByEmail, openCockpit } from './engineHelpers';
import { expectLegacyQueueKeysEmpty, queueKeys } from './helpers';
import { E2E_USERS, engineCupIds } from './testData';
import { HOLD_RETRY_MS } from '../../../src/core/services/mutationQueueRetry';

test('Cup QUEUE: eine dauerhaft abgelehnte Turnier-Mutation ist innerhalb von 10s als gescheitert sichtbar, retry/verwerfen wirken (Task A4, C-SYNC Teil B, @FU-126, @FU-127)', async ({ asRole }, testInfo) => {
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
      const failed = failedRaw ? (JSON.parse(failedRaw) as Array<{ id: string; retryCount: number; rejection?: string }>) : [];
      const queuedRaw = window.localStorage.getItem(queueKey);
      const queued = queuedRaw ? (JSON.parse(queuedRaw) as unknown[]) : [];
      return { failed, pending: queued.length };
    }, { queueKey: keys.queue, failedKey: keys.failed });

  // @FU-126: spätestens 10 s nach dem Neuladen (erster Versuch) liegt der Eintrag ohne Wiederholung als „nicht übernommen“ ab
  await expect.poll(async () => (await readQueueState()).failed.map((f) => f.id), { message: '@FU-126: beim ersten Versuch abgelegt', timeout: 10000 }).toEqual([badMutationId]);
  const [abgelegt] = (await readQueueState()).failed;
  expect(abgelegt.retryCount).toBe(0);
  expect(abgelegt.rejection).toBe('invalidValue');
  // … und versucht ihn nicht noch einmal von selbst, auch nicht nach der früheren 30-s-Pause
  await ownerPage.clock.fastForward(HOLD_RETRY_MS + 1000);
  expect(await readQueueState()).toMatchObject({ pending: 0, failed: [expect.objectContaining({ id: badMutationId, retryCount: 0 })] });

  const syncStatus = ownerPage.locator('[data-testid="sync-status"]');
  await expect(syncStatus).toHaveAttribute('data-state', 'error', { timeout: 10000 });
  await syncStatus.click();
  const failedList = ownerPage.locator('[data-testid="sync-failed-list"]');
  await expect(failedList).toBeVisible({ timeout: 2000 });
  // Grund in Klartext (Glossar „nicht übernommen“), kein „Erneut versuchen“, nur Verwerfen mit Laden des Server-Stands
  await expect(ownerPage.locator(`[data-testid="sync-failed-reason-${badMutationId}"]`)).toHaveText('Nicht übernommen – ungültiger Wert');
  await expect(ownerPage.locator(`[data-testid="sync-retry-${badMutationId}"]`)).toHaveCount(0);
  const verwerfenEindeutig = ownerPage.locator(`[data-testid="sync-discard-${badMutationId}"]`);
  await expect(verwerfenEindeutig).toHaveText('Verwerfen und aktuellen Stand laden');
  await verwerfenEindeutig.click();
  await ownerPage.locator('[data-testid="confirm-dialog-confirm"]').click();
  await expect.poll(async () => (await readQueueState()).failed.length, { message: 'Verwerfen entfernt den Eintrag', timeout: 5000 }).toBe(0);

  // @FU-127: ein Eintrag mit unklarem Grund (ohne Merkmal) behält „Erneut versuchen“; er verlässt die Fehlerliste und
  // geht erneut in die Warteschlange (leere Angaben: der erneute Versuch gelingt ohne Schreiben).
  const unklarId = `${badMutationId}-unklar`;
  await ownerPage.evaluate(
    ({ id, tournamentId, queueKey, failedKey }) => {
      const item = {
        id,
        type: 'UPDATE_TOURNAMENT_METADATA',
        payload: { tournamentId, metadata: {} },
        timestamp: Date.now(),
        retryCount: 5,
        failedAt: Date.now(),
        lastError: 'new row violates row-level security policy for table "tournaments"',
      };
      window.localStorage.setItem(queueKey, '[]');
      window.localStorage.setItem(failedKey, JSON.stringify([item]));
    },
    { id: unklarId, tournamentId: ids.tournamentId, queueKey: keys.queue, failedKey: keys.failed }
  );
  await ownerPage.reload();
  await ownerPage.waitForLoadState('networkidle');
  await expectEngineMatchRunningUi(ownerPage);
  await expect(syncStatus).toHaveAttribute('data-state', 'error', { timeout: 10000 });
  await syncStatus.click();
  await expect(failedList).toBeVisible({ timeout: 2000 });
  await expect(ownerPage.locator(`[data-testid="sync-failed-reason-${unklarId}"]`)).toHaveText('new row violates row-level security policy for table "tournaments"');
  await ownerPage.locator(`[data-testid="sync-retry-${unklarId}"]`).click();
  await expect.poll(async () => (await readQueueState()).failed.length, { message: '„erneut versuchen": Eintrag verlässt die Fehlerliste sofort', timeout: 5000 }).toBe(0);
  await expect(syncStatus).not.toHaveAttribute('data-state', 'error', { timeout: 5000 });

  // "Verwerfen" eines unklaren Eintrags: für den isolierten Nachweis ein direkt gesetzter Dead-Letter-Eintrag.
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
