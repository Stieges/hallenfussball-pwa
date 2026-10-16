/**
 * D12 Korrektur. Besitzer: B-25 (Korrekturmodus im Cockpit).
 * Besitzer: B-25 -- Soll-Marker: das Cockpit eines beendeten Spiels bietet die Korrektur
 * (`match-correction-button`).
 */
import { expect } from '@playwright/test';
import { openCockpit } from '../../engineHelpers';
import { expectPageAnchor, expectSollMarker, fetchTurniertagBracket, getRows, SOLL_TIMEOUT_MS, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function korrektur({ asRole }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const ownerPage = await asRole('owner');
  await openCockpit(ownerPage, TURNIERTAG_ID, groupMatches[0].id);
  await expectPageAnchor(ownerPage.locator('[data-testid="team-name-home"]'), 'Cockpit des Spiels');
  await expectSollMarker(ownerPage, 'match-correction-button');
  // Soll-Wirkung (DB): die Korrektur erzeugt eine neue Zeile in `match_corrections` für dieses Spiel.
  const query = `match_corrections?match_id=eq.${groupMatches[0].id}&select=id`;
  const before = (await getRows<{ id: string }>(query, 'match_corrections vorher')).length;
  await ownerPage.locator('[data-testid="match-correction-button"]').click();
  await expect.poll(async () => (await getRows<{ id: string }>(query, 'match_corrections nachher')).length, {
    message: 'Korrektur erzeugt eine Zeile in match_corrections', timeout: SOLL_TIMEOUT_MS,
  }).toBeGreaterThan(before);
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D12', title: 'Ergebnis eines beendeten Spiels korrigieren', scenarios: [], owner: 'B-25', expectedFail: true, run: korrektur },
];
