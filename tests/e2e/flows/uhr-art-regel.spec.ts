/**
 * B-08e (T2-UI): Regel-Feld „Uhr-Art“ und „Länge der angehaltenen Schlussphase“ im Admin Center
 * (Match Cockpit). Szenarien `2026-09-27_wizard-regelinhalte.md`: @W2A-035 (Uhr-Art wählbar), @W2A-040
 * (Schlussphase 1 bis 5 Minuten, vorbelegt 1, ungültig → Bereich genannt, nicht übernommen).
 * Gastmodus = Eigentümer; die Sperre für Helfer (@W2A-030) braucht ein Cloud-Mitglied und ist im
 * Verhaltenstest `B08e-uhr-art-regel.test.tsx` belegt, nicht hier (E2E läuft nur offline, nie gegen die Produktion).
 * Bilder (nur mit `B08E_BILDER=<Ordner>`): 1280×720 und 360×640.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';

const ID = 'e2e-uhr-art-cup';
const TEAMS = ['e1', 'e2', 'e3', 'e4'].map((n) => `00000000-0000-4000-8000-0000000000${n}`);

function cup() {
  const date = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  return {
    id: ID, status: 'published', publishedAt: new Date().toISOString(), sport: 'football', sportId: 'football-indoor',
    tournamentType: 'classic', mode: 'classic', numberOfFields: 1, numberOfTeams: 4, numberOfGroups: 1, groupSystem: 'roundRobin',
    groupPhaseGameDuration: 12, groupPhaseBreakDuration: 2, gamePeriods: 2, halftimeBreak: 1, gameDuration: 12, breakDuration: 2,
    placementLogic: ['points', 'goalDifference', 'goalsFor'], finals: { enabled: false }, isKidsTournament: false,
    hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals', pointSystem: { win: 3, draw: 1, loss: 0 },
    title: 'Uhr-Art-Cup', ageClass: 'U12', date, timeSlot: '10:00 - 14:00', startDate: date, startTime: '10:00',
    location: { name: 'Test-Halle' },
    teams: TEAMS.map((id, i) => ({ id, name: `FC Test ${'ABCD'[i]}`, group: 'A' })),
    matches: [{
      id: '00000000-0000-4000-8000-000000000910', matchNumber: 1, round: 1, field: 1, group: 'A', phase: 'groupStage',
      slotA: { kind: 'team', teamId: TEAMS[0] }, slotB: { kind: 'team', teamId: TEAMS[1] }, matchStatus: 'scheduled',
      scheduledTime: `${date}T10:00:00.000Z`,
    }],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

const feld = (page: Page) => page.getByTestId('settings-final-phase-minutes');
const hinweis = (page: Page) => page.getByTestId('settings-final-phase-range');

async function oeffneRegeln(page: Page): Promise<void> {
  await page.goto(`/#/tournament/${ID}/admin/match-cockpit`);
  await expect(page.getByTestId('settings-clock-mode')).toBeVisible({ timeout: 15000 });
}

test.describe('B-08e Regel Uhr-Art und Schlussphase (Admin Center)', () => {
  test.beforeEach(async ({ seedIndexedDB }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Safe-Area-Emulation (wie live-cockpit.spec.ts)');
    await seedIndexedDB({ tournaments: [cup()] });
  });

  test('@W2A-040 Vorgabe 1 Minute; 3 Minuten gewählt bleiben nach dem Neuladen', async ({ page }) => {
    await oeffneRegeln(page);
    await expect(page.getByTestId('settings-clock-mode')).toHaveValue('durchlaufend-letzte-minute-angehalten');
    await expect(feld(page)).toHaveValue('1');

    await feld(page).fill('3');
    await expect(hinweis(page)).toHaveCount(0);
    await feld(page).blur();

    await page.reload();
    await expect(feld(page)).toHaveValue('3');
  });

  test('@W2A-040 Gegenbeispiel: 0 und 6 werden nicht übernommen, der Hinweis nennt 1 bis 5 Minuten', async ({ page }) => {
    await oeffneRegeln(page);
    await feld(page).fill('3');
    await feld(page).fill('6');
    await expect(hinweis(page)).toContainText('1 bis 5 Minuten');
    await feld(page).fill('0');
    await expect(hinweis(page)).toContainText('1 bis 5 Minuten');

    await feld(page).blur();
    await expect(feld(page)).toHaveValue('3');
    await page.reload();
    await expect(feld(page)).toHaveValue('3');
  });

  test('@W2A-035 Uhr-Art „immer angehalten“ gewählt: Länge-Feld verschwindet, Wahl bleibt nach dem Neuladen', async ({ page }) => {
    await oeffneRegeln(page);
    await page.getByTestId('settings-clock-mode').selectOption('immer-angehalten');
    await expect(feld(page)).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('settings-clock-mode')).toHaveValue('immer-angehalten');
    await expect(feld(page)).toHaveCount(0);
  });

  test('@W2A-040 Feld hat Touch-Ziel ≥ 44 px und Schrift ≥ 16 px', async ({ page }) => {
    await oeffneRegeln(page);
    const box = await feld(page).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
    const px = await feld(page).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(px).toBeGreaterThanOrEqual(16);
  });
});

// Bilder für Daniel (nur mit B08E_BILDER=<Ordner>): Vorgabe, gültiger Wert, ungültiger Wert, andere Uhr-Art.
for (const [breite, hoehe] of [[1280, 720], [360, 640]] as const) {
  test.describe(`B-08e Bilder ${breite}x${hoehe}`, () => {
    test.use({ viewport: { width: breite, height: hoehe } });
    test.skip(!process.env.B08E_BILDER, 'Bilder nur mit B08E_BILDER');

    test.beforeEach(async ({ seedIndexedDB }) => {
      await seedIndexedDB({ tournaments: [cup()] });
    });

    test('Regel-Feld in vier Zuständen', async ({ page }) => {
      const dir = process.env.B08E_BILDER ?? '';
      const foto = async (name: string): Promise<void> => {
        await feld(page).or(page.getByTestId('settings-clock-mode')).first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${dir}/${name}-${breite}x${hoehe}.png` });
      };
      await oeffneRegeln(page);
      await foto('1-vorgabe');
      await feld(page).fill('3');
      await foto('2-drei-minuten');
      await feld(page).fill('6');
      await expect(hinweis(page)).toBeVisible();
      await foto('3-ungueltig-6');
      await feld(page).blur();
      await page.getByTestId('settings-clock-mode').selectOption('immer-angehalten');
      await expect(feld(page)).toHaveCount(0);
      await foto('4-immer-angehalten');
    });
  });
}
