/**
 * Monitor wachhalten (B-48a, Variante B): Hinweis „Bildschirm kann ausgehen – Energiesparen prüfen“ als Ecke oben rechts, nur auf
 * Einrichtungs- und QR-Folien ohne laufendes Spiel, 10 Sekunden lang, eine Zeile. Überdeckung aller Folientypen:
 * monitor-wachhalten-ueberdeckung.spec.ts. Szenario @ME-006 (beide Beispielzeilen), Gegenbeispiele:
 * Live-Folie mit Spiel, Spielstart während der 10 Sekunden, Zusage, Browser-Quelle (OBS-Kennung).
 *
 * Gemessen wird am echten Layout bei 1920×1080, 1280×720 und 3840×2160, hell und dunkel. Die Wake-Lock-Schnittstelle
 * wird im Browser gemockt (abgelehnt, hängend, zugesagt). Läuft ohne Supabase-Stack (IndexedDB-Saat, Offline-Modus).
 */
import type { Page } from '@playwright/test';
import { test, expect, type TestOptions } from '../helpers/test-fixtures';

const PROJEKTE = ['desktop'];
type WakeLockModus = 'abgelehnt' | 'haengt' | 'zugesagt';
type Spiel = 'laeuft' | 'geplant';

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
/** Programm: QR zuerst (Live ohne Spiel wird übersprungen), dann Live auf Feld 1. */
const QR_UND_LIVE: Folie[] = [QR_FOLIE, { ...LIVE_FOLIE, id: 's2', order: 1 }];
/** Der Satz aus dem Szenario @ME-006, wörtlich. */
const GHERKIN_HINWEIS = 'Bildschirm kann ausgehen – Energiesparen prüfen';
/** IndexedDB-Ziel der Saat (src/core/storage/IndexedDBAdapter.ts, wie in den Test-Fixtures). */
const DB = { dbName: 'hallenfussball', storeName: 'cache', version: 1 };

/** Turnier mit einem Spiel auf Feld 1: läuft (Spiel 7) oder noch geplant. */
function turnierDaten(slides: Folie[], theme: string, spiel: Spiel) {
  const now = new Date().toISOString();
  const heim = '00000000-0000-4000-8000-0000000000c1';
  const gast = '00000000-0000-4000-8000-0000000000c2';
  const sr = '00000000-0000-4000-8000-0000000000c3';
  const laeuft = spiel === 'laeuft';
  return {
    id: 'wach-turnier', title: 'Hallencup Nord', name: 'Hallencup Nord', date: '2026-11-28', status: 'published', sport: 'hallenfussball',
    sportId: 'football-indoor', tournamentType: 'classic', mode: 'classic', numberOfFields: 1, numberOfTeams: 3,
    groupPhaseGameDuration: 10, placementLogic: ['points', 'goalDiff', 'goalsFor'], finals: { enabled: false },
    isKidsTournament: false, hideScoresForPublic: false, hideRankingsForPublic: false, isPublic: true,
    shareCode: 'ABC123', resultMode: 'standard', pointSystem: { win: 3, draw: 1, loss: 0 },
    groups: [{ id: 'g1', name: 'Gruppe A', teamIds: [heim, gast] }],
    teams: [{ id: heim, name: 'SV Süd', color: '#DC2626' }, { id: gast, name: 'FC Nord', color: '#FACC15' }, { id: sr, name: 'SR1', color: '#888888' }],
    matches: [{
      id: 'm7', number: 7, round: 3, teamA: heim, teamB: gast,
      slotA: { kind: 'team', teamId: heim }, slotB: { kind: 'team', teamId: gast }, homeTeamId: heim, awayTeamId: gast,
      homeScore: laeuft ? 10 : 0, awayScore: 0, scoreA: laeuft ? 10 : 0, scoreB: 0,
      status: laeuft ? 'RUNNING' : 'SCHEDULED', matchStatus: laeuft ? 'running' : 'scheduled',
      field: 1, fieldNumber: 1, groupId: 'g1', group: 'A', referee: 1, scheduledTime: now, durationSeconds: 600,
      elapsedSeconds: laeuft ? 320 : 0, timerStartTime: now, timerElapsedSeconds: laeuft ? 320 : 0,
    }],
    monitors: [{
      id: 'mon-1', name: 'Hallenmonitor Halle', defaultSlideDuration: 15, transition: 'none', transitionDuration: 0,
      theme, performanceMode: 'auto', slides, createdAt: now, updatedAt: now,
    }],
    fields: [{ id: 'field-1', defaultName: 'Feld 1' }], createdAt: now, updatedAt: now,
  };
}

