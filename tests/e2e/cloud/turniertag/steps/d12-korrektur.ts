/**
 * D12 Korrektur. Besitzer: B-25 (Korrekturmodus im Cockpit).
 * Besitzer: B-25 -- Soll-Marker: das Cockpit eines beendeten Spiels bietet die Korrektur
 * (`match-correction-button`).
 */
import { openCockpit } from '../../engineHelpers';
import { expectPageAnchor, expectSollMarker, fetchTurniertagBracket, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function korrektur({ asRole }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const ownerPage = await asRole('owner');
  await openCockpit(ownerPage, TURNIERTAG_ID, groupMatches[0].id);
  await expectPageAnchor(ownerPage.locator('[data-testid="team-name-home"]'), 'Cockpit des Spiels');
  await expectSollMarker(ownerPage, 'match-correction-button');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D12', title: 'Ergebnis eines beendeten Spiels korrigieren', scenarios: [], owner: 'B-25', expectedFail: true, run: korrektur },
];
