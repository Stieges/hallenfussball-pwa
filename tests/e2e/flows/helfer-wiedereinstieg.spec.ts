/**
 * A-17c-2 (T2-UI): Helfer-Wiedereinstieg, Szenarien @HE-096, @HE-099, @HE-109, @HE-110 (`2026-09-24_helfer-am-turniertag.md`).
 * Ohne Datenbank: eine eigene Vorschau der App mit Scheinadresse für den Server (`scripts/visual-metrics`, Netz-Stub), die
 * Gerätesitzung des Helfers im Speicher, der Zugangs-Index (`helper:access:v1`) und die lokalen Turniere als Saat. Nie gegen
 * Produktion (die Adresse ist fest 127.0.0.1). Läuft nur im Projekt `desktop`, die Größen setzt der Test selbst.
 *   1. Einsatz-Karte auf der Startseite (Live-Cup erst in vier Tagen, nichts läuft; Trainingsturnier von letzter Woche)
 *   2. Auswahl /helfer bei zwei laufenden Turnieren
 *   3. „Meine Turniere auf diesem Handy“ im Menü „Mehr“ des Felds
 * Je Größe 360×640 und 1280×720: Karte ohne Scrollen sichtbar, Tasten ≥ 44 px, kein waagrechtes Scrollen. Bilder: A17C2_BILDER.
 */
