/**
 * E2E: Cockpit Scheibe 3, Team-Spalten und Einträge (Plan Abschluss PR 2, T2-UI Spalten).
 * Ablauf: Anpfiff -> Tor FC Nord Nr. 7 -> Foul SV Süd -> Zeitstrafe SV Süd Nr. 5 -> Gelbe Karte FC Nord Nr. 9, je Schritt
 * Stand, Zähler und Marke geprüft. Saat: Spiel 1 FC Nord – SV Süd, 2 × 6 Minuten, Foul-Grenze 5 (Vorgabe).
 * Szenarien: @SL-019, @SL-083 (Tor zählt mit dem ersten Tipp, Nummer als Nachtrag), @SL-033/@SL-099 (Zähler „Foul n/5“),
 * @SL-029/@SL-031 (Zeitstrafe ohne Dauer-Auswahl, Marke mit Restzeit), @SL-084 (Karte), @SL-061/@OB-025 (alles auf einem Gerät
 * bedienbar), @OB-025 (langer Name: vollständig, höchstens drei Zeilen, Tor-Knöpfe auf einer Höhe, kein „…“). Am Laptop darf in PR 2
 * noch gescrollt werden (das löst PR 3).
 */
import { test, expect } from '../helpers/test-fixtures';
import { tippeKarte, wartePicker } from '../helpers/cockpitNeu';

const ID = 'e2e-s3-cup';
const TEAMS = ['e1', 'e2', 'e3', 'e4'].map((n) => `00000000-0000-4000-8000-0000000000${n}`);
const NAMEN = ['FC Nord', 'SV Süd', 'TSV Ost', 'FC West'];
const NAME_50 = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
const FARBEN = ['#FFD700', '#1E56D9', '#2E8B57', '#C0392B']; // Farbsaat: Trikotfarben für den Streifen im Spaltenkopf
const PAARE: Array<[number, number]> = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];

function cup(namen: readonly string[] = NAMEN) {
  const date = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  return {
    id: ID, status: 'published', publishedAt: new Date().toISOString(), sport: 'football', sportId: 'football-indoor',
    tournamentType: 'classic', mode: 'classic', numberOfFields: 1, numberOfTeams: 4, numberOfGroups: 1, groupSystem: 'roundRobin',
    groupPhaseGameDuration: 12, groupPhaseBreakDuration: 2, gameDuration: 12, breakDuration: 2, gamePeriods: 2, halftimeBreak: 1,
    placementLogic: ['points', 'goalDifference', 'goalsFor'], finals: { enabled: false }, isKidsTournament: false,
    hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals', pointSystem: { win: 3, draw: 1, loss: 0 },
    title: 'Cockpit-Cup Spalten', ageClass: 'U12', date, timeSlot: '10:00 - 14:00', startDate: date, startTime: '10:00',
    location: { name: 'Test-Halle' },
    teams: TEAMS.map((id, i) => ({ id, name: namen[i], group: 'A', colors: { primary: FARBEN[i] } })),
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

  test('@OB-025 @SL-061 50-Zeichen-Name: vollständig, höchstens drei Zeilen, ohne „…“, die beiden Tor-Knöpfe stehen auf einer Höhe', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup([NAME_50, NAMEN[1], NAMEN[2], NAMEN[3]])] });
    await page.goto(`/#/tournament/${ID}/live`);
    await page.getByTestId('match-start-button').click({ timeout: 15000 });
    await expect(page.getByTestId('match-pause-button')).toBeVisible();

    const name = page.getByTestId('team-name-home');
    await expect(name).toHaveText(NAME_50);
    expect(await name.textContent()).not.toMatch(/…|\.\.\./);
    const mass = await name.evaluate((el) => {
      const stil = getComputedStyle(el);
      return { zeilen: Math.round(el.getBoundingClientRect().height / parseFloat(stil.lineHeight)), hyphens: stil.hyphens, ueberlauf: el.scrollWidth > el.clientWidth };
    });
    expect(mass.zeilen).toBeLessThanOrEqual(3);
    expect(mass.hyphens).not.toBe('auto');
    expect(mass.ueberlauf).toBe(false);

    // Beide Köpfe gleich hoch -> die Tor-Knöpfe beider Spalten stehen auf einer Höhe (±1 px) und der Kopf überlappt das Tor nicht
    const torHeim = await page.getByTestId('goal-button-home').boundingBox();
    const torGast = await page.getByTestId('goal-button-away').boundingBox();
    const kopfHeim = await page.getByTestId('team-head-home').boundingBox();
    if (!torHeim || !torGast || !kopfHeim) { throw new Error('Spalte nicht sichtbar'); }
    expect(Math.abs(torHeim.y - torGast.y)).toBeLessThanOrEqual(1);
    expect(kopfHeim.y + kopfHeim.height).toBeLessThanOrEqual(torHeim.y + 1);
    // Abstand der beiden Tor-Knöpfe mindestens `spacing.sm` (8 px, Mockup `column-gap`): ein Fehltipp bucht sonst ein Tor für die Gegner (VISUAL § 9)
    const luecke = torGast.x - (torHeim.x + torHeim.width);
    expect(luecke).toBeGreaterThanOrEqual(7.5);
    // Beide Köpfe sind gleich hoch, auch wenn der Name links dreizeilig umbricht und der rechte einzeilig bleibt (Spalten teilen die Zeile)
    const kopfGast = await page.getByTestId('team-head-away').boundingBox();
    expect(Math.abs((kopfGast?.height ?? 0) - kopfHeim.height), 'Köpfe gleich hoch').toBeLessThanOrEqual(1);
    // @SL-176: der Kopf trägt die getragene Farbe wie der Kasten (hier die Trikotfarbe aus der Farbsaat, kein Leibchen)
    await expect(page.getByTestId('team-head-home')).toHaveCSS('background-color', 'rgb(255, 215, 0)');
  });

  test('@SL-087 Gegenbeispiel: ohne Anpfiff bietet die Spalte keine Eintrags-Tasten an', async ({ page }) => {
    await page.goto(`/#/tournament/${ID}/live`);
    await expect(page.getByTestId('match-start-button')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('goal-button-home')).toHaveCount(0);
    await expect(page.getByTestId('card-button-away')).toHaveCount(0);
  });
});
