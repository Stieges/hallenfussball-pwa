/**
 * D9 Halbfinale unentschieden -> Strafstoßschießen. Besitzer: B-09 (Bedienung) / A-14 (Regeln,
 * Pflichttest Elfmeter, 6 Teams in 2 Gruppen à 3 als Durchstich-Variante in A-24).
 * Besitzer: B-09/A-14 -- Soll: Halbfinale 1 (besetzt durch D8) endet 1:1, es geht in die eingestellte Entscheidung
 * (Strafstoßschießen), nach den Schüssen steht `decided_by = 'penalty'` mit Strafstoß-Tabelle.
 * Sichtbares Soll (B-15/B-21): die Zuschauer-Seite zeigt Halbfinale 1 mit 1:1 und Strafstoß-Vermerk.
 */
import { expect } from '@playwright/test';
import { E2E_TURNIERTAG_SHARE_CODE } from '../../testData';
import { fetchTurniertagBracket, findFinalByLabel, SOLL_TIMEOUT_MS, vorbedingung } from './shared';
import { appendOwner, eventOf, regularResultEvents } from './playViaRpc';
import type { StepContext, TurniertagStep } from './types';

async function halbfinaleElfmeter({ anonPage }: StepContext): Promise<void> {
  const { finals } = await fetchTurniertagBracket();
  const hf1 = findFinalByLabel(finals, '1. Halbfinale');
  expect(hf1.team_a_id && hf1.team_b_id, 'Halbfinale 1 ist besetzt (hängt an D8)').toBeTruthy();
  const start = Date.now() - 600_000;
  const base = regularResultEvents(hf1, 1, 1, 600_000);
  await vorbedingung('Halbfinale 1 regulär 1:1 spielen', async () => {
    const regular = await appendOwner(hf1.id, base);
    expect(regular.results.map((r) => r.status)).toEqual(base.map(() => 'accepted'));
  });
  // @SL-053: das Halbfinale geht in die eingestellte Entscheidung (Strafstoßschießen direkt, ohne Wahl der Turnierleitung; eine
  // TIEBREAK_CHOICE lehnt der Server dort ab). Drei Schützen je Team: nach A✓ B✓ A✓ B✗ A✓ steht 3:1 fest, ein weiterer Schuss wäre abgelehnt.
  const kicks = [[hf1.team_a_id, true], [hf1.team_b_id, true], [hf1.team_a_id, true], [hf1.team_b_id, false], [hf1.team_a_id, true]] as const;
  const schuesse = kicks.map(([teamId, scored], i) => eventOf('SHOOTOUT_KICK', start + 110_000 + i * 1000, start, { teamId, payload: { scored } }));
  const shootout = await appendOwner(hf1.id, [...schuesse, eventOf('SHOOTOUT_END', start + 130_000, start)]);
  expect(shootout.results.map((r) => `${r.status}${r.code ? `:${r.code}` : ''}`), 'Strafstöße und Ende werden angenommen').toEqual(shootout.results.map(() => 'accepted'));
  await expect.poll(async () => findFinalByLabel((await fetchTurniertagBracket()).finals, '1. Halbfinale').decided_by, { timeout: SOLL_TIMEOUT_MS }).toBe('penalty');
  // Soll-Wirkung sichtbar (B-15/B-21): die Zuschauer-Seite zeigt das Halbfinale 1 als im
  // Strafstoßschießen entschieden (Ergebnis 1:1 plus Strafstoß-Vermerk in derselben Zeile).
  await anonPage.goto(`/#/live/${E2E_TURNIERTAG_SHARE_CODE}`);
  const zeile = anonPage.locator('tr', { hasText: 'Halbfinale 1' }).first();
  await expect(zeile, 'Zeile von Halbfinale 1 auf der Zuschauer-Seite').toBeVisible({ timeout: SOLL_TIMEOUT_MS });
  await expect(zeile).toHaveText(/1\s*:\s*1/, { timeout: SOLL_TIMEOUT_MS });
  await expect(zeile, 'Strafstoß-Ergebnis in Klammern, z. B. (4:3)').toHaveText(/\(\s*\d+\s*:\s*\d+\s*(i\. E\.\s*)?\)|Strafstoß/i, { timeout: SOLL_TIMEOUT_MS });
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D9', title: 'Halbfinale unentschieden: Strafstoßschießen entscheidet', scenarios: ['@SL-053', '@W2A-007', '@TM-052'], owner: 'B-09/A-14', expectedFail: false, run: halbfinaleElfmeter },
];
