/**
 * Monitor wachhalten (B-48a): Hinweis in der Kopfzeile anstelle der Gruppen-Angabe, wenn der Browser das Anlassen des Bildschirms ablehnt oder 5 Sekunden
 * nicht antwortet. Szenario @ME-006 (beide Beispielzeilen), Gegenbeispiele: Zusage, Browser-Quelle.
 *
 * Gemessen wird am echten Layout bei 1920×1080 und 1280×720: Der Hinweis verdeckt weder Schiedsrichter-Zeile noch Stand,
 * steht oben rechts im Bild und verschwindet nach 10 Sekunden von selbst. Die Wake-Lock-Schnittstelle des Browsers
 * wird im Browser gemockt (abgelehnt, hängend, zugesagt). Läuft ohne Supabase-Stack (IndexedDB-Saat, Offline-Modus).
 */
import type { Page } from '@playwright/test';
import { test, expect, type TestOptions } from '../helpers/test-fixtures';

const PROJEKTE = ['desktop'];
type WakeLockModus = 'abgelehnt' | 'haengt' | 'zugesagt';

test.beforeEach(() => {
  test.skip(!PROJEKTE.includes(test.info().project.name), 'läuft nur im Desktop-Projekt');
});

/** Mockt navigator.wakeLock vor dem Laden der Seite. */
async function wakeLockMocken(page: Page, modus: WakeLockModus): Promise<void> {
  await page.addInitScript((m) => {
    const request = (): Promise<unknown> => {
      if (m === 'abgelehnt') { return Promise.reject(new DOMException('nicht erlaubt', 'NotAllowedError')); }
      if (m === 'haengt') { return new Promise(() => undefined); }
      return Promise.resolve({ release: () => Promise.resolve(), addEventListener: () => undefined, removeEventListener: () => undefined });
    };
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  }, modus);
}

async function turnierSaeen(seedIndexedDB: TestOptions['seedIndexedDB']): Promise<void> {
  const now = new Date().toISOString();
  const heim = '00000000-0000-4000-8000-0000000000c1';
  const gast = '00000000-0000-4000-8000-0000000000c2';
  const sr = '00000000-0000-4000-8000-0000000000c3';
  await seedIndexedDB({
    tournaments: [{
      id: 'wach-turnier', title: 'Hallencup Nord', name: 'Hallencup Nord', status: 'published', sport: 'hallenfussball',
      sportId: 'football-indoor', tournamentType: 'classic', mode: 'classic', numberOfFields: 1, numberOfTeams: 3,
      groupPhaseGameDuration: 10, placementLogic: ['points', 'goalDiff', 'goalsFor'], finals: { enabled: false },
      isKidsTournament: false, hideScoresForPublic: false, hideRankingsForPublic: false, isPublic: true,
      shareCode: 'ABC123', resultMode: 'standard', pointSystem: { win: 3, draw: 1, loss: 0 },
      groups: [{ id: 'g1', name: 'Gruppe A', teamIds: [heim, gast] }],
      teams: [{ id: heim, name: 'SV Süd', color: '#DC2626' }, { id: gast, name: 'FC Nord', color: '#FACC15' }, { id: sr, name: 'SR1', color: '#888888' }],
      matches: [{
        id: 'm7', number: 7, round: 3, teamA: heim, teamB: gast,
        slotA: { kind: 'team', teamId: heim }, slotB: { kind: 'team', teamId: gast }, homeTeamId: heim, awayTeamId: gast,
        homeScore: 10, awayScore: 0, scoreA: 10, scoreB: 0, status: 'RUNNING', matchStatus: 'running', field: 1, fieldNumber: 1,
        groupId: 'g1', group: 'A', referee: 1, scheduledTime: now, durationSeconds: 600, elapsedSeconds: 320,
        timerStartTime: now, timerElapsedSeconds: 320,
      }],
      monitors: [{
        id: 'mon-1', name: 'Hallenmonitor Halle', defaultSlideDuration: 15, transition: 'none', transitionDuration: 0,
        theme: 'dark', performanceMode: 'auto',
        slides: [{ id: 's1', type: 'live', config: { fieldId: 'field-1' }, duration: null, order: 0 }],
        createdAt: now, updatedAt: now,
      }],
      fields: [{ id: 'field-1', defaultName: 'Feld 1' }], createdAt: now, updatedAt: now,
    }],
  });
}

