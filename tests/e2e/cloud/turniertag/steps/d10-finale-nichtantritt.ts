/**
 * D10 Finale + Nichtantritt im Platzierungsspiel (2:0 auf Zuschauer-Seite und /tv).
 * Besitzer: A-25 (Nichtantritt als Ergebniseintrag mit Wertungsmerkmal, E-A4) / B-12.
 * Besitzer: A-25/B-12 -- Soll: das Spiel um Platz 3 nimmt `RESULT_ENTRY` mit
 * `forfeit = { absent: 'A' }` an und speichert `matches.forfeit_absent = 'A'` (2:0 als Wertung).
 */
import { expect } from '@playwright/test';
import { getLocalServiceRoleClient } from '../../helpers';
import { fetchTurniertagBracket } from './shared';
import { appendOwner, eventOf } from './playViaRpc';
import type { StepContext, TurniertagStep } from './types';

async function nichtantritt(_ctx: StepContext): Promise<void> {
  const { finals } = await fetchTurniertagBracket();
  const platz3 = finals[2];
  expect(platz3.team_a_id && platz3.team_b_id, 'Spiel um Platz 3 ist besetzt (nach D9)').toBeTruthy();
  const at = Date.now() - 60_000;
  const result = await appendOwner(platz3.id, [
    eventOf('RESULT_ENTRY', at, at, { section: null, clockMs: null, payload: { scores: { [platz3.team_a_id ?? '']: 2, [platz3.team_b_id ?? '']: 0 }, forfeit: { absent: 'B' } } }),
  ]);
  expect(result.results[0].status).toBe('accepted');
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/matches?id=eq.${platz3.id}&select=forfeit_absent,score_a,score_b`, { headers });
  expect(res.ok, `Spalte matches.forfeit_absent: ${res.status}`).toBe(true);
  expect(await res.json()).toEqual([{ forfeit_absent: 'B', score_a: 2, score_b: 0 }]);
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D10', title: 'Nichtantritt im Spiel um Platz 3: 2:0 als Wertung', scenarios: [], owner: 'A-25/B-12', expectedFail: true, run: nichtantritt },
];
