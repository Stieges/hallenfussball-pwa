/**
 * D10 Finale + Nichtantritt im Platzierungsspiel (2:0 auf Zuschauer-Seite und /tv).
 * Ablauf nach Spielplan (@TM-144: Spiel um Platz 3 vor dem Finale, Finale zuletzt): erst den Nichtantritt im Spiel um
 * Platz 3 eintragen, dann das Finale regulär spielen (Aufbau für D11 ff.), danach die Wirkung von Platz 3 prüfen.
 * Voraussetzung: D8/D9 (Halbfinale 1 im Strafstoßschießen entschieden); Halbfinale 2 spielt dieser Schritt als Vorbedingung regulär 2:1
 * (früher eigener Schritt D9b ohne Szenario), danach sind Platz 3 und Finale besetzt.
 * Besitzer: A-25 (Nichtantritt als Ergebniseintrag mit Wertungsmerkmal, E-A4) / B-12. Das Weiterrücken nach Nichtantritt im K.-o. (@TM-061,
 * Halbfinale → Finale) prüft dieser Schritt nicht (Nichtantritt im Spiel um Platz 3).
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

/** Vorbedingung: Halbfinale 2 regulär 2:1 (Sieger ins Finale, Verlierer ins Spiel um Platz 3). */
async function halbfinale2(): Promise<void> {
  const hf2 = findFinalByLabel((await fetchTurniertagBracket()).finals, '2. Halbfinale');
  expect(hf2.team_a_id && hf2.team_b_id, 'Halbfinale 2 ist besetzt (hängt an D8)').toBeTruthy();
  const events = regularResultEvents(hf2, 2, 1);
  const result = await appendOwner(hf2.id, events);
  expect(result.results.map((r) => r.status)).toEqual(events.map(() => 'accepted'));
  await expect.poll(async () => {
    const m = findFinalByLabel((await fetchTurniertagBracket()).finals, '2. Halbfinale');
    return [m.match_status, m.score_a, m.score_b];
  }, { message: 'Halbfinale 2 steht beendet auf 2:1', timeout: SOLL_TIMEOUT_MS }).toEqual(['finished', 2, 1]);
}

async function nichtantritt({ anonPage }: StepContext): Promise<void> {
  await vorbedingung('Halbfinale 2 regulär 2:1 spielen', halbfinale2);
  const { finals } = await fetchTurniertagBracket();
  const platz3 = findFinalByLabel(finals, 'Spiel um Platz 3');
  const finale = findFinalByLabel(finals, 'Finale');
  expect(platz3.team_a_id && platz3.team_b_id, 'Spiel um Platz 3 ist besetzt (hängt an D8/D9 und Halbfinale 2)').toBeTruthy();
  expect(finale.team_a_id && finale.team_b_id, 'Finale ist besetzt (hängt an D8/D9 und Halbfinale 2)').toBeTruthy();
  const at = Date.now() - 60_000;
  const result = await appendOwner(platz3.id, [
    eventOf('RESULT_ENTRY', at, at, { section: null, clockMs: null, payload: { scores: { [platz3.team_a_id ?? '']: 2, [platz3.team_b_id ?? '']: 0 }, forfeit: { absent: 'B' } } }),
  ]);
  // Das Finale ist das letzte Spiel (@TM-144) und wird vor jeder Prüfung von Platz 3 gespielt, damit D11 ff. es beendet vorfinden.
  const finaleEvents = regularResultEvents(finale, 1, 0);
  await vorbedingung('Finale regulär spielen', async () => {
    const finaleResult = await appendOwner(finale.id, finaleEvents);
    expect(finaleResult.results.map((r) => r.status), 'Finale regulär gespielt').toEqual(finaleEvents.map(() => 'accepted'));
  });
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
  { id: 'D10', title: 'Nichtantritt im Spiel um Platz 3: 2:0 als Wertung', scenarios: ['@W2A-022'], owner: 'A-25/B-12', expectedFail: false, run: nichtantritt },
];
