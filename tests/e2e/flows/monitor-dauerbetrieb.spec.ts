/**
 * Monitor-Dauerbetrieb (B-17): Layout ohne Überlappung und ohne Scrollbalken bei 1280×720 und 1920×1080,
 * mit einem Teamnamen von 50 Zeichen inkl. Umlauten und ß; Monitorschrift = App-Schrift (Inter Variable);
 * Escape und Leertaste verlassen die Seite nicht.
 *
 * Szenarien: @ME-013 (Größen), @ZM-086 (keine Überlappung), @ME-022 (Escape), @ME-003 (keine Eingabe).
 * Benötigt keinen Supabase-Stack: der Monitor liest die Turnier-Daten aus IndexedDB (seedIndexedDB).
 */
import { test, expect, type TestOptions } from '../helpers/test-fixtures';

/** Genau 50 Zeichen, mit Umlauten und ß. */
const LANGER_TEAMNAME = 'Größenwahn Übungsteam Füßen Ösen Äpfel Ölkrug Ähre';

async function seedLiveTournament(seedIndexedDB: TestOptions['seedIndexedDB']): Promise<void> {
  const tournament = {
    id: 'dauer-turnier',
    title: 'Hallencup Nord',
    name: 'Hallencup Nord',
    status: 'published',
    sport: 'hallenfussball',
    sportId: 'football-indoor',
    tournamentType: 'classic',
    mode: 'classic',
    numberOfFields: 1,
    numberOfTeams: 2,
    groupPhaseGameDuration: 10,
    placementLogic: ['points', 'goalDiff', 'goalsFor'],
    finals: { enabled: false },
    isKidsTournament: false,
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    isPublic: true,
    shareCode: 'ABC123',
    resultMode: 'standard',
    pointSystem: { win: 3, draw: 1, loss: 0 },
    groups: [{ id: 'g1', name: 'Gruppe A', teamIds: ['t1', 't2'] }],
    teams: [
      { id: 't1', name: LANGER_TEAMNAME, color: '#DC2626' },
      { id: 't2', name: 'SV Süd', color: '#FACC15' },
    ],
    matches: [
      {
        id: 'm7',
        number: 7,
        round: 3,
        teamA: 't1',
        teamB: 't2',
        homeTeamId: 't1',
        awayTeamId: 't2',
        homeScore: 1,
        awayScore: 0,
        scoreA: 1,
        scoreB: 0,
        status: 'RUNNING',
        matchStatus: 'running',
        field: 1,
        fieldNumber: 1,
        groupId: 'g1',
        scheduledTime: new Date().toISOString(),
        durationSeconds: 600,
        elapsedSeconds: 320,
        timerStartTime: new Date().toISOString(),
        timerElapsedSeconds: 320,
      },
    ],
    monitors: [
      {
        id: 'mon-1',
        name: 'Hallenmonitor Halle',
        defaultSlideDuration: 15,
        transition: 'none',
        transitionDuration: 0,
        theme: 'dark',
        performanceMode: 'auto',
        slides: [{ id: 's1', type: 'live', config: { fieldId: 'field-1' }, duration: null, order: 0 }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    fields: [{ id: 'field-1', defaultName: 'Feld 1' }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await seedIndexedDB({ tournaments: [tournament] });
}

/** Der Live-Folie zeigt den Teamnamen gekürzt (@ZM-087); der volle Name steht im title-Attribut. */
const teamNameLocator = (page: import('@playwright/test').Page) => page.locator(`[title="${LANGER_TEAMNAME}"]`).first();

for (const [breite, hoehe] of [[1280, 720], [1920, 1080]] as const) {
  test.describe(`Layout ${breite}×${hoehe} (@ME-013, @ZM-086)`, () => {
    test.use({ viewport: { width: breite, height: hoehe } });

    test('kein Scrollbalken, keine Überlappung, Teamname nicht abgeschnitten, Monitorschrift = App-Schrift', async ({ page, seedIndexedDB }) => {
      expect(LANGER_TEAMNAME.length).toBe(50);
      await seedLiveTournament(seedIndexedDB);
      await page.goto('/#/display/dauer-turnier/mon-1');

      const name = teamNameLocator(page);
      await expect(name).toBeVisible({ timeout: 15_000 });

      const messung = await name.evaluate((el) => {
        const doc = document.documentElement;
        const r = el.getBoundingClientRect();
        const uhr = Array.from(document.querySelectorAll('body *'))
          .find((e) => e.childElementCount === 0 && /^\d{2}:\d{2}/.test(e.textContent ?? '')) as HTMLElement | undefined;
        const u = uhr?.getBoundingClientRect();
        return {
          scrollY: doc.scrollHeight - doc.clientHeight,
          scrollX: doc.scrollWidth - doc.clientWidth,
          abgeschnitten: (el as HTMLElement).scrollWidth - (el as HTMLElement).clientWidth,
          imBild: r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight,
          ueberlappt: u ? !(r.bottom <= u.top || u.bottom <= r.top) : null,
          schrift: getComputedStyle(el).fontFamily,
          interGeladen: document.fonts.check('16px "Inter Variable"'),
        };
      });

      expect(messung.scrollY, 'vertikaler Scrollbalken').toBeLessThanOrEqual(0);
      expect(messung.scrollX, 'horizontaler Scrollbalken').toBeLessThanOrEqual(0);
      expect(messung.abgeschnitten, 'Teamname abgeschnitten').toBeLessThanOrEqual(0);
      expect(messung.imBild, 'Teamname außerhalb des Bildes').toBe(true);
      expect(messung.ueberlappt, 'Teamname überlagert die Uhr').toBe(false);
      // Monitorschrift = App-Schrift (Daniel 10.10.): kein Bebas-Neue-Rückfall, kein System-Fallback.
      expect(messung.schrift.startsWith('"Inter Variable"'), messung.schrift).toBe(true);
      expect(messung.interGeladen, 'Inter Variable geladen').toBe(true);
    });
  });
}

test.describe('Tasten verlassen die Monitor-Seite nicht (@ME-022, @ME-003)', () => {
  test('Escape, Leertaste und Backspace lassen die Seite offen', async ({ page, seedIndexedDB }) => {
    await seedLiveTournament(seedIndexedDB);
    await page.goto('/#/display/dauer-turnier/mon-1');
    await expect(teamNameLocator(page)).toBeVisible({ timeout: 15_000 });

    await page.keyboard.press('Escape');
    await page.keyboard.press(' ');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('ArrowRight');

    await expect(page).toHaveURL(/#\/display\/dauer-turnier\/mon-1/);
    await expect(teamNameLocator(page)).toBeVisible();
  });
});
