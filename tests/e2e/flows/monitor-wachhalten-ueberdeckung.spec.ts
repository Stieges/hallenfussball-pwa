/**
 * Wachhalten-Hinweis verdeckt nichts (B-48a Fixrunde 4, @ME-006, Zusammenspiel @ME-067).
 *
 * Alle Folientypen ohne laufendes Spiel, 1920×1080 und 1280×720, Thema hell und dunkel, Gruppe mit 8 Teams (hohe Tabelle):
 * - Ersatzfolien bei leerem Programm (öffentlich QR, nicht öffentlich Spielplan, auch mit 30 Spielen) und QR-Folie des Programms:
 *   Der Hinweis steht oben rechts in einer Zeile. Kein Textlauf und kein Symbol der
 *   Folie schneidet sein Rechteck, die Folie ist um seine Höhe nach unten versetzt, nach 10 Sekunden wieder oben.
 * - Text-, Spielplan-, Tabellen-, Sponsor- und Live-Folie aus dem Programm: nie ein Hinweis, keine Verschiebung.
 * Läuft ohne Supabase-Stack (IndexedDB-Saat); die 10 Sekunden laufen auf der Browser-Uhr (page.clock).
 */
import type { Page } from '@playwright/test';
import { test, expect, type TestOptions } from '../helpers/test-fixtures';

const ID = (n: number): string => `00000000-0000-4000-8000-0000000000d${n}`;
const NAMEN = [
  'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921', 'Eintracht Oberweiler-Niederstetten 1919', 'Turn- und Sportverein Ost',
  'FC Nord', 'SV Süd', 'TuS West', 'Spielvereinigung Mitte', 'Union Hafen',
];
const STAMP = '2026-03-14T09:00:00.000Z';
const BILDER = process.env.B48A_SCR ?? 'test-results';

/** id, Turnier, Folientyp, Konfiguration, erwartet einen Hinweis? `leer` = Monitor ohne Folienprogramm (Ersatzfolie). */
const FOLIEN = [
  { id: 'standings', tid: 'ue-turnier', config: { groupId: 'A' }, hinweis: false },
  { id: 'all-standings', tid: 'ue-turnier', config: {}, hinweis: false },
  { id: 'schedule-field', tid: 'ue-turnier', config: { fieldId: 'field-1' }, hinweis: false },
  { id: 'next-matches', tid: 'ue-turnier', config: { matchCount: 4 }, hinweis: false },
  { id: 'sponsor', tid: 'ue-turnier', config: { sponsorId: 'sp-1', showQrCode: true }, hinweis: false },
  {
    id: 'custom-text',
    tid: 'ue-turnier',
    config: {
      headline: 'Willkommen zum Hallencup Nord der Jugendabteilung',
      body: 'Viel Erfolg allen Mannschaften. Bitte die Hallenordnung beachten.\nSpielplan und Tabellen finden Sie am Eingang.',
    },
    hinweis: false,
  },
  // Live ohne Spiel auf Feld 1 zeigt den Rückfall (@ZM-122), aber ein Programm ist eingerichtet
  { id: 'live', tid: 'ue-turnier', config: { fieldId: 'field-1' }, hinweis: false },
  { id: 'qr-code', tid: 'ue-turnier', config: {}, hinweis: true },
] as const;
/** Monitore ohne Programm (`slides: []`): Ersatzfolie. Öffentlich QR, nicht öffentlich Spielplan (5 bzw. 30 Spiele). */
const ERSATZ = [
  { id: 'leer', tid: 'ue-turnier', name: 'Ersatz-QR (öffentlich)' },
  { id: 'leer', tid: 'ue-privat', name: 'Ersatz-Spielplan (nicht öffentlich)' },
  { id: 'leer', tid: 'ue-viele', name: 'Ersatz-Spielplan (nicht öffentlich, 30 Spiele)' },
] as const;
const FAELLE = [
  ...FOLIEN.map(f => ({ name: `Folie ${f.id}`, tid: f.tid, monitor: `mon-${f.id}`, bild: f.id, hinweis: f.hinweis })),
  ...ERSATZ.map(e => ({ name: e.name, tid: e.tid, monitor: `mon-${e.id}`, bild: `ersatz-${e.tid}`, hinweis: true })),
];

