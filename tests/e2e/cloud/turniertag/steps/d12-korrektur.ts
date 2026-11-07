/**
 * D12 Korrektur eines beendeten Spiels.
 *
 * Die Korrektur schreibt ein Engine-Ereignis `CORRECTION` in `match_events` (nicht mehr in `match_corrections`).
 * Gherkin @EK-063: Einstieg im Spielplan beim beendeten Spiel ODER im Cockpit, immer derselbe Dialog.
 *  - D12: Spielplan-Weg (G2 Spur A, @SL-193): Tipp aufs beendete Spiel → Aktionsauswahl → „Ergebnis korrigieren“ → derselbe Dialog
 *    wie im Cockpit (`cockpit-korrektur-*`: bisher und neu) → „Weiter“ → Auswahl des Grunds (`result-entry-reason`, Pflicht).
 *    Der frühere Weg über `correction-button-<id>` / `correction-score-a` ist entfernt.
 *  - D12b: Cockpit-Einstieg (`match-correct-button`, B-10a2), auf einem BEENDETEN Spiel (Gruppenspiel 4,
 *    nach D8 beendet; @EK-063: "nachdem er das Spiel selbst geleitet hat und es abgepfiffen ist").
 */
import { expect } from '@playwright/test';
import { fetchEngineRows, openCockpit } from '../../engineHelpers';
import { expectPageAnchor, fetchTurniertagBracket, fetchTurniertagMatches, openTurniertagPath, SOLL_TIMEOUT_MS, TURNIERTAG_ID, vorbedingung } from './shared';
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
    return [m?.score_a, m?.score_b, m?.match_status];
  }, { message: 'Ergebnis des Spiels nach der Korrektur (das Spiel bleibt beendet)', timeout: 10000 }).toEqual([4, 0, 'finished']);
}

/**
 * D12b (@EK-063, Einstieg „in seinem Cockpit, nachdem er das Spiel selbst geleitet hat und es abgepfiffen ist“): im Cockpit des beendeten
 * Gruppenspiels 4 wählt Olli „Korrigieren“ (`match-correct-button`). Es öffnet sich die Korrektur dieses Spiels mit bisher und neu und danach
 * der Auswahl des Grunds – derselbe Dialog wie beim Einstieg im Spielplan (D12: `cockpit-korrektur-*`, `result-entry-reason`). Gespeichert
 * wird nicht (Abbrechen), das Ergebnis bleibt.
 */
async function korrekturImCockpit({ asRole }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const spiel = await vorbedingung('Gruppenspiel 4 ist beendet', async () => {
    const zeile = (await fetchTurniertagMatches()).find((m) => m.id === groupMatches[3].id);
    expect(zeile?.match_status, 'Gruppenspiel 4 ist beendet (D8)').toBe('finished');
    return zeile!;
  });
  const vorher = (await fetchEngineRows(spiel.id)).filter((row) => row.type === 'CORRECTION').length;
  const ownerPage = await asRole('owner');
  await openCockpit(ownerPage, TURNIERTAG_ID, spiel.id);
  await expectPageAnchor(ownerPage.locator('[data-testid="team-name-home"]'), 'Cockpit des Spiels');
  await ownerPage.getByTestId('match-correct-button').click({ timeout: SOLL_TIMEOUT_MS });
  const dialog = ownerPage.getByTestId('cockpit-korrektur-dialog');
  await expect(dialog, 'die Korrektur öffnet sich').toBeVisible({ timeout: SOLL_TIMEOUT_MS });
  await expect(dialog, `Korrektur von Spiel ${spiel.match_number ?? '?'}`).toContainText(`Spiel ${spiel.match_number ?? '?'}`);
  // bisher: das geltende Ergebnis; neu: zwei Zahlenfelder, vorbelegt mit dem bisherigen Stand
  await expect(dialog, 'bisher').toContainText(`${(spiel.score_a ?? 0) + 5}:${spiel.score_b ?? ''}`); // MUTATIONSPROBE
  await expect(ownerPage.getByTestId('cockpit-korrektur-home')).toHaveValue(String(spiel.score_a));
  await expect(ownerPage.getByTestId('cockpit-korrektur-away')).toHaveValue(String(spiel.score_b));
  await ownerPage.getByTestId('cockpit-korrektur-home').fill(String((spiel.score_a ?? 0) + 1));
  await ownerPage.getByTestId('cockpit-korrektur-weiter').click();
  // ... und die Auswahl des Grunds (derselbe Schritt wie im Spielplan)
  await expect(ownerPage.getByTestId('result-entry-reason'), 'Auswahl des Grunds').toBeVisible({ timeout: SOLL_TIMEOUT_MS });
  await ownerPage.getByTestId('result-entry-cancel').click();
  expect((await fetchEngineRows(spiel.id)).filter((row) => row.type === 'CORRECTION').length, 'abgebrochen: keine Korrektur gespeichert').toBe(vorher);
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D12', title: 'Ergebnis eines beendeten Spiels im Spielplan korrigieren (CORRECTION in match_events)', scenarios: ['@EK-063'], owner: 'B-24', expectedFail: false, run: korrekturImSpielplan },
  { id: 'D12b', title: 'Korrektur aus dem Cockpit der Turnierleitung (gleicher Dialog)', scenarios: ['@EK-063'], owner: 'B-10a2 (gebaut, @SL-159)', expectedFail: false, run: korrekturImCockpit },
];
