/**
 * MS1 – Vereinskürzel am Monitor (@ZM-087, @ZM-149), Playwright-Ablauf je betroffenem Bildschirm
 * (Live-Folie, Nächste Spiele, Tabelle) bei 1280×720 und 1920×1080 (T2-UI b).
 * Der volle Name steht am Monitor nicht mehr; Namen ohne Listenwort bleiben unverändert.
 */
import type { Page } from '@playwright/test';
import { test, expect, type TestOptions } from '../helpers/test-fixtures';

const TOURNAMENT_ID = 'ms1-tournament';
const MONITOR_ID = 'ms1-monitor';
const ID = (n: number): string => `00000000-0000-4000-8000-0000000000b${n}`;

const VOLL = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
const KUERZEL = 'SG FF Nordheim-Süd 1921';
const EINTRACHT = 'Eintracht Oberweiler-Niederstetten 1919';
const TSV_VOLL = 'Turn- und Sportverein Ost';

type SlideType = 'live' | 'next-matches' | 'standings';

async function seed(seedIndexedDB: TestOptions['seedIndexedDB'], slideType: SlideType): Promise<void> {
  const teams = [
    { id: ID(1), name: VOLL, group: 'A' },
    { id: ID(2), name: EINTRACHT, group: 'A' },
    { id: ID(3), name: TSV_VOLL, group: 'A' },
    { id: ID(4), name: 'FC Nord', group: 'A' },
  ];
  const match = (id: string, a: string, b: string, minute: number, extra: Record<string, unknown> = {}) => ({
    id,
    round: 1,
    teamA: a,
    teamB: b,
    slotA: { kind: 'team', teamId: a },
    slotB: { kind: 'team', teamId: b },
    field: 1,
    group: 'A',
    groupId: 'A',
    matchStatus: 'scheduled',
    scheduledTime: `2026-03-14T10:${String(minute).padStart(2, '0')}:00.000Z`,
    ...extra,
  });
  const tournament = {
    id: TOURNAMENT_ID,
    title: 'MS1 Hallencup',
    name: 'MS1 Hallencup',
    status: 'published',
    sport: 'hallenfussball',
    sportId: 'football-indoor',
    tournamentType: 'classic',
    mode: 'classic',
    numberOfFields: 1,
    numberOfTeams: 4,
    groupPhaseGameDuration: 10,
    placementLogic: ['points', 'goalDiff', 'goalsFor'],
    finals: { enabled: false },
    isKidsTournament: false,
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    resultMode: 'standard',
    pointSystem: { win: 3, draw: 1, loss: 0 },
    groups: [{ id: 'A', name: 'Gruppe A', teamIds: teams.map(t => t.id) }],
    teams,
    matches: [
      match('m1', ID(1), ID(2), 0, {
        matchStatus: 'running',
        scoreA: 1,
        scoreB: 0,
        timerStartTime: new Date().toISOString(),
        timerElapsedSeconds: 60,
      }),
      match('m2', ID(3), ID(4), 20),
      match('m3', ID(1), ID(3), 40),
      match('m4', ID(2), ID(4), 59),
    ],
    monitors: [
      {
        id: MONITOR_ID,
        name: 'Haupthalle',
        defaultSlideDuration: 60,
        transition: 'none',
        transitionDuration: 0,
        theme: 'dark',
        performanceMode: 'auto',
        slides: [{ id: 's1', type: slideType, config: slideType === 'standings' ? { groupId: 'A' } : { fieldId: 'field-1' }, duration: null, order: 0 }],
        createdAt: '2026-03-01T08:00:00.000Z',
        updatedAt: '2026-03-14T09:00:00.000Z',
      },
    ],
    fields: [{ id: 'field-1', defaultName: 'Feld 1' }],
    createdAt: '2026-03-01T08:00:00.000Z',
    updatedAt: '2026-03-14T09:00:00.000Z',
  };
  await seedIndexedDB({ tournaments: [tournament] });
}

/** Alle Teamnamen der Folie als Text (Markierung data-teamname, fachliche Rolle). */
async function teamTexte(page: Page): Promise<string> {
  await page.waitForSelector('[data-teamname]', { timeout: 15000 });
  return (await page.locator('[data-teamname]').allTextContents()).join(' | ');
}

/**
 * Ersatz-Messung (Skill visuelle-pruefung ist ohne Saat-Paket BLOCKED): jeder Teamname liegt im Bild,
 * ist nicht abgeschnitten (Text passt in seine Zelle) und zeigt keine ellipsis-Kürzung (@ZM-087, @ZM-086).
 */
async function pruefeNamenImBild(page: Page, breite: number, hoehe: number): Promise<void> {
  const befunde = await page.evaluate(({ b, h }) => {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-teamname]')).flatMap(el => {
      const r = el.getBoundingClientRect();
      const probleme: string[] = [];
      if (r.left < 0 || r.top < 0 || r.right > b + 1 || r.bottom > h + 1) { probleme.push('ausserhalb'); }
      if (el.scrollWidth > el.clientWidth + 1) { probleme.push('quer abgeschnitten'); }
      if (el.scrollHeight > el.clientHeight + 1) { probleme.push('hoch abgeschnitten'); }
      if (getComputedStyle(el).textOverflow === 'ellipsis') { probleme.push('ellipsis'); }
      return probleme.map(p => `${el.textContent ?? ''}: ${p}`);
    });
  }, { b: breite, h: hoehe });
  expect(befunde).toEqual([]);
}

for (const groesse of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test.describe(`MS1 Vereinskürzel ${groesse.width}×${groesse.height}`, () => {
    test.use({ viewport: groesse });

    test('@ZM-087 @ZM-149 Live-Folie: Kürzel nach Liste, Namen ohne Listenwort unverändert', async ({ page, seedIndexedDB }) => {
      await seed(seedIndexedDB, 'live');
      await page.goto(`/#/display/${TOURNAMENT_ID}/${MONITOR_ID}`);
      const namen = await teamTexte(page);
      expect(namen).toContain(KUERZEL);
      expect(namen).toContain(EINTRACHT);
      expect(namen).not.toContain(VOLL);
      expect(namen).not.toContain('…');
      expect(namen).not.toMatch(/GÜFÖ|SFNS/);
      await pruefeNamenImBild(page, groesse.width, groesse.height);
    });

    test('@ZM-087 @ZM-149 Nächste Spiele: Kürzel nach Liste, TSV längste Folge, kein „…“', async ({ page, seedIndexedDB }) => {
      await seed(seedIndexedDB, 'next-matches');
      await page.goto(`/#/display/${TOURNAMENT_ID}/${MONITOR_ID}`);
      const namen = await teamTexte(page);
      expect(namen).toContain(KUERZEL);
      expect(namen).toContain('TSV Ost');
      expect(namen).toContain(EINTRACHT);
      expect(namen).not.toContain(VOLL);
      expect(namen).not.toContain('Turn- und SV');
      expect(namen).not.toContain('…');
      await pruefeNamenImBild(page, groesse.width, groesse.height);
    });

    test('@ZM-087 Tabelle Gruppe A: Kürzel in der Namenszelle', async ({ page, seedIndexedDB }) => {
      await seed(seedIndexedDB, 'standings');
      await page.goto(`/#/display/${TOURNAMENT_ID}/${MONITOR_ID}`);
      const namen = await teamTexte(page);
      expect(namen).toContain(KUERZEL);
      expect(namen).not.toContain(VOLL);
      expect(namen).not.toContain('…');
      await pruefeNamenImBild(page, groesse.width, groesse.height);
    });
  });
}
