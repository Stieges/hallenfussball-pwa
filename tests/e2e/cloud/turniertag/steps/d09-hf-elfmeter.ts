/**
 * D9 Halbfinale unentschieden -> Strafstoßschießen. Besitzer: B-09 (Bedienung) / A-14 (Regeln,
 * Pflichttest Elfmeter, 6 Teams in 2 Gruppen à 3 als Durchstich-Variante in A-24).
 * Besitzer: B-09/A-14 -- Soll: Halbfinale 1 (besetzt durch D8) endet 1:1, die Turnierleitung wählt
 * Strafstoßschießen, nach den Schüssen steht `decided_by = 'penalty'` mit Strafstoß-Tabelle.
 */
import { expect } from '@playwright/test';
import { fetchTurniertagBracket, SOLL_TIMEOUT_MS } from './shared';
import { appendOwner, eventOf, regularResultEvents } from './playViaRpc';
import type { StepContext, TurniertagStep } from './types';

async function halbfinaleElfmeter(_ctx: StepContext): Promise<void> {
  const { finals } = await fetchTurniertagBracket();
  const hf1 = finals[0];
  expect(hf1.team_a_id && hf1.team_b_id, 'Halbfinale 1 ist besetzt (D8)').toBeTruthy();
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
  await expect.poll(async () => (await fetchTurniertagBracket()).finals[0].decided_by, { timeout: SOLL_TIMEOUT_MS }).toBe('penalty');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D9', title: 'Halbfinale unentschieden: Strafstoßschießen entscheidet', scenarios: [], owner: 'B-09/A-14', expectedFail: true, run: halbfinaleElfmeter },
];
