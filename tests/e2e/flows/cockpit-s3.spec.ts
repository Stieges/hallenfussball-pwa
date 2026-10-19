/**
 * E2E: Cockpit Scheibe 3, Team-Spalten und Einträge (Plan Abschluss PR 2, T2-UI Spalten).
 * Ablauf: Anpfiff -> Tor FC Nord Nr. 7 -> Foul SV Süd -> Zeitstrafe SV Süd Nr. 5 -> Gelbe Karte FC Nord Nr. 9, je Schritt
 * Stand, Zähler und Marke geprüft. Saat: Spiel 1 FC Nord – SV Süd, 2 × 6 Minuten, Foul-Grenze 5 (Vorgabe).
 * Szenarien: @SL-019, @SL-083 (Tor zählt mit dem ersten Tipp, Nummer als Nachtrag), @SL-033/@SL-099 (Zähler „Foul n/5“),
 * @SL-029/@SL-031 (Zeitstrafe ohne Dauer-Auswahl, Marke mit Restzeit), @SL-084 (Karte), @SL-061/@OB-025 (alles auf einem Gerät
 * bedienbar). Am Laptop darf in PR 2 noch gescrollt werden (das löst PR 3).
 */
import { test, expect } from '../helpers/test-fixtures';
import { tippeKarte, wartePicker } from '../helpers/cockpitNeu';

const ID = 'e2e-s3-cup';
const TEAMS = ['e1', 'e2', 'e3', 'e4'].map((n) => `00000000-0000-4000-8000-0000000000${n}`);
const NAMEN = ['FC Nord', 'SV Süd', 'TSV Ost', 'FC West'];
const PAARE: Array<[number, number]> = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];

function cup() {
  const date = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  return {
    id: ID, status: 'published', publishedAt: new Date().toISOString(), sport: 'football', sportId: 'football-indoor',
    tournamentType: 'classic', mode: 'classic', numberOfFields: 1, numberOfTeams: 4, numberOfGroups: 1, groupSystem: 'roundRobin',
    groupPhaseGameDuration: 12, groupPhaseBreakDuration: 2, gameDuration: 12, breakDuration: 2, gamePeriods: 2, halftimeBreak: 1,
    placementLogic: ['points', 'goalDifference', 'goalsFor'], finals: { enabled: false }, isKidsTournament: false,
    hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals', pointSystem: { win: 3, draw: 1, loss: 0 },
    title: 'Cockpit-Cup Spalten', ageClass: 'U12', date, timeSlot: '10:00 - 14:00', startDate: date, startTime: '10:00',
    location: { name: 'Test-Halle' },
    teams: TEAMS.map((id, i) => ({ id, name: NAMEN[i], group: 'A' })),
    matches: PAARE.map(([a, b], i) => ({
      id: `00000000-0000-4000-8000-0000000009${i + 10}`, matchNumber: i + 1, round: i + 1, field: 1, group: 'A', phase: 'groupStage',
      slotA: { kind: 'team', teamId: TEAMS[a] }, slotB: { kind: 'team', teamId: TEAMS[b] }, matchStatus: 'scheduled',
      scheduledTime: `${date}T${String(10 + Math.floor(i / 5)).padStart(2, '0')}:${String((i % 5) * 12).padStart(2, '0')}:00.000Z`,
    })),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

test.describe('Cockpit Scheibe 3: Team-Spalten und Einträge (Gast, lokal)', () => {
  test.beforeEach(async ({ page, seedIndexedDB }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Safe-Area-Emulation verdeckt Tasten (wie live-cockpit.spec.ts)');
    await seedIndexedDB({ tournaments: [cup()] });
    await expect(page.getByText('Cockpit-Cup Spalten')).toBeVisible({ timeout: 15000 });
  });

  test('@SL-019 @SL-033 @SL-029 @SL-084 Tor, Foul, Zeitstrafe und Karte über die Team-Spalten, je Schritt Stand, Zähler und Marke', async ({ page }) => {
    await page.goto(`/#/tournament/${ID}/live`);
    await page.getByTestId('match-start-button').click({ timeout: 15000 });
    await expect(page.getByTestId('match-pause-button')).toBeVisible();
    await expect(page.getByTestId('team-name-home')).toHaveText('FC Nord');
    await expect(page.getByTestId('team-name-away')).toHaveText('SV Süd');
    await expect(page.getByTestId('team-fouls-away')).toHaveText('Foul 0/5');

    // Tor FC Nord, Nr. 7: zählt mit dem ersten Tipp, die Nummer kommt als Nachtrag
    await page.getByTestId('goal-button-home').click();
    await expect(page.getByTestId('scoreboard-box-links')).toHaveText('1');
    await wartePicker(page);
    await page.getByTestId('number-picker').getByRole('button', { name: '7', exact: true }).click();
    await expect(page.getByTestId('number-picker')).toBeHidden();
    await expect(page.getByTestId('scoreboard-box-links')).toHaveText('1');
    await expect(page.getByTestId('scoreboard-box-rechts')).toHaveText('0');

    // Foul SV Süd: Zähler gegen die Grenze
    await page.getByTestId('foul-button-away').click();
    await expect(page.getByTestId('team-fouls-away')).toHaveText('Foul 1/5');
    await expect(page.getByTestId('team-fouls-home')).toHaveText('Foul 0/5');

    // Zeitstrafe SV Süd, Nr. 5: ohne Dauer-Auswahl, Marke mit Restzeit in der Spalte
    await page.getByTestId('penalty-button-away').click();
    await wartePicker(page);
    await page.getByTestId('number-picker').getByRole('button', { name: '5', exact: true }).click();
    await expect(page.getByTestId('number-picker')).toBeHidden();
    await expect(page.getByTestId('team-column-away').getByText(/^Nr\. 5 · \d+:\d{2}$/)).toBeVisible();
    await expect(page.getByTestId('team-fouls-away')).toHaveText('Foul 2/5'); // die Zeitstrafe zählt als Foul

    // Gelbe Karte FC Nord, Nr. 9
    await tippeKarte(page, 'home', 'Gelb', 9);
    await expect(page.getByTestId('team-fouls-home')).toHaveText('Foul 1/5');
    await expect(page.getByTestId('scoreboard-box-links')).toHaveText('1');
  });

  test('@SL-087 Gegenbeispiel: ohne Anpfiff bietet die Spalte keine Eintrags-Tasten an', async ({ page }) => {
    await page.goto(`/#/tournament/${ID}/live`);
    await expect(page.getByTestId('match-start-button')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('goal-button-home')).toHaveCount(0);
    await expect(page.getByTestId('card-button-away')).toHaveCount(0);
  });
});
