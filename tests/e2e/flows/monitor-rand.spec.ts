/**
 * MS2 – Bildrand am Monitor in Prozent (@ME-067, @ME-020), Playwright-Ablauf (T2-UI b).
 *
 * Monitor 1920×1080 und 1280×720: jede Folie hält 5 % der Breite links/rechts und 5 % der Höhe oben/unten frei,
 * Text und QR-Code liegen im sicheren Bereich; mit Rand 0 % ist nichts abgeschnitten. Adressparameter `?rand=`.
 * Monitor-Editor auf Tablet und Desktop: der eingestellte Rand erreicht den Monitor nach dem nächsten Abruf.
 * Läuft offline (Monitor liest aus IndexedDB).
 */
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect, type TestOptions } from '../helpers/test-fixtures';

const TID = 'ms2-turnier';
const ID = (n: number): string => `00000000-0000-4000-8000-0000000000c${n}`;
const NAMEN = ['Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921', 'Eintracht Oberweiler-Niederstetten 1919', 'Turn- und Sportverein Ost', 'FC Nord'];
const STAMP = '2026-03-14T09:00:00.000Z';

const FOLIEN = [
  { id: 'live', config: { fieldId: 'field-1' } },
  { id: 'standings', config: { groupId: 'A' } },
  { id: 'schedule-field', config: { fieldId: 'field-1' } },
  { id: 'next-matches', config: { matchCount: 4 } },
  { id: 'all-standings', config: {} },
  { id: 'sponsor', config: { sponsorId: 'sp-1', showQrCode: true } },
  { id: 'custom-text', config: { headline: 'Willkommen zum Hallencup', body: 'Viel Erfolg allen Mannschaften' } },
  { id: 'qr-code', config: {} },
] as const;

async function seed(seedIndexedDB: TestOptions['seedIndexedDB'], overscanPercent?: number): Promise<void> {
  const teams = NAMEN.map((name, i) => ({ id: ID(i + 1), name, group: 'A' }));
  const match = (id: string, a: string, b: string, minute: number, extra: Record<string, unknown> = {}) => ({
    id, round: 1, teamA: a, teamB: b, slotA: { kind: 'team', teamId: a }, slotB: { kind: 'team', teamId: b },
    field: 1, group: 'A', groupId: 'A', matchStatus: 'scheduled',
    scheduledTime: `2026-03-14T10:${String(minute).padStart(2, '0')}:00.000Z`, ...extra,
  });
  await seedIndexedDB({
    tournaments: [{
      id: TID, title: 'MS2 Hallencup', name: 'MS2 Hallencup', status: 'published', sport: 'hallenfussball', sportId: 'football-indoor',
      tournamentType: 'classic', mode: 'classic', numberOfFields: 1, numberOfTeams: 4, groupPhaseGameDuration: 10,
      placementLogic: ['points', 'goalDiff', 'goalsFor'], finals: { enabled: false }, isKidsTournament: false,
      hideScoresForPublic: false, hideRankingsForPublic: false, isPublic: true, shareCode: 'ABC123', resultMode: 'standard',
      date: '2026-03-14', timeSlot: '10:00 - 14:00', startDate: '2026-03-14', startTime: '10:00', numberOfGroups: 1, groupSystem: 'roundRobin',
      groupPhaseBreakDuration: 2, gameDuration: 10, breakDuration: 2, ageClass: 'U11', location: { name: 'Test-Halle' },
      pointSystem: { win: 3, draw: 1, loss: 0 }, groups: [{ id: 'A', name: 'Gruppe A', teamIds: teams.map(t => t.id) }], teams,
      matches: [
        match('m1', ID(1), ID(2), 0, { matchStatus: 'running', scoreA: 1, scoreB: 0, timerStartTime: new Date().toISOString(), timerElapsedSeconds: 60 }),
        match('m2', ID(3), ID(4), 20), match('m3', ID(1), ID(3), 40), match('m4', ID(2), ID(4), 59),
      ],
      sponsors: [{ id: 'sp-1', name: 'Bäckerei Maier', tier: 'gold', createdAt: STAMP, updatedAt: STAMP }],
      monitors: [...FOLIEN.map(f => ({
        id: `mon-${f.id}`, name: `Monitor ${f.id}`, defaultSlideDuration: 60, transition: 'none', transitionDuration: 0, theme: 'dark',
        performanceMode: 'auto', ...(overscanPercent === undefined ? {} : { overscanPercent }),
        slides: [{ id: 's1', type: f.id, config: f.config, duration: null, order: 0 }], createdAt: STAMP, updatedAt: STAMP,
      })), {
        // Normalfall: Programm mit mehreren Folien, also mit Positionspunkten (@ME-067 „jedes Symbol“)
        id: 'mon-zwei', name: 'Monitor zwei', defaultSlideDuration: 60, transition: 'none', transitionDuration: 0, theme: 'dark',
        performanceMode: 'auto', ...(overscanPercent === undefined ? {} : { overscanPercent }),
        slides: [0, 1].map(i => ({ id: `z${i}`, type: 'custom-text', config: { headline: `Folie ${i + 1}` }, duration: null, order: i })),
        createdAt: STAMP, updatedAt: STAMP,
      }],
      fields: [{ id: 'field-1', defaultName: 'Feld 1' }], createdAt: STAMP, updatedAt: STAMP,
    }],
  });
}

