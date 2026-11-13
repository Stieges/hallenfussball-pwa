/**
 * E2E (G3-N N1b, Regel T2-UI): der Kopf des Spielplans der Turnierleitung (@ZP-113) und der Kopf-Überlauf am Tablet
 * (C-KOPF-UEBERLAUF-TABLET-LANGTEXT), offline (Gast = Turnierleitung, Wegwerf-Turnier im lokalen Speicher).
 *
 * @ZP-113 Eckdaten nicht als Karte mit acht Zeilen, über der Liste „Spiele · Beginn … Uhr · Ende etwa … Uhr“, Teilnehmer eingeklappt als
 * „Teilnehmer (4)“ und mit einem Tipp aufgeklappt, am Laptop ohne Wischen erreichbar; die erste Spielzeile liegt nach höchstens einmal Wischen
 * ganz im Bild. Befund: bei 768 Bildpunkten Breite und 30 % längeren Texten wächst die Seite nicht über das Fenster hinaus (Kopf bricht um).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { animationenFertig } from '../helpers/animationenFertig';
import { cup, ID, NAMEN, NAME_50 } from '../helpers/laptopCup';
// @ts-expect-error – .mjs ohne Typen; die echten Messfunktionen von `npm run visual:metrics`
import { messeSeite, dehneTexte } from '../../../scripts/visual-metrics/browser-messung.mjs';

interface Grenzwert { id: string; typ: string; wert: unknown; geltung: string[]; typJeArt?: Record<string, string> }
const GW = JSON.parse(readFileSync(join(process.cwd(), 'scripts/visual-metrics/grenzwerte.json'), 'utf8')) as { grenzwerte: Grenzwert[] };

function grenzen(art: string): { g: Record<string, unknown>; hart: Set<string> } {
  const g: Record<string, unknown> = {};
  const hart = new Set<string>();
  for (const e of GW.grenzwerte) {
    if (!e.geltung.includes(art) || e.id.startsWith('gate.') || e.id.startsWith('langtext.') || e.id.startsWith('monitor.') || e.id.startsWith('overscan.')) { continue; }
    g[e.id] = e.wert;
    if ((e.typJeArt?.[art] ?? e.typ) === 'HART') { hart.add(e.id); }
  }
  return { g, hart };
}

/** HART-Befunde der Messung wie `npm run visual:metrics` (nur Überlauf), nach Langtext-Dehnung */
async function ueberlaeufe(page: Page, art: string): Promise<string[]> {
  await page.evaluate(dehneTexte, { dehnung: 0.3, teamname: NAME_50, teamSelektor: '[data-teamname]' });
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const { g, hart } = grenzen(art);
  const m: { befunde: { metrik: string; selektor: string; ist: string }[] } = await page.evaluate(messeSeite, {
    art, g, randPx: 0, monitorSchrift: null, ebuPruefen: false, extraInhalte: [],
    primarySelektor: '[data-primary], [data-variant="primary"]',
  });
  return m.befunde.filter((b) => hart.has(b.metrik) && b.metrik.startsWith('ueberlauf')).map((b) => `${b.metrik} ${b.selektor} ${b.ist}`);
}

