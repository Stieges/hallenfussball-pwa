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

/**
 * Das Turnier hat nur die Finalrunde (Halbfinale 1, dann Finale): Desktop als Tabelle, Handy/Tablet als Karten ohne Rolle
 * und Test-ID. In beiden Layouts gehören die ersten zwei Eingabefelder zum Halbfinale 1, die nächsten zwei zum Finale.
 */
async function trageEin(page: Page, heim: number, gast: number): Promise<void> {
  // Erst eintragen, wenn das Turnier geladen ist (sonst setzt das Nachladen die Felder zurück).
  await expect(page.getByText('Sieger Halbfinale 1').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole('spinbutton').filter({ visible: true })).toHaveCount(4);
  await page.getByRole('spinbutton').filter({ visible: true }).nth(0).fill(String(heim));
  await page.getByRole('spinbutton').filter({ visible: true }).nth(1).fill(String(gast));
}
const ZWEI_ZWEI = /2\s?:\s?2/;

test.describe('@FU-094 Spielplan: K.-o.-Unentschieden mit Strafstoßschießen eintragen (offline)', () => {
  // C-PHASE-LOKAL-VERLOREN behoben (A-25a): `MatchSchema.phase` -- das lokal geladene Halbfinale bleibt ein K.-o.-Spiel.

  // Bis 768 px zeigt der Spielplan die Finalrunde als Karten (FinalStageSchedule, `max-width: 768px`). Seit SK (#250,
  // C-FINALRUNDE-MOBIL-EINGABE behoben) ist die Karte eintragbar und zeigt die Tore je Mannschaftszeile (@OB-064 Z.1):
  // „FC Nord 2 (4)“ / „SV Süd 2 (3)“ statt „2 : 2“. Ab 1024 px (Tabelle) steht der Stand als „2 : 2“.
  const istKarte = (page: Page) => (page.viewportSize()?.width ?? 0) <= 768;

  test.beforeEach(async ({ seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [strafstossTurnier()] });
  });

  test('@FU-094 2:2 im Halbfinale 1 → Abfrage → 4:3 Heimteam → beendet 2:2', async ({ page }) => {
    await page.goto(`/#/tournament/${TOURNAMENT}/schedule`);
    await page.waitForLoadState('networkidle');
    await trageEin(page, 2, 2);

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
    if (istKarte(page)) {
      // @OB-064 Z.1: je Zeile die Tore, der Strafstoßstand in Klammern, der Sieger fett
      await expect(page.getByTestId(`final-goals-${HF1}-home`)).toHaveText('2', { timeout: 10_000 });
      await expect(page.getByTestId(`final-goals-${HF1}-away`)).toHaveText('2');
      await expect(page.getByTestId(`final-penalty-${HF1}-home`)).toHaveText('(4)');
      await expect(page.getByTestId(`final-penalty-${HF1}-away`)).toHaveText('(3)');
      await expect(page.getByTestId(`final-name-${HF1}-home`)).toHaveAttribute('data-winner', 'true');
      await expect(page.getByTestId(`final-name-${HF1}-away`)).not.toHaveAttribute('data-winner', 'true');
    } else {
      await expect(page.getByText(ZWEI_ZWEI).filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 });
    }
    await expect(page.getByRole('spinbutton').filter({ visible: true })).toHaveCount(2); // Halbfinale beendet: nur noch das Finale hat Felder
    // Finale mit FC Nord: belegt in src/hooks/__tests__/koSlotResolution.a25aStrafstoss.test.ts (die Hand-Saat hier
    // trifft den Resolver nicht wie ein veröffentlichtes Turnier -- Saat-Paket).
  });

  test('@FU-094 Gegenbeispiel: ohne Angabe (Abbrechen) speichert die App das Unentschieden nicht', async ({ page }) => {
    await page.goto(`/#/tournament/${TOURNAMENT}/schedule`);
    await page.waitForLoadState('networkidle');
    await trageEin(page, 2, 2);
    await page.getByTestId('result-entry-shootout-cancel').click({ timeout: 5_000 });

    await expect(page.getByTestId('result-entry-shootout-dialog')).toHaveCount(0);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Sieger Halbfinale 1').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole('spinbutton').filter({ visible: true })).toHaveCount(4); // Halbfinale weiter offen
    await expect(page.getByText(ZWEI_ZWEI).filter({ visible: true })).toHaveCount(0);
    // Karten-Ansicht: kein gespeicherter Stand, also keine Torzahl je Zeile (Gegenstück zu @OB-064 Z.1)
    await expect(page.getByTestId(`final-goals-${HF1}-home`)).toHaveCount(0);
  });
});
