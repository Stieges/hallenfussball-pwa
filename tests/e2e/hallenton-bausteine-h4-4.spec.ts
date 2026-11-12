/**
 * H4-4 (@HT-045, @HT-039, @HT-047): Bausteine des Hallentons am Prüfstand tests/e2e/harness/status-zeile.html – `StatusZeile` mit 1, 2 und
 * 4 Einträgen und drei `LautsprecherFeldKarte`n, bei 360×640 und 1280×720, hell und dunkel. Je Fall: nichts läuft über (kein waagerechtes
 * Scrollen, kein Überlauf in Pillen und Karten), jede Pille ≥ 44 px hoch, Kurzform unter 480 px, „+n weitere“ klappt auf, und die
 * Messung von `npm run visual:metrics` (messeSeite, HART-Grenzwerte aus grenzwerte.json) findet keinen HART-Befund.
 * Bilder: Ordner aus H44_BILDER (sonst Testausgabe). Läuft nur im Projekt `desktop` am Dev-Server (setzt das Fenster selbst).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; die echte Messfunktion von `npm run visual:metrics`
import { messeSeite } from '../../scripts/visual-metrics/browser-messung.mjs';

const GERAETE = [
  { name: '360x640', width: 360, height: 640, art: 'handy', schmal: true },
  { name: '1280x720', width: 1280, height: 720, art: 'desktop', schmal: false },
] as const;

interface Grenzwert { id: string; typ: string; wert: unknown; geltung: string[]; typJeArt?: Record<string, string> }
const GW = JSON.parse(readFileSync(join(process.cwd(), 'scripts/visual-metrics/grenzwerte.json'), 'utf8')) as { grenzwerte: Grenzwert[] };

/** Grenzwerte wie `grenzenFuer` in messen.mjs (App-Modus, ohne Monitor/Langtext/Gates) und die Liste der HART-Metriken. */
function grenzen(art: string): { g: Record<string, unknown>; hart: Set<string> } {
  const g: Record<string, unknown> = {};
  const hart = new Set<string>();
  for (const e of GW.grenzwerte) {
    if (!e.geltung.includes(art) || e.id.startsWith('gate.') || e.id.startsWith('langtext.') || e.id.startsWith('monitor.') || e.id.startsWith('overscan.')) {continue;}
    g[e.id] = e.wert;
    if ((e.typJeArt?.[art] ?? e.typ) === 'HART') {hart.add(e.id);}
  }
  return { g, hart };
}

async function hartBefunde(page: Page, art: string): Promise<string[]> {
  const { g, hart } = grenzen(art);
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const m: { befunde: { metrik: string; selektor: string; ist: string }[] } = await page.evaluate(messeSeite, {
    art, g, randPx: 0, monitorSchrift: null, ebuPruefen: false, extraInhalte: [],
    primarySelektor: '[data-primary], [data-variant="primary"]',
  });
  return m.befunde.filter((b) => hart.has(b.metrik)).map((b) => `${b.metrik} ${b.selektor} ${b.ist}`);
}

