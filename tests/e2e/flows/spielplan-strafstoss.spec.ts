/**
 * A-25a T2-UI (b), offline (Gast, lokale Engine): Olli trägt im Spielplan 2:2 für das Halbfinale 1 ein. Die App fragt
 * nach dem Ergebnis des Strafstoßschießens; ohne Angabe bleibt „Ergebnis speichern“ gesperrt. Nach „4:3 für das
 * Heimteam“ ist das Halbfinale beendet mit 2:2 (@FU-094). Folgespiel: Vitest koSlotResolution.a25aStrafstoss.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';

const NORD = '00000000-0000-4000-8000-0000000000b1';
const SUED = '00000000-0000-4000-8000-0000000000b2';
const WEST = '00000000-0000-4000-8000-0000000000b3';
const OST = '00000000-0000-4000-8000-0000000000b4';
const HF1 = '00000000-0000-4000-8000-0000000025a1';
const FINALE = '00000000-0000-4000-8000-0000000025a2';
const TOURNAMENT = 'a25a-strafstoss-offline';

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function strafstossTurnier(): Record<string, unknown> {
  const date = tomorrow();
  const sieger = { kind: 'matchResult', matchId: HF1, role: 'winner' };
  return {
    id: TOURNAMENT, status: 'published', sport: 'football', sportId: 'football-indoor', tournamentType: 'classic', mode: 'classic',
    numberOfFields: 1, numberOfTeams: 4, numberOfGroups: 1, groupSystem: 'groupsAndFinals',
    groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, gameDuration: 10, breakDuration: 2,
    placementLogic: ['points', 'goalDifference', 'goalsFor'], finals: { enabled: true },
    finalsConfig: { preset: 'top-4', tiebreaker: 'shootout' },
    isKidsTournament: false, hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 }, title: 'Hallencup Strafstoß', ageClass: 'U12',
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
        id: FINALE, round: 2, field: 1, phase: 'final', label: 'Finale', teamA: 'TBD', teamB: WEST,
        slotA: { kind: 'pending', source: sieger }, originA: sieger, slotB: { kind: 'team', teamId: WEST },
        matchStatus: 'scheduled', scheduledTime: `${date}T10:30:00.000Z`, time: '10:30',
      },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

/** Halbfinale-Zeile der Tabelle „Finalrunde“: Olli trägt Heim und Gast ein (die Schnelleingabe startet mit dem zweiten Feld). */
async function trageEin(page: Page, heim: string, gast: string): Promise<void> {
  const row = page.getByRole('row').filter({ hasText: 'FC Nord' }).filter({ hasText: 'SV Süd' }).first();
  await expect(row).toBeVisible();
  const [feldHeim, feldGast] = [row.getByRole('spinbutton').nth(0), row.getByRole('spinbutton').nth(1)];
  await feldHeim.fill(heim);
  await feldGast.fill(gast);
}

const finaleZeile = (page: Page) => page.getByRole('row').filter({ hasText: 'TSV West' }).first();
const halbfinaleZeile = (page: Page) => page.getByRole('row').filter({ hasText: 'FC Nord' }).filter({ hasText: 'SV Süd' }).first();

test.describe('@FU-094 Spielplan: K.-o.-Unentschieden mit Strafstoßschießen eintragen (offline)', () => {
  // Befund-Vorschlag C-PHASE-LOKAL-VERLOREN: `MatchSchema` (core/models/schemas/TournamentSchema.ts) kennt kein Feld `phase`;
  // `LocalStorageRepository.loadList` entfernt es beim Laden. Ein lokal gespeichertes Halbfinale gilt dann als Gruppenspiel,
  // die Abfrage erscheint nicht. Probe mit `phase` im Schema: beide Tests grün (A25a-T2-e2e-probe-phase.log).
  test.fail(true, 'C-PHASE-LOKAL-VERLOREN: lokal geladenes Turnier verliert match.phase');

  test.beforeEach(async ({ seedIndexedDB }, testInfo) => {
    // Handy/Tablet zeigen die von Hand gesäte Finalrunde als Karten mit Preset-Platzhaltern (Saat-Problem, kein
    // Funktionsfehler); bis zum Saat-Paket nur Desktop (Tabelle „Finalrunde“). Messung 360/768: BLOCKED (Report).
    test.skip(testInfo.project.name !== 'desktop', 'Saat-Paket fehlt für Handy/Tablet');
    await seedIndexedDB({ tournaments: [strafstossTurnier()] });
  });

  test('@FU-094 2:2 im Halbfinale 1 → Abfrage → 4:3 Heimteam → beendet 2:2', async ({ page }) => {
    await page.goto(`/#/tournament/${TOURNAMENT}/schedule`);
    await page.waitForLoadState('networkidle');
    await expect(finaleZeile(page)).toContainText('Sieger Halbfinale 1');
    await trageEin(page, '2', '2');

    // Abfrage: „Ergebnis des Strafstoßschießens“, ohne Angabe gesperrt
    const dialog = page.getByTestId('result-entry-shootout-dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByRole('heading', { name: 'Ergebnis des Strafstoßschießens' })).toBeVisible();
    const save = page.getByTestId('result-entry-shootout-save');
    await expect(save).toBeDisabled();
    await expect(page.getByTestId('result-entry-shootout-hint')).toHaveText('Bitte das Ergebnis des Strafstoßschießens eintragen.');
    // Ersatzmessung für visual:metrics (BLOCKED): Haupttaste ganz im Bild, kein waagerechtes Scrollen, Bild als Anhang.
    const box = await save.boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) {
      throw new Error('Haupttaste oder Viewport nicht messbar');
    }
    expect(box.y >= 0 && box.y + box.height <= viewport.height && box.x + box.width <= viewport.width).toBe(true);
    expect(box.height).toBeGreaterThanOrEqual(56);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await test.info().attach('strafstoss-abfrage', { body: await page.screenshot(), contentType: 'image/png' });

    await page.getByTestId('result-entry-shootout-home').fill('4');
    await page.getByTestId('result-entry-shootout-away').fill('3');
    await expect(save).toBeEnabled();
    await save.click();

    await expect(dialog).toHaveCount(0);
    await expect(halbfinaleZeile(page)).toContainText('2 : 2', { timeout: 10_000 });
    // Finale mit FC Nord: belegt in src/hooks/__tests__/koSlotResolution.a25aStrafstoss.test.ts (die Hand-Saat hier
    // trifft den Resolver nicht wie ein veröffentlichtes Turnier -- Saat-Paket).
  });

  test('@FU-094 Gegenbeispiel: ohne Angabe (Abbrechen) speichert die App das Unentschieden nicht', async ({ page }) => {
    await page.goto(`/#/tournament/${TOURNAMENT}/schedule`);
    await page.waitForLoadState('networkidle');
    await trageEin(page, '2', '2');
    await page.getByTestId('result-entry-shootout-cancel').click({ timeout: 5_000 });

    await expect(page.getByTestId('result-entry-shootout-dialog')).toHaveCount(0);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(halbfinaleZeile(page)).not.toContainText('2 : 2');
    await expect(finaleZeile(page)).toContainText('Sieger Halbfinale 1');
  });
});
