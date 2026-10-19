/**
 * D10 Finale + Nichtantritt im Platzierungsspiel (2:0 auf Zuschauer-Seite und /tv).
 * Ablauf: erst das Finale regulär spielen, dann den Nichtantritt im Spiel um Platz 3 eintragen.
 * Voraussetzung: D8/D9/D9b (beide Halbfinals entschieden, Platz 3 und Finale besetzt).
 * Besitzer: A-25 (Nichtantritt als Ergebniseintrag mit Wertungsmerkmal, E-A4) / B-12.
 * Besitzer: A-25/B-12 -- Soll: das Spiel um Platz 3 nimmt `RESULT_ENTRY` mit
 * `forfeit = { absent: 'A' }` an und speichert `matches.forfeit_absent = 'A'` (2:0 als Wertung).
 * Sichtbares Soll (B-12/B-15/B-21): die Zuschauer-Seite zeigt die Zeile von Platz 3 mit 2:0 und
 * Wertungs-Vermerk (nicht als gespieltes Ergebnis).
 */
import { expect } from '@playwright/test';
import { getLocalServiceRoleClient } from '../../helpers';
import { E2E_TURNIERTAG_SHARE_CODE } from '../../testData';
import { fetchTurniertagBracket, findFinalByLabel, SOLL_TIMEOUT_MS, vorbedingung } from './shared';
import { appendOwner, eventOf, regularResultEvents } from './playViaRpc';
import type { StepContext, TurniertagStep } from './types';

async function nichtantritt({ anonPage }: StepContext): Promise<void> {
  const { finals } = await fetchTurniertagBracket();
  const platz3 = findFinalByLabel(finals, 'Spiel um Platz 3');
  const finale = findFinalByLabel(finals, 'Finale');
  expect(platz3.team_a_id && platz3.team_b_id, 'Spiel um Platz 3 ist besetzt (hängt an D8/D9/D9b)').toBeTruthy();
  expect(finale.team_a_id && finale.team_b_id, 'Finale ist besetzt (hängt an D8/D9/D9b)').toBeTruthy();
  const finaleEvents = regularResultEvents(finale, 1, 0);
  await vorbedingung('Finale regulär spielen', async () => {
    const finaleResult = await appendOwner(finale.id, finaleEvents);
    expect(finaleResult.results.map((r) => r.status), 'Finale regulär gespielt').toEqual(finaleEvents.map(() => 'accepted'));
  });
  const at = Date.now() - 60_000;
  const result = await appendOwner(platz3.id, [
    eventOf('RESULT_ENTRY', at, at, { section: null, clockMs: null, payload: { scores: { [platz3.team_a_id ?? '']: 2, [platz3.team_b_id ?? '']: 0 }, forfeit: { absent: 'B' } } }),
  ]);
  expect(result.results[0].status).toBe('accepted');
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/matches?id=eq.${platz3.id}&select=forfeit_absent,score_a,score_b`, { headers });
  expect(res.ok, `Spalte matches.forfeit_absent: ${res.status}`).toBe(true);
  expect(await res.json()).toEqual([{ forfeit_absent: 'B', score_a: 2, score_b: 0 }]);
  // Soll-Wirkung sichtbar (B-12/B-15): 2:0 samt Wertungs-Vermerk auf der Zuschauer-Seite.
  await anonPage.goto(`/#/live/${E2E_TURNIERTAG_SHARE_CODE}`);
  const zeile = anonPage.locator('tr', { hasText: 'Spiel um Platz 3' }).first();
  await expect(zeile, 'Zeile von Platz 3 auf der Zuschauer-Seite').toBeVisible({ timeout: SOLL_TIMEOUT_MS });
  await expect(zeile).toHaveText(/2\s*:\s*0/, { timeout: SOLL_TIMEOUT_MS });
  await expect(zeile, 'Wertungs-Vermerk (Nichtantritt/Wertung)').toHaveText(/Wertung|Nichtantritt|kampflos/i, { timeout: SOLL_TIMEOUT_MS });
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D10', title: 'Nichtantritt im Spiel um Platz 3: 2:0 als Wertung', scenarios: ['@W2A-022', '@W2A-025'], owner: 'A-25/B-12', expectedFail: true, run: nichtantritt },
];
