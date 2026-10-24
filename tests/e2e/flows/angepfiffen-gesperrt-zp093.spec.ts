/**
 * @ZP-093 (Befund C-ANGEPFIFFEN-TAUSCHZIEL), offline (Gast): Ein angepfiffenes Spiel lässt sich im Bearbeitungsmodus des
 * Spielplans weder per Feld-Auswahl ändern noch als Ablageziel tauschen. Spiel 1 läuft auf Feld 1, Spiel 2 ist geplant.
 * Vitest: src/components/schedule/__tests__/{SortableCards,StageSwapRejected}.zp093.test.tsx, useScheduleTabActions.zp093.test.tsx.
 */
import { test, expect } from '../helpers/test-fixtures';

const NORD = '00000000-0000-4000-8000-0000000000d1';
const SUED = '00000000-0000-4000-8000-0000000000d2';
const WEST = '00000000-0000-4000-8000-0000000000d3';
const OST = '00000000-0000-4000-8000-0000000000d4';
const SPIEL1 = '00000000-0000-4000-8000-0000000201a1';
const SPIEL2 = '00000000-0000-4000-8000-0000000201a2';
const TOURNAMENT = 'zp093-gesperrt-offline';
const BILDER = process.env.ZP093_BILDER;

function turnier(): Record<string, unknown> {
  const date = new Date().toISOString().split('T')[0];
  const spiel = (id: string, field: number, a: string, b: string, extra: Record<string, unknown>) => ({
    id, round: 1, field, phase: 'groupStage', group: 'A', teamA: a, teamB: b,
    slotA: { kind: 'team', teamId: a }, slotB: { kind: 'team', teamId: b },
    scheduledTime: `${date}T10:00:00.000Z`, time: '10:00', ...extra,
  });
  return {
    id: TOURNAMENT, status: 'published', sport: 'football', sportId: 'football-indoor', tournamentType: 'classic', mode: 'classic',
    numberOfFields: 2, numberOfTeams: 4, numberOfGroups: 1, groupSystem: 'roundRobin',
    groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, gameDuration: 10, breakDuration: 2,
    placementLogic: ['points', 'goalDifference', 'goalsFor'], finals: { enabled: false }, finalsConfig: { preset: 'none' },
    isKidsTournament: false, hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 }, title: 'Hallencup Gesperrt', ageClass: 'U12',
    date, timeSlot: '10:00 - 14:00', startDate: date, startTime: '10:00', location: { name: 'Halle Nord' },
    teams: [
      { id: NORD, name: 'FC Nord', group: 'A' }, { id: SUED, name: 'SV Süd', group: 'A' },
      { id: WEST, name: 'TSV West', group: 'A' }, { id: OST, name: 'SC Ost', group: 'A' },
    ],
    matches: [
      spiel(SPIEL1, 1, NORD, SUED, { matchStatus: 'running', scoreA: 1, scoreB: 0, timerStartTime: new Date().toISOString(), timerElapsedSeconds: 0 }),
      spiel(SPIEL2, 2, WEST, OST, { matchStatus: 'scheduled' }),
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

test.describe('@ZP-093 C-ANGEPFIFFEN-TAUSCHZIEL: laufendes Spiel im Bearbeitungsmodus (offline)', () => {
  test.beforeEach(async ({ seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [turnier()] });
  });

  test('@ZP-093 Feld-Auswahl des laufenden Spiels ist gesperrt, Ablegen darauf zeigt die Rückmeldung und die Reihenfolge bleibt', async ({ page }, testInfo) => {
    await page.goto(`/#/tournament/${TOURNAMENT}/schedule`);
    await page.getByTestId('schedule-edit-start').click();

    // Sichtbar ist je Breite nur ein Satz Karten; die Feld-Auswahlen sind nach Spielen sortiert (Spiel 1 zuerst)
    const auswahlen = page.getByRole('combobox', { name: 'Feld', exact: true }).filter({ visible: true });
    const laufend = auswahlen.first();
    const geplant = auswahlen.nth(1);
    await expect(laufend).toBeDisabled();
    await expect(geplant).toBeEnabled();
    await expect(laufend).toHaveCSS('cursor', 'not-allowed');

    const reihenfolge = (a: { x: number; y: number }, b: { x: number; y: number }) => (a.y !== b.y ? a.y < b.y : a.x < b.x);
    // Treffer 0 ist die Teilnehmerliste oben, Treffer 1 die Karte des Spiels
    const nord = page.getByText('FC Nord', { exact: true }).filter({ visible: true }).nth(1);
    const west = page.getByText('TSV West', { exact: true }).filter({ visible: true }).nth(1);
    await nord.scrollIntoViewIfNeeded();
    const vorher = await Promise.all([nord.boundingBox(), west.boundingBox()]);
    expect(reihenfolge(vorher[0]!, vorher[1]!)).toBe(true);

    // Spiel 2 (geplant) auf Spiel 1 (läuft) ziehen
    // gezogen wird am Griff des geplanten Spiels (das laufende hat statt dessen ein Schloss)
    const griff = page.getByLabel('Ziehen zum Verschieben').filter({ visible: true }).first();
    await griff.scrollIntoViewIfNeeded();
    const von = (await griff.boundingBox())!;
    const nach = (await nord.boundingBox())!;
    await page.mouse.move(von.x + von.width / 2, von.y + von.height / 2);
    await page.mouse.down();
    await page.mouse.move(von.x + 20, von.y + 20, { steps: 5 });
    await page.mouse.move(nach.x + nach.width / 2, nach.y + nach.height / 2, { steps: 15 });
    await page.mouse.up();

    await expect(page.getByText(/bleibt auf seinem Platz und Feld/)).toBeVisible();
    // die Karten gleiten nach dem Ablegen kurz zurück: auf die ruhende Reihenfolge warten
    await expect.poll(async () => {
      const [a, b] = await Promise.all([nord.boundingBox(), west.boundingBox()]);
      return a !== null && b !== null && reihenfolge(a, b);
    }).toBe(true);

    if (BILDER) {
      await page.mouse.move(0, 0);
      await page.waitForTimeout(900); // Toast ist eingeglitten
      await page.screenshot({ path: `${BILDER}/${testInfo.project.name}.png`, fullPage: false });
    }
  });
});
