/**
 * Monitor-Dauerbetrieb (B-17 Fixrunde 1): Layout und Tasten der Monitor-Seite.
 *
 * Szenarien: @ME-013 (Größen, 125 %), @ZM-086 (keine Überlappung von 720p bis 4K), @ZM-087 (Teamname bis 50
 * Zeichen vollständig, ohne „…“), @ZM-125 (Schrift nicht unter 3 % der Bildhöhe), @ME-022 (Tasten ohne Wirkung).
 *
 * Läuft ohne Supabase-Stack: der Monitor liest aus IndexedDB (seedIndexedDB), der Dev-Server startet im
 * Offline-Modus. Nur im Projekt desktop, damit die CI die Größen nicht je Gerätprofil wiederholt.
 */
import type { Page } from '@playwright/test';
import { test, expect, type TestOptions } from '../helpers/test-fixtures';
import { displayFontSizes } from '../../../src/design-tokens';

/** Genau 50 Zeichen, mit Umlauten und ß (@ZM-087). */
const LANGER_NAME = 'Größenwahn Übungsteam Füßen Ösen Äpfel Ölkrug Ähre';
/** Ein mittellanger Name, der vorher in Bebas Neue passte (Review K2). */
const MITTEL_NAME = 'Sportfreunde Lotte';
/** Ein kurzer Name (Review Fixrunde 2: muss in Vorgabegröße einzeilig stehen). */
const KURZ_NAME = 'SV Süd';

/** Projekte, in denen diese Spec läuft: Chromium (desktop) und WebKit (desktop-webkit, Safari). */
const PROJEKTE = ['desktop', 'desktop-webkit'];

test.beforeEach(() => {
  test.skip(!PROJEKTE.includes(test.info().project.name), 'läuft nur in den Desktop-Projekten');
});

async function seedLiveTournament(
  seedIndexedDB: TestOptions['seedIndexedDB'],
  heim: string = LANGER_NAME,
  gast: string = MITTEL_NAME,
): Promise<void> {
  const now = new Date().toISOString();
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
      { id: 't1', name: heim, color: '#DC2626' },
      { id: 't2', name: gast, color: '#FACC15' },
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
        homeScore: 10,
        awayScore: 0,
        scoreA: 10,
        scoreB: 0,
        status: 'RUNNING',
        matchStatus: 'running',
        field: 1,
        fieldNumber: 1,
        groupId: 'g1',
        scheduledTime: now,
        durationSeconds: 600,
        elapsedSeconds: 320,
        timerStartTime: now,
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
        createdAt: now,
        updatedAt: now,
      },
    ],
    fields: [{ id: 'field-1', defaultName: 'Feld 1' }],
    createdAt: now,
    updatedAt: now,
  };
  await seedIndexedDB({ tournaments: [tournament] });
}

