/**
 * D12 Korrektur eines beendeten Spiels.
 *
 * Die Korrektur schreibt ein Engine-Ereignis `CORRECTION` in `match_events` (nicht mehr in `match_corrections`).
 * Gherkin @EK-063: Einstieg im Spielplan beim beendeten Spiel ODER im Cockpit, immer derselbe Dialog.
 *  - D12: Spielplan-Weg. Auf main ist er NICHT angeschlossen: `MatchScoreCell` zeigt `correction-button-<id>` nur mit
 *    `onStartCorrection`, ScheduleTab reicht keinen Handler durch (A-08e, Daniel 15.10. Frage 1 = A: kein Korrektur-Knopf
 *    im Spielplan bis B-24); der Weg Ergebnis-Kreis -> `match-summary-edit-score` blendet `onEditScore` ebenfalls nur
 *    mit Handler ein. Der Dialog (`correction-score-a/b`, `correction-confirm-button`) ist erst erreichbar, wenn B-24
 *    den Einstieg baut. Der Schritt behält die Erwartung (CORRECTION-Ereignis, Stand 4:0) und ist expectedFail.
 *  - D12b: Cockpit-Einstieg (`match-correction-button`), Besitzer B-25.
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
  const knopf = ownerPage.locator(`[data-testid="correction-button-${match.id}"]`);
  await expect(async () => {
    for (const fraction of [0, 0.3, 0.6, 1]) {
      await ownerPage.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), fraction);
      await ownerPage.waitForTimeout(250);
      if (await knopf.isVisible().catch(() => false)) {
        return;
      }
    }
    expect(await knopf.isVisible(), 'Korrigieren-Knopf des beendeten Spiels').toBe(true);
  }).toPass({ timeout: 20000 });
  await knopf.click();
  await ownerPage.locator('[data-testid="correction-score-a"]').fill('4');
  await ownerPage.locator('[data-testid="correction-score-b"]').fill('0');
  await ownerPage.locator('[data-testid="correction-confirm-button"]').click();
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
  { id: 'D12', title: 'Ergebnis eines beendeten Spiels im Spielplan korrigieren (CORRECTION in match_events)', scenarios: ['@EK-063'], befunde: ['C-KORREKTUR-EINSTIEG-FEHLT'], owner: 'B-25', expectedFail: true, run: korrekturImSpielplan },
  { id: 'D12b', title: 'Korrektur aus dem Cockpit der Turnierleitung (gleicher Dialog)', scenarios: ['@EK-063'], owner: 'B-25', expectedFail: true, run: korrekturImCockpit },
];
