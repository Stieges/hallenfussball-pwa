/**
 * D6 Halbzeit + Zeitstrafe. Besitzer: B-08 (Halbzeit) / B-10b (Zeitstrafe).
 * Besitzer: B-08/B-10b -- Soll-Marker: das Cockpit des laufenden Spiels führt die Halbzeit aus
 * (`match-halftime-button`).
 */
import { expectEngineMatchRunningUi, openCockpit } from '../../engineHelpers';
import { expectPageAnchor, expectSollMarker, fetchTurniertagBracket, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function halbzeitZeitstrafe({ asRole }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const ownerPage = await asRole('owner');
  await openCockpit(ownerPage, TURNIERTAG_ID, groupMatches[0].id);
  await expectPageAnchor(ownerPage.locator('[data-testid="team-name-home"]'), 'Cockpit des Spiels');
  await expectEngineMatchRunningUi(ownerPage);
  await expectSollMarker(ownerPage, 'match-halftime-button');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D6', title: 'Halbzeit ausführen, Zeitstrafe läuft ab', scenarios: [], owner: 'B-08/B-10b', expectedFail: true, run: halbzeitZeitstrafe },
];
