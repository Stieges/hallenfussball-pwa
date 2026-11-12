/**
 * @SL-239 Aktionsblatt am Spiel: Darstellung (G3-N N3, Regel T2-UI). Über den Prüfstand tests/e2e/harness/aktionsblatt.html (ECHTE Spielplan-Ansicht, Tokens,
 * i18n, Hell/Dunkel) – damit auch die Rolle Helfer, die im echten Ablauf nur mit Server erreichbar ist. Je Fall (Spiel geplant, läuft, beendet; Turnierleitung und
 * Helfer; normal und mit 50-Zeichen-Teamnamen; Deutsch und Englisch): Blatt vollständig im Fenster (Haupttaste ohne Scrollen), kein waagerechter Überlauf,
 * jede Taste ≥ 56 px, „X“ ≥ 44 px, kein HART-Befund der Messung von `npm run visual:metrics` (messeSeite). Bilder: Ordner aus G3N_N3_BILDER (sonst Testausgabe).
 * Läuft nur im Projekt `desktop` am Dev-Server (setzt Fenster selbst).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { animationenFertig } from './helpers/animationenFertig';
// @ts-expect-error – .mjs ohne Typen; die echte Messfunktion von `npm run visual:metrics`
import { messeSeite } from '../../scripts/visual-metrics/browser-messung.mjs';

const GERAETE = [
  { name: '360x640', width: 360, height: 640, art: 'handy' },
  { name: '390x844', width: 390, height: 844, art: 'handy' },
  { name: '768x1024', width: 768, height: 1024, art: 'tablet' },
  { name: '1440x900', width: 1440, height: 900, art: 'desktop' },
] as const;
const ZUSTAENDE = ['geplant', 'laeuft', 'beendet'] as const;

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
  await animationenFertig(page); // Übergänge der Tasten abwarten, sonst misst der Kontrast eine Zwischenfarbe
  const m: { befunde: { metrik: string; selektor: string; ist: string }[] } = await page.evaluate(messeSeite, {
    art, g, randPx: 0, monitorSchrift: null, ebuPruefen: false, extraInhalte: [],
    primarySelektor: '[data-primary], [data-variant="primary"]',
  });
  return m.befunde.filter((b) => hart.has(b.metrik)).map((b) => `${b.metrik} ${b.selektor} ${b.ist}`);
}

test.describe('@SL-239 Aktionsblatt: Darstellung (Prüfstand)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstand nur am Dev-Server (im gebauten Stand nicht vorhanden)');
  });

  for (const g of GERAETE) {
    for (const thema of ['light', 'dark'] as const) {
      for (const zustand of ZUSTAENDE) {
        for (const rechte of ['leitung', 'helfer'] as const) {
          for (const fall of [{ name: 'de', query: '' }, { name: 'en-langtext', query: '&sprache=en&lang=1' }] as const) {
            test(`@SL-239 ${g.name}, ${thema}, ${zustand}, ${rechte}, ${fall.name}: Blatt im Fenster, Haupttaste ohne Scrollen, kein HART-Befund`, async ({ page }, testInfo) => {
              await page.setViewportSize({ width: g.width, height: g.height });
              await page.emulateMedia({ colorScheme: thema });
              await page.goto(`/tests/e2e/harness/aktionsblatt.html?zustand=${zustand}&rechte=${rechte}${fall.query}`);
              await page.locator('[data-testid^="match-name-"]:visible, [data-testid^="match-row-time-"]:visible').first().click();
              const blatt = page.getByTestId('match-action-menu');
              await expect(blatt).toBeVisible();
              await animationenFertig(page); // das Blatt gleitet 0,3 s ein; erst danach messen

              expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
              const ueberlauf = await blatt.evaluate((el) => [el, ...Array.from(el.querySelectorAll('*'))].map((k) => k.scrollWidth - k.clientWidth));
              for (const breit of ueberlauf) { expect(breit, 'kein waagerechter Überlauf im Blatt').toBeLessThanOrEqual(1); }
              const haupt = blatt.locator('[data-primary="true"]');
              await expect(haupt).toHaveCount(1);
              const hb = (await haupt.boundingBox())!;
              expect(hb.height, 'Haupttaste mindestens 56 px').toBeGreaterThan(55.9);
              expect(hb.y + hb.height, 'Haupttaste ganz im Fenster').toBeLessThanOrEqual(g.height);
              for (const taste of await blatt.getByRole('listitem').getByRole('button').all()) {
                const box = (await taste.boundingBox())!;
                expect(box.height, 'jede Taste mindestens 56 px').toBeGreaterThan(55.9);
                expect(box.x + box.width, 'Taste rechts im Fenster').toBeLessThanOrEqual(g.width);
              }
              expect((await page.getByTestId('match-action-menu-close').boundingBox())!.height, '„X“ mindestens 44 px').toBeGreaterThan(43.9);

              expect(await hartBefunde(page, g.art), 'kein HART-Befund').toEqual([]);
              const ordner = process.env.G3N_N3_BILDER ?? testInfo.outputDir;
              mkdirSync(ordner, { recursive: true });
              await page.screenshot({ path: join(ordner, `n3-${g.name}-${thema}-${zustand}-${rechte}-${fall.name}.png`) });
            });
          }
        }
      }
    }
  }
});
