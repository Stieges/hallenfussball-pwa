/**
 * D9 Halbfinale unentschieden -> Strafstoßschießen. Besitzer: B-09 (Bedienung) / A-14 (Regeln,
 * Pflichttest Elfmeter, 6 Teams in 2 Gruppen à 3 als Durchstich-Variante in A-24).
 * Besitzer: B-09/A-14 -- Soll: Halbfinale 1 (besetzt durch D8) endet 1:1, die Turnierleitung wählt
 * Strafstoßschießen, nach den Schüssen steht `decided_by = 'penalty'` mit Strafstoß-Tabelle.
 * Sichtbares Soll (B-15/B-21): die Zuschauer-Seite zeigt Halbfinale 1 mit 1:1 und Strafstoß-Vermerk.
 */
import { expect } from '@playwright/test';
import { E2E_TURNIERTAG_SHARE_CODE } from '../../testData';
import { fetchTurniertagBracket, findFinalByLabel, SOLL_TIMEOUT_MS } from './shared';
import { appendOwner, eventOf, regularResultEvents } from './playViaRpc';
import type { StepContext, TurniertagStep } from './types';

async function halbfinaleElfmeter({ anonPage }: StepContext): Promise<void> {
  const { finals } = await fetchTurniertagBracket();
  const hf1 = findFinalByLabel(finals, '1. Halbfinale');
  expect(hf1.team_a_id && hf1.team_b_id, 'Halbfinale 1 ist besetzt (hängt an D8)').toBeTruthy();
  const start = Date.now() - 600_000;
  const base = regularResultEvents(hf1, 1, 1, 600_000);
  const regular = await appendOwner(hf1.id, base);
  expect(regular.results.map((r) => r.status)).toEqual(base.map(() => 'accepted'));
  const choice = eventOf('TIEBREAK_CHOICE', start + 100_000, start, { payload: { choice: 'shootout' } });
  const kicks = [0, 1, 2, 3, 4].flatMap((round) => [
    eventOf('SHOOTOUT_KICK', start + 110_000 + round * 2000, start, { teamId: hf1.team_a_id, payload: { scored: true } }),
    eventOf('SHOOTOUT_KICK', start + 111_000 + round * 2000, start, { teamId: hf1.team_b_id, payload: { scored: round % 2 === 0 } }),
  ]);
  const shootout = await appendOwner(hf1.id, [choice, ...kicks, eventOf('SHOOTOUT_END', start + 130_000, start)]);
  expect(shootout.results.every((r) => r.status === 'accepted')).toBe(true);
  await expect.poll(async () => findFinalByLabel((await fetchTurniertagBracket()).finals, '1. Halbfinale').decided_by, { timeout: SOLL_TIMEOUT_MS }).toBe('penalty');
  // Soll-Wirkung sichtbar (B-15/B-21): die Zuschauer-Seite zeigt das Halbfinale 1 als im
  // Strafstoßschießen entschieden (Ergebnis 1:1 plus Strafstoß-Vermerk in derselben Zeile).
  await anonPage.goto(`/#/live/${E2E_TURNIERTAG_SHARE_CODE}`);
  const zeile = anonPage.locator('tr', { hasText: 'Halbfinale 1' }).first();
  await expect(zeile, 'Zeile von Halbfinale 1 auf der Zuschauer-Seite').toBeVisible({ timeout: SOLL_TIMEOUT_MS });
  await expect(zeile).toHaveText(/1\s*:\s*1/, { timeout: SOLL_TIMEOUT_MS });
  await expect(zeile, 'Strafstoß-Vermerk (i. E. / Elfmeterschießen)').toHaveText(/i\.\s?E\.|n\.\s?E\.|Elfmeter|Strafstoß/i, { timeout: SOLL_TIMEOUT_MS });
}

/**
 * D9b Halbfinale 2 regulär entscheiden (2:1), damit die Verlierer-/Sieger-Plätze von Platz 3 und
 * Finale beide besetzt werden können (Fixrunde 1, N2). Besitzer: A-13 (Besetzung durch die Auflösung
 * der Finalrunde, wie D8); die Verlierer/Sieger-Besetzung selbst gehört zu A-14.
 */
async function halbfinale2(_ctx: StepContext): Promise<void> {
  const { finals } = await fetchTurniertagBracket();
  const hf2 = findFinalByLabel(finals, '2. Halbfinale');
  expect(hf2.team_a_id && hf2.team_b_id, 'Halbfinale 2 ist besetzt (hängt an D8)').toBeTruthy();
  const events = regularResultEvents(hf2, 2, 1);
  const result = await appendOwner(hf2.id, events);
  expect(result.results.map((r) => r.status)).toEqual(events.map(() => 'accepted'));
  await expect.poll(async () => {
    const m = findFinalByLabel((await fetchTurniertagBracket()).finals, '2. Halbfinale');
    return [m.match_status, m.score_a, m.score_b];
  }, { message: 'Halbfinale 2 steht beendet auf 2:1', timeout: SOLL_TIMEOUT_MS }).toEqual(['finished', 2, 1]);
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D9', title: 'Halbfinale unentschieden: Strafstoßschießen entscheidet', scenarios: ['@SL-145'], owner: 'B-09/A-14', expectedFail: true, run: halbfinaleElfmeter },
  { id: 'D9b', title: 'Halbfinale 2 regulär entschieden (Voraussetzung für Platz 3 und Finale)', scenarios: [], owner: 'A-13', expectedFail: true, run: halbfinale2 },
];
