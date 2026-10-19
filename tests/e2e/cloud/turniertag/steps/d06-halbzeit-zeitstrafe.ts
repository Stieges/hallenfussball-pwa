/**
 * D6 Halbzeit läuft von selbst, Zeitstrafe läuft ab.
 *
 * Seit B-08b/c (#263, Daniel 18.10.: "Abschnitts- und Spielende immer automatisch") gibt es KEINEN Halbzeit-Knopf
 * mehr; der Marker `match-halftime-button` war veraltet. Gherkin: @SL-005 (Abschnittsende bei Ablauf von selbst,
 * Halbzeitpause beginnt), @SL-096 (abgelaufene Zeitstrafe wird gemeldet).
 *  - D6: ein Spiel, dessen erster Abschnitt laut Uhr längst abgelaufen ist, wird beim Öffnen des Cockpits von selbst
 *    beendet (`SECTION_END` in `match_events`), ohne Knopfdruck, und das Cockpit bietet keinen Halbzeit-Knopf an.
 *  - D6z: eine laufende Zeitstrafe verschwindet nach Ablauf aus "Aktive Zeitstrafen". Besitzer B-10b (heute bleibt sie stehen).
 */
import { expect } from '@playwright/test';
import { fetchEngineRows, openCockpit } from '../../engineHelpers';
import { appendOwner, eventOf } from './playViaRpc';
import { expectPageAnchor, fetchTurniertagBracket, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function halbzeitVonSelbst({ asRole }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const match = groupMatches[1];
  const start = Date.now() - 3_600_000; // Anpfiff vor einer Stunde: der erste Abschnitt ist laut Uhr lange abgelaufen
  const angepfiffen = await appendOwner(match.id, [eventOf('MATCH_START', start, start)]);
  expect(angepfiffen.results.map((r) => r.status)).toEqual(['accepted']);
  const ownerPage = await asRole('owner');
  await openCockpit(ownerPage, TURNIERTAG_ID, match.id);
  await expectPageAnchor(ownerPage.locator('[data-testid="team-name-home"]'), 'Cockpit des Spiels');
  expect(await ownerPage.locator('[data-testid="match-halftime-button"]').count(), 'es gibt keinen Halbzeit-Knopf (automatisches Abschnittsende)').toBe(0);
  await expect.poll(async () => (await fetchEngineRows(match.id)).filter((row) => row.type === 'SECTION_END').length, {
    message: 'das Abschnittsende entsteht ohne Knopfdruck (SECTION_END)', timeout: 15000,
  }).toBeGreaterThan(0);
}

async function zeitstrafeLaeuftAb({ asRole }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const match = groupMatches[2];
  const now = Date.now();
  const start = now - 6000;
  const events = [
    eventOf('MATCH_START', start, start),
    eventOf('TIME_PENALTY', now - 5000, start, { teamId: match.team_a_id, payload: { durationSeconds: 20 } }),
  ];
  expect((await appendOwner(match.id, events)).results.map((r) => r.status)).toEqual(['accepted', 'accepted']);
  const ownerPage = await asRole('owner');
  await openCockpit(ownerPage, TURNIERTAG_ID, match.id);
  await expectPageAnchor(ownerPage.getByText('Aktive Zeitstrafen').first(), 'Liste der aktiven Zeitstrafen');
  // Soll (B-10b, @SL-096): nach Ablauf der 20 Sekunden steht die Strafe nicht mehr unter "Aktive Zeitstrafen".
  await expect(ownerPage.getByText('Aktive Zeitstrafen')).toHaveCount(0, { timeout: 30000 });
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D6', title: 'Halbzeit läuft von selbst, kein Halbzeit-Knopf', scenarios: ['@SL-005'], owner: 'B-08b/c (gebaut, #263)', expectedFail: false, run: halbzeitVonSelbst },
  { id: 'D6z', title: 'Zeitstrafe läuft ab und verschwindet aus den aktiven', scenarios: ['@SL-096'], owner: 'B-10b', expectedFail: true, run: zeitstrafeLaeuftAb },
];