test.describe('@ZP-113 Kopf des Spielplans der Turnierleitung', () => {
  test.beforeEach(async ({ seedIndexedDB }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Safe-Area-Emulation stört die Klicks');
    await seedIndexedDB({ tournaments: [cup({ namen: [NAME_50, ...NAMEN.slice(1)] })] });
  });

  test('@ZP-113 Handy 360×640: keine Eckdaten-Karte, Listenkopf mit Beginn und Ende, Teilnehmer eingeklappt und mit einem Tipp offen', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/#/tournament/${ID}/schedule`);
    await expect(page.getByTestId('schedule-list-head')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Veranstaltungsort')).toHaveCount(0);
    await expect(page.getByText('Ende (ca.):')).toHaveCount(0);
    await expect(page.getByTestId('schedule-list-head')).toContainText(/^Spiele/);
    await expect(page.getByTestId('schedule-list-times')).toHaveText(/^Beginn \d{2}:\d{2} Uhr · Ende etwa \d{2}:\d{2} Uhr$/);
    const toggle = page.getByTestId('public-participants-toggle');
    await expect(toggle).toHaveText(/Teilnehmer \(4\)/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('public-participants-list')).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('public-participants-list')).toContainText(NAME_50);
  });

  test('@ZP-113 die erste Spielzeile liegt nach höchstens einmal Wischen ganz im Bild (360×640)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/#/tournament/${ID}/schedule`);
    const erste = page.locator('[data-match-card]:visible').first();
    await expect(erste).toBeVisible({ timeout: 15_000 });
    await animationenFertig(page);
    const box = (await erste.boundingBox())!;
    const scrollY = await page.evaluate(() => window.scrollY);
    // Ein Wisch bringt das Fenster um seine Höhe weiter: der Unterrand der ersten Zeile darf höchstens bei zweimal der Fensterhöhe liegen
    expect(box.y + scrollY + box.height, 'Unterkante der ersten Spielzeile (Seitenkoordinate)').toBeLessThanOrEqual(2 * 640);
  });

  test('@ZP-113 Gegenbeispiel Laptop: die Teilnehmer sind ohne Wischen erreichbar (Taste im ersten Bild)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/#/tournament/${ID}/schedule`);
    const toggle = page.getByTestId('public-participants-toggle');
    await expect(toggle).toBeVisible({ timeout: 15_000 });
    await animationenFertig(page);
    const box = (await toggle.boundingBox())!;
    expect(box.y + box.height, 'Teilnehmer-Taste liegt im ersten Bild').toBeLessThanOrEqual(900);
  });

  test('C-KOPF-UEBERLAUF-TABLET-LANGTEXT 768×1024 mit 30 % längeren Texten: Kopf bricht um, kein Überlauf, Seite nicht breiter als das Fenster', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`/#/tournament/${ID}/schedule`);
    await expect(page.getByTestId('management-header-actions')).toBeVisible({ timeout: 15_000 });
    await animationenFertig(page);
    expect(await ueberlaeufe(page, 'tablet')).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('@ZP-113 Handy: die Werkzeugleiste unter der Karte steht bündig mit Karte, Filterzeile und Liste (nicht 24 px eingerückt)', async ({ page }) => {
    for (const [w, h] of [[360, 640], [390, 844]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`/#/tournament/${ID}/schedule`);
      await expect(page.getByTestId('schedule-current')).toBeVisible({ timeout: 15_000 });
      await animationenFertig(page);
      const links = async (id: string) => (await page.getByTestId(id).boundingBox())!.x;
      const karte = await links('schedule-current');
      const bearbeiten = await links('schedule-edit-start');
      expect(Math.abs(bearbeiten - karte), `${String(w)} px: Bearbeiten-Taste bündig mit der Karte`).toBeLessThanOrEqual(1);
      expect(Math.abs((await links('schedule-filter-bar')) - karte), `${String(w)} px: Filterzeile bündig`).toBeLessThanOrEqual(1);
    }
  });

  test('@ZP-113 Bearbeiten-Modus am Handy 360×640: keine Karte, Listenkopf und Teilnehmer bleiben, kein waagerechtes Scrollen', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/#/tournament/${ID}/schedule`);
    await expect(page.getByTestId('schedule-current')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('schedule-edit-start').click();
    await expect(page.getByTestId('schedule-current')).toHaveCount(0);
    await expect(page.getByTestId('schedule-list-head')).toBeVisible();
    await expect(page.getByTestId('public-participants-toggle')).toBeVisible();
    await animationenFertig(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('@ZP-113 die erste Spielzeile liegt auch bei 390×844 nach höchstens einmal Wischen ganz im Bild', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/#/tournament/${ID}/schedule`);
    const erste = page.locator('[data-match-card]:visible').first();
    await expect(erste).toBeVisible({ timeout: 15_000 });
    await animationenFertig(page);
    const box = (await erste.boundingBox())!;
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(box.y + scrollY + box.height).toBeLessThanOrEqual(2 * 844);
  });
});
