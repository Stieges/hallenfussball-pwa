/**
 * UR T2-UI (b), offline (Gast, lokale Engine): Olli trägt im Spielplan 3:1 für das geplante Spiel ein (@FU-080). Im
 * Gast-Turnier gibt es kein Konto und keinen Server (L4) -- das Protokoll des Spiels zeigt die Zeile „Ergebnis
 * eingetragen“ ohne „von …“. Einstieg ins Protokoll: Live-Bereich, Spiel-Auswahl (Desktop: Sidebar, Handy: „Ereignisse“).
 * Der Konto-Weg mit Namen steht in tests/e2e/cloud/urheber.cloud.spec.ts.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';

const NORD = '00000000-0000-4000-8000-0000000000c1';
const SUED = '00000000-0000-4000-8000-0000000000c2';
const WEST = '00000000-0000-4000-8000-0000000000c3';
const OST = '00000000-0000-4000-8000-0000000000c4';
const SPIEL_9 = '00000000-0000-4000-8000-0000000000c9';
const FINALE = '00000000-0000-4000-8000-0000000000ca';
const TOURNAMENT = 'ur-protokoll-offline';

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

/**
 * Finalrunde wie tests/e2e/flows/spielplan-strafstoss.spec.ts (bewährte Hand-Saat): das geplante Spiel 9 (Halbfinale)
 * und das Finale. 3:1 ist kein Unentschieden → keine Strafstoß-Abfrage.
 */
function papierTurnier(): Record<string, unknown> {
  const date = tomorrow();
  const sieger = { kind: 'matchResult', matchId: SPIEL_9, role: 'winner' };
  return {
    id: TOURNAMENT, status: 'published', sport: 'football', sportId: 'football-indoor', tournamentType: 'classic', mode: 'classic',
    numberOfFields: 1, numberOfTeams: 4, numberOfGroups: 1, groupSystem: 'groupsAndFinals',
    groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, gameDuration: 10, breakDuration: 2,
    placementLogic: ['points', 'goalDifference', 'goalsFor'], finals: { enabled: true },
    finalsConfig: { preset: 'top-4', tiebreaker: 'shootout' },
    isKidsTournament: false, hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 }, title: 'Hallencup Papier', ageClass: 'U12',
    date, timeSlot: '10:00 - 14:00', startDate: date, startTime: '10:00', location: { name: 'Halle Nord' },
    teams: [
      { id: NORD, name: 'FC Nord' }, { id: SUED, name: 'SV Süd' }, { id: WEST, name: 'TSV West' }, { id: OST, name: 'SC Ost' },
    ],
    matches: [
      {
        id: SPIEL_9, round: 1, field: 1, phase: 'semifinal', label: 'Halbfinale 1', teamA: SUED, teamB: NORD,
        slotA: { kind: 'team', teamId: SUED }, slotB: { kind: 'team', teamId: NORD },
        matchStatus: 'scheduled', scheduledTime: `${date}T10:00:00.000Z`, time: '10:00',
      },
      {
        id: FINALE, round: 2, field: 1, phase: 'final', label: 'Finale', teamA: 'TBD', teamB: WEST,
        slotA: { kind: 'pending', source: sieger }, originA: sieger, slotB: { kind: 'team', teamId: WEST },
        matchStatus: 'scheduled', scheduledTime: `${date}T10:30:00.000Z`, time: '10:30',
      },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

async function trageDreiZuEinsEin(page: Page): Promise<void> {
  await page.goto(`/#/tournament/${TOURNAMENT}/schedule`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Sieger Halbfinale 1').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole('spinbutton').filter({ visible: true })).toHaveCount(4);
  await page.getByRole('spinbutton').filter({ visible: true }).nth(0).fill('3');
  await page.getByRole('spinbutton').filter({ visible: true }).nth(1).fill('1');
  // Dann ist Spiel 9 beendet: nur noch das Finale hat Eingabefelder
  await expect(page.getByRole('spinbutton').filter({ visible: true })).toHaveCount(2, { timeout: 10_000 });
}

test.describe('@FU-080 Protokoll eines im Spielplan eingetragenen Spiels (Gast, offline)', () => {
  test.beforeEach(async ({ seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [papierTurnier()] });
  });

  test('@FU-080 L4: Gast trägt 3:1 ein → Protokoll zeigt „Ergebnis eingetragen“ ohne Namen', async ({ page }) => {
    await trageDreiZuEinsEin(page);

    // Einstieg: Live-Bereich, Spiel-Auswahl (ManagementTab) -- dasselbe wie in der Cloud-E2E.
    await page.getByRole('link', { name: 'Live' }).or(page.getByRole('button', { name: 'Live' })).or(page.getByRole('tab', { name: 'Live' })).filter({ visible: true }).first().click();
    await page.waitForLoadState('networkidle');
    await page.locator('select').filter({ has: page.locator(`option[value="${SPIEL_9}"]`) }).selectOption(SPIEL_9);
    const istHandy = (page.viewportSize()?.width ?? 0) < 768;
    if (istHandy) {
      await page.getByTestId('match-event-log-button').click();
    }
    const zeile = page.getByTestId('protocol-result-entry').filter({ visible: true });
    await expect(zeile).toHaveCount(1, { timeout: 10_000 });
    await expect(zeile).toHaveText('📝Ergebnis eingetragen');
    await expect(zeile).not.toContainText('von');
    // Kein waagerechtes Scrollen, Zeile ganz im Bild (Ersatz, falls visual:metrics die Ansicht nicht kennt).
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const box = await zeile.boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) {
      throw new Error('Protokoll-Zeile oder Viewport nicht messbar');
    }
    expect(box.x >= 0 && box.x + box.width <= viewport.width).toBe(true);
    // Bilder hell/dunkel für die visuelle Prüfung (Ablage unter test-results, nicht im Repo).
    await page.screenshot({ path: test.info().outputPath('protokoll-urheber-hell.png') });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: test.info().outputPath('protokoll-urheber-dunkel.png') });
  });
});
