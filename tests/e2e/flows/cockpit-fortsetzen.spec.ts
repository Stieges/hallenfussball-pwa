/**
 * E2E: „Spiel fortsetzen“ nach dem Abpfiff von selbst (LT-6, Befund C-FORTSETZEN-NICHT-GEBUNDEN; T2-UI (b)).
 * Ablauf (Uhr vorgespult mit `page.clock`): Anpfiff -> Tor FC Nord -> Spiel endet mit Ablauf von selbst (1:0) -> im Endstand stehen
 * „Weiter“ und „Spiel fortsetzen“ -> 20 Sekunden danach „Spiel fortsetzen“, Restzeit 0:40 -> das Spiel läuft mit 1:0 weiter.
 * Gegenbeispiel: nach mehr als 30 Sekunden steht „Spiel fortsetzen“ nicht mehr da.
 * Szenarien: @SL-074, @SL-075 Z. 2, @SL-152 Z. 4. Bilder nur, wenn FORTSETZEN_BILDER gesetzt ist.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { wartePicker } from '../helpers/cockpitNeu';

const ID = 'e2e-fortsetzen-cup';
const TEAMS = ['f1', 'f2', 'f3', 'f4'].map((n) => `00000000-0000-4000-8000-0000000000${n}`);
const NAMEN = ['FC Nord', 'SV Süd', 'TSV Ost', 'FC West'];
const PAARE: Array<[number, number]> = [[0, 1], [2, 3]];

/** Ein Abschnitt zu 2 Minuten: das Spiel endet nach 2:00 von selbst. */
function cup() {
  const date = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  return {
    id: ID, status: 'published', publishedAt: new Date().toISOString(), sport: 'football', sportId: 'football-indoor',
    tournamentType: 'classic', mode: 'classic', numberOfFields: 1, numberOfTeams: 4, numberOfGroups: 1, groupSystem: 'roundRobin',
    groupPhaseGameDuration: 2, groupPhaseBreakDuration: 2, gameDuration: 2, breakDuration: 2, gamePeriods: 1,
    placementLogic: ['points', 'goalDifference', 'goalsFor'], finals: { enabled: false }, isKidsTournament: false,
    hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals', pointSystem: { win: 3, draw: 1, loss: 0 },
    title: 'Fortsetzen-Cup', ageClass: 'U12', date, timeSlot: '10:00 - 14:00', startDate: date, startTime: '10:00',
    location: { name: 'Test-Halle' },
    teams: TEAMS.map((id, i) => ({ id, name: NAMEN[i], group: 'A' })),
    matches: PAARE.map(([a, b], i) => ({
      id: `00000000-0000-4000-8000-0000000008${i + 10}`, matchNumber: i + 1, round: i + 1, field: 1, group: 'A', phase: 'groupStage',
      slotA: { kind: 'team', teamId: TEAMS[a] }, slotB: { kind: 'team', teamId: TEAMS[b] }, matchStatus: 'scheduled',
      scheduledTime: `${date}T10:${String(i * 4).padStart(2, '0')}:00.000Z`,
    })),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

async function bild(page: Page, name: string, projekt: string): Promise<void> {
  const ordner = process.env.FORTSETZEN_BILDER;
  if (ordner) { await page.screenshot({ path: `${ordner}/${name}-${projekt}.png` }); }
}

/** Spiel 1 anpfeifen, ein Tor für FC Nord, die Uhr bis zum Ablauf vorspulen: das Spiel endet von selbst mit 1:0. */
async function endetVonSelbst(page: Page): Promise<void> {
  await page.goto(`/#/tournament/${ID}/live`);
  await page.getByTestId('match-start-button').click({ timeout: 15000 });
  await expect(page.getByTestId('match-pause-button')).toBeVisible();
  await page.getByTestId('goal-button-home').click();
  await expect(page.getByTestId('scoreboard-box-links')).toHaveText('1');
  await wartePicker(page);
  await page.keyboard.press('Escape');
  await page.clock.fastForward(125_000);
  await expect(page.getByTestId('scoreboard-state')).toContainText('Ende', { timeout: 10_000 });
  await expect(page.getByTestId('scoreboard-score')).toHaveText('1:0');
}

test.describe('Cockpit: Spiel fortsetzen nach dem Abpfiff von selbst (LT-6)', () => {
  test.beforeEach(async ({ page, seedIndexedDB }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Safe-Area-Emulation verdeckt Tasten (wie live-cockpit.spec.ts)');
    await page.clock.install();
    await seedIndexedDB({ tournaments: [cup()] });
  });

  test('@SL-152 @SL-074 im Endstand „Weiter“ und „Spiel fortsetzen“; 20 s danach fortgesetzt mit Restzeit 0:40 → läuft mit 1:0 weiter', async ({ page }, testInfo) => {
    await endetVonSelbst(page);
    await expect(page.getByTestId('match-next-button')).toBeVisible();
    await expect(page.getByTestId('match-continue-button')).toHaveText(/Spiel fortsetzen/);
    await expect(page.getByRole('button', { name: /Bestätigen/ })).toHaveCount(0);
    await bild(page, 'endstand-mit-fortsetzen', testInfo.project.name);

    await page.clock.fastForward(20_000);
    await page.getByTestId('match-continue-button').click();
    const dialog = page.getByTestId('resume-finished-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('resume-rest-stepper')).toContainText('1:00');
    await dialog.getByTestId('resume-rest-stepper-minus').click();
    await dialog.getByTestId('resume-rest-stepper-minus').click();
    await expect(dialog.getByTestId('resume-rest-stepper')).toContainText('0:40');
    await bild(page, 'fortsetzen-restzeit', testInfo.project.name);
    await dialog.getByTestId('resume-apply').click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('scoreboard-state')).toContainText('Live');
    await expect(page.getByTestId('scoreboard-score')).toHaveText('1:0');
    await expect(page.getByTestId('match-pause-button')).toBeVisible();
    await expect(page.getByTestId('match-continue-button')).toHaveCount(0);
    await bild(page, 'fortgesetzt', testInfo.project.name);
  });

  test('@SL-075 Z. 2 mehr als 30 Sekunden nach dem Abpfiff steht „Spiel fortsetzen“ nicht mehr da', async ({ page }) => {
    await endetVonSelbst(page);
    await expect(page.getByTestId('match-continue-button')).toBeVisible();
    await page.clock.fastForward(31_000);
    await expect(page.getByTestId('match-continue-button')).toHaveCount(0);
  });
});
