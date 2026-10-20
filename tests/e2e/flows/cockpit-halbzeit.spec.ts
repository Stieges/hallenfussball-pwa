/**
 * E2E: Halbzeit von selbst, Wiederanpfiff, Abpfiff von selbst im Live-Cockpit (B-08b/c, T2-UI).
 *
 * Szenarien: @SL-005 (Ablauf des ersten Abschnitts -> Halbzeit mit Pausen-Restzeit, Wiederanpfiff angeboten),
 * @SL-006 (der Wiederanpfiff startet den zweiten Abschnitt bei 0:00), @SL-009 (Ablauf der Spielzeit ->
 * Spiel abgepfiffen; der Endstand-Teil von @SL-073 ist offen: Befund C-COCKPIT-ENDSTAND-NACH-AUTOENDE; @SL-152 die Quittungszeile
 * „Abgepfiffen · 1:0 gespeichert“ unter „Ende“, 30 Sekunden lang, dann weg); Befund C-COCKPIT-HALBZEIT-START („Start“ in der Halbzeitpause meldete
 * „Spiel fortgesetzt“, die Tafel blieb auf Halbzeit).
 *
 * Das Turnier ist so eingestellt, dass kein langes Warten nötig ist: 1 Minute Spielzeit in 2 Abschnitten = 2 x 30 Sekunden.
 * Bilder (hell, 360 und 1280 px) nach `E2E_BILDER`, falls gesetzt.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '../helpers/test-fixtures';
import { schliesseTorAuswahl } from '../helpers/cockpitNeu';

test.use({ colorScheme: 'light' });

const TOURNAMENT_ID = 'e2e-halbzeit-tournament';
const TEAM_IDS = ['e1', 'e2', 'e3', 'e4'].map((n) => `00000000-0000-4000-8000-0000000000${n}`);
const SPIEL_IDS = ['00000000-0000-4000-8000-0000000009a1', '00000000-0000-4000-8000-0000000009a2'];

function createTestTournament() {
  const morgen = new Date();
  morgen.setDate(morgen.getDate() + 1);
  const datum = morgen.toISOString().split('T')[0];
  return {
    id: TOURNAMENT_ID,
    status: 'published',
    sport: 'football',
    sportId: 'football-indoor',
    tournamentType: 'classic',
    mode: 'classic',
    numberOfFields: 1,
    numberOfTeams: 4,
    numberOfGroups: 1,
    groupSystem: 'roundRobin',
    groupPhaseGameDuration: 1,
    groupPhaseBreakDuration: 2,
    gameDuration: 1,
    breakDuration: 2,
    gamePeriods: 2,
    halftimeBreak: 1,
    placementLogic: ['points', 'goalDifference', 'goalsFor'],
    finals: { enabled: false },
    isKidsTournament: false,
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 },
    title: 'E2E Halbzeit Turnier',
    ageClass: 'U12',
    date: datum,
    timeSlot: '10:00 - 14:00',
    startDate: datum,
    startTime: '10:00',
    location: { name: 'Test-Halle' },
    teams: TEAM_IDS.map((id, i) => ({ id, name: `FC Test ${'ABCD'[i]}`, group: 'A' })),
    // Gespeicherter Spielplan mit festen Spiel-IDs: das Cockpit wird über die Adresse (`?matchId=`) auf Spiel 1 gepinnt (keine Spielauswahl mehr)
    matches: [[0, 1], [2, 3]].map(([a, b], i) => ({
      id: SPIEL_IDS[i], matchNumber: i + 1, round: i + 1, field: 1, group: 'A', phase: 'groupStage',
      slotA: { kind: 'team', teamId: TEAM_IDS[a] }, slotB: { kind: 'team', teamId: TEAM_IDS[b] }, matchStatus: 'scheduled',
      scheduledTime: `${datum}T${String(10 + i).padStart(2, '0')}:00:00.000Z`,
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test.describe('Cockpit: Halbzeit, Wiederanpfiff, Abpfiff von selbst', () => {
  test.setTimeout(150_000);

  test.beforeEach(async ({ page, seedIndexedDB }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Skipping on iPhone due to Safe Area emulation issues');
    await seedIndexedDB({ tournaments: [createTestTournament()] });
    await expect(page.getByText('E2E Halbzeit Turnier')).toBeVisible({ timeout: 15000 });
    await page.getByText('E2E Halbzeit Turnier').click();
    await page.getByText('Live').first().click({ force: true });
    await expect(page.getByTestId('scoreboard')).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    try {
      await page.evaluate(() => { localStorage.removeItem('tournaments'); });
    } catch {
      // Aufräumen darf nicht scheitern (übersprungener Test: Seite ist about:blank)
    }
  });

  test('@SL-005 @SL-006 @SL-009 Halbzeit von selbst, Wiederanpfiff startet Abschnitt 2 bei 0:00, Abpfiff von selbst', async ({ page }, testInfo) => {
    const bilder = process.env.E2E_BILDER;
    const bild = async (name: string): Promise<void> => {
      if (!bilder) { return; }
      mkdirSync(bilder, { recursive: true });
      await page.getByTestId('scoreboard').scrollIntoViewIfNeeded();
      await page.evaluate(() => { window.scrollTo(0, 0); });
      await page.screenshot({ path: join(bilder, `${name}-${testInfo.project.name}.png`), fullPage: false });
    };

    // @SL-152: Spiel 1 über die Adresse öffnen (`?matchId=`, eine Spielauswahl gibt es nicht mehr, @SL-057), damit das Cockpit nach dem
    // Abpfiff auf Spiel 1 bleibt (ohne Angabe springt es sofort zum folgenden) und die Quittungszeile zu sehen ist
    await page.goto(`/#/tournament/${TOURNAMENT_ID}/live?matchId=${SPIEL_IDS[0]}`);
    await expect(page.getByTestId('scoreboard')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('match-start-button').click();
    await expect(page.getByTestId('scoreboard-state')).toContainText('Live');
    await expect(page.getByTestId('scoreboard-quittung'), '@SL-152 Gegenbeispiel: vor dem Abpfiff keine Quittungszeile').toHaveCount(0);
    await page.getByTestId('goal-button-home').click();
    await schliesseTorAuswahl(page);
    await expect(page.getByTestId('scoreboard-box-links')).toHaveText('1');
    await bild('1-erster-abschnitt');

    // @SL-005: nach 30 Sekunden endet der erste Abschnitt von selbst; Halbzeit mit Pausen-Restzeit, Wiederanpfiff angeboten
    await expect(page.getByTestId('scoreboard-state')).toContainText('Halbzeit', { timeout: 45_000 });
    await expect(page.getByTestId('scoreboard-clock-rest')).toContainText(/^[01]:\d\d$/);
    const wiederanpfiff = page.getByTestId('match-wiederanpfiff-button');
    await expect(wiederanpfiff).toBeVisible();
    await expect(wiederanpfiff).toContainText('Wiederanpfiff');
    await expect(page.getByTestId('match-start-button')).toHaveCount(0);
    await bild('2-halbzeit-wiederanpfiff');

    // @SL-006 + Befund C-COCKPIT-HALBZEIT-START: der Wiederanpfiff startet Abschnitt 2, meldet den Wiederanpfiff
    await wiederanpfiff.click();
    await expect(page.getByTestId('scoreboard-state')).toContainText('Live');
    await expect(page.getByTestId('scoreboard-clock-sub')).toContainText(/Spielzeit 0:0\d/);
    await expect(page.getByTestId('notice-line')).toContainText('Wiederanpfiff');
    await expect(page.getByText('Spiel fortgesetzt')).toHaveCount(0);
    await expect(page.getByTestId('match-pause-button')).toBeVisible();
    await bild('3-zweiter-abschnitt');

    // @SL-009: nach weiteren 30 Sekunden ist das Spiel abgepfiffen. Das Cockpit bleibt hier auf dem gewählten Spiel 1; ohne Wahl
    // springt es sofort zum nächsten Spiel (Befund C-COCKPIT-ENDSTAND-NACH-AUTOENDE, @SL-073 offen). Belegt ist der Abpfiff durch „Ende“.
    await expect(page.getByTestId('scoreboard-state')).toHaveText('Ende', { timeout: 45_000 });
    await expect(page.getByTestId('scoreboard')).toContainText(/Ende|Anstoß/);

    // @SL-152: das Abzeichen bleibt „Ende“, darunter die Quittungszeile mit dem tatsächlichen Endstand; nach 30 Sekunden ist sie weg
    await expect(page.getByTestId('scoreboard-state')).toHaveText('Ende');
    await expect(page.getByTestId('scoreboard-quittung')).toHaveText('Abgepfiffen · 1:0 gespeichert');
    await expect(page.getByTestId('notice-line'), '@SL-152 keine Doppelung: „Spiel abgepfiffen“ steht nicht zusätzlich in der Meldezeile').not.toContainText('abgepfiffen');
    await bild('4-abgepfiffen');
    await expect(page.getByTestId('scoreboard-quittung'), '@SL-152 Gegenbeispiel: nach den 30 Sekunden keine Zeile').toHaveCount(0, { timeout: 35_000 });
    await expect(page.getByTestId('scoreboard-state')).toHaveText('Ende');
  });
});