/** Die Live-Folie ist da, sobald der Teamname mit vollem Namen im DOM steht. */
async function oeffneMonitor(
  page: Page,
  seedIndexedDB: TestOptions['seedIndexedDB'],
  heim: string = LANGER_NAME,
  gast: string = MITTEL_NAME,
): Promise<void> {
  await seedLiveTournament(seedIndexedDB, heim, gast);
  await page.goto('/#/display/dauer-turnier/mon-1');
  await expect(page.locator(`[title="${heim}"]`)).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

/** Schrift und Überlappung der Live-Folie, gemessen am angezeigten Text (nicht am title-Attribut). */
async function messeLiveFolie(page: Page, namen: string[], vorgabe: string) {
  return page.evaluate(({ namen, vorgabe }) => {
    type Box = { name: string; top: number; bottom: number; left: number; right: number };
    const box = (el: Element, name: string): Box => {
      const r = el.getBoundingClientRect();
      return { name, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    const leaf = (re: RegExp): Element | undefined => Array.from(document.querySelectorAll('body *'))
      .find((e) => e.childElementCount === 0 && re.test(e.textContent ?? ''));

    const teams = namen.map((n) => {
      const el = document.querySelector(`[title="${n}"]`);
      if (!(el instanceof HTMLElement)) { throw new Error(`Teamname ${n} nicht gefunden`); }
      const stil = getComputedStyle(el);
      return {
        name: n,
        text: el.textContent ?? '',
        abgeschnitten: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
        zeilenhoehe: parseFloat(stil.lineHeight) || parseFloat(stil.fontSize) * 1.2,
        höhe: el.getBoundingClientRect().height,
        schriftPx: parseFloat(stil.fontSize),
        // WebKit serialisiert ohne Anführungszeichen; die erste Schriftfamilie zählt
        family: stil.fontFamily.replace(/["']/g, ''),
        el,
      };
    });

    // Glyphen-Messung: dieselbe Zeichenkette in Inter und in einer Ausweichschrift muss verschieden breit sein.
    const messe = (family: string, text: string) => {
      const m = document.createElement('span');
      Object.assign(m.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', fontFamily: family, fontWeight: '700' });
      m.textContent = text;
      document.body.appendChild(m);
      const w = m.getBoundingClientRect().width;
      m.remove();
      return w;
    };
    const glyphen = teams.map((t) => ({
      inter: messe('"Inter Variable"', t.text),
      ausweich: messe('monospace', t.text),
    }));

    const bloecke: Box[] = [];
    const kopf = leaf(/^LIVE$/);
    if (kopf) { bloecke.push(box(kopf, 'LIVE-Kennzeichen')); }
    const feld = leaf(/^Feld 1/);
    if (feld) { bloecke.push(box(feld, 'Feld/Spiel')); }
    document.querySelectorAll('[data-position]').forEach((el) => {
      bloecke.push(box(el, `Stand ${el.getAttribute('data-position')}`));
    });
    teams.forEach((t) => bloecke.push(box(t.el, `Team ${t.name.slice(0, 12)}`)));
    const uhr = leaf(/^\d{2}:\d{2}/);
    if (uhr) { bloecke.push(box(uhr, 'Uhr')); }
    const hinweis = document.querySelector('[data-testid="monitor-wakelock-hint"]');
    if (hinweis) { bloecke.push(box(hinweis, 'Hinweis')); }

    const ueberlappungen: string[] = [];
    for (let i = 0; i < bloecke.length; i++) {
      for (let j = i + 1; j < bloecke.length; j++) {
        const a = bloecke[i]; const b = bloecke[j];
        const schneidet = a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
        if (schneidet) { ueberlappungen.push(`${a.name} ↔ ${b.name}`); }
      }
    }

    const doc = document.documentElement;
    const ausserhalb = bloecke.filter((b) => b.left < -0.5 || b.top < -0.5 || b.right > window.innerWidth + 0.5 || b.bottom > window.innerHeight + 0.5).map((b) => b.name);

    // Vorgabegröße aus dem Token, berechnet im Browser (clamp am Viewport)
    const vorgabeMessfeld = document.createElement('span');
    vorgabeMessfeld.style.fontSize = vorgabe;
    vorgabeMessfeld.textContent = 'x';
    document.body.appendChild(vorgabeMessfeld);
    const vorgabePx = parseFloat(getComputedStyle(vorgabeMessfeld).fontSize);
    vorgabeMessfeld.remove();

    return {
      vorgabePx,
      scrollY: doc.scrollHeight - doc.clientHeight,
      scrollX: doc.scrollWidth - doc.clientWidth,
      hoehe: window.innerHeight,
      teams: teams.map((t, i) => ({
        name: t.name,
        text: t.text,
        abgeschnitten: t.abgeschnitten,
        zeilen: Math.round(t.höhe / t.zeilenhoehe),
        schriftPx: t.schriftPx,
        family: t.family,
        interGlyphen: glyphen[i].inter !== glyphen[i].ausweich,
        interGeladen: Array.from(document.fonts).some((f) => f.family.replace(/["']/g, '') === 'Inter Variable' && f.status === 'loaded'),
      })),
      ueberlappungen,
      ausserhalb,
    };
  }, { namen, vorgabe });
}

const GROESSEN: Array<{ name: string; width: number; height: number; dsf?: number }> = [
  { name: '800×600', width: 800, height: 600 },
  { name: '1024×768', width: 1024, height: 768 },
  { name: '1280×720', width: 1280, height: 720 },
  { name: '1366×768', width: 1366, height: 768 },
  { name: '1920×1080', width: 1920, height: 1080 },
  { name: '2560×1440', width: 2560, height: 1440 },
  { name: '3840×2160', width: 3840, height: 2160 },
  { name: '1920×1080 bei 125 % (Viewport 1536×864)', width: 1536, height: 864, dsf: 1.25 },
];

for (const groesse of GROESSEN) {
  test.describe(`Live-Folie ${groesse.name} (@ME-013, @ZM-086, @ZM-087)`, () => {
    test.use({
      viewport: { width: groesse.width, height: groesse.height },
      deviceScaleFactor: groesse.dsf ?? 1,
    });

    test('ohne Scrollbalken, ohne Überlappung, Teamnamen vollständig, Monitorschrift = App-Schrift', async ({ page, seedIndexedDB }) => {
      expect(LANGER_NAME.length).toBe(50);
      await oeffneMonitor(page, seedIndexedDB);
      const m = await messeLiveFolie(page, [LANGER_NAME, MITTEL_NAME], displayFontSizes.teamName);

      expect(m.scrollY, 'vertikaler Scrollbalken').toBeLessThanOrEqual(0);
      expect(m.scrollX, 'horizontaler Scrollbalken').toBeLessThanOrEqual(0);
      expect(m.ausserhalb, 'Element außerhalb des Bildes').toEqual([]);
      expect(m.ueberlappungen, 'überlappende Elemente').toEqual([]);

      for (const t of m.teams) {
        expect(t.text, `${t.name}: voller Name, kein Kürzel`).toBe(t.name);
        expect(t.text, `${t.name}: keine Kürzung`).not.toContain('…');
        expect(t.abgeschnitten, `${t.name}: abgeschnitten`).toBe(false);
        expect(t.zeilen, `${t.name}: höchstens zwei Zeilen`).toBeLessThanOrEqual(2);
        expect(t.schriftPx, `${t.name}: nicht unter 3 % der Bildhöhe`).toBeGreaterThanOrEqual(m.hoehe * 0.03 - 0.5);
        // Untergrenze der Schrift: Der lange Name ist größer als 3 %, wenn er zweizeilig größer passt
        if (t.name === LANGER_NAME) {
          expect(t.schriftPx, `${t.name}: zweizeilig größer als die Untergrenze`).toBeGreaterThan(m.hoehe * 0.03 + 1);
        }
        expect(t.family.startsWith('Inter Variable,'), t.family).toBe(true);
        expect(t.interGlyphen, `${t.name}: Glyphen aus Inter`).toBe(true);
        expect(t.interGeladen, 'Inter Variable geladen').toBe(true);
      }
    });
  });
}

// Review Fixrunde 2 (K2-Regression): kurze und mittellange Namen bleiben in der Vorgabegröße, einzeilig.
// Die Vorgabe ist die Obergrenze: Ein Name bleibt in der Vorgabegröße, solange er höchstens zwei Zeilen braucht.
// „SV Süd“ ist bei 720p und 1080p einzeilig; „Sportfreunde Lotte“ ist bei 720p zweizeilig (64 px passt nicht in eine
// Zeile der 46-%-Box), bei 1080p einzeilig. Einzeilig bei 720p wäre nur unterhalb der Vorgabe möglich (Bedenken im Report).
for (const [breite, hoehe, lotteEinzeilig] of [[1280, 720, false], [1920, 1080, true]] as const) {
  test.describe(`Kurze Namen ${breite}×${hoehe} bleiben in Vorgabegröße (@ZM-125, @ZM-087)`, () => {
    test.use({ viewport: { width: breite, height: hoehe } });

    test('„SV Süd“ und „Sportfreunde Lotte“ stehen in der Vorgabegröße des Tokens, ohne Kürzung', async ({ page, seedIndexedDB }) => {
      await oeffneMonitor(page, seedIndexedDB, KURZ_NAME, MITTEL_NAME);
      const m = await messeLiveFolie(page, [KURZ_NAME, MITTEL_NAME], displayFontSizes.teamName);
      for (const t of m.teams) {
        expect(t.text, t.name).toBe(t.name);
        expect(t.abgeschnitten, `${t.name}: abgeschnitten`).toBe(false);
        expect(t.schriftPx, `${t.name}: Vorgabegröße ${m.vorgabePx} px`).toBeGreaterThanOrEqual(m.vorgabePx - 0.5);
        expect(t.zeilen, `${t.name}: höchstens zwei Zeilen`).toBeLessThanOrEqual(2);
      }
      expect(m.teams.find((t) => t.name === KURZ_NAME)?.zeilen, 'SV Süd einzeilig').toBe(1);
      if (lotteEinzeilig) {
        expect(m.teams.find((t) => t.name === MITTEL_NAME)?.zeilen, 'Sportfreunde Lotte einzeilig').toBe(1);
      }
      expect(m.ueberlappungen).toEqual([]);
    });
  });
}

test.describe('Tasten ohne Wirkung (@ME-022, @ME-003)', () => {
  test('Escape, Leertaste, Backspace und Pfeile verlassen die Seite nicht und halten oder schalten die Folie nicht', async ({ page, seedIndexedDB }) => {
    const now = new Date().toISOString();
    await seedIndexedDB({
      tournaments: [{
        id: 'dauer-turnier',
        title: 'Hallencup Nord',
        name: 'Hallencup Nord',
        status: 'published',
        sport: 'hallenfussball',
        sportId: 'football-indoor',
        tournamentType: 'classic',
        mode: 'classic',
        numberOfFields: 1,
        numberOfTeams: 0,
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
        groups: [],
        teams: [],
        matches: [],
        monitors: [{
          id: 'mon-1',
          name: 'Hallenmonitor Halle',
          defaultSlideDuration: 3,
          transition: 'none',
          transitionDuration: 0,
          theme: 'dark',
          performanceMode: 'auto',
          slides: [
            { id: 's1', type: 'custom-text', config: { headline: 'Erste Folie' }, duration: null, order: 0 },
            { id: 's2', type: 'custom-text', config: { headline: 'Zweite Folie' }, duration: null, order: 1 },
          ],
          createdAt: now,
          updatedAt: now,
        }],
        fields: [],
        createdAt: now,
        updatedAt: now,
      }],
    });
    await page.goto('/#/display/dauer-turnier/mon-1');
    await expect(page.getByText('Erste Folie', { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.keyboard.press('Escape');
    await page.keyboard.press(' ');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');

    // Sofort danach: weder Sprung noch Pausen-Badge.
    await expect(page).toHaveURL(/#\/display\/dauer-turnier\/mon-1/);
    await expect(page.getByText('Erste Folie', { exact: true })).toBeVisible();
    await expect(page.getByText('Zweite Folie', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('monitor-pause-indicator')).toHaveCount(0);

    // Die Folienfolge läuft weiter: nach der Dauer von 3 s kommt die zweite Folie.
    await expect(page.getByText('Zweite Folie', { exact: true })).toBeVisible({ timeout: 8_000 });
  });
});