async function turnierSaeen(seedIndexedDB: TestOptions['seedIndexedDB'], slides: Folie[], theme: string, spiel: Spiel): Promise<void> {
  await seedIndexedDB({ tournaments: [turnierDaten(slides, theme, spiel)] });
}

/**
 * Startet das Spiel, während der Monitor offen ist: die Saat wird im laufenden Browser neu geschrieben (ohne Reload),
 * der Monitor liest beim nächsten Abruf (5 s).
 */
async function spielStartetJetzt(page: Page, slides: Folie[], theme: string): Promise<void> {
  const daten = turnierDaten(slides, theme, 'laeuft');
  await page.evaluate(async ({ daten, db }) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(db.dbName, db.version);
      request.onerror = () => reject(new Error(String(request.error?.message)));
      request.onsuccess = () => {
        const conn = request.result;
        const tx = conn.transaction(db.storeName, 'readwrite');
        tx.objectStore(db.storeName).put({ key: 'tournaments', value: [daten] });
        tx.oncomplete = () => { conn.close(); resolve(); };
        tx.onerror = () => { conn.close(); reject(new Error(String(tx.error?.message))); };
      };
    });
  }, { daten, db: DB });
}

/** Öffnet den Monitor mit Fake-Uhr des Browsers, damit die 5 und 10 Sekunden ohne echtes Warten ablaufen. */
async function oeffneMonitor(
  page: Page, seedIndexedDB: TestOptions['seedIndexedDB'], slides: Folie[], theme: string, spiel: Spiel,
): Promise<void> {
  await turnierSaeen(seedIndexedDB, slides, theme, spiel);
  await page.clock.install();
  await page.goto('/#/display/wach-turnier/mon-1');
  if (slides[0].type === 'live' && spiel === 'laeuft') {
    await expect(page.getByTestId('live-header')).toBeVisible({ timeout: 15_000 });
  } else {
    await page.waitForTimeout(1_000);
  }
  await page.evaluate(() => document.fonts.ready);
}

/** Lage des Hinweises im Browser: Rechteck, Schriftgröße, Bildmaße. Null, wenn kein Hinweis steht. */
async function eckeMessen(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-testid="monitor-wakelock-hint"]');
    if (!el) { return null; }
    const r = el.getBoundingClientRect();
    return {
      top: r.top, right: r.right, bottom: r.bottom, left: r.left,
      schrift: parseFloat(getComputedStyle(el).fontSize),
      breite: window.innerWidth, hoehe: window.innerHeight,
    };
  });
}

