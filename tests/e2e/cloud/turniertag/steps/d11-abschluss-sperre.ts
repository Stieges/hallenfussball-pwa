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
  // Wie N7b: erst wenn die Prüfung durch ist („bereit“ oder eine Ablehnung); die Taste „Abschließen“ gibt es schon im Stand „wird geprüft“ (gesperrt).
  const bereit = dialog.getByTestId('finish-ready');
  const abgelehnt = dialog.getByTestId('finish-error');
  await expect(bereit.or(abgelehnt).first(), 'Prüfung des Abschlusses ist durch').toBeVisible({ timeout: 15_000 });
  expect(await abgelehnt.count(), `Abschluss möglich, nicht abgelehnt: ${(await abgelehnt.count()) > 0 ? (await abgelehnt.first().innerText()).replace(/\s+/g, ' ') : ''}`).toBe(0);
  await expect(dialog.getByTestId('tournament-finish-confirm'), 'Abschluss möglich (nicht „Endstand ist noch vorläufig“)').toBeEnabled({ timeout: SOLL_TIMEOUT_MS });
  await dialog.getByTestId('tournament-finish-confirm').click();
  try {
    await expect.poll(async () => (await getRows<{ lifecycle_status: string }>(`tournaments?id=eq.${TURNIERTAG_ID}&select=lifecycle_status`, 'Zustand des Turniers'))[0]?.lifecycle_status, {
      message: 'Zustand nach dem Abschluss (lifecycle_status)', timeout: SOLL_TIMEOUT_MS,
    }).toBe('finished');
  } catch (fehler) {
    // Der Grund der Ablehnung steht im Dialog (Endstand vorläufig, offene Punkte, Netz ...): mit in die Fehlermeldung.
    await ownerPage.getByTestId('tournament-ended').or(ownerPage.getByTestId('finish-error')).first().waitFor({ timeout: 15_000 }).catch(() => undefined);
    const meldungen: string[] = [`Dialog offen: ${(await ownerPage.getByTestId('finish-dialog').count()) > 0}`, `Zustand C sichtbar: ${(await ownerPage.getByTestId('tournament-ended').count()) > 0}`];
    for (const kennung of ['finish-error', 'finish-unconfirmed', 'finish-sending', 'finish-offline']) {
      const stelle = ownerPage.getByTestId(kennung);
      if ((await stelle.count()) > 0) {
        meldungen.push(`${kennung}: ${(await stelle.first().innerText()).replace(/\s+/g, ' ')}`);
      }
    }
    meldungen.push(`Seite: ${(await ownerPage.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 500)}`);
    throw new Error(`${fehler instanceof Error ? fehler.message : String(fehler)}\n${meldungen.join('\n')}`, { cause: fehler });
  }
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
  { id: 'D11', title: 'Turnier abschließen: Sperre, Bildschirm frei', scenarios: ['@LZ-030'], befunde: ['C-FINALRUNDE-NICHT-ABSCHLIESSBAR'], owner: 'Teil F (Endstand mit Finalrunde) und B-20 (Bildschirm frei); Abschluss-Dialog gebaut (R3-4)', expectedFail: true, run: abschluss },
];
