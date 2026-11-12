/**
 * @OB-021 Live-Info eines laufenden Spiels (G3-N N3, Befund C-LIVEINFO-TASTEN-AUS-DEM-BILD): die drei Tasten brechen bei schmaler Breite um,
 * statt aus dem Bild zu laufen. Über den Prüfstand tests/e2e/harness/live-info.html (ECHTE Komponente, Tokens, i18n, Hell/Dunkel). Je Fall:
 * kein waagerechter Überlauf (`scrollWidth <= clientWidth`) in der Live-Info und in jeder Taste, jede Taste liegt vollständig im Fenster,
 * Tasten ≥ 44 px hoch, Seite scrollt nicht waagerecht, kein HART-Befund der Messung von `npm run visual:metrics`.
 * Läuft nur im Projekt `desktop` am Dev-Server (setzt Fenster selbst).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; die echte Messfunktion von `npm run visual:metrics`
import { messeSeite } from '../../scripts/visual-metrics/browser-messung.mjs';

const GERAETE = [
  { name: '320x568', width: 320, height: 568, art: 'handy' },
  { name: '360x640', width: 360, height: 640, art: 'handy' },
  { name: '1280x720', width: 1280, height: 720, art: 'desktop' },
] as const;
const FAELLE = [
  { name: 'kurz', query: '' },
  { name: 'langtext', query: '?lang=1' },
  { name: 'englisch', query: '?sprache=en&lang=1' },
] as const;

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
  // Übergänge der Tasten (transition: all) abwarten, sonst misst der Kontrast eine Zwischenfarbe
  await page.waitForTimeout(400);
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const m: { befunde: { metrik: string; selektor: string; ist: string }[] } = await page.evaluate(messeSeite, {
    art, g, randPx: 0, monitorSchrift: null, ebuPruefen: false, extraInhalte: [],
    primarySelektor: '[data-primary], [data-variant="primary"]',
  });
  return m.befunde.filter((b) => hart.has(b.metrik)).map((b) => `${b.metrik} ${b.selektor} ${b.ist}`);
}

test.describe('@OB-021 Live-Info: Tasten im Rahmen (Prüfstand)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstand nur am Dev-Server (im gebauten Stand nicht vorhanden)');
  });

  for (const g of GERAETE) {
    for (const thema of ['light', 'dark'] as const) {
      for (const fall of FAELLE) {
        test(`@OB-021 ${g.name}, ${thema}, ${fall.name}: drei Tasten im Fenster, nichts läuft über, kein HART-Befund`, async ({ page }) => {
          await page.setViewportSize({ width: g.width, height: g.height });
          await page.emulateMedia({ colorScheme: thema });
          await page.goto(`/tests/e2e/harness/live-info.html${fall.query}`);
          const info = page.getByTestId('live-info-expand');
          await expect(info).toBeVisible();
          const tasten = page.getByTestId('live-info-actions').getByRole('button');
          await expect(tasten).toHaveCount(3);

          const ueberlauf = await info.evaluate((el) => [el, ...Array.from(el.querySelectorAll('*'))].map((k) => k.scrollWidth - k.clientWidth));
          for (const breit of ueberlauf) { expect(breit, 'kein waagerechter Überlauf in der Live-Info').toBeLessThanOrEqual(1); }
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
          for (const taste of await tasten.all()) {
            const box = await taste.boundingBox();
            expect(box?.height ?? 0, 'Taste mindestens 44 px hoch').toBeGreaterThan(43.9);
            expect(box?.x ?? -1, 'Taste links im Fenster').toBeGreaterThanOrEqual(0);
            expect((box?.x ?? 0) + (box?.width ?? 0), 'Taste rechts im Fenster').toBeLessThanOrEqual(g.width);
          }
          expect(await hartBefunde(page, g.art), 'kein HART-Befund').toEqual([]);
        });
      }
    }
  }
});