import { mkdirSync } from 'node:fs';
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader/Stub wie bei `npm run visual:metrics`
import { installiereSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';
// @ts-expect-error – .mjs ohne Typen
import { starteApp } from '../../../scripts/visual-metrics/app-server.mjs';
// @ts-expect-error – .mjs ohne Typen
import { STUB_URL, installiereStub } from '../../../scripts/visual-metrics/stub.mjs';

const BILDER = process.env.A17C2_BILDER;
const GROESSEN = [{ width: 360, height: 640 }, { width: 1280, height: 720 }];
const GERAET = '00000000-0000-4000-8000-0000000000aa';
const TAG = 86_400_000;
const CUP = '00000000-0000-4000-8000-00000000c0b1';
const NIKO = '00000000-0000-4000-8000-00000000a1c0';
const TRAINING = '00000000-0000-4000-8000-0000000007a1';

interface App { basisUrl: string; stop: () => Promise<void> }
let app: App;

const tag = (offset: number) => {
  const d = new Date(Date.now() + offset * TAG);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function turnier(id: string, title: string, offset: number) {
  const date = tag(offset);
  const teams = ['a', 'b', 'c', 'd'].map((n) => `00000000-0000-4000-8000-${id.slice(-4)}${n.repeat(8)}`);
  return {
    id, ownerId: GERAET, status: 'published', publishedAt: new Date().toISOString(), sport: 'football', sportId: 'football-indoor',
    tournamentType: 'classic', mode: 'classic', numberOfFields: 2, numberOfTeams: 4, numberOfGroups: 1, groupSystem: 'roundRobin',
    groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, gameDuration: 10, breakDuration: 2,
    placementLogic: ['points', 'goalDifference', 'goalsFor'], finals: { enabled: false }, isKidsTournament: false,
    hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals', pointSystem: { win: 3, draw: 1, loss: 0 },
    title, ageClass: 'U12', date, timeSlot: '10:00 - 14:00', startDate: date, startTime: '10:00', location: { name: 'Test-Halle' },
    teams: teams.map((tid, i) => ({ id: tid, name: `FC ${title.slice(0, 4)} ${'ABCD'[i]}`, group: 'A' })),
    matches: [[0, 1], [2, 3]].map(([a, b], i) => ({
      id: `00000000-0000-4000-9000-${id.slice(-4)}0000000${i}`, matchNumber: i + 1, round: 1, field: i + 1, group: 'A', phase: 'groupStage',
      slotA: { kind: 'team', teamId: teams[a] }, slotB: { kind: 'team', teamId: teams[b] }, matchStatus: 'scheduled',
      scheduledTime: `${date}T10:${String(i * 12).padStart(2, '0')}:00.000Z`,
    })),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

function eintrag(id: string, title: string, field: number, offset: number) {
  return {
    tournamentId: id, title, date: tag(offset), code: `CODE${field}${id.length}ABCDEF`, field, relation: 'accepted', closed: false,
    checkNumber: null, homeHintDismissed: true, offlineReadyAt: null, updatedAt: new Date().toISOString(),
  };
}

const zugangAntwort = (id: string, title: string, offset: number) => ({
  json: { state: 'open', relation: 'accepted', field: 2, closed: false, tournament: { id, title, date: tag(offset) } },
});

async function oeffneApp(context: BrowserContext, opts: { eintraege: ReturnType<typeof eintrag>[]; turniere: ReturnType<typeof turnier>[]; status: unknown }) {
  await installiereStub(context, { name: 'helfer-wiedereinstieg', zustand: { geraet: { id: GERAET }, einwilligung: true, rpc: { helper_access_status: opts.status } } });
  await installiereSaat(context, {
    formatVersion: 1,
    datenbanken: [{ name: 'hallenfussball', version: 1, store: 'cache', eintraege: { tournaments: opts.turniere } }],
    localStorage: { 'helper:access:v1': { version: 1, deviceUserId: GERAET, entries: opts.eintraege } },
  });
}

async function pruefeGroessen(page: Page, selektoren: string[]) {
  const werte = await page.evaluate((sel) => ({
    waagrecht: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    boxen: sel.map((s) => { const el = document.querySelector(s); const r = el?.getBoundingClientRect(); return { s, h: r?.height ?? 0, unten: r?.bottom ?? 0, rechts: r?.right ?? 0 }; }),
    innen: { w: window.innerWidth, h: window.innerHeight },
  }), selektoren);
  expect(werte.waagrecht, 'kein waagrechtes Scrollen').toBe(false);
  for (const b of werte.boxen) {
    expect(b.h, `${b.s} Höhe ≥ 44 px`).toBeGreaterThanOrEqual(44);
    expect(b.unten, `${b.s} ohne Scrollen sichtbar`).toBeLessThanOrEqual(werte.innen.h);
    expect(b.rechts, `${b.s} innerhalb der Breite`).toBeLessThanOrEqual(werte.innen.w);
  }
}

async function bild(page: Page, name: string) {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  const w = page.viewportSize()?.width ?? 0;
  await page.screenshot({ path: `${BILDER}/${name}-${w}.png` });
}

test.describe('A-17c-2 Helfer-Wiedereinstieg (Netz-Stub)', () => {
  test.describe.configure({ mode: 'serial' }); // ein Worker, ein Build der App (parallele Builds würden sich überschreiben)
  // eslint-disable-next-line no-empty-pattern -- Playwright verlangt für den ersten Parameter ein Destrukturierungsmuster
  test.beforeAll(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'eigene Größen; nur im Projekt desktop');
    test.setTimeout(300_000);
    app = await starteApp({ stubUrl: STUB_URL, log: () => undefined }) as App;
  });
  test.afterAll(async () => { await app?.stop(); });

  for (const groesse of GROESSEN) {
    test.describe(`${groesse.width}×${groesse.height}`, () => {
      test.use({ viewport: groesse, serviceWorkers: 'block' });

      test('@HE-109 Einsatz-Karte: Live-Cup in vier Tagen, Trainingsturnier von letzter Woche; ein Tipp öffnet Feld 2', async ({ page, context }) => {
        await oeffneApp(context, {
          eintraege: [eintrag(CUP, 'Live-Cup', 2, 4)],
          turniere: [turnier(CUP, 'Live-Cup', 4), turnier(TRAINING, 'Training', -7)],
          status: zugangAntwort(CUP, 'Live-Cup', 4),
        });
        await page.goto(`${app.basisUrl}/#/`);
        const karte = page.getByTestId(`helper-assignment-${CUP}`);
        await expect(karte).toBeVisible({ timeout: 20000 });
        await expect(karte).toContainText(/Du hilfst beim Live-Cup · Feld 2 · \p{L}{2}/u);
        await expect(page).toHaveURL(/#\/$/);
        await pruefeGroessen(page, [`[data-testid="helper-assignment-${CUP}"]`]);
        await bild(page, 'einsatz-karte');
        await karte.click();
        await expect(page).toHaveURL(/#\/tournament\/00000000-0000-4000-8000-00000000c0b1\/live\?f=2/);
      });

      test('@HE-099 Auswahl: zwei laufende Turniere statt Startseite, Zeilen ≥ 56 px', async ({ page, context }) => {
        await oeffneApp(context, {
          eintraege: [eintrag(CUP, 'Live-Cup', 2, 0), eintrag(NIKO, 'Nikolaus-Turnier', 1, 0)],
          turniere: [turnier(CUP, 'Live-Cup', 0), turnier(NIKO, 'Nikolaus-Turnier', 0)],
          status: { abbruch: true }, // ohne Netz gilt der gespeicherte Stand (Halle)
        });
        await page.goto(`${app.basisUrl}/#/`);
        await expect(page.getByTestId('helper-chooser')).toBeVisible({ timeout: 20000 });
        await expect(page).toHaveURL(/#\/helfer$/);
        await pruefeGroessen(page, [`[data-testid="helper-chooser-${CUP}"]`, `[data-testid="helper-chooser-${NIKO}"]`, '[data-testid="helper-chooser-home"]']);
        const hoehe = await page.getByTestId(`helper-chooser-${CUP}`).evaluate((el) => el.getBoundingClientRect().height);
        expect(hoehe).toBeGreaterThanOrEqual(56);
        await bild(page, 'auswahl');
      });

      test('@HE-110 „Meine Turniere auf diesem Handy“ im Menü „Mehr“ des Felds → Startseite mit Karte und Trainingsturnier', async ({ page, context }) => {
        await oeffneApp(context, {
          eintraege: [eintrag(CUP, 'Live-Cup', 2, 0)],
          turniere: [turnier(CUP, 'Live-Cup', 0), turnier(TRAINING, 'Training', 10)],
          status: zugangAntwort(CUP, 'Live-Cup', 0),
        });
        await page.goto(`${app.basisUrl}/#/`);
        await expect(page).toHaveURL(/#\/tournament\/00000000-0000-4000-8000-00000000c0b1\/live\?f=2/, { timeout: 20000 });
        await page.getByTestId('cockpit-more-button').click({ timeout: 20000 });
        const punkt = page.getByTestId('mehr-meine-turniere');
        await expect(punkt).toBeVisible();
        await expect(punkt).toHaveText('Meine Turniere auf diesem Handy');
        await pruefeGroessen(page, ['[data-testid="mehr-meine-turniere"]']);
        await bild(page, 'mehr-punkt');
        await punkt.click();
        await expect(page).toHaveURL(/#\/$/);
        await expect(page.getByTestId(`helper-assignment-${CUP}`)).toBeVisible();
        await expect(page.getByTestId(`tournament-card-${TRAINING}`)).toBeVisible(); // Toms eigenes Trainingsturnier (läuft nicht) steht auf der Startseite
        await bild(page, 'startseite-vom-feld');
      });

      test('@HE-110 Start direkt am Feld (ohne Startweiche): „Mehr“ → „Meine Turniere auf diesem Handy“ bleibt auf der Startseite', async ({ page, context }) => {
        await oeffneApp(context, {
          eintraege: [eintrag(CUP, 'Live-Cup', 2, 0)],
          turniere: [turnier(CUP, 'Live-Cup', 0), turnier(TRAINING, 'Training', 10)],
          status: zugangAntwort(CUP, 'Live-Cup', 0),
        });
        // wie nach dem QR-Scan, Neuladen oder direktem Link: die Adresse ist schon das Feld, die Start-Weiche auf „/“ läuft nie
        await page.goto(`${app.basisUrl}/#/tournament/${CUP}/live?f=2`);
        await page.getByTestId('cockpit-more-button').click({ timeout: 20000 });
        await page.getByTestId('mehr-meine-turniere').click();
        await expect(page.getByTestId(`helper-assignment-${CUP}`)).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(4000); // die Weiche darf nicht nachträglich ans Feld zurückleiten
        await expect(page).toHaveURL(/#\/$/);
        await expect(page.getByTestId(`tournament-card-${TRAINING}`)).toBeVisible();
      });
    });
  }
});
