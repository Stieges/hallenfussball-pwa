/**
 * H4-5 (@HT-045, @HT-012, @HT-035, @HT-038, @HT-039): die Statuszeile in den echten Kopfzeilen – Verwaltung (`ManagementHeader`) und Cockpit
 * (`CockpitSlimHeader`) – und der Streifen in einer Ansicht ohne Kopf, am Prüfstand tests/e2e/harness/status-kopfzeile.html, bei 360×640 und
 * 1280×720, hell und dunkel. Je Fall: „Probe läuft“ und „Feld 1 bereit“ stehen in einer Zeile (gleiche y-Lage ± 2 px, Review H4-4 Befund 9),
 * ohne Eintrag fehlt die Zeile ganz, nichts läuft über, jede Pille ≥ 44 px, kein HART-Befund der Messung von `npm run visual:metrics`.
 * Bilder: Ordner aus H45_BILDER (sonst Testausgabe). Läuft nur im Projekt `desktop` am Dev-Server (setzt das Fenster selbst).
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
const ORTE = ['verwaltung', 'cockpit', 'streifen'] as const;

interface Grenzwert { id: string; typ: string; wert: unknown; geltung: string[]; typJeArt?: Record<string, string> }
const GW = JSON.parse(readFileSync(join(process.cwd(), 'scripts/visual-metrics/grenzwerte.json'), 'utf8')) as { grenzwerte: Grenzwert[] };

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
  // Die Anmelde-Tasten (`auth-*`, AuthSection) gehören nicht zu H4-5: ihr bestehender Befund (Avatar 40×40 px am Handy) steht im Bericht
  return m.befunde.filter((b) => hart.has(b.metrik) && !b.selektor.includes('data-testid="auth-')).map((b) => `${b.metrik} ${b.selektor} ${b.ist}`);
}

async function bild(page: Page, outputDir: string, name: string) {
  const ordner = process.env.H45_BILDER ?? outputDir;
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${name}.png`), fullPage: true });
}

test.describe('@HT-045 H4-5 Statuszeile in den Kopfzeilen (Prüfstand)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstand nur am Dev-Server (im gebauten Stand nicht vorhanden)');
  });

  for (const ort of ORTE) {
    for (const g of GERAETE) {
      for (const thema of ['light', 'dark'] as const) {
        test(`@HT-045 ${ort} ${g.name}, ${thema}: Probe und bereit nebeneinander, ohne Eintrag keine Zeile, nichts läuft über`, async ({ page }, testInfo) => {
          await page.setViewportSize({ width: g.width, height: g.height });
          await page.emulateMedia({ colorScheme: thema });
          await page.goto(`/tests/e2e/harness/status-kopfzeile.html?ort=${ort}`);
          await expect(page.getByTestId('zeile-bereit')).toBeVisible();

          // @HT-045 Zeile 2: „Probe läuft“ und „Feld 1 bereit“ in einer Zeile (360 px: gekürzt „Feld 1 bereit“), Probe zuerst
          const zwei = page.getByTestId('zeile-probe-bereit');
          const probe = await zwei.getByRole('button').first().boundingBox();
          const bereit = await zwei.getByRole('button').last().boundingBox();
          expect(Math.abs((probe?.y ?? 0) - (bereit?.y ?? 99)), 'Probe und bereit nebeneinander').toBeLessThanOrEqual(2);
          const reihenfolge = await zwei.getByRole('button').allTextContents();
          expect(reihenfolge.at(0)).toBe('Probe läuft');
          expect(reihenfolge.at(-1)).toBe(g.schmal ? 'Feld 1 bereit' : 'Lautsprecher Feld 1 bereit');
          // Zeile 3 und 4: Störung zuerst; zwei Felder, ein Eintrag
          expect((await page.getByTestId('zeile-stoerung-probe').getByRole('button').allTextContents()).at(0)).toMatch(/Feld 1 nicht bereit$/);
          expect((await page.getByTestId('zeile-zwei-felder').getByRole('button').allTextContents()).at(0)).toMatch(/Feld 1, 2 nicht bereit$/);
          // Zeile 5: kein Lautsprecher und keine Probe → die Zeile fehlt ganz
          await expect(page.getByTestId('zeile-keiner')).toHaveCount(0);
          // Mehr als zwei: „+n weitere“
          await expect(page.getByTestId('zeile-mehr-weitere')).toBeVisible();

          for (const k of await page.locator('[data-testid^="zeile-"] button').all()) {
            const box = await k.boundingBox();
            expect(box?.height ?? 0, `Pille ${await k.textContent()}`).toBeGreaterThanOrEqual(44);
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'kein waagerechtes Scrollen').toBe(true);
          const ueberlauf = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid^="zeile-"] button, [data-testid^="zeile-"]')).filter((el) => el.scrollWidth - el.clientWidth > 1).map((el) => el.textContent));
          expect(ueberlauf, 'kein Überlauf in Pillen und Zeilen').toEqual([]);
          expect(await hartBefunde(page, g.art), 'kein HART-Befund der visuellen Messung').toEqual([]);
          await bild(page, testInfo.outputDir, `h4-5-${ort}-${g.name}-${thema}`);
        });
      }
    }
  }
});
