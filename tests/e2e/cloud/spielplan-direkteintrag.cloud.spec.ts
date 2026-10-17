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
      const expand = card.getByTestId('quick-score-expand');
      await expect(expand).toBeVisible();
      for (let i = 0; i < 3; i++) { await expand.getByLabel(`${ids.homeTeamName} Tor hinzufügen`).click(); }
      await expand.getByLabel(`${ids.awayTeamName} Tor hinzufügen`).click();
      await expand.getByTestId('quick-score-save-btn').click();

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
