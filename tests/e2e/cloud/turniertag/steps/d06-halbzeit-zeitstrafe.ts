/**
 * D6 Halbzeit läuft von selbst, Zeitstrafe läuft ab.
 *
 * Seit B-08b/c (#263, Daniel 18.10.: "Abschnitts- und Spielende immer automatisch") gibt es KEINEN Halbzeit-Knopf
 * mehr. Gherkin @SL-005: läuft der Abschnitt ab, gibt das Gerät einen Ton, das Cockpit zeigt "Halbzeit" mit
 * herunterzählender Pausen-Restzeit und bietet den Wiederanpfiff an; @SL-096 (abgelaufene Zeitstrafe wird gemeldet).
 *  - D6: ein Spiel, dessen erster Abschnitt gerade abgelaufen ist (60 min Spielzeit, 2 Abschnitte: Anpfiff vor 30 min und
 *    10 s), geht beim Öffnen des Cockpits von selbst in die Pause (`SECTION_END` in `match_events`, ohne Knopfdruck); das
 *    Cockpit zeigt "Halbzeit", die Pausen-Restzeit und den Wiederanpfiff-Knopf. Der Ton ist nicht Teil dieses Schritts
 *    (@SL-005 steckt im E2E nur teilweise; der Ton wird auf der Vitest-Ebene geprüft). Eigenes Spiel: Gruppenspiel 10.
 *  - D6z: eine laufende Zeitstrafe verschwindet nach Ablauf aus "Aktive Zeitstrafen". Besitzer B-10b (heute bleibt sie stehen).
 *    Eigenes Spiel: Gruppenspiel 11.
 */
import { expect } from '@playwright/test';
import { fetchEngineRows, openCockpit } from '../../engineHelpers';
import { appendOwner, eventOf } from './playViaRpc';
import { expectPageAnchor, fetchTurniertagBracket, TURNIERTAG_ID, vorbedingung } from './shared';
import type { StepContext, TurniertagStep } from './types';

/** Abschnittsdauer des Turniertag-Cups: 60 min Spielzeit in 2 Abschnitten (Seed `groupPhaseGameDuration: 60`, `gamePeriods: 2`). */
const ABSCHNITT_MS = 30 * 60_000;

async function halbzeitVonSelbst({ asRole }: StepContext): Promise<void> {
  const match = await vorbedingung('Gruppenspiel 10 anpfeifen (Abschnitt gerade abgelaufen)', async () => {
    const { groupMatches } = await fetchTurniertagBracket();
    const gewaehlt = groupMatches[9];
    const start = Date.now() - ABSCHNITT_MS - 10_000;
    const angepfiffen = await appendOwner(gewaehlt.id, [eventOf('MATCH_START', start, start)]);
    expect(angepfiffen.results.map((r) => r.status)).toEqual(['accepted']);
    return gewaehlt;
  });
  const ownerPage = await asRole('owner');
  await openCockpit(ownerPage, TURNIERTAG_ID, match.id);
  await expectPageAnchor(ownerPage.locator('[data-testid="team-name-home"]'), 'Cockpit des Spiels');
  await expect.poll(async () => (await fetchEngineRows(match.id)).filter((row) => row.type === 'SECTION_END').length, {
    message: 'das Abschnittsende entsteht ohne Knopfdruck (SECTION_END)', timeout: 15000,
  }).toBeGreaterThan(0);
  // @SL-005: "Halbzeit" mit herunterzählender Pausen-Restzeit, und der Wiederanpfiff wird angeboten.
  await expect(ownerPage.locator('[data-testid="scoreboard-state"]'), 'Cockpit zeigt "Halbzeit"').toContainText(/Halbzeit/i, { timeout: 10000 });
  await expect(ownerPage.locator('[data-testid="scoreboard-clock-rest"]'), 'Pausen-Restzeit').toHaveText(/\d+:\d\d/, { timeout: 10000 });
  await expect(ownerPage.locator('[data-testid="match-wiederanpfiff-button"]'), 'Cockpit bietet den Wiederanpfiff an').toBeVisible({ timeout: 10000 });
}

async function zeitstrafeLaeuftAb({ asRole }: StepContext): Promise<void> {
  const match = await vorbedingung('Gruppenspiel 11 anpfeifen, Zeitstrafe von 20 s eintragen', async () => {
    const { groupMatches } = await fetchTurniertagBracket();
    const gewaehlt = groupMatches[10];
    const now = Date.now();
    const start = now - 6000;
    const events = [
      eventOf('MATCH_START', start, start),
      eventOf('TIME_PENALTY', now - 5000, start, { teamId: gewaehlt.team_a_id, payload: { durationSeconds: 20 } }),
    ];
    expect((await appendOwner(gewaehlt.id, events)).results.map((r) => r.status)).toEqual(['accepted', 'accepted']);
    return gewaehlt;
  });
  const ownerPage = await asRole('owner');
  await openCockpit(ownerPage, TURNIERTAG_ID, match.id);
  await expectPageAnchor(ownerPage.getByText('Aktive Zeitstrafen').first(), 'Liste der aktiven Zeitstrafen');
  // Soll (B-10b, @SL-096): nach Ablauf der 20 Sekunden steht die Strafe nicht mehr unter "Aktive Zeitstrafen".
  await expect(ownerPage.getByText('Aktive Zeitstrafen')).toHaveCount(0, { timeout: 30000 });
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D6', title: 'Halbzeit läuft von selbst: "Halbzeit", Pausen-Restzeit, Wiederanpfiff (Ton: Vitest)', scenarios: ['@SL-005'], owner: 'B-08b/c (gebaut, #263)', expectedFail: false, run: halbzeitVonSelbst },
  { id: 'D6z', title: 'Zeitstrafe läuft ab und verschwindet aus den aktiven', scenarios: ['@SL-096'], owner: 'B-10b', expectedFail: true, run: zeitstrafeLaeuftAb },
];
