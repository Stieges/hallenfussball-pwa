/**
 * Befund C-SCHNELLEINGABE-ENTWURF-VERLOREN, offline (Gast): ein angefangener Eintrag in der Schnelleingabe der Finalrunde
 * bleibt stehen, während von außen etwas kommt. Wiederhergestellt wird @FU-101 (Gegeben das Feld für SV Süd zeigt schon 2,
 * Olli tippt im Feld für FC Nord „1“ und „0“ → 10:2). Am Turniertag läuft fast immer ein anderes Spiel: seine Uhr lässt
 * den Spielplan jede Sekunde neu zeichnen. Vorher baute das jede Zeile der Finalrunden-Tabelle neu auf, die getippte 2
 * verschwand ohne Hinweis. Vitest: src/components/schedule/__tests__/FU-101-entwurf-bleibt.test.tsx.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';

const NORD = '00000000-0000-4000-8000-0000000000c1';
const SUED = '00000000-0000-4000-8000-0000000000c2';
const WEST = '00000000-0000-4000-8000-0000000000c3';
const OST = '00000000-0000-4000-8000-0000000000c4';
const HF1 = '00000000-0000-4000-8000-0000000101a1';
const HF2 = '00000000-0000-4000-8000-0000000101a2';
const TOURNAMENT = 'fu101-entwurf-offline';

function heute(): string {
  return new Date().toISOString().split('T')[0];
}

/** Halbfinale 1 FC Nord – SV Süd ist offen, Halbfinale 2 TSV West – SC Ost läuft (Uhr tickt). */
function turnier(): Record<string, unknown> {
  const date = heute();
  return {
    id: TOURNAMENT, status: 'published', sport: 'football', sportId: 'football-indoor', tournamentType: 'classic', mode: 'classic',
    numberOfFields: 2, numberOfTeams: 4, numberOfGroups: 1, groupSystem: 'groupsAndFinals',
    groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, gameDuration: 10, breakDuration: 2,
    placementLogic: ['points', 'goalDifference', 'goalsFor'], finals: { enabled: true },
    finalsConfig: { preset: 'top-4', tiebreaker: 'shootout' },
    isKidsTournament: false, hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 }, title: 'Hallencup Entwurf', ageClass: 'U12',
    date, timeSlot: '10:00 - 14:00', startDate: date, startTime: '10:00', location: { name: 'Halle Nord' },
    teams: [
      { id: NORD, name: 'FC Nord' }, { id: SUED, name: 'SV Süd' }, { id: WEST, name: 'TSV West' }, { id: OST, name: 'SC Ost' },
    ],
    matches: [
      {
        id: HF1, round: 1, field: 1, phase: 'semifinal', label: 'Halbfinale 1', teamA: NORD, teamB: SUED,
        slotA: { kind: 'team', teamId: NORD }, slotB: { kind: 'team', teamId: SUED },
        matchStatus: 'scheduled', scheduledTime: `${date}T10:00:00.000Z`, time: '10:00',
      },
      {
        id: HF2, round: 1, field: 2, phase: 'semifinal', label: 'Halbfinale 2', teamA: WEST, teamB: OST,
        slotA: { kind: 'team', teamId: WEST }, slotB: { kind: 'team', teamId: OST },
        matchStatus: 'running', scoreA: 1, scoreB: 0, timerStartTime: new Date().toISOString(), timerElapsedSeconds: 0,
        scheduledTime: `${date}T10:00:00.000Z`, time: '10:00',
      },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

/** Desktop: Tabelle (`match-score-input-…`), bis 768 px: Karten (`final-score-input-…`). */
function feld(page: Page, seite: 'home' | 'away') {
  const karte = (page.viewportSize()?.width ?? 0) <= 768;
  return page.getByTestId(`${karte ? 'final' : 'match'}-score-input-${HF1}-${seite}`);
}

test.describe('C-SCHNELLEINGABE-ENTWURF-VERLOREN: der Entwurf bleibt, während ein anderes Spiel läuft (@FU-101, offline)', () => {
  test.beforeEach(async ({ seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [turnier()] });
  });

  test('@FU-101 die 2 für SV Süd bleibt über mehrere Uhr-Takte von Halbfinale 2 stehen, danach speichert „10“ + Enter 10:2', async ({ page }) => {
    await page.goto(`/#/tournament/${TOURNAMENT}/schedule`);
    // Sofort tippen, sobald das Feld da ist (wie Olli am Turniertag) – keine Wartezeit auf die Ruhe der Seite
    await expect(feld(page, 'away')).toBeVisible();
    await feld(page, 'away').click();
    await page.keyboard.type('2');

    // Halbfinale 2 läuft: die Restzeit zählt sichtbar weiter, der Spielplan zeichnet sich also neu
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_500);
    await expect(feld(page, 'away')).toHaveValue('2');
    await expect(feld(page, 'away')).toBeFocused();

    await feld(page, 'home').click();
    await page.keyboard.type('1');
    await page.waitForTimeout(1_500); // weitere Takte mitten im Tippen
    await page.keyboard.type('0');
    await expect(feld(page, 'home')).toHaveValue('10');
    await expect(feld(page, 'away')).toHaveValue('2');
    await test.info().attach('entwurf-nach-takten', { body: await page.screenshot(), contentType: 'image/png' });
    await page.keyboard.press('Enter');

    // @FU-101: Halbfinale 1 ist beendet mit 10:2 – die Felder verschwinden, nur Halbfinale 2 läuft weiter
    await expect(feld(page, 'home')).toHaveCount(0, { timeout: 10_000 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    const karte = (page.viewportSize()?.width ?? 0) <= 768;
    if (karte) {
      await expect(page.getByTestId(`final-goals-${HF1}-home`)).toHaveText('10');
      await expect(page.getByTestId(`final-goals-${HF1}-away`)).toHaveText('2');
    } else {
      await expect(page.getByText(/10\s?:\s?2/).filter({ visible: true }).first()).toBeVisible();
    }
  });
});
