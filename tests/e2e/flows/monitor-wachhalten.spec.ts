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

type Folie = { id: string; type: string; config: Record<string, unknown>; duration: number | null; order: number };
const LIVE_FOLIE: Folie = { id: 's1', type: 'live', config: { fieldId: 'field-1' }, duration: null, order: 0 };
const QR_FOLIE: Folie = { id: 's1', type: 'qr-code', config: {}, duration: null, order: 0 };
/** Der Satz aus dem Szenario @ME-006, wörtlich. */
const GHERKIN_HINWEIS = 'Der Bildschirm kann sich nach der Energiespar-Einstellung des Geräts abschalten.';
/** Bildrand des Monitors (Standard, @ME-020). */
const RAND_PX = 48;

async function turnierSaeen(seedIndexedDB: TestOptions['seedIndexedDB'], slides: Folie[] = [LIVE_FOLIE], theme = 'dark'): Promise<void> {
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
        theme, performanceMode: 'auto',
        slides,
        createdAt: now, updatedAt: now,
      }],
      fields: [{ id: 'field-1', defaultName: 'Feld 1' }], createdAt: now, updatedAt: now,
    }],
  });
}

/** Öffnet den Monitor mit Fake-Uhr des Browsers, damit die 5 und 10 Sekunden ohne echtes Warten ablaufen. */
async function oeffneMonitor(
  page: Page, seedIndexedDB: TestOptions['seedIndexedDB'], slides: Folie[] = [LIVE_FOLIE], theme = 'dark', hash = '#/display/wach-turnier/mon-1',
): Promise<void> {
  await turnierSaeen(seedIndexedDB, slides, theme);
  await page.clock.install();
  await page.goto(`/${hash}`);
  if (slides[0].type === 'live') {
    await expect(page.getByText('SV Süd', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  } else {
    await page.waitForTimeout(1_000);
  }
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

for (const theme of ['dark', 'light'] as const) {
for (const [breite, hoehe] of [[1920, 1080], [1280, 720], [3840, 2160]] as const) {
  test.describe(`Wachhalten-Hinweis ${breite}×${hoehe} Thema ${theme} (@ME-006)`, () => {
    test.use({ viewport: { width: breite, height: hoehe } });

    for (const [lage, modus, vorlauf] of [
      ['der Browser lässt das Anlassen des Bildschirms nicht zu', 'abgelehnt', 0],
      ['der Browser beantwortet die Anfrage 5 Sekunden lang weder mit Ja noch mit Nein', 'haengt', 5_000],
    ] as const) {
      test(`Lage „${lage}“: in der Kopfzeile, verdeckt weder Schiedsrichter-Zeile noch Stand, verschwindet nach 10 s`, async ({ page, seedIndexedDB }) => {
        await wakeLockMocken(page, modus);
        await oeffneMonitor(page, seedIndexedDB, [LIVE_FOLIE], theme);
        if (vorlauf > 0) {
          await page.clock.runFor(vorlauf - 1_000);
          await expect(page.getByTestId('monitor-wakelock-hint')).toHaveCount(0);
          await page.clock.runFor(1_000);
        }
        const hinweis = page.getByTestId('monitor-wakelock-hint');
        await expect(hinweis).toBeVisible();
        await expect(hinweis).toHaveText(GHERKIN_HINWEIS);
        await page.screenshot({ path: `${process.env.B48A_SCR ?? 'test-results'}/hinweis-${modus}-${theme}-${breite}x${hoehe}.png` });

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
        // K2: ganz innerhalb des eigenen Bildrands, Rahmen vollständig (nicht abgeschnitten), eine Zeile
        expect(h.top, 'Oberkante im Bildrand').toBeGreaterThanOrEqual(RAND_PX - 0.5);
        expect(h.right, 'Rechtskante im Bildrand').toBeLessThanOrEqual(m.breite - RAND_PX + 0.5);
        expect(h.bottom - h.top, 'eine Zeile').toBeLessThan(schriftPx * 2.4);
        expect(h.right, 'rechtsbündig').toBeGreaterThan(m.breite * 0.9);
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
      await oeffneMonitor(page, seedIndexedDB, [LIVE_FOLIE], theme);
      await page.clock.runFor(6_000);
      await expect(page.getByTestId('monitor-wakelock-hint')).toHaveCount(0);
    });

    test('K1: Startfolie Zuschauer-QR (ohne Kopfzeile): Hinweis als Ecke oben rechts im Bildrand, 10 s', async ({ page, seedIndexedDB }) => {
      await wakeLockMocken(page, 'abgelehnt');
      await oeffneMonitor(page, seedIndexedDB, [QR_FOLIE], theme);
      const hinweis = page.getByTestId('monitor-wakelock-hint');
      await expect(hinweis).toBeVisible();
      await expect(hinweis).toHaveText(GHERKIN_HINWEIS);
      await expect(hinweis).toHaveAttribute('data-variant', 'corner');
      await page.screenshot({ path: `${process.env.B48A_SCR ?? 'test-results'}/hinweis-qr-startfolie-${theme}-${breite}x${hoehe}.png` });
      const m = await messe(page);
      const h = m.hinweis!;
      const schriftPx = await hinweis.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(schriftPx, 'Schrift mindestens 3 % der Bildhöhe').toBeGreaterThanOrEqual(m.hoehe * 0.03 - 0.5);
      expect(h.top, 'oben im Bildrand').toBeGreaterThanOrEqual(RAND_PX - 0.5);
      expect(h.top, 'oben im Bildrand (5 %)').toBeGreaterThanOrEqual(m.hoehe * 0.05 - 0.5);
      expect(h.right, 'rechts im Bildrand').toBeLessThanOrEqual(m.breite - RAND_PX + 0.5);
      expect(h.right, 'Kastenkante höchstens bei 95 % der Breite (@ME-067)').toBeLessThanOrEqual(m.breite * 0.95 + 0.5);
      expect(h.left, 'rechte Bildhälfte').toBeGreaterThan(m.breite * 0.4);
      await page.clock.runFor(10_000);
      await expect(hinweis).toHaveCount(0);
    });
  });
}
}

test.describe('Browser-Quelle: OBS-Kennung im User-Agent (@ME-006)', () => {
  test.use({ viewport: { width: 1920, height: 1080 }, userAgent: 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 OBS/30.0' });

  test('Gegenbeispiel: auch ohne Antwort des Browsers erscheint nie ein Hinweis, die Gruppe bleibt stehen', async ({ page, seedIndexedDB }) => {
    await wakeLockMocken(page, 'haengt');
    await oeffneMonitor(page, seedIndexedDB);
    await page.clock.runFor(7_000);
    await expect(page.getByTestId('monitor-wakelock-hint')).toHaveCount(0);
    await expect(page.getByTestId('live-group')).toContainText('A');
  });
});
