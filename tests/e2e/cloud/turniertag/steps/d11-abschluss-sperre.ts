/**
 * D11 Abschluss + Sperre (+ Freigabe Bildschirm = B-20, noch nicht gebaut und hier nicht geprüft). Die Turnierleitung schließt das Turnier im
 * Dialog „Turnier abschließen“ ab (R3-4, `tournament-finish-open` im Admin-Center), danach lehnt der Server jede Änderung ab.
 * Der Turniertag-Cup hat eine Finalrunde: deren Endstand ist bis Teil F (Endstand mit Finalrunde, `legacyStandings`) vorläufig, der Dialog
 * meldet „Der Endstand ist noch vorläufig“ – der Schritt bleibt bis dahin erwartet rot. Die Nikolaus-Linie (N7b) belegt den Abschluss heute.
 */
import { expect } from '@playwright/test';
import { appendAsRole, fetchEngineRows } from '../../engineHelpers';
import { eventOf } from './playViaRpc';
import { expectPageAnchor, fetchTurniertagBracket, getRows, openTurniertagPath, SOLL_TIMEOUT_MS, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function abschluss({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/dashboard');
  await expectPageAnchor(ownerPage.getByText('Dashboard', { exact: true }).first(), 'Admin-Kategorie Dashboard');
  await ownerPage.getByTestId('tournament-finish-open').click({ timeout: SOLL_TIMEOUT_MS });
  // Soll-Wirkung: der Endstand ist fest (Finalrunde: Teil F), der Dialog bietet das Abschließen an – danach ist das Turnier abgeschlossen
  const dialog = ownerPage.getByTestId('finish-dialog');
  await expect(dialog.getByTestId('tournament-finish-confirm'), 'Abschluss möglich (nicht „Endstand ist noch vorläufig“)').toBeVisible({ timeout: SOLL_TIMEOUT_MS });
  await dialog.getByTestId('tournament-finish-confirm').click();
  await expect.poll(async () => (await getRows<{ lifecycle_status: string }>(`tournaments?id=eq.${TURNIERTAG_ID}&select=lifecycle_status`, 'Zustand des Turniers'))[0]?.lifecycle_status, {
    message: 'Zustand nach dem Abschluss (lifecycle_status, nicht die alte Spalte status: C-E2E-N7B-SPALTE)', timeout: SOLL_TIMEOUT_MS,
  }).toBe('finished');
  const { groupMatches } = await fetchTurniertagBracket();
  const rows = await fetchEngineRows(groupMatches[0].id);
  const lastScore = rows.filter((row) => ['GOAL', 'OWN_GOAL', 'CORRECTION', 'RESULT_ENTRY'].includes(row.type)).pop();
  const at = Date.now() - 1000;
  const sperre = await appendAsRole('owner', groupMatches[0].id, [
    eventOf('CORRECTION', at, at - 5000, {
      payload: {
        scores: { [groupMatches[0].team_a_id ?? '']: 1, [groupMatches[0].team_b_id ?? '']: 0 },
        reason: 'Sperrprüfung nach Turnierabschluss',
        basedOn: lastScore?.id ?? null,
      },
    }),
  ]);
  expect(sperre.results.map((r) => r.status), 'Schreibversuch nach dem Abschluss wird abgelehnt').not.toContain('accepted');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D11', title: 'Turnier abschließen: Sperre, Bildschirm frei', scenarios: ['@LZ-030'], befunde: ['C-ZUSTAND-ABGELEITET', 'C-E2E-N7B-SPALTE'], owner: 'Teil F (Endstand mit Finalrunde) und B-20 (Bildschirm frei); Abschluss-Dialog gebaut (R3-4)', expectedFail: true, run: abschluss },
];
