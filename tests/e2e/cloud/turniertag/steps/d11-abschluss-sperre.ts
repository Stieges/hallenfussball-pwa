/**
 * D11 Abschluss + Sperre + Freigabe Bildschirm. Besitzer: A-21a / B-33 / B-20.
 * Besitzer: A-21a/B-33/B-20 -- Soll-Marker: die Turnierleitung schließt das Turnier ab
 * (`tournament-finish-button` im Admin-Center), danach sind Ergebnisse gesperrt und die
 * Bildschirme frei.
 */
import { expect } from '@playwright/test';
import { appendAsRole } from '../../engineHelpers';
import { eventOf } from './playViaRpc';
import { expectPageAnchor, expectSollMarker, fetchTurniertagBracket, getRows, openTurniertagPath, SOLL_TIMEOUT_MS, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function abschluss({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/dashboard');
  await expectPageAnchor(ownerPage.getByText('Dashboard', { exact: true }).first(), 'Admin-Kategorie Dashboard');
  await expectSollMarker(ownerPage, 'tournament-finish-button');
  // Soll-Wirkung (DB): nach dem Abschluss ist das Turnier abgeschlossen und Schreiben wird abgelehnt.
  await ownerPage.locator('[data-testid="tournament-finish-button"]').click();
  await expect.poll(async () => (await getRows<{ status: string }>(`tournaments?id=eq.${TURNIERTAG_ID}&select=status`, 'Turnierstatus'))[0]?.status, {
    message: 'Turnierstatus nach dem Abschluss', timeout: SOLL_TIMEOUT_MS,
  }).toBe('completed');
  const { groupMatches } = await fetchTurniertagBracket();
  const at = Date.now() - 1000;
  const sperre = await appendAsRole('owner', groupMatches[0].id, [eventOf('GOAL', at, at - 5000, { teamId: groupMatches[0].team_a_id })]);
  expect(sperre.results.map((r) => r.status), 'Schreibversuch nach dem Abschluss wird abgelehnt').not.toContain('accepted');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D11', title: 'Turnier abschließen: Sperre, Bildschirm frei', scenarios: [], owner: 'A-21a/B-33/B-20', expectedFail: true, run: abschluss },
];
