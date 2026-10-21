/**
 * E2E: Tafel des Live-Cockpits im Ablauf Vor Anpfiff → Live → Pause → Weiter → Abpfiff (Cockpit 2.4/2.5, T2-UI (b)).
 *
 * Szenarien: @SL-001 (Anpfiff startet die Uhr im ersten Abschnitt), @SL-004 (angehaltene Uhr steht), @SL-009/@SL-073
 * (Abpfiff auch ohne Ton sichtbar), @SL-064 (Meldezeile verdeckt Uhr und Stand nicht), @OB-021 (kein schwebender
 * Hinweis über Bedienelementen; C-COCKPIT-SOUNDHINWEIS-VERDECKT).
 */

import { test, expect } from '../helpers/test-fixtures';

import { abpfiffHalten } from '../helpers/abpfiff';
/**
 * Generate a future date string (tomorrow) in YYYY-MM-DD format
 * This ensures tournaments are categorized as "upcoming" not "finished"
 */
function getFutureDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * Create test tournament with dynamic future date
 * Must be called fresh each time to get current date
 */
function createTestTournament() {
  const futureDate = getFutureDate();
  return {
    id: 'e2e-test-tournament',
    status: 'published',
    sport: 'football',
    sportId: 'football-indoor', // Pflichtfeld im TournamentSchema (A-08f3b2)
    tournamentType: 'classic',
    mode: 'classic',
    numberOfFields: 1,
    numberOfTeams: 4,
    numberOfGroups: 1,
    groupSystem: 'roundRobin',
    groupPhaseGameDuration: 10,
    groupPhaseBreakDuration: 2,
    gameDuration: 10,
    breakDuration: 2,
    placementLogic: ['points', 'goalDifference', 'goalsFor'],
    finals: { enabled: false },
    isKidsTournament: false,
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 },
    title: 'E2E Test Turnier',
    ageClass: 'U12',
    date: futureDate,
    timeSlot: '10:00 - 14:00',
    startDate: futureDate,
    startTime: '10:00',
    location: { name: 'Test-Halle' },
    // Team-IDs als UUID (TeamIdSchema seit A-01)
    teams: [
      { id: '00000000-0000-4000-8000-0000000000e1', name: 'FC Test A' },
      { id: '00000000-0000-4000-8000-0000000000e2', name: 'FC Test B' },
      { id: '00000000-0000-4000-8000-0000000000e3', name: 'FC Test C' },
      { id: '00000000-0000-4000-8000-0000000000e4', name: 'FC Test D' },
    ],
    // Let the app generate matches from the schedule
    matches: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test.describe('Cockpit-Tafel', () => {
  test.beforeEach(async ({ page, seedIndexedDB }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Skipping on iPhone due to Safe Area emulation issues');
    await seedIndexedDB({ tournaments: [createTestTournament()] });
    await expect(page.getByText('E2E Test Turnier')).toBeVisible({ timeout: 15000 });
    await page.getByText('E2E Test Turnier').click();
    await page.getByText('Live').first().click({ force: true });
    await expect(page.getByTestId('scoreboard')).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    try {
      await page.evaluate(() => { localStorage.removeItem('tournaments'); });
    } catch {
      // Ignore cleanup errors (e.g., when test was skipped and page is about:blank)
    }
  });

  test('Vor Anpfiff steht die Anstoßzeit nur bei der Uhr, der Abzeichen-Platz bleibt leer; Anpfiff macht die Tafel live', async ({ page }) => {
    // @SL-049/@SL-050, @OB-068: die Anstoßzeit steht einmal, bei der Uhr; der Platz des Abzeichens bleibt leer
    await expect(page.getByTestId('scoreboard-state')).toBeEmpty();
    await expect(page.getByTestId('scoreboard-clock-rest')).toContainText(/\d{1,2}:\d{2}/);
    await expect(page.getByTestId('scoreboard-clock')).toContainText('Anstoß');
    await expect(page.getByTestId('scoreboard-clock-sub')).toContainText(/Spiel \d+/);

    // @SL-001: der Anpfiff startet die Uhr; die Spielzeit läuft ab 0:00
    await page.getByTestId('match-start-button').click();
    await expect(page.getByTestId('scoreboard-state')).toContainText('Live');
    await expect(page.getByTestId('scoreboard-clock-sub')).toContainText(/Spielzeit 0:0\d/);
    await expect(page.getByTestId('scoreboard-clock')).toHaveAttribute('data-steht', 'false');
  });

  test('@SL-004 Pause hält die Uhr an und markiert sie, Weiter lässt sie weiterlaufen', async ({ page }) => {
    await page.getByTestId('match-start-button').click();
    await expect(page.getByTestId('scoreboard-state')).toContainText('Live');
    await page.getByTestId('match-pause-button').click();
    await expect(page.getByTestId('scoreboard-clock')).toHaveAttribute('data-steht', 'true');
    await expect(page.getByTestId('scoreboard-clock')).toContainText('Uhr steht');
    const beiPause = await page.getByTestId('scoreboard-clock-rest').textContent();
    await page.waitForTimeout(2200);
    expect(await page.getByTestId('scoreboard-clock-rest').textContent()).toBe(beiPause);

    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByTestId('scoreboard-clock')).toHaveAttribute('data-steht', 'false');
    await expect(async () => {
      expect(await page.getByTestId('scoreboard-clock-rest').textContent()).not.toBe(beiPause);
    }).toPass({ timeout: 5000 });
  });

  test('B1 die Tafel springt nicht: gleiche Höhe laufend, pausiert und nach Weiter (Spec § 7)', async ({ page }) => {
    await page.getByTestId('match-start-button').click();
    await expect(page.getByTestId('scoreboard-state')).toContainText('Live');
    const hoehe = async () => Math.round((await page.getByTestId('scoreboard').boundingBox())!.height);
    const laeuft = await hoehe();
    await page.getByTestId('match-pause-button').click();
    await expect(page.getByTestId('scoreboard-clock')).toHaveAttribute('data-steht', 'true');
    await expect(page.getByTestId('scoreboard-clock')).toContainText('Uhr steht');
    expect(await hoehe()).toBe(laeuft);
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByTestId('scoreboard-clock')).toHaveAttribute('data-steht', 'false');
    expect(await hoehe()).toBe(laeuft);
  });

  test('N1 die Foul-Grenze „5. Foul in dieser Halbzeit“ steht in der Meldezeile vollständig, ohne „…“, und die Tafel wächst nicht', async ({ page }) => {
    await page.getByTestId('match-start-button').click();
    await expect(page.getByTestId('scoreboard-state')).toContainText('Live');
    const hoehe = async () => Math.round((await page.getByTestId('scoreboard').boundingBox())!.height);
    const vorher = await hoehe();
    for (let i = 0; i < 5; i += 1) { await page.getByTestId('foul-button-home').click(); }
    const zeile = page.getByTestId('notice-line');
    await expect(zeile).toContainText('5. Foul in dieser Halbzeit');
    const abgeschnitten = await zeile.evaluate((el) => {
      const text = el.querySelector('span:last-of-type') ?? el;
      return { ellipse: getComputedStyle(text as HTMLElement).textOverflow === 'ellipsis' && text.scrollWidth > (text as HTMLElement).clientWidth, hoch: el.scrollHeight > el.clientHeight + 1 };
    });
    expect(abgeschnitten).toEqual({ ellipse: false, hoch: false });
    expect(await hoehe()).toBe(vorher);
  });

  test('@SL-064 @OB-021 nichts liegt fest über Uhr, Stand oder Bedienelementen: keine schwebenden Hinweise', async ({ page }) => {
    await page.getByTestId('match-start-button').click();
    await expect(page.getByTestId('scoreboard-state')).toContainText('Live');
    // der frühere schwebende Hinweis „Sound für Spielende“ gibt es nicht mehr
    await expect(page.getByText('Sound für Spielende')).toHaveCount(0);
    // Meldung („Spiel angepfiffen“) steht in der Tafel, im Fluss
    const zeile = page.getByTestId('notice-line');
    await expect(zeile).toContainText('Spiel angepfiffen');
    const lage = await zeile.evaluate((el) => {
      for (let n: HTMLElement | null = el as HTMLElement; n; n = n.parentElement) {
        if (['fixed', 'absolute'].includes(getComputedStyle(n).position)) { return getComputedStyle(n).position; }
      }
      return 'im Fluss';
    });
    expect(lage).toBe('im Fluss');
    // die Tafel läuft nie über ihre Breite hinaus (auch nicht mit Meldung) und überlagert nichts seitlich
    const breite = await page.getByTestId('scoreboard').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, rechts: el.getBoundingClientRect().right, fenster: window.innerWidth }));
    expect(breite.scroll).toBeLessThanOrEqual(breite.client);
    expect(breite.rechts).toBeLessThanOrEqual(breite.fenster);
    // Uhr und Stand sind sichtbar und frei (nichts darüber)
    await page.getByTestId('scoreboard').scrollIntoViewIfNeeded();
    for (const id of ['scoreboard-clock', 'scoreboard-box-links', 'scoreboard-box-rechts']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box).not.toBeNull();
      const oben = await page.evaluate(([x, y, ziel]) => {
        const el = document.elementFromPoint(x, y);
        return !!el && !!el.closest(`[data-testid="${ziel}"]`);
      }, [box!.x + box!.width / 2, box!.y + box!.height / 2, id] as const);
      expect(oben, `${id} ist verdeckt`).toBe(true);
    }
  });

  test('@OB-065 Cockpit 360×640 und 1280×800: das Abzeichen „Live“ trägt den Puls-Punkt und bleibt im Kopf der Tafel', async ({ page }) => {
    await page.getByTestId('match-start-button').click();
    const abzeichen = page.getByTestId('scoreboard-abzeichen');
    await expect(abzeichen).toHaveAttribute('data-state', 'live');
    await expect(abzeichen).toHaveText('Live');
    await expect(abzeichen).toHaveAttribute('data-pulse', 'true');
    await expect(abzeichen.getByTestId('match-status-badge-dot')).toBeAttached();
    for (const fenster of [{ width: 360, height: 640 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(fenster);
      await expect(abzeichen).toBeVisible();
      const box = await abzeichen.boundingBox();
      expect(box, `Abzeichen bei ${fenster.width}×${fenster.height}`).not.toBeNull();
      expect(box!.height).toBeGreaterThan(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(fenster.width);
    }
  });

  test('@SL-009 @SL-073 nach dem Abpfiff steht „Ende“ im Abzeichen der Tafel (@OB-065) oder das nächste Spiel steht bereit', async ({ page }) => {
    await page.getByTestId('match-start-button').click();
    await expect(page.getByTestId('match-pause-button')).toBeVisible();
    await page.getByTestId('match-pause-button').click();
    await expect(page.getByTestId('match-resume-button')).toBeVisible();
    await abpfiffHalten(page);
    await expect(page.getByRole('alertdialog')).toHaveCount(0); // die Rückfrage ist beantwortet
    await expect(async () => {
      const text = (await page.getByTestId('scoreboard').textContent()) ?? '';
      expect(/Ende|Anstoß/.test(text)).toBe(true);
    }).toPass({ timeout: 5000 });
  });
});