/**
 * Mockt navigator.wakeLock VOR dem ersten Laden der Seite (die Saat öffnet sie schon, der Monitor-Aufruf ist danach nur
 * ein Hash-Wechsel). Standard: Das Gerät sagt das Anlassen des Bildschirms zu, es gibt keinen Wachhalten-Hinweis, der die
 * Folie nach unten rückt (@ME-006). Ein Test fragt die Ablehnung ausdrücklich an und ruft das vor `seed` auf.
 */
async function wakeLockMocken(ziel: Page | BrowserContext, modus: 'zugesagt' | 'abgelehnt'): Promise<void> {
  await ziel.addInitScript((m) => {
    const request = (): Promise<unknown> => (m === 'abgelehnt'
      ? Promise.reject(new DOMException('nicht erlaubt', 'NotAllowedError'))
      : Promise.resolve({ release: () => Promise.resolve(), addEventListener: () => undefined, removeEventListener: () => undefined }));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  }, modus);
}

// im Kontext, damit auch das zweite Fenster der Editor-Tests (context.newPage) den Mock hat
test.beforeEach(async ({ context }) => { await wakeLockMocken(context, 'zugesagt'); });

async function oeffne(page: Page, folie: string, abfrage = ''): Promise<void> {
  await page.goto(`/#/display/${TID}/mon-${folie}${abfrage}`);
  await page.locator('[data-testid="monitor-slide"]').waitFor({ timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

/** Rand der Folie in Bildpunkten und alle Inhalte (Text-Läufe, Bilder, SVG) außerhalb des sicheren Bereichs. */
async function messe(page: Page, randX: number, randY: number) {
  return page.evaluate(({ rx, ry }) => {
    const flaeche = document.querySelector('[data-testid="monitor-slide"]')!;
    const wurzel = flaeche.firstElementChild as HTMLElement;
    const stil = getComputedStyle(wurzel);
    const W = window.innerWidth; const H = window.innerHeight;
    const aussen: string[] = [];
    const pruefe = (name: string, r: DOMRect) => {
      if (r.width === 0 && r.height === 0) { return; }
      if (r.left < rx - 1 || r.right > W - rx + 1 || r.top < ry - 1 || r.bottom > H - ry + 1) {
        aussen.push(`${name} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
      }
    };
    const laeufer = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
    for (let n = laeufer.nextNode(); n; n = laeufer.nextNode()) {
      if ((n.textContent ?? '').trim() === '') { continue; }
      const bereich = document.createRange(); bereich.selectNodeContents(n);
      pruefe(`Text „${(n.textContent ?? '').trim().slice(0, 30)}“`, bereich.getBoundingClientRect());
    }
    wurzel.querySelectorAll('svg, img, canvas').forEach(el => pruefe(el.tagName, el.getBoundingClientRect()));
    return {
      W, H,
      links: parseFloat(stil.paddingLeft), rechts: parseFloat(stil.paddingRight), oben: parseFloat(stil.paddingTop), unten: parseFloat(stil.paddingBottom),
      abgeschnitten: wurzel.scrollHeight > wurzel.clientHeight + 1 || wurzel.scrollWidth > wurzel.clientWidth + 1,
      aussen,
    };
  }, { rx: randX, ry: randY });
}

for (const [breite, hoehe, seitlich, oben] of [[1920, 1080, 96, 54], [1280, 720, 64, 36]] as const) {
  test.describe(`Bildrand ${breite}×${hoehe} (@ME-067)`, () => {
    test.use({ viewport: { width: breite, height: hoehe } });
    test.beforeEach(() => { test.skip(test.info().project.name !== 'desktop', 'läuft nur im Projekt desktop'); });

    for (const f of FOLIEN) {
      test(`@ME-067 ${f.id}: vorbelegter Rand 5 % = ${seitlich}/${oben} Bildpunkte, Inhalt im sicheren Bereich`, async ({ page, seedIndexedDB }) => {
        await seed(seedIndexedDB);
        await oeffne(page, f.id);
        const m = await messe(page, seitlich, oben);
        expect([m.links, m.rechts]).toEqual([seitlich, seitlich]);
        expect([m.oben, m.unten]).toEqual([oben, oben]);
        expect(m.abgeschnitten, 'Folie schneidet Inhalt ab').toBe(false);
        expect(m.aussen, 'Inhalt im Bildrand').toEqual([]);
      });

      // @ME-006: der Hinweis steht nur auf Einrichtungs- (Text) und QR-Folien; dort liegt er in der Ecke des sicheren Bereichs
      if (f.id === 'qr-code' || f.id === 'custom-text') {
        test(`@ME-067 ${f.id}: der Hinweis in der Ecke (Energiesparen) liegt im sicheren Bereich, der Inhalt rückt nach unten`, async ({ page, seedIndexedDB }) => {
          await wakeLockMocken(page, 'abgelehnt');
          await seed(seedIndexedDB);
          await oeffne(page, f.id);
          const hinweis = page.getByTestId('monitor-wakelock-hint');
          await expect(hinweis).toBeVisible({ timeout: 5_000 });
          const r = (await hinweis.boundingBox())!;
          expect(r.x).toBeGreaterThanOrEqual(seitlich - 0.5);
          expect(r.y).toBeGreaterThanOrEqual(oben - 0.5);
          expect(r.x + r.width).toBeLessThanOrEqual(breite - seitlich + 0.5);
          expect(r.y + r.height).toBeLessThanOrEqual(hoehe - oben + 0.5);
          const m = await messe(page, seitlich, oben);
          expect(m.oben, 'Folie beginnt unter dem Hinweis').toBeCloseTo(oben + r.height, 0);
          expect(m.abgeschnitten, 'Folie schneidet Inhalt ab').toBe(false);
          expect(m.aussen, 'Inhalt im Bildrand').toEqual([]);
        });
      } else {
        test(`@ME-067 Gegenbeispiel ${f.id}: auf dieser Folie erscheint kein Hinweis (@ME-006), auch bei abgelehntem Anlassen`, async ({ page, seedIndexedDB }) => {
          await wakeLockMocken(page, 'abgelehnt');
          await seed(seedIndexedDB);
          await oeffne(page, f.id);
          await page.waitForTimeout(1_500);
          await expect(page.getByTestId('monitor-wakelock-hint')).toHaveCount(0);
          expect((await messe(page, seitlich, oben)).oben).toBe(oben);
        });
      }

      test(`@ME-067 Gegenbeispiel ${f.id}: Rand 0 % lässt keinen Rand stehen, nichts ist abgeschnitten`, async ({ page, seedIndexedDB }) => {
        await seed(seedIndexedDB, 0);
        await oeffne(page, f.id);
        const m = await messe(page, 0, 0);
        expect([m.links, m.rechts, m.oben, m.unten]).toEqual([0, 0, 0, 0]);
        expect(m.abgeschnitten, 'Folie schneidet Inhalt ab').toBe(false);
        expect(m.aussen, 'Inhalt außerhalb des Bildes').toEqual([]);
      });
    }

    test(`@ME-067 Mehr-Folien-Monitor: Positionspunkte und alle Symbole liegen im sicheren Bereich (${seitlich}/${oben} Bildpunkte)`, async ({ page, seedIndexedDB }) => {
      await seed(seedIndexedDB);
      await oeffne(page, 'zwei');
      const punkte = page.getByTestId('monitor-slide-dots');
      await expect(punkte).toBeVisible();
      const r = (await punkte.boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(seitlich - 0.5);
      expect(r.y).toBeGreaterThanOrEqual(oben - 0.5);
      expect(r.x + r.width).toBeLessThanOrEqual(breite - seitlich + 0.5);
      expect(r.y + r.height).toBeLessThanOrEqual(hoehe - oben + 0.5);
      expect((await messe(page, seitlich, oben)).aussen).toEqual([]);
    });

    test('@ME-067 Gegenbeispiel Mehr-Folien-Monitor: Rand 0 % – Positionspunkte im Bild, nichts abgeschnitten', async ({ page, seedIndexedDB }) => {
      await seed(seedIndexedDB, 0);
      await oeffne(page, 'zwei');
      const r = (await page.getByTestId('monitor-slide-dots').boundingBox())!;
      expect(r.y + r.height).toBeLessThanOrEqual(hoehe + 0.5);
      expect(r.x).toBeGreaterThanOrEqual(0);
      const m = await messe(page, 0, 0);
      expect(m.abgeschnitten).toBe(false);
      expect(m.aussen).toEqual([]);
    });
  });
}

test.describe('Adressparameter ?rand= (R-MS-3)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test.beforeEach(() => { test.skip(test.info().project.name !== 'desktop', 'läuft nur im Projekt desktop'); });

  for (const [abfrage, erwartet, text] of [
    ['?rand=0', 0, '?rand=0 überschreibt den gespeicherten Rand 8 %'],
    ['?rand=3.5', 3.5, '?rand=3.5 überschreibt auf 3,5 %'],
    ['?rand=50', 8, 'Gegenbeispiel: ?rand=50 liegt außerhalb 0–10 und wird ignoriert'],
    ['?rand=abc', 8, 'Gegenbeispiel: ?rand=abc wird ignoriert'],
    ['', 8, 'ohne Parameter gilt der gespeicherte Rand 8 %'],
  ] as const) {
    test(`@ME-067 ${text}`, async ({ page, seedIndexedDB }) => {
      await seed(seedIndexedDB, 8);
      await oeffne(page, 'custom-text', abfrage);
      const m = await messe(page, 0, 0);
      expect([m.links, m.rechts]).toEqual([1280 * erwartet / 100, 1280 * erwartet / 100]);
      expect([m.oben, m.unten]).toEqual([720 * erwartet / 100, 720 * erwartet / 100]);
    });
  }

  test('@ME-067 ?rand= gilt nur für diese Sitzung: danach wieder der gespeicherte Wert, nichts wird gemerkt', async ({ page, seedIndexedDB }) => {
    await seed(seedIndexedDB, 8);
    await oeffne(page, 'custom-text', '?rand=0');
    expect((await messe(page, 0, 0)).links).toBe(0);
    // dieselbe Adresse ohne Parameter, neu geladen
    await oeffne(page, 'custom-text');
    await page.reload();
    await page.locator('[data-testid="monitor-slide"]').waitFor();
    expect((await messe(page, 0, 0)).links).toBe(102.4);
    const speicher = await page.evaluate(async () => {
      const ablage = (s: Storage) => Object.keys(s).map(k => `${k}=${s.getItem(k) ?? ''}`);
      const idb = await new Promise<string>((res) => {
        const r = indexedDB.open('hallenfussball', 1);
        r.onsuccess = () => {
          const g = r.result.transaction('cache').objectStore('cache').get('tournaments');
          g.onsuccess = () => { res(JSON.stringify(g.result)); r.result.close(); };
        };
      });
      return { eintraege: [...ablage(localStorage), ...ablage(sessionStorage)], idb };
    });
    for (const e of speicher.eintraege) { expect(e, 'kein Rand im Browser-Speicher').not.toMatch(/rand|overscan/i); }
    expect(speicher.idb).not.toContain('"overscanPercent":0');
    expect(speicher.idb).toContain('"overscanPercent":8');
  });
});

test.describe('Bildrand im Monitor-Editor (@ME-020, @ME-067)', () => {
  test.beforeEach(() => {
    test.skip(!['desktop', 'tablet-landscape', 'tablet-portrait'].includes(test.info().project.name), 'Editor: Tablet und Desktop');
  });

  test('@ME-020 Rand im Editor auf 8 % gestellt: der Monitor zeigt nach höchstens 10 Sekunden 8 %, alle Bildschirme gleich', async ({ page, seedIndexedDB }) => {
    await seed(seedIndexedDB);
    // Der Monitor läuft in einem zweiten Fenster derselben Browser-Sitzung (dieselbe IndexedDB)
    const monitor = await page.context().newPage();
    await monitor.setViewportSize({ width: 1280, height: 720 });
    await oeffne(monitor, 'custom-text');
    expect((await messe(monitor, 0, 0)).links).toBe(64);

    await page.goto(`/#/tournament/${TID}/monitors`);
    await page.getByRole('button', { name: /"Monitor custom-text" bearbeiten/ }).click();
    const regler = page.getByTestId('monitor-overscan-input');
    await expect(regler).toHaveValue('5');
    await expect(page.getByText('Bildrand (5 %)')).toBeVisible();
    await expect(page.getByText('Vorbelegung 5 % passt für die meisten Fernseher')).toBeVisible();
    await regler.fill('8');
    await expect(page.getByText('Bildrand (8 %)')).toBeVisible();
    // kein seitliches Überlaufen des Editors auf dem Gerät
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await expect.poll(async () => (await messe(monitor, 0, 0)).links, { timeout: 10_000, intervals: [500] }).toBe(102.4);
    const m = await messe(monitor, 0, 0);
    expect([m.oben, m.unten]).toEqual([57.6, 57.6]);
    const sicher = await messe(monitor, 102.4, 57.6);
    expect(sicher.abgeschnitten, 'Folie schneidet Inhalt ab').toBe(false);
    expect(sicher.aussen, 'Inhalt im Bildrand').toEqual([]);
  });

  test('@ME-020 Gegenbeispiel: ohne Änderung im Editor bleibt der Monitor-Rand bei 5 %', async ({ page, seedIndexedDB }) => {
    await seed(seedIndexedDB);
    const monitor = await page.context().newPage();
    await monitor.setViewportSize({ width: 1280, height: 720 });
    await oeffne(monitor, 'custom-text');
    await page.goto(`/#/tournament/${TID}/monitors`);
    await page.getByRole('button', { name: /"Monitor custom-text" bearbeiten/ }).click();
    await expect(page.getByTestId('monitor-overscan-input')).toHaveValue('5');
    await monitor.waitForTimeout(6_000);
    expect((await messe(monitor, 0, 0)).links).toBe(64);
  });
});