function turnierMit(tid: string, oeffentlich: boolean, anzahlSpiele: number, theme: string, monitors: unknown[]) {
  const teams = NAMEN.map((name, i) => ({ id: ID(i + 1), name, group: 'A' }));
  const paare: Array<[number, number]> = [];
  for (let i = 0; i < 8; i += 1) { for (let j = i + 1; j < 8; j += 1) { paare.push([i, j]); } }
  const match = (n: number, a: string, b: string) => ({
    id: `m${n}`, number: n, round: 1, teamA: a, teamB: b, slotA: { kind: 'team', teamId: a }, slotB: { kind: 'team', teamId: b },
    field: 1, fieldNumber: 1, group: 'A', groupId: 'A', matchStatus: 'scheduled', status: 'SCHEDULED',
    scheduledTime: `2026-03-14T${String(10 + Math.floor(n / 6)).padStart(2, '0')}:${String((n % 6) * 10).padStart(2, '0')}:00.000Z`, durationSeconds: 600,
  });
  return {
    id: tid, title: 'Hallencup Nord', name: 'Hallencup Nord', status: 'published', sport: 'hallenfussball', sportId: 'football-indoor',
    tournamentType: 'classic', mode: 'classic', numberOfFields: 1, numberOfTeams: 8, groupPhaseGameDuration: 10,
    placementLogic: ['points', 'goalDiff', 'goalsFor'], finals: { enabled: false }, isKidsTournament: false,
    hideScoresForPublic: false, hideRankingsForPublic: false, isPublic: oeffentlich, ...(oeffentlich ? { shareCode: 'ABC123' } : {}), resultMode: 'standard',
    date: '2026-03-14', timeSlot: '10:00 - 14:00', startDate: '2026-03-14', startTime: '10:00', numberOfGroups: 1, groupSystem: 'roundRobin',
    groupPhaseBreakDuration: 2, gameDuration: 10, breakDuration: 2, ageClass: 'U11', location: { name: 'Test-Halle' },
    pointSystem: { win: 3, draw: 1, loss: 0 }, groups: [{ id: 'A', name: 'Gruppe A', teamIds: teams.map(t => t.id) }], teams,
    matches: paare.slice(0, anzahlSpiele).map(([i, j], n) => match(n + 1, ID(i + 1), ID(j + 1))),
    sponsors: [{ id: 'sp-1', name: 'Bäckerei Maier', tier: 'gold', createdAt: STAMP, updatedAt: STAMP }],
    monitors: monitors.map(m => ({ ...(m as object), defaultSlideDuration: 60, transition: 'none', transitionDuration: 0, theme, performanceMode: 'auto', createdAt: STAMP, updatedAt: STAMP })),
    fields: [{ id: 'field-1', defaultName: 'Feld 1' }], createdAt: STAMP, updatedAt: STAMP,
  };
}

async function seed(seedIndexedDB: TestOptions['seedIndexedDB'], theme: string): Promise<void> {
  const leer = { id: 'mon-leer', name: 'Monitor leer', slides: [] };
  const programm = FOLIEN.map(f => ({
    id: `mon-${f.id}`, name: `Monitor ${f.id}`, slides: [{ id: 's1', type: f.id, config: f.config, duration: null, order: 0 }],
  }));
  await seedIndexedDB({
    tournaments: [
      turnierMit('ue-turnier', true, 5, theme, [...programm, leer]),
      turnierMit('ue-privat', false, 5, theme, [leer]),
      turnierMit('ue-viele', false, 28, theme, [leer]),
    ],
  });
}

/** Das Gerät lehnt das Anlassen des Bildschirms ab: der Hinweis ist fällig. */
async function anlassenAblehnen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const request = (): Promise<unknown> => Promise.reject(new DOMException('nicht erlaubt', 'NotAllowedError'));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  });
}

