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
 *  - D6z: eine laufende Zeitstrafe verschwindet nach Ablauf aus "Aktive Zeitstrafen", die Meldezeile meldet sie als abgelaufen (B-10b).
 *    Eigenes Spiel: Gruppenspiel 11.
 */
import { expect } from '@playwright/test';
import { fetchEngineRows, openCockpit } from '../../engineHelpers';
import { appendOwner, eventOf } from './playViaRpc';
import { expectPageAnchor, fetchTurniertagBracket, fetchTurniertagTeams, TURNIERTAG_ID, vorbedingung } from './shared';
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

/** Zwei Rechtecke überlappen sich (Hinweis über Uhr oder Stand). */
const ueberlappt = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * D6z (@SL-096): Team A hat eine Zeitstrafe von 20 s, kein Tor fällt. Läuft sie ab, zeigt das Cockpit, dass sich das Team ergänzen darf: die
 * Strafen-Karte verschwindet aus „Aktive Zeitstrafen“ (der Kasten selbst bleibt am Laptop stehen, „keine“) und die Meldezeile nennt
 * „Zeitstrafe <Team> … abgelaufen“, ohne Uhr oder Stand zu verdecken.
 */
async function zeitstrafeLaeuftAb({ asRole }: StepContext): Promise<void> {
  const { match, team } = await vorbedingung('Gruppenspiel 11 anpfeifen, Zeitstrafe von 20 s eintragen', async () => {
    const { groupMatches } = await fetchTurniertagBracket();
    const gewaehlt = groupMatches[10];
    const now = Date.now();
    const start = now - 6000;
    const events = [
      eventOf('MATCH_START', start, start),
      eventOf('TIME_PENALTY', now - 5000, start, { teamId: gewaehlt.team_a_id, payload: { durationSeconds: 20 } }),
    ];
    expect((await appendOwner(gewaehlt.id, events)).results.map((r) => r.status)).toEqual(['accepted', 'accepted']);
    const name = (await fetchTurniertagTeams()).find((t) => t.id === gewaehlt.team_a_id)?.name;
    expect(name, 'Name des bestraften Teams').toBeTruthy();
    return { match: gewaehlt, team: name ?? '' };
  });
  const ownerPage = await asRole('owner');
  await openCockpit(ownerPage, TURNIERTAG_ID, match.id);
  await expectPageAnchor(ownerPage.getByText('Aktive Zeitstrafen').first(), 'Liste der aktiven Zeitstrafen');
  const karte = ownerPage.locator('[data-testid^="strafen-karte-"][data-testid$="-titel"]');
  await expect(karte, 'die laufende Strafe steht als Karte da').toHaveCount(1, { timeout: 10000 });
  await expect(karte).toContainText(team);
  // Soll (@SL-096): nach Ablauf der 20 Sekunden steht die Strafe nicht mehr unter „Aktive Zeitstrafen“ ...
  await expect(karte, 'abgelaufene Strafe: Karte weg').toHaveCount(0, { timeout: 30000 });
  // ... und das Cockpit meldet, dass sich das Team ergänzen darf
  const meldung = ownerPage.getByTestId('notice-line');
  await expect(meldung, 'Meldezeile nennt die abgelaufene Zeitstrafe').toContainText(new RegExp(`Zeitstrafe ${team}.*läuft noch`) /* MUTATIONSPROBE */, { timeout: 5000 });
  const [hinweis, uhr, stand] = await Promise.all([meldung.boundingBox(), ownerPage.getByTestId('scoreboard-clock').boundingBox(), ownerPage.getByTestId('scoreboard-score').boundingBox()]);
  expect(hinweis && uhr && stand, 'Meldezeile, Uhr und Stand sind sichtbar').toBeTruthy();
  if (hinweis && uhr && stand) {
    expect(ueberlappt(hinweis, uhr), 'der Hinweis verdeckt die Uhr nicht').toBe(false);
    expect(ueberlappt(hinweis, stand), 'der Hinweis verdeckt den Stand nicht').toBe(false);
  }
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D6', title: 'Halbzeit läuft von selbst: "Halbzeit", Pausen-Restzeit, Wiederanpfiff (Ton: Vitest)', scenarios: ['@SL-005'], owner: 'B-08b/c (gebaut, #263)', expectedFail: false, run: halbzeitVonSelbst },
  { id: 'D6z', title: 'Zeitstrafe läuft ab: Karte weg, Meldezeile „abgelaufen“, Uhr und Stand frei', scenarios: ['@SL-096'], owner: 'B-10b (gebaut, Meldezeile)', expectedFail: false, run: zeitstrafeLaeuftAb },
];
