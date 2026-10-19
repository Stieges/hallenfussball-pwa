/**
 * D8 Gruppenabschluss -> Halbfinale über Kreuz. Besitzer: A-13 (Auflösung der Finalrunde) mit der Oberfläche des Abschlusses.
 *
 * Gherkin @TM-044: nach dem letzten Abpfiff einer Gruppe SCHLÄGT DIE APP den Abschluss nur vor; die Plätze mit Herkunft aus
 * dieser Gruppe sind noch nicht besetzt. @TM-046/@TM-016: erst wenn Olli "Gruppe abschließen" wählt, ist die Gruppe
 * "abgeschlossen" und alle Plätze mit Herkunft aus ihr sind besetzt (Halbfinale über Kreuz); @TM-047: jede Gruppe rückt für sich ein.
 * Die Besetzung geschieht also NICHT von selbst am Server, sondern durch die Handlung der Turnierleitung.
 *
 * Die Vorbereitung (alle gespielten Gruppenspiele zeitrichtig beenden) ist eine Vorbedingung: scheitert sie, wird der
 * Schritt unerwartet rot und nicht als "erwartet rot" gewertet. Soll-Marker (der Besitzer präzisiert sie beim Bauen):
 * `group-close-suggestion` (Vorschlag), `group-close-button-<Gruppe>` ("Gruppe abschließen").
 */
import { expect } from '@playwright/test';
import { fetchEngineRows } from '../../engineHelpers';
import { expectPageAnchor, expectSollMarker, fetchTurniertagBracket, fetchTurniertagMatches, openTurniertagPath, SOLL_TIMEOUT_MS, vorbedingung } from './shared';
import { appendOwner, finishingEvents, regularResultEvents } from './playViaRpc';
import type { StepContext, TurniertagStep } from './types';

const halbfinalePlaetzeBesetzt = async (): Promise<boolean> =>
  (await fetchTurniertagMatches()).filter((m) => m.phase !== 'groupStage').slice(0, 2).every((m) => m.team_a_id && m.team_b_id);

async function gruppenabschluss({ asRole }: StepContext): Promise<void> {
  await vorbedingung('alle Gruppenspiele beenden', async () => {
    const { groupMatches } = await fetchTurniertagBracket();
    for (const [index, match] of groupMatches.entries()) {
      const rows = await fetchEngineRows(match.id);
      if (rows.some((row) => row.type === 'MATCH_END')) {
        continue;
      }
      const remaining = finishingEvents(rows, regularResultEvents(match, (index % 3) + 1, index % 2));
      const result = await appendOwner(match.id, remaining);
      expect(result.results.map((r) => r.status), `Gruppenspiel ${index + 1}`).toEqual(remaining.map(() => 'accepted'));
    }
  });
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/schedule');
  await expectPageAnchor(ownerPage.locator('[data-testid="filter-phase"]'), 'Spielplan der Turnierleitung');
  // @TM-044: die App schlägt den Abschluss vor ...
  await expectSollMarker(ownerPage, 'group-close-suggestion');
  // ... und besetzt die Plätze noch nicht.
  expect(await halbfinalePlaetzeBesetzt(), 'vor "Gruppe abschließen" sind die Halbfinal-Plätze noch nicht besetzt').toBe(false);
  // @TM-046/@TM-047: Olli wählt "Gruppe abschließen" (je Gruppe), danach sind die Plätze besetzt.
  for (const gruppe of ['A', 'B']) {
    await ownerPage.locator(`[data-testid="group-close-button-${gruppe}"]`).click({ timeout: SOLL_TIMEOUT_MS });
  }
  await expect.poll(halbfinalePlaetzeBesetzt, {
    message: 'Halbfinale 1 und 2 sind nach "Gruppe abschließen" besetzt',
    timeout: SOLL_TIMEOUT_MS,
  }).toBe(true);
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D8', title: 'Gruppenabschluss: App schlägt vor, Olli schließt ab, Halbfinale über Kreuz besetzt', scenarios: ['@TM-044', '@TM-046', '@TM-047', '@TM-016'], owner: 'A-13', expectedFail: true, run: gruppenabschluss },
];
