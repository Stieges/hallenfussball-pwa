/**
 * D12 Korrektur eines beendeten Spiels.
 *
 * Die Korrektur schreibt ein Engine-Ereignis `CORRECTION` in `match_events` (nicht mehr in `match_corrections`).
 * Gherkin @EK-063: Einstieg im Spielplan beim beendeten Spiel ODER im Cockpit, immer derselbe Dialog.
 *  - D12: Spielplan-Weg (G2 Spur A, @SL-193): Tipp aufs beendete Spiel → Aktionsauswahl → „Ergebnis korrigieren“ → derselbe Dialog
 *    wie im Cockpit (`cockpit-korrektur-*`: bisher und neu) → „Weiter“ → Auswahl des Grunds (`result-entry-reason`, Pflicht).
 *    Der frühere Weg über `correction-button-<id>` / `correction-score-a` ist entfernt.
 *  - D12b: Cockpit-Einstieg (`match-correction-button`), Besitzer B-25 (W5), auf einem BEENDETEN Spiel (Gruppenspiel 4,
 *    nach D8 beendet; @EK-063: "nachdem er das Spiel selbst geleitet hat und es abgepfiffen ist").
 */
import { expect } from '@playwright/test';
import { fetchEngineRows, openCockpit } from '../../engineHelpers';
import { expectPageAnchor, expectSollMarker, fetchTurniertagBracket, fetchTurniertagMatches, openTurniertagPath, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function korrekturImSpielplan({ asRole }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const match = groupMatches[0];
  const before = (await fetchEngineRows(match.id)).filter((row) => row.type === 'CORRECTION').length;
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/schedule');
  await expectPageAnchor(ownerPage.locator('[data-testid="filter-phase"]'), 'Spielplan der Turnierleitung');
  const kreis = ownerPage.locator(`[data-testid="match-circle-${match.id}"]:visible`);
  await expect(async () => {
    for (const fraction of [0, 0.3, 0.6, 1]) {
      await ownerPage.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), fraction);
      await ownerPage.waitForTimeout(250);
      if (await kreis.first().isVisible().catch(() => false)) {
        return;
      }
    }
    expect(await kreis.first().isVisible(), 'Karte des beendeten Spiels').toBe(true);
  }).toPass({ timeout: 20000 });
  await kreis.first().click();
  await ownerPage.getByTestId('match-action-correct').click();
  await ownerPage.getByTestId('cockpit-korrektur-home').fill('4');
  await ownerPage.getByTestId('cockpit-korrektur-away').fill('0');
  await ownerPage.getByTestId('cockpit-korrektur-weiter').click();
  // @EK-063: die Auswahl des Grunds gehört zum Dialog (Pflicht)
  await ownerPage.getByTestId('result-entry-reason').selectOption('input_error');
  await ownerPage.getByTestId('result-entry-save').click();
  // Ereignis: genau eine neue CORRECTION-Zeile mit dem neuen Stand je Team.
  await expect.poll(async () => (await fetchEngineRows(match.id)).filter((row) => row.type === 'CORRECTION').length, {
    message: 'Korrektur erzeugt ein CORRECTION-Ereignis in match_events', timeout: 10000,
  }).toBe(before + 1);
  const rows = (await fetchEngineRows(match.id)).filter((row) => row.type === 'CORRECTION');
  const scores = rows[rows.length - 1].payload.scores as Record<string, number>;
  expect(scores[match.team_a_id ?? '']).toBe(4);
  expect(scores[match.team_b_id ?? '']).toBe(0);
  // Neuer Stand: das Spiel steht in der Cloud auf 4:0.
  await expect.poll(async () => {
    const m = (await fetchTurniertagMatches()).find((x) => x.id === match.id);
    return [m?.score_a, m?.score_b];
  }, { message: 'Ergebnis des Spiels nach der Korrektur', timeout: 10000 }).toEqual([4, 0]);
}

async function korrekturImCockpit({ asRole }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const ownerPage = await asRole('owner');
  await openCockpit(ownerPage, TURNIERTAG_ID, groupMatches[3].id);
  await expectPageAnchor(ownerPage.locator('[data-testid="team-name-home"]'), 'Cockpit des Spiels');
  await expectSollMarker(ownerPage, 'match-correction-button');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D12', title: 'Ergebnis eines beendeten Spiels im Spielplan korrigieren (CORRECTION in match_events)', scenarios: ['@EK-063'], owner: 'B-24', expectedFail: false, run: korrekturImSpielplan },
  { id: 'D12b', title: 'Korrektur aus dem Cockpit der Turnierleitung (gleicher Dialog)', scenarios: ['@EK-063'], owner: 'B-25', expectedFail: true, run: korrekturImCockpit },
];
