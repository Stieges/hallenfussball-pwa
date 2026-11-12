/**
 * tests/e2e/cloud/spielplan-direkteintrag.cloud.spec.ts — A-08f3e2 (T2-UI b): Olli trägt im Spielplan ein
 * Papier-Ergebnis ein. Echter Weg über die Oberfläche: Spielkarte → Schnelleingabe → Speichern → Server-Eintrag
 * `RESULT_ENTRY` über `append_match_events`, Spalten beendet 3:1 (@FU-080). Gegenprobe per Service-Role.
 * Nur cloud-desktop (der Engine-Cup DIREKTEINTRAG wird verbraucht, neu mit `npm run test:env:seed`).
 */
import { test, expect } from './fixtures';
import { engineCupTarget, expectSeededEngineMatch, fetchEngineRows, newRoleContext } from './engineHelpers';
import { fetchMatchRow } from './helpers';
import { engineCupIds } from './testData';

test.describe('Spielplan: Ergebnis direkt eintragen', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Engine-Cups nur auf cloud-desktop.');
  });

  test('@FU-080 Spiel geplant und auf Papier geleitet: Olli trägt 3:1 ein → beendet mit 3:1, Server-Eintrag RESULT_ENTRY', async ({ browser }) => {
    test.setTimeout(90_000);
    const ids = engineCupIds('DIREKTEINTRAG');
    await expectSeededEngineMatch(engineCupTarget('DIREKTEINTRAG'));
    const owner = await newRoleContext(browser, 'owner');
    try {
      const page = owner.page;
      await page.goto(`/#/tournament/${ids.tournamentId}/schedule`);
      await page.waitForLoadState('networkidle');
      const card = page.locator('[data-match-card]').filter({ hasText: ids.homeTeamName }).first();
      await card.getByText(ids.homeTeamName).first().click();
      await page.getByTestId('match-action-enterResult').click(); // @SL-193: Tipp aufs Spiel, dann „Ergebnis eintragen“
      const sheet = page.getByTestId('result-sheet'); // @SL-195: das Blatt „Endergebnis“, Felder leer, Speichern erst mit der Taste
      await expect(sheet).toBeVisible();
      await sheet.getByTestId('result-sheet-score-home').fill('3');
      await sheet.getByTestId('result-sheet-score-away').fill('1');
      await sheet.getByTestId('result-sheet-save').click();

      await expect(page.locator(`[data-testid="match-circle-${ids.matchId}"]`)).toContainText('3:1', { timeout: 10000 });
      await expect.poll(() => fetchMatchRow(ids.matchId).then((row) => [row.score_a, row.score_b, row.match_status]), { timeout: 10000 })
        .toEqual([3, 1, 'finished']);
      expect((await fetchEngineRows(ids.matchId)).map((row) => row.type)).toEqual(['RESULT_ENTRY']);
      await expect(page.getByTestId('sync-status-rejected')).toHaveCount(0);
      await expect(page.getByTestId('engine-outbox-waiting')).toHaveCount(0);
    } finally {
      await owner.context.close();
    }
  });
});
