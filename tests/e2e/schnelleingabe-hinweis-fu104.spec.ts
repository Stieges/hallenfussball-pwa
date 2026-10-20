/**
 * @FU-104 (T2-UI, Fixrunde 2 K1): Hinweis „Ergebnis wurde inzwischen von Tom geändert (jetzt 3:1)“ in der Schnelleingabe der
 * Finalrunde – Tabelle bei 1280×720, Karte bei 360×640, je hell und dunkel. Über den Prüfstand tests/e2e/harness/score-changed.html,
 * weil die Variante mit „Meine Eingabe behalten“ (Spiel bleibt eintragbar) offline im echten Ablauf nicht erreichbar ist; den echten
 * Ablauf (zweiter Tab trägt ein, Spiel beendet) prüft tests/e2e/flows/schnelleingabe-entwurf.spec.ts.
 * Je Fall: Text vollständig (nichts abgeschnitten, kein Überlauf, kein waagerechtes Scrollen), Knopf ≥ 44 px, die Messung von
 * `npm run visual:metrics` (messeSeite, HART-Grenzwerte aus grenzwerte.json) ohne neuen HART-Befund gegenüber dem Stand vor dem
 * Hinweis, und das Verhalten: „0“ + Enter sendet nichts, erst nach „Meine Eingabe behalten“ sendet Enter 10:2.
 * Bilder: Ordner aus FU104_BILDER (sonst Testausgabe). Läuft nur im Projekt `desktop` am Dev-Server (setzt Fenster selbst).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; die echte Messfunktion von `npm run visual:metrics`
import { messeSeite } from '../../scripts/visual-metrics/browser-messung.mjs';

const HF1 = '00000000-0000-4000-8000-0000000104a1';
const TEXT_TOM = 'Ergebnis wurde inzwischen von Tom geändert (jetzt 3:1)';
const TEXT_OHNE_NAME = 'Ergebnis wurde inzwischen von einem anderen Gerät geändert (jetzt 3:1)';

const GERAETE = [
  { name: '1280x720', width: 1280, height: 720, art: 'desktop', prefix: 'match', hinweis: 'score-changed' },
  { name: '360x640', width: 360, height: 640, art: 'handy', prefix: 'final', hinweis: 'final-score-changed' },
] as const;

const FAELLE = [
  { name: 'geplant-tom', art: 'geplant', autor: 'Tom', text: TEXT_TOM, knopf: true },
  { name: 'geplant-ohne-name', art: 'geplant', autor: '', text: TEXT_OHNE_NAME, knopf: true },
  { name: 'beendet-ohne-name', art: 'beendet', autor: '', text: TEXT_OHNE_NAME, knopf: false },
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
  return m.befunde.filter((b) => hart.has(b.metrik)).map((b) => `${b.metrik} ${b.selektor}`);
}

async function bild(page: Page, outputDir: string, name: string) {
  const ordner = process.env.FU104_BILDER ?? outputDir;
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${name}.png`), fullPage: true });
}

test.describe('@FU-104 C-SCHNELLEINGABE-FREMDAENDERUNG-STILL Hinweis „inzwischen geändert“: Darstellung und Knopf (Prüfstand)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstand nur am Dev-Server (im gebauten Stand nicht vorhanden)');
  });

  for (const g of GERAETE) {
    for (const thema of ['light', 'dark'] as const) {
      for (const fall of FAELLE) {
        test(`@FU-104 ${g.name}, ${thema}, ${fall.name}: Hinweis vollständig${fall.knopf ? ', Knopf „Meine Eingabe behalten“' : ', ohne Knopf'}, kein neuer HART-Befund`, async ({ page }, testInfo) => {
          await page.setViewportSize({ width: g.width, height: g.height });
          await page.emulateMedia({ colorScheme: thema });
          await page.goto(`/tests/e2e/harness/score-changed.html?name=${encodeURIComponent(fall.autor)}`);
          const feld = page.getByTestId(`${g.prefix}-score-input-${HF1}-home`);
          await expect(feld).toBeVisible();
          await feld.click();
          await page.keyboard.type('1');
          const vorher = await hartBefunde(page, g.art);

          await page.evaluate((art) => { window.__fremd(art); }, fall.art);
          const hinweis = page.getByTestId(`${g.hinweis}-${HF1}`);
          await expect(hinweis).toContainText(fall.text);
          const knopf = page.getByTestId(`${g.hinweis}-keep-${HF1}`);
          await expect(knopf).toHaveCount(fall.knopf ? 1 : 0);

          // Langer Text: nichts abgeschnitten oder übergelaufen, kein waagerechtes Scrollen der Seite
          const ueberlauf = await hinweis.evaluate((el) => [el, ...Array.from(el.children)].map((k) => ({
            breit: k.scrollWidth - k.clientWidth, hoch: k.scrollHeight - k.clientHeight,
          })));
          for (const u of ueberlauf) {
            expect(u.breit, 'kein waagerechter Überlauf im Hinweis').toBeLessThanOrEqual(1);
            expect(u.hoch, 'kein senkrechter Überlauf im Hinweis').toBeLessThanOrEqual(1);
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
          if (fall.knopf) {
            const box = await knopf.boundingBox();
            expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
            const rahmen = await hinweis.boundingBox();
            expect(box && rahmen && box.x >= rahmen.x - 1 && box.x + box.width <= rahmen.x + rahmen.width + 1).toBe(true);
          }

          const nachher = await hartBefunde(page, g.art);
          expect(nachher.filter((b) => !vorher.includes(b)), 'kein neuer HART-Befund durch den Hinweis').toEqual([]);
          await bild(page, testInfo.outputDir, `fu104-${g.name}-${thema}-${fall.name}`);

          // Verhalten: „0“ + Enter sendet nichts; erst „Meine Eingabe behalten“ macht Enter wieder wirksam
          if (fall.knopf) {
            await feld.click();
            await page.keyboard.type('0');
            await page.keyboard.press('Enter');
            expect(await page.evaluate(() => window.__gesendet)).toEqual([]);
            await knopf.click();
            await expect(hinweis).toHaveCount(0);
            await feld.click();
            await page.keyboard.press('Enter');
            expect(await page.evaluate(() => window.__gesendet)).toEqual([[HF1, 10, 2]]);
          } else {
            expect(await page.evaluate(() => window.__gesendet)).toEqual([]);
          }
        });
      }
    }
  }
});
