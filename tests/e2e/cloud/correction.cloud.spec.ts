/**
 * tests/e2e/cloud/correction.cloud.spec.ts — Cloud-Nachweis für A2 Fixrunde 1 (Ruling AJ/AK,
 * .superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-review.md, C1): die
 * Ergebniskorrektur (`useCorrectionMode#handleConfirmCorrection`) läuft seit Fixrunde 1 über eine
 * gezielte `UPDATE_MATCH`-Aktualisierung statt über den vollen Turnier-Save, der Ergebnis-Spalten
 * für bestehende Spiele seit A2 überspringt. Owner korrigiert ein bereits BEENDETES Live-Cup-Spiel
 * (nicht das laufende -- unabhängiges Datum, kein Konflikt mit `two-devices.cloud.spec.ts`s
 * serieller Kette) über die echte Oberfläche, danach steht der neue Stand in der DB.
 */
import { test, expect } from './fixtures';
import { fetchFinishedMatchRow, fetchMatchRow, getLocalServiceRoleClient, safeCleanup } from './helpers';
import { E2E_LIVE_CUP_ID } from './testData';

test('Owner korrigiert ein beendetes Live-Cup-Spiel: neuer Stand steht in der DB (A2 Fixrunde 1, C1)', async ({
  asRole,
}, testInfo) => {
  // Der Ergebnis-Kreis (MatchCardScore) wird in der mobilen Kartenansicht anders/nicht klickbar
  // gerendert als in der Desktop-Tabellenansicht (gleiches Muster wie
  // `two-devices.cloud.spec.ts`s Live-Cup/Public-Cup-Tests) -- nur auf Desktop ausgeführt.
  test.skip(!testInfo.project.name.includes('desktop'), 'Score-Kreis-Klick ist Desktop-Tabellenansicht-spezifisch.');

  const before = await fetchFinishedMatchRow(E2E_LIVE_CUP_ID);
  const newScoreA = before.score_a + 1;
  const newScoreB = before.score_b;

  try {
    const ownerPage = await asRole('owner');
    await ownerPage.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/schedule`);
    await ownerPage.waitForLoadState('networkidle');

    // Klick auf den Ergebnis-Kreis öffnet die Spiel-Zusammenfassung (MatchSummary), von dort aus
    // "Ergebnis bearbeiten" (ScoreHeader.tsx) den Korrektur-Dialog -- kein direkter Korrektur-Button
    // in der Tabellenansicht.
    await ownerPage.locator(`[data-testid="match-circle-${before.id}"]`).click();
    // Zwei Instanzen im DOM (Desktop-/Mobile-Variante des Dialogs), nur eine sichtbar.
    await ownerPage.locator('[data-testid="match-summary-edit-score"]:visible').click();
    await expect(ownerPage.locator('[data-testid="correction-score-a"]')).toBeVisible({ timeout: 10000 });

    await ownerPage.locator('[data-testid="correction-score-a"]').fill(String(newScoreA));
    await ownerPage.locator('[data-testid="correction-score-b"]').fill(String(newScoreB));
    await ownerPage.locator('[data-testid="correction-confirm-button"]').click();

    await expect.poll(() => fetchMatchRow(before.id).then((row) => row.score_a), {
      message: 'Die Korrektur sollte den neuen Stand in der DB persistieren (targeted UPDATE_MATCH, kein voller Save)',
      timeout: 10000,
    }).toBe(newScoreA);
    expect((await fetchMatchRow(before.id)).match_status).toBe('finished');
  } finally {
    await safeCleanup('Live-Cup: korrigiertes Ergebnis zurückbauen (Korrektur-Test)', async () => {
      const { url, headers } = getLocalServiceRoleClient();
      const res = await fetch(`${url}/rest/v1/matches?id=eq.${before.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ score_a: before.score_a, score_b: before.score_b }),
      });
      if (!res.ok) {
        throw new Error(`Rückbau fehlgeschlagen: ${res.status} ${await res.text()}`);
      }
    });
  }
});
