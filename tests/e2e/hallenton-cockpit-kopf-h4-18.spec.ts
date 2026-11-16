/**
 * H4-18 (@HT-059): im Cockpit-Kopf steht keine Störung doppelt (Pille UND Kasten unter der Tafel) und kein „Status unbekannt“. Am Prüfstand
 * tests/e2e/harness/cockpit-statuszeile.html (echter Kopf, echtes `LiveCockpit` mit laufendem Spiel, echte Hooks; nur der Server-Aufruf und das
 * Lautsprecher-Gerät sind Doppel). Gemessen werden die Tor-Tasten und die Reihe Foul, Zeitstrafe, Karte (Unterkante, bis wohin sichtbar) in den Fällen
 * „Feld 1 nicht bereit“ (`feld1`) und „eigenes Gerät Feld 1, Ton nicht aktiv“ (`ton`). H418_PHASE=vorher|nachher benennt die Messreihe (gleiche Daten).
 * Bilder und `messwerte.jsonl`: Ordner aus H418_BILDER. Läuft nur im Projekt `desktop` am Dev-Server.
 */
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { hartBefunde, speichereBild } from './helpers/hallentonPruefstand';

const GROESSEN = [
  { name: '360x640', width: 360, height: 640, art: 'handy' },
  { name: '390x664', width: 390, height: 664, art: 'handy' },
  { name: '1280x720', width: 1280, height: 720, art: 'desktop' },
] as const;
const TORE = ['goal-button-home', 'goal-button-away'] as const;
const REIHE = ['foul-button-home', 'penalty-button-home', 'card-button-home', 'foul-button-away', 'penalty-button-away', 'card-button-away'] as const;
const ZEILE = '[data-testid="hallenton-status-zeile"]';
const KASTEN = '[data-testid="cockpit-hall-aus"]';
const PHASE = process.env.H418_PHASE === 'vorher' ? 'vorher' : 'nachher';

interface Gruppe { unten: number; sichtbarBis: number; imBild: boolean }
interface Messung { zeile: number; kasten: number; tore: Gruppe; reihe: Gruppe; fensterHoehe: number }

function notiere(name: string, m: Messung): void {
  const ordner = process.env.H418_BILDER;
  if (ordner) { appendFileSync(join(ordner, 'messwerte.jsonl'), `${JSON.stringify({ name, phase: PHASE, ...m })}\n`); }
}

async function oeffne(page: Page, fall: string, g: (typeof GROESSEN)[number], thema: 'light' | 'dark'): Promise<void> {
  await page.setViewportSize({ width: g.width, height: g.height });
  await page.emulateMedia({ colorScheme: thema });
  await page.clock.setFixedTime(new Date(2026, 10, 21, 14, 0));
  await page.goto(`/tests/e2e/harness/cockpit-statuszeile.html?fall=${fall}`);
  await page.getByTestId('foul-button-home').waitFor({ timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect(page.getByTestId('cockpit-slim-header')).toBeVisible();
  // erst die erste Antwort des (gefälschten) Servers abwarten und zwei Bilder lang rendern lassen
  await page.waitForFunction(() => document.documentElement.dataset.antwort === '1');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** Unterkante einer Tastengruppe und bis wohin ihre schlechteste Taste sichtbar ist (von oben nach unten angetippt). */
async function messe(page: Page): Promise<Messung> {
  return page.evaluate(({ tore, reihe, zeile, kasten }) => {
    const gruppe = (ids: string[]): Gruppe => {
      const rects = ids.map((id) => ({ id, r: document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect() }));
      const unten = Math.max(...rects.map((x) => x.r.bottom));
      let schlechtesteSichtbar = Infinity;
      for (const { id, r } of rects) {
        let bis = 0;
        for (let y = Math.floor(r.top); y < window.innerHeight; y += 1) {
          if (document.elementFromPoint(r.left + r.width / 2, y)?.closest(`[data-testid="${id}"]`) !== null) { bis = y + 1; }
        }
        schlechtesteSichtbar = Math.min(schlechtesteSichtbar, bis - r.bottom);
      }
      return { unten: Math.round(unten), sichtbarBis: Math.round(unten + schlechtesteSichtbar), imBild: unten <= window.innerHeight + 0.5 && schlechtesteSichtbar >= -1 };
    };
    const hoehe = (sel: string): number => { const e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().height) : 0; };
    return { zeile: hoehe(zeile), kasten: hoehe(kasten), tore: gruppe(tore), reihe: gruppe(reihe), fensterHoehe: window.innerHeight };
  }, { tore: [...TORE], reihe: [...REIHE], zeile: ZEILE, kasten: KASTEN });
}

test.describe('@HT-059 H4-18 Cockpit-Kopf: Messung (Prüfstand)', () => {
  test.beforeEach(({ browserName, page }, testInfo) => {
    page.on('pageerror', (e) => { testInfo.annotations.push({ type: 'seitenfehler', description: e.message.slice(0, 300) }); });
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstand nur am Dev-Server (im gebauten Stand nicht vorhanden)');
  });

  for (const g of GROESSEN) {
    for (const thema of ['light', 'dark'] as const) {
      for (const fall of ['feld1', 'ton'] as const) {
        test(`Messung ${PHASE} ${fall} ${g.name}, ${thema}`, async ({ page }, testInfo) => {
          await oeffne(page, fall, g, thema);
          const m = await messe(page);
          notiere(`${PHASE} ${fall} ${g.name} ${thema}`, m);
          await speichereBild(page, testInfo.outputDir, 'H418_BILDER', `h4-18-${PHASE}-${fall}-${g.name}-${thema}`, false);
          expect(await hartBefunde(page, g.art), 'kein HART-Befund der visuellen Messung').toEqual([]);
          if (PHASE === 'nachher') {
            // @HT-059 Zeilen 4 und 6: die Störung steht genau einmal – im Kasten unter der Tafel, nicht zusätzlich als Pille im Kopf
            await expect(page.locator(ZEILE)).toHaveCount(0);
            await expect(page.locator(KASTEN)).toBeVisible();
            expect(m.zeile).toBe(0);
            // @HT-059 Zeile 4 und 6, Folge: die Tor-Tasten stehen im Bild (die Foul-Reihe verlangt die Anforderung hier nicht, sie steht im Bericht als Befund)
            expect(m.tore.imBild, `Tor-Tasten im Bild: ${JSON.stringify(m.tore)}`).toBe(true);
          } else {
            expect(m.zeile, 'vorher stand die Pille zusätzlich zum Kasten').toBeGreaterThan(0);
          }
        });
      }
    }
  }
});
