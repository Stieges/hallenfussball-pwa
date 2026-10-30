/**
 * @OB-074 „Teilen“ und „Als PDF“ sind am Handy ohne Scrollen erreichbar (Grundriss: Handy 360×640 und 390×844, Turnier mit 15 Spielen).
 * Vorher: `backdrop-filter` der Karte machte sie zum Bezugsrahmen von `position: fixed`; die Leiste klebte am Kartenende (y ≈ 3500 bei 640 Höhe).
 * Gegenbeispiel: Im Bearbeiten-Modus (dort ist der Filter schon aus) bleibt die Leiste wie bisher im Fenster.
 * Bilder: Ordner aus OB074_SCR (sonst im Testergebnis-Ordner). Läuft nur im Projekt `desktop` (setzt Fenster selbst).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { buildVisualTournament } from './visual/helpers';

const ID = 'ob074-tournament';
const GERAETE = [
  { name: 'handy-360x640', width: 360, height: 640 },
  { name: 'handy-390x844', width: 390, height: 844 },
] as const;

const TEAMS = ['FC Nordstadt', 'SV Südpark', 'TSV Westtal', 'BSC Ostring', 'SG Hafen', 'VfL Mitte'].map((name, i) => ({
  id: `00000000-0000-4000-8000-0000000000b${i + 1}`,
  name,
}));

/** Jeder gegen jeden mit 6 Teams = 15 Spiele, alle geplant. */
function fuenfzehnSpiele() {
  const spiele = [];
  let runde = 0;
  for (let i = 0; i < TEAMS.length; i++) {
    for (let j = i + 1; j < TEAMS.length; j++) {
      const minuten = runde * 12;
      const uhr = `${String(9 + Math.floor(minuten / 60)).padStart(2, '0')}:${String(minuten % 60).padStart(2, '0')}`;
      runde += 1;
      spiele.push({
        id: `ob074-match-${runde}`,
        round: runde,
        teamA: TEAMS[i].id,
        teamB: TEAMS[j].id,
        field: 1,
        matchStatus: 'scheduled' as const,
        scheduledTime: `2026-03-14T${uhr}:00.000Z`,
      });
    }
  }
  return spiele;
}

interface Box { top: number; bottom: number; left: number; right: number }

async function oeffneSpielplan(page: Page, seed: (d: Record<string, unknown>) => Promise<void>) {
  const turnier = buildVisualTournament({
    id: ID,
    title: 'Nordstadt Hallencup',
    matches: fuenfzehnSpiele(),
    extra: { teams: TEAMS, numberOfTeams: 6 },
  });
  await seed({ tournaments: [turnier] });
  await page.goto(`/#/tournament/${ID}/schedule`);
  await expect(page.getByTestId('schedule-action-pdf')).toBeAttached();
  await page.waitForTimeout(600);
}

/** Orte der beiden Tasten im Fenster und die Höhe der unteren Leiste (aus dem Token, nicht festverdrahtet). */
const messe = (page: Page) =>
  page.evaluate(() => {
    const tasten = [...document.querySelectorAll<HTMLElement>('.schedule-action-buttons button')];
    const box = (el: HTMLElement | undefined): Box => {
      if (!el) {throw new Error('Taste fehlt');}
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    const teilen = tasten.find((t) => t.textContent?.trim() === 'Teilen');
    const pdf = document.querySelector<HTMLElement>('[data-testid="schedule-action-pdf"]') ?? undefined;
    const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--layout-height-bottom-nav')) || 0;
    return { fenster: { w: window.innerWidth, h: window.innerHeight }, teilen: box(teilen), pdf: box(pdf), nav };
  });

function imFensterUeberNav(m: Awaited<ReturnType<typeof messe>>) {
  for (const t of [m.teilen, m.pdf]) {
    expect(t.top).toBeGreaterThanOrEqual(0);
    expect(t.left).toBeGreaterThanOrEqual(0);
    expect(t.right).toBeLessThanOrEqual(m.fenster.w);
    expect(t.bottom).toBeLessThanOrEqual(m.fenster.h - m.nav);
  }
}

async function bild(page: Page, ordner: string, name: string) {
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${name}.png`) });
}

test.describe('@OB-074 Teilen und Als PDF am Handy ohne Scrollen', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
  });

  for (const g of GERAETE) {
    test(`@OB-074 ${g.name}: beide Tasten im Fenster über der unteren Leiste, oben und nach dem Scrollen`, async ({ page, seedIndexedDB }, testInfo) => {
      const ordner = process.env.OB074_SCR ?? testInfo.outputDir;
      await page.setViewportSize({ width: g.width, height: g.height });
      await oeffneSpielplan(page, seedIndexedDB);

      await bild(page, ordner, `leiste-${g.name}-oben`);
      imFensterUeberNav(await messe(page));

      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
      await page.waitForTimeout(200);
      imFensterUeberNav(await messe(page));

      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(200);
      imFensterUeberNav(await messe(page));
      await bild(page, ordner, `leiste-${g.name}-unten`);
    });
  }

  test('@OB-074 Gegenbeispiel: im Bearbeiten-Modus bleibt die Leiste wie bisher im Fenster', async ({ page, seedIndexedDB }, testInfo) => {
    const ordner = process.env.OB074_SCR ?? testInfo.outputDir;
    await page.setViewportSize({ width: 360, height: 640 });
    await oeffneSpielplan(page, seedIndexedDB);
    await page.getByTestId('schedule-edit-start').click();
    await page.waitForTimeout(400);
    imFensterUeberNav(await messe(page));
    await bild(page, ordner, 'leiste-handy-360x640-bearbeiten');
  });
});