async function bild(page: Page, outputDir: string, name: string) {
  const ordner = process.env.H44_BILDER ?? outputDir;
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${name}.png`), fullPage: true });
}

test.describe('@HT-045 H4-4 Statuszeile und Feldkarten (Prüfstand)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstand nur am Dev-Server (im gebauten Stand nicht vorhanden)');
  });

  for (const g of GERAETE) {
    for (const thema of ['light', 'dark'] as const) {
      test(`@HT-045 ${g.name}, ${thema}: nichts läuft über, Pillen ≥ 44 px, Kurzform ${g.schmal ? 'ja' : 'nein'}, kein HART-Befund`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: g.width, height: g.height });
        await page.emulateMedia({ colorScheme: thema });
        await page.goto('/tests/e2e/harness/status-zeile.html');
        await expect(page.getByTestId('zeile-1')).toBeVisible();

        // Kurzform: erst ab zwei Einträgen und nur unter 480 px
        await expect(page.getByTestId('zeile-1')).toContainText('Lautsprecher Feld 1 bereit');
        const zwei = page.getByTestId('zeile-2');
        if (g.schmal) {
          await expect(zwei).toContainText('Feld 1 bereit');
          await expect(zwei).not.toContainText('Lautsprecher Feld 1 bereit');
        } else {
          await expect(zwei).toContainText('Lautsprecher Feld 1 bereit');
        }
        // @HT-045 Zeile 2: „Probe läuft“ und „Feld 1 bereit“ stehen in derselben Zeile (gleiche y-Lage ± 2 px), nicht untereinander
        const probe = await zwei.getByRole('button').first().boundingBox();
        const bereit = await zwei.getByRole('button').last().boundingBox();
        expect(Math.abs((probe?.y ?? 0) - (bereit?.y ?? 99)), 'Probe und bereit nebeneinander').toBeLessThanOrEqual(2);
        // „Prüfen“ steht unmittelbar neben „bereit“, die Probe davor
        const reihenfolge = await zwei.getByRole('button').allTextContents();
        expect(reihenfolge.at(0)).toBe('Probe läuft');
        expect(reihenfolge.at(-1)).toMatch(/Feld 1 bereit$/);
        const mitPruefen = await page.getByTestId('zeile-2p').getByRole('button').allTextContents();
        expect(mitPruefen.at(0)).toBe('Probe läuft');
        expect(mitPruefen.at(-1)).toBe('Prüfen');

        // Vier Einträge (@HT-045): Störung, Probe, „+2 weitere“ (Feld 2 bereit mit „Prüfen“ daneben und Feld 3 bereit); „Prüfen“ steht nie allein
        const vier = page.getByTestId('zeile-4');
        expect((await vier.getByRole('button').allTextContents()).map((t) => t.replace(/^(Lautsprecher )/, '')).at(-1)).toBe('+2 weitere');
        await expect(vier.getByTestId('zeile-4-weitere')).toHaveAttribute('aria-expanded', 'false');
        await expect(vier).not.toContainText('Prüfen');

        // Tippflächen und Überlauf
        const knoepfe = page.locator('button');
        for (const k of await knoepfe.all()) {
          const box = await k.boundingBox();
          expect(box?.height ?? 0, `Pille ${await k.textContent()}`).toBeGreaterThanOrEqual(44);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'kein waagerechtes Scrollen').toBe(true);
        const ueberlauf = await page.evaluate(() => Array.from(document.querySelectorAll('button, article, [role="status"]')).filter((el) => el.scrollWidth - el.clientWidth > 1).map((el) => el.textContent));
        expect(ueberlauf, 'kein Überlauf in Pillen, Karten und Zeilen').toEqual([]);

        expect(await hartBefunde(page, g.art), 'kein HART-Befund der visuellen Messung').toEqual([]);
        await bild(page, testInfo.outputDir, `h4-4-${g.name}-${thema}`);

        // Aufklappen zeigt alle vier
        await vier.getByTestId('zeile-4-weitere').click();
        await expect(vier.getByTestId('zeile-4-weitere')).toHaveText('weniger');
        await expect(vier.getByTestId('zeile-4-weitere')).toHaveAttribute('aria-expanded', 'true');
        // Alle vier Einträge plus „Prüfen“ neben Feld 2 plus die Sammelpille; „Prüfen“ direkt hinter „Feld 2 bereit“
        await expect(vier.getByRole('button')).toHaveCount(6);
        const aufgeklappt = await vier.getByRole('button').allTextContents();
        expect(aufgeklappt.findIndex((t) => t === 'Prüfen')).toBe(aufgeklappt.findIndex((t) => t.endsWith('Feld 2 bereit')) + 1);
        await bild(page, testInfo.outputDir, `h4-4-${g.name}-${thema}-aufgeklappt`);
      });
    }
  }

  test('@HT-045 Tippen auf „bereit“ meldet das Ziel, Tippen auf „Prüfen“ löst aus', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/tests/e2e/harness/status-zeile.html');
    await page.getByTestId('zeile-2p').getByRole('button', { name: /Lautsprecher Feld 1 bereit/ }).first().click();
    await page.getByTestId('zeile-2p').getByRole('button', { name: /prüfen/i }).click();
    expect(await page.evaluate(() => (window as unknown as { __ziele: string[] }).__ziele)).toEqual(['/tournament/hallencup-sued/admin/hallenton', 'pruefen']);
  });
});