/** Hinweis-Rechteck, Überschneidungen mit Textläufen und Symbolen der Folie, Oberkante des Folieninhalts, Innenabstand oben. */
async function messe(page: Page) {
  return page.evaluate(() => {
    const flaeche = document.querySelector('[data-testid="monitor-slide"]')!;
    const wurzel = flaeche.firstElementChild as HTMLElement;
    const hinweis = document.querySelector('[data-testid="monitor-wakelock-hint"]');
    const h = hinweis?.getBoundingClientRect() ?? null;
    const inhalt: Array<{ name: string; r: DOMRect }> = [];
    const laeufer = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
    for (let n = laeufer.nextNode(); n; n = laeufer.nextNode()) {
      if ((n.textContent ?? '').trim() === '') { continue; }
      const bereich = document.createRange(); bereich.selectNodeContents(n);
      for (const r of Array.from(bereich.getClientRects())) { inhalt.push({ name: `Text „${(n.textContent ?? '').trim().slice(0, 30)}“`, r }); }
    }
    wurzel.querySelectorAll('svg, img, canvas').forEach(el => inhalt.push({ name: el.tagName, r: el.getBoundingClientRect() }));
    const sichtbar = inhalt.filter(({ r }) => r.width > 0 && r.height > 0);
    const schneidet = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5
      && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
    return {
      hinweis: h ? { top: h.top, right: h.right, bottom: h.bottom, left: h.left, hoehe: h.height } : null,
      ueberschneidungen: h ? sichtbar.filter(({ r }) => schneidet(h, r)).map(({ name, r }) => `${name} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`) : [],
      inhaltOben: sichtbar.length > 0 ? Math.min(...sichtbar.map(({ r }) => r.top)) : null,
      paddingOben: parseFloat(getComputedStyle(wurzel).paddingTop),
      abgeschnitten: wurzel.scrollHeight > wurzel.clientHeight + 1 || wurzel.scrollWidth > wurzel.clientWidth + 1,
    };
  });
}

for (const theme of ['dark', 'light'] as const) {
  for (const [breite, hoehe] of [[1920, 1080], [1280, 720]] as const) {
    test.describe(`Hinweis verdeckt nichts ${breite}×${hoehe} Thema ${theme} (@ME-006)`, () => {
      test.use({ viewport: { width: breite, height: hoehe } });
      test.beforeEach(() => { test.skip(test.info().project.name !== 'desktop', 'läuft nur im Projekt desktop'); });

      for (const f of FAELLE) {
        test(`${f.name}: ${f.hinweis ? 'Hinweis überschneidet nichts, Folie nach unten versetzt, danach wieder oben' : 'kein Hinweis, keine Verschiebung'}`, async ({ page, seedIndexedDB }) => {
          await anlassenAblehnen(page);
          await seed(seedIndexedDB, theme);
          await page.clock.install();
          await page.goto(`/#/display/${f.tid}/${f.monitor}`);
          await page.locator('[data-testid="monitor-slide"]').waitFor({ timeout: 15_000 });
          await page.waitForTimeout(1_000);
          await page.evaluate(() => document.fonts.ready);
          const randOben = hoehe * 0.05;
          const mit = await messe(page);

          if (!f.hinweis) {
            expect(mit.hinweis, 'kein Hinweis').toBeNull();
            expect(mit.paddingOben, 'keine Verschiebung').toBeCloseTo(randOben, 0);
            await page.screenshot({ path: `${BILDER}/ohne-${f.bild}-${theme}-${breite}x${hoehe}.png` });
            await page.clock.runFor(11_000);
            await expect(page.getByTestId('monitor-wakelock-hint')).toHaveCount(0);
            return;
          }

          expect(mit.hinweis, 'Hinweis steht').not.toBeNull();
          await page.screenshot({ path: `${BILDER}/mit-${f.bild}-${theme}-${breite}x${hoehe}.png` });
          expect(mit.ueberschneidungen, 'Hinweis ∩ Inhalt = leer').toEqual([]);
          expect(mit.inhaltOben!, 'Inhalt beginnt unter dem Hinweis').toBeGreaterThanOrEqual(mit.hinweis!.bottom - 0.5);
          expect(mit.paddingOben, 'Folie um die Höhe des Hinweises nach unten versetzt').toBeCloseTo(randOben + mit.hinweis!.hoehe, 0);
          expect(mit.abgeschnitten, 'Folie schneidet nichts ab').toBe(false);

          await page.clock.runFor(10_000);
          await expect(page.getByTestId('monitor-wakelock-hint')).toHaveCount(0);
          await page.screenshot({ path: `${BILDER}/nach-${f.bild}-${theme}-${breite}x${hoehe}.png` });
          const danach = await messe(page);
          expect(danach.paddingOben, 'danach wieder am Bildrand').toBeCloseTo(randOben, 0);
          expect(danach.inhaltOben!, 'Inhalt rückt nach oben zurück').toBeLessThan(mit.inhaltOben!);
        });
      }
    });
  }
}
