/**
 * G1b, Finalrunde (offline, Gast): Speichern nur über „Ergebnis speichern“ (@FU-101, Fassung 2026-11-01), laufendes Spiel mit
 * leeren Feldern und „Spiel beenden und Ergebnis eintragen“ (@FU-112). Befund #7: Tippen von „2“ beendete das laufende
 * Halbfinale sofort mit 2:0. Tabelle (Desktop): `match-score-…`, Karte (Handy, bis 768 px): `final-score-…`.
 * Vitest: src/components/schedule/__tests__/FU-101-schnelleingabe-zweistellig.test.tsx, FinalStageSchedule.sk.test.tsx.
 * Die Rückfrage mit „Nein“ und die Rolle Helfer (@FU-113) laufen nur mit Konto und Server (Cloud-Spec, CI).
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';

const NORD = '00000000-0000-4000-8000-0000000000d1';
const SUED = '00000000-0000-4000-8000-0000000000d2';
const WEST = '00000000-0000-4000-8000-0000000000d3';
const OST = '00000000-0000-4000-8000-0000000000d4';
const HF1 = '00000000-0000-4000-8000-0000000102a1';
const HF2 = '00000000-0000-4000-8000-0000000102a2';
const TOURNAMENT = 'g1b-finalrunde-speichern';

function turnier(): Record<string, unknown> {
  const date = new Date().toISOString().split('T')[0];
  return {
    id: TOURNAMENT, status: 'published', sport: 'football', sportId: 'football-indoor', tournamentType: 'classic', mode: 'classic',
    numberOfFields: 2, numberOfTeams: 4, numberOfGroups: 1, groupSystem: 'groupsAndFinals',
    groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, gameDuration: 10, breakDuration: 2,
    placementLogic: ['points', 'goalDifference', 'goalsFor'], finals: { enabled: true },
    finalsConfig: { preset: 'top-4', tiebreaker: 'shootout' },
    isKidsTournament: false, hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 }, title: 'Hallencup Speichern', ageClass: 'U12',
    date, timeSlot: '10:00 - 14:00', startDate: date, startTime: '10:00', location: { name: 'Halle Nord' },
    teams: [{ id: NORD, name: 'FC Nord' }, { id: SUED, name: 'SV Süd' }, { id: WEST, name: 'TSV West' }, { id: OST, name: 'SC Ost' }],
    matches: [
      {
        id: HF1, round: 1, field: 1, phase: 'semifinal', label: 'Halbfinale 1', teamA: NORD, teamB: SUED,
        slotA: { kind: 'team', teamId: NORD }, slotB: { kind: 'team', teamId: SUED },
        matchStatus: 'scheduled', scheduledTime: `${date}T10:00:00.000Z`, time: '10:00',
      },
      {
        id: HF2, round: 1, field: 2, phase: 'semifinal', label: 'Halbfinale 2', teamA: WEST, teamB: OST,
        slotA: { kind: 'team', teamId: WEST }, slotB: { kind: 'team', teamId: OST },
        matchStatus: 'running', scoreA: 0, scoreB: 0, timerStartTime: new Date().toISOString(), timerElapsedSeconds: 0,
        scheduledTime: `${date}T10:00:00.000Z`, time: '10:00',
      },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

const istKarte = (page: Page) => (page.viewportSize()?.width ?? 0) <= 768;
const feld = (page: Page, id: string, seite: 'home' | 'away') => page.getByTestId(`${istKarte(page) ? 'final' : 'match'}-score-input-${id}-${seite}`);
const speichern = (page: Page, id: string) => page.getByTestId(`${istKarte(page) ? 'final' : 'match'}-score-save-${id}`);

test.describe('@FU-101 @FU-112 Finalrunde: Speichern nur über „Ergebnis speichern“ (offline)', () => {
  test.beforeEach(async ({ seedIndexedDB, page }) => {
    await seedIndexedDB({ tournaments: [turnier()] });
    await page.goto(`/#/tournament/${TOURNAMENT}/schedule`);
  });

  test('@FU-101 @FU-112 Tippen von „2“ im laufenden Halbfinale beendet nichts: Felder leer, auch nach Verlassen und Neuladen', async ({ page }) => {
    await expect(feld(page, HF2, 'home')).toHaveValue('');
    await expect(feld(page, HF2, 'away')).toHaveValue('');
    await feld(page, HF2, 'home').click();
    await page.keyboard.type('2');
    await feld(page, HF2, 'away').click(); // Feld verlassen
    await page.waitForTimeout(1500);
    await expect(speichern(page, HF2)).toBeDisabled();
    // nichts gespeichert: keine Rückfrage, kein Dialog, die Felder stehen noch (ein beendetes Spiel hätte keine)
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('result-entry-end-message')).toHaveCount(0);
    await expect(feld(page, HF2, 'home')).toHaveValue('2');
    await page.reload();
    await page.waitForLoadState('networkidle');
    // Das Spiel läuft weiter: die Felder (nur bei einem nicht beendeten Spiel) stehen noch, leer
    await expect(feld(page, HF2, 'home')).toHaveValue('');
    await expect(feld(page, HF2, 'away')).toHaveValue('');
  });

  test('@FU-112 Das laufende Halbfinale bietet „Spiel beenden und Ergebnis eintragen“ erst mit beiden Feldern an', async ({ page }) => {
    await expect(speichern(page, HF2)).toHaveText('Spiel beenden und Ergebnis eintragen');
    await expect(speichern(page, HF2)).toBeDisabled();
    await feld(page, HF2, 'home').fill('3');
    await expect(speichern(page, HF2)).toBeDisabled();
    await feld(page, HF2, 'away').fill('1');
    await expect(speichern(page, HF2)).toBeEnabled();
    const box = await speichern(page, HF2).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    const schrift = await feld(page, HF2, 'home').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(schrift).toBeGreaterThanOrEqual(16);
    expect(await feld(page, HF2, 'home').getAttribute('inputmode')).toBe('numeric');
  });

  test('@FU-101 Halbfinale 1: „1“ und „0“ tippen und das Feld verlassen speichern nichts, „Ergebnis speichern“ beendet mit 10:2', async ({ page }) => {
    await feld(page, HF1, 'away').fill('2');
    await feld(page, HF1, 'home').click();
    await page.keyboard.type('1');
    await page.keyboard.type('0');
    await expect(feld(page, HF1, 'home')).toHaveValue('10');
    await feld(page, HF1, 'away').focus(); // Feld verlassen
    await page.waitForTimeout(1500);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(feld(page, HF1, 'home')).toHaveValue('');
    // Nochmal, diesmal mit der Taste
    await feld(page, HF1, 'away').fill('2');
    await feld(page, HF1, 'home').fill('10');
    await speichern(page, HF1).click();
    await expect(feld(page, HF1, 'home')).toHaveCount(0, { timeout: 10_000 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    if (istKarte(page)) {
      await expect(page.getByTestId(`final-goals-${HF1}-home`)).toHaveText('10');
    } else {
      await expect(page.getByText(/10\s?:\s?2/).filter({ visible: true }).first()).toBeVisible();
    }
  });

  test('@FU-101 Tastatur: „3“, Tab, „1“, Enter im zweiten Feld speichert wie „Ergebnis speichern“; Enter im ersten Feld springt nur', async ({ page }) => {
    await feld(page, HF1, 'home').click();
    await page.keyboard.type('3');
    await page.keyboard.press('Enter'); // Enter im ersten Feld: springt ins zweite, speichert nichts
    await expect(feld(page, HF1, 'away')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab'); // Tab-Reihenfolge Feld 1 → Feld 2
    await expect(feld(page, HF1, 'away')).toBeFocused();
    await page.waitForTimeout(500);
    await expect(feld(page, HF1, 'home')).toHaveValue('3');
    await page.keyboard.type('1');
    await page.keyboard.press('Enter');
    await expect(feld(page, HF1, 'home')).toHaveCount(0, { timeout: 10_000 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    if (istKarte(page)) {
      await expect(page.getByTestId(`final-goals-${HF1}-home`)).toHaveText('3');
      await expect(page.getByTestId(`final-goals-${HF1}-away`)).toHaveText('1');
    } else {
      await expect(page.getByText(/3\s?:\s?1/).filter({ visible: true }).first()).toBeVisible();
    }
  });
});