/** Öffnet den Monitor mit Fake-Uhr des Browsers, damit die 5 und 10 Sekunden ohne echtes Warten ablaufen. */
async function oeffneMonitor(page: Page, seedIndexedDB: TestOptions['seedIndexedDB'], hash = '#/display/wach-turnier/mon-1'): Promise<void> {
  await turnierSaeen(seedIndexedDB);
  await page.clock.install();
  await page.goto(`/${hash}`);
  await expect(page.getByText('SV Süd', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
}

/** Rechtecke von Hinweis und den geschützten Bereichen, gemessen im Browser. */
async function messe(page: Page) {
  return page.evaluate(() => {
    // Textzeilen werden an ihrem Text gemessen (Range), nicht an der Zelle, die auch leeren Platz umfasst.
    const rect = (sel: string, nurText = false) => {
      const el = document.querySelector(sel);
      if (!el) { return null; }
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = nurText ? range.getBoundingClientRect() : el.getBoundingClientRect();
      return { name: sel, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const schneidet = (a: { left: number; top: number; right: number; bottom: number }, b: { left: number; top: number; right: number; bottom: number }) =>
      a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const hinweis = rect('[data-testid="monitor-wakelock-hint"]');
    const geschuetzt = [rect('[data-testid="live-referee"]', true), rect('[data-testid="live-block-home"]'),
      rect('[data-testid="live-block-away"]'), rect('[data-testid="live-badge"]', true),
      rect('[data-testid="live-name-home"]', true), rect('[data-testid="live-name-away"]', true)]
      .filter((r): r is NonNullable<typeof r> => r !== null);
    return {
      hinweis,
      vorhanden: geschuetzt.map((g) => g.name),
      verdeckt: hinweis ? geschuetzt.filter((g) => schneidet(hinweis, g)).map((g) => g.name) : [],
      breite: window.innerWidth,
      hoehe: window.innerHeight,
    };
  });
}

for (const [breite, hoehe] of [[1920, 1080], [1280, 720], [3840, 2160]] as const) {
  test.describe(`Wachhalten-Hinweis ${breite}×${hoehe} (@ME-006)`, () => {
    test.use({ viewport: { width: breite, height: hoehe } });

    for (const [lage, modus, vorlauf] of [
      ['der Browser lässt das Anlassen des Bildschirms nicht zu', 'abgelehnt', 0],
      ['der Browser beantwortet die Anfrage 5 Sekunden lang weder mit Ja noch mit Nein', 'haengt', 5_000],
    ] as const) {
      test(`Lage „${lage}“: in der Kopfzeile, verdeckt weder Schiedsrichter-Zeile noch Stand, verschwindet nach 10 s`, async ({ page, seedIndexedDB }) => {
        await wakeLockMocken(page, modus);
        await oeffneMonitor(page, seedIndexedDB);
        if (vorlauf > 0) {
          await page.clock.runFor(vorlauf - 1_000);
          await expect(page.getByTestId('monitor-wakelock-hint')).toHaveCount(0);
          await page.clock.runFor(1_000);
        }
        const hinweis = page.getByTestId('monitor-wakelock-hint');
        await expect(hinweis).toBeVisible();
        await expect(hinweis).toContainText('Energiespar');
        await page.screenshot({ path: `${process.env.B48A_SCR ?? 'test-results'}/hinweis-${modus}-${breite}x${hoehe}.png` });

        const m = await messe(page);
        expect(m.vorhanden, 'geschützte Bereiche gefunden').toEqual(expect.arrayContaining([
          '[data-testid="live-referee"]', '[data-testid="live-block-home"]', '[data-testid="live-block-away"]']));
        expect(m.hinweis, 'Hinweis gemessen').not.toBeNull();
        const h = m.hinweis!;
        // anstelle der Gruppen-Angabe in der Kopfzeile: rechts oben, im Kopf der Live-Folie, Gruppe so lange weg
        await expect(page.locator('[data-testid="live-header"] [data-testid="monitor-wakelock-hint"]')).toHaveCount(1);
        await expect(page.getByTestId('live-group')).toHaveCount(0);
        const schriftPx = await hinweis.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        expect(schriftPx, 'Schrift mindestens 3 % der Bildhöhe').toBeGreaterThanOrEqual(m.hoehe * 0.03 - 0.5);
        expect(h.top, 'oben').toBeLessThan(m.hoehe * 0.2);
        expect(h.left, 'rechts').toBeGreaterThanOrEqual(m.breite * 0.5 - 1);
        expect(h.right).toBeLessThanOrEqual(m.breite);
        expect(h.bottom).toBeLessThanOrEqual(m.hoehe);
        expect(m.verdeckt, 'verdeckte Bereiche').toEqual([]);

        await page.clock.runFor(10_000);
        await expect(hinweis).toHaveCount(0);
        // nach 10 s steht wieder die Gruppe
        await expect(page.getByTestId('live-group')).toContainText('A');
        await expect(page.getByText('SV Süd', { exact: true }).first()).toBeVisible();
      });
    }

    test('Gegenbeispiel: bei Zusage des Browsers erscheint nie ein Hinweis', async ({ page, seedIndexedDB }) => {
      await wakeLockMocken(page, 'zugesagt');
      await oeffneMonitor(page, seedIndexedDB);
      await page.clock.runFor(6_000);
      await expect(page.getByTestId('monitor-wakelock-hint')).toHaveCount(0);
    });

    test('Gegenbeispiel: in der Browser-Quelle (/tv) erscheint auch ohne Antwort nie ein Hinweis', async ({ page, seedIndexedDB }) => {
      await wakeLockMocken(page, 'haengt');
      await turnierSaeen(seedIndexedDB);
      await page.clock.install();
      await page.goto('/#/tv');
      await page.clock.runFor(7_000);
      await expect(page.getByTestId('monitor-wakelock-hint')).toHaveCount(0);
    });
  });
}
