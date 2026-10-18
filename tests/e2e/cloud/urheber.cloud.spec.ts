/**
 * tests/e2e/cloud/urheber.cloud.spec.ts — UR (Befund C-EREIGNIS-OHNE-URHEBER): „Ergebnis eingetragen von Olli“.
 * Echter Weg gegen den lokalen Stack MIT `20261028_006_event_author_names.sql`: Olli (Seed-Konto „Olli Owner“) trägt im
 * Spielplan 3:1 ein (@FU-080), öffnet das Spiel über den Live-Bereich (Spiel-Auswahl) und sieht im Ereignisprotokoll
 * „Ergebnis eingetragen von Olli Owner“. Der Helfer Heiko (collaborator, @FU-065 „Helfer sieht, welches Konto …“) liest
 * denselben Namen über die Lesefunktion `match_event_author_names`.
 * Nur cloud-desktop (die Sidebar ist das Desktop-Protokoll; der Engine-Cup URHEBER wird verbraucht, neu mit
 * `npm run test:env:seed`). Ohne `_006` im Stack zeigt die App „Ergebnis eingetragen“ ohne Namen -- dann rot.
 */
import { test, expect } from './fixtures';
import { engineCupTarget, expectSeededEngineMatch, fetchEngineRows, newRoleContext, openCockpit } from './engineHelpers';
import { fetchMatchRow } from './helpers';
import { E2E_USERS, engineCupIds } from './testData';

const OLLI = E2E_USERS.owner.displayName;

test.describe('UR: Urheber am Eintrag im Protokoll', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Engine-Cups und Sidebar-Protokoll nur auf cloud-desktop.');
  });

  test('@FU-080 Olli trägt im Spielplan 3:1 ein → das Protokoll zeigt „Ergebnis eingetragen von Olli“, auch beim Helfer (@FU-065)', async ({ browser }) => {
    test.setTimeout(120_000);
    const ids = engineCupIds('URHEBER');
    await expectSeededEngineMatch(engineCupTarget('URHEBER'));
    const owner = await newRoleContext(browser, 'owner');
    const helper = await newRoleContext(browser, 'helper');
    try {
      // Gegeben Spiel ist geplant und wurde auf Papier geleitet -- Wenn Olli im Spielplan 3:1 einträgt
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
      // Dann ist das Spiel beendet mit 3:1
      await expect.poll(() => fetchMatchRow(ids.matchId).then((row) => [row.score_a, row.score_b, row.match_status]), { timeout: 10000 })
        .toEqual([3, 1, 'finished']);
      expect((await fetchEngineRows(ids.matchId)).map((row) => row.type)).toEqual(['RESULT_ENTRY']);

      // Und das Protokoll zeigt „Ergebnis eingetragen von Olli“ -- Einstieg: Live-Bereich, Spiel-Auswahl (ManagementTab).
      await page.goto(`/#/tournament/${ids.tournamentId}/live`);
      await page.waitForLoadState('networkidle');
      await page.locator('select').filter({ has: page.locator(`option[value="${ids.matchId}"]`) }).selectOption(ids.matchId);
      const ollisProtocol = page.getByTestId('protocol-result-entry');
      await expect(ollisProtocol).toHaveText(`📝Ergebnis eingetragen von ${OLLI}`, { timeout: 15000 });
      await expect(page.getByText('Noch keine Ereignisse')).toHaveCount(0);

      // @FU-065: Helfer Heiko öffnet dasselbe Protokoll und liest Ollis Namen über die Lesefunktion.
      await openCockpit(helper.page, ids.tournamentId, ids.matchId);
      await expect(helper.page.getByTestId('protocol-result-entry')).toHaveText(`📝Ergebnis eingetragen von ${OLLI}`, { timeout: 15000 });
    } finally {
      await owner.context.close();
      await helper.context.close();
    }
  });

  // @FU-082 mit Namen über die Oberfläche: braucht zwei Konten der Turnierleitung (Olli + Co-Admin) in einem Engine-Cup
  // und einen festen Zeitpunkt, an dem Marias Gerät den alten Stand 2:1 noch hält. Die Engine-Cups kennen nur den
  // Helfer als Mitglied (EngineCupSpec.helper), und Marias Gerät holt Ollis Korrektur per Realtime meist vor ihrer
  // Eingabe nach (dann Grund-Rückfrage statt Ablehnung). Abgedeckt: Container (event-author-names-check.sh, Maria liest
  // „Olli“) + Hook-Test (useScheduleResultEntry.test.tsx, Text „… von Olli geändert (jetzt 2:2)“). Offener Punkt im Report.
  test.fixme('@FU-082 Marias Korrektur wird abgelehnt mit „Spiel 7 wurde inzwischen von Olli geändert (jetzt 2:2)“', async () => {
    // Fall bewusst offen, siehe Kommentar oben.
  });
});
