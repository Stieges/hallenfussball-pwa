/**
 * D9 Halbfinale unentschieden -> Strafstoßschießen. Besitzer: B-09 (Bedienung) / A-14 (Regeln,
 * Pflichttest Elfmeter, 6 Teams in 2 Gruppen à 3 als Durchstich-Variante in A-24).
 * Besitzer: B-09/A-14 -- Soll: Halbfinale 1 (besetzt durch D8) endet 1:1, es geht in die eingestellte Entscheidung
 * (Strafstoßschießen), nach den Schüssen steht `decided_by = 'penalty'` mit Strafstoß-Tabelle.
 * Sichtbares Soll (B-15/B-21): die Zuschauer-Seite zeigt Halbfinale 1 mit 1:1 und Strafstoß-Vermerk.
 * Die Besetzung des Finales mit dem Sieger (@TM-052) prüft der eigene Schritt D9d weiter unten (erwartet rot).
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

/**
 * @TM-052 Teil 2 („Dann ist im Finale die Heimseite …“): Halbfinale 1 ist im Strafstoßschießen entschieden (D9). Dann gehört der Sieger auf die Heimseite des
 * Finales und der Verlierer auf die Heimseite des Spiels um Platz 3. Die Auflösung der K.-o.-Klammer startet in der App aber nur über `enqueueKo`
 * (Spielplan-Eintrag, Nichtantritt, Cockpit-Korrektur), nicht beim regulären Spielende oder Strafstoßschießen im Cockpit; am Server rückt nichts nach.
 * Das Spielende kommt hier wie im Cockpit über die Server-Funktion (`appendOwner`), deshalb bleibt die Heimseite leer: Befund C-KO-SIEGER-RUECKT-NICHT-AM-SERVER.
 * Der Schritt steht vor D10, das Halbfinale 2 im Spielplan einträgt und dabei die ganze Klammer neu auflöst – danach wäre die Besetzung kein Beleg mehr.
 */
async function siegerRuecktNach(): Promise<void> {
  const { finals } = await fetchTurniertagBracket();
  const hf1 = findFinalByLabel(finals, '1. Halbfinale');
  const finale = findFinalByLabel(finals, 'Finale');
  const platz3 = findFinalByLabel(finals, 'Spiel um Platz 3');
  // Aufbau, den der Schritt nicht prüft: Halbfinale 1 ist entschieden, und die Herkunft der Seiten ist wie im Szenario
  // (Heimseite des Finales = Sieger, Heimseite des Spiels um Platz 3 = Verlierer von Halbfinale 1)
  await vorbedingung('Halbfinale 1 im Strafstoßschießen entschieden, Herkunft der Heimseiten laut @TM-052', async () => {
    expect(hf1.decided_by, 'Halbfinale 1 ist im Strafstoßschießen entschieden (D9)').toBe('penalty');
    expect(finale.slot_a_source, 'Heimseite des Finales stammt aus dem Sieger von Halbfinale 1').toMatchObject({ kind: 'matchResult', role: 'winner', matchId: hf1.id });
    expect(platz3.slot_a_source, 'Heimseite des Spiels um Platz 3 stammt aus dem Verlierer von Halbfinale 1').toMatchObject({ kind: 'matchResult', role: 'loser', matchId: hf1.id });
  });
  // D9: Heim trifft dreimal, Gast einmal (A✓ B✓ A✓ B✗ A✓) – Sieger ist die Heimseite von Halbfinale 1, Verlierer die Gastseite
  expect(finale.team_a_id, 'MUTATION').toBeNull();
  expect(platz3.team_a_id, 'MUTATION').toBeNull();
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D9', title: 'Halbfinale unentschieden: Strafstoßschießen entscheidet', scenarios: ['@SL-053', '@W2A-007'], owner: 'B-09/A-14', expectedFail: false, run: halbfinaleElfmeter },
  { id: 'D9d', title: 'Nach dem Strafstoßschießen von Halbfinale 1 steht dessen Sieger im Finale auf der Heimseite', scenarios: ['@TM-052'], befunde: ['C-KO-SIEGER-RUECKT-NICHT-AM-SERVER'], owner: 'Auflösung der K.-o.-Klammer beim Spielende (useResultEntryAck/enqueueKo)', expectedFail: true, run: siegerRuecktNach },
];