for (const theme of ['dark', 'light'] as const) {
for (const [breite, hoehe] of [[1920, 1080], [1280, 720], [3840, 2160]] as const) {
  const bild = `${theme}-${breite}x${hoehe}`;
  const SCR = process.env.B48A_SCR ?? 'test-results';

  test.describe(`Wachhalten-Hinweis ${breite}×${hoehe} Thema ${theme} (@ME-006)`, () => {
    test.use({ viewport: { width: breite, height: hoehe } });

    // Startfolie ohne Spiel: Hinweis als Ecke oben rechts, 10 s (beide Lagen aus dem Szenario)
    for (const [lage, modus, vorlauf] of [
      ['der Browser lässt das Anlassen des Bildschirms nicht zu', 'abgelehnt', 0],
      ['der Browser beantwortet die Anfrage 5 Sekunden lang weder mit Ja noch mit Nein', 'haengt', 5_000],
    ] as const) {
      test(`Lage „${lage}“ auf der Zuschauer-QR-Folie: Ecke oben rechts am Bildrand, verschwindet nach 10 s`, async ({ page, seedIndexedDB }) => {
        await wakeLockMocken(page, modus);
        await oeffneMonitor(page, seedIndexedDB, [QR_FOLIE], theme, 'geplant');
        if (vorlauf > 0) {
          await page.clock.runFor(vorlauf - 1_000);
          await expect(page.getByTestId('monitor-wakelock-hint')).toHaveCount(0);
          await page.clock.runFor(1_000);
        }
        const hinweis = page.getByTestId('monitor-wakelock-hint');
        await expect(hinweis).toBeVisible();
        await expect(hinweis).toHaveText(GHERKIN_HINWEIS);
        await page.screenshot({ path: `${SCR}/hinweis-${modus}-${bild}.png` });

        const m = await eckeMessen(page);
        expect(m, 'Hinweis gemessen').not.toBeNull();
        const h = m!;
        expect(h.schrift, 'Schrift mindestens 3 % der Bildhöhe').toBeGreaterThanOrEqual(h.hoehe * 0.03 - 0.5);
        // in der Ecke des sicheren Bereichs: Rand 5 % je Seite, kein zweiter Rand (@ME-067), eine Zeile (@ME-006)
        expect(h.top, 'Oberkante genau am Bildrand (5 % der Höhe)').toBeCloseTo(h.hoehe * 0.05, 0);
        expect(h.right, 'Rechtskante genau am Bildrand (95 % der Breite)').toBeCloseTo(h.breite * 0.95, 0);
        expect(h.bottom - h.top, 'eine Zeile').toBeLessThan(h.schrift * 2);
        expect(h.left, 'rechte Bildhälfte').toBeGreaterThan(h.breite * 0.4);
        expect(h.bottom, 'innerhalb des Bildes').toBeLessThanOrEqual(h.hoehe);

        await page.clock.runFor(10_000);
        await expect(hinweis).toHaveCount(0);
      });
    }

    // Gegenbeispiel: Live-Folie mit laufendem Spiel. Nie ein Hinweis, die Kopfzeile zeigt Feld/Spiel und Gruppe.
    for (const modus of ['abgelehnt', 'haengt'] as const) {
      test(`Gegenbeispiel, Anfrage ${modus}: Live-Folie mit laufendem Spiel zeigt nie einen Hinweis, Kopfzeile bleibt`, async ({ page, seedIndexedDB }) => {
        await wakeLockMocken(page, modus);
        await oeffneMonitor(page, seedIndexedDB, [LIVE_FOLIE], theme, 'laeuft');
        await expect(page.getByTestId('live-group')).toContainText('A');
        await expect(page.getByTestId('live-info')).toContainText('1');
        await page.screenshot({ path: `${SCR}/kopfzeile-spiel-laeuft-${modus}-${bild}.png` });
        await page.clock.runFor(11_000);
        await expect(page.getByTestId('monitor-wakelock-hint')).toHaveCount(0);
        await expect(page.getByTestId('live-group')).toContainText('A');
      });
    }

    // Gegenbeispiel: Startet das Spiel während der 10 Sekunden, verschwindet der Hinweis sofort.
    test('Spiel startet während der 10 Sekunden: der Hinweis verschwindet, das Folienprogramm läuft weiter', async ({ page, seedIndexedDB }) => {
      await wakeLockMocken(page, 'abgelehnt');
      await oeffneMonitor(page, seedIndexedDB, QR_UND_LIVE, theme, 'geplant');
      const hinweis = page.getByTestId('monitor-wakelock-hint');
      await expect(hinweis).toBeVisible();
      await spielStartetJetzt(page, QR_UND_LIVE, theme);
      // Der Monitor fragt alle 5 Sekunden ab. Im Sekundentakt prüfen, bis der Hinweis weg ist (vor Ablauf der 10 s).
      let vergangen = 0;
      while (vergangen < 9_000 && (await hinweis.count()) > 0) {
        await page.clock.runFor(1_000);
        vergangen += 1_000;
        await page.waitForTimeout(150);
      }
      await expect(hinweis).toHaveCount(0);
      expect(vergangen, 'Hinweis vor Ablauf der 10 s weg').toBeLessThan(9_000);
      await expect(page.getByTestId('live-header')).toBeVisible();
      await expect(page.getByTestId('live-group')).toContainText('A');
    });

    test('Gegenbeispiel: bei Zusage des Browsers erscheint nie ein Hinweis', async ({ page, seedIndexedDB }) => {
      await wakeLockMocken(page, 'zugesagt');
      await oeffneMonitor(page, seedIndexedDB, [QR_FOLIE], theme, 'geplant');
      await page.clock.runFor(6_000);
      await expect(page.getByTestId('monitor-wakelock-hint')).toHaveCount(0);
    });
  });
}
}

test.describe('Browser-Quelle: OBS-Kennung im User-Agent (@ME-006)', () => {
  test.use({ viewport: { width: 1920, height: 1080 }, userAgent: 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 OBS/30.0' });

  test('Gegenbeispiel: auch ohne Antwort des Browsers erscheint auf einer Startfolie ohne Spiel nie ein Hinweis', async ({ page, seedIndexedDB }) => {
    await wakeLockMocken(page, 'haengt');
    await oeffneMonitor(page, seedIndexedDB, [QR_FOLIE], 'dark', 'geplant');
    await page.clock.runFor(7_000);
    await expect(page.getByTestId('monitor-wakelock-hint')).toHaveCount(0);
  });
});
