/**
 * @SL-195 @SL-238 Blatt „Endergebnis Spiel n“: Darstellung und Tastatur-Probe (G3-N N4, Regel T2-UI). Über den Prüfstand
 * tests/e2e/harness/aktionsblatt.html (ECHTE Spielplan-Ansicht, Tokens, i18n, Hell/Dunkel). Je Fall (leer, mit Eingabe, laufendes Spiel; normal
 * und mit 50-Zeichen-Teamnamen; Deutsch und Englisch): Blatt vollständig im Fenster („Ergebnis speichern“ ohne Scrollen), kein waagerechter
 * Überlauf, Felder, „−“, „+“ mindestens 44 px, „Ergebnis speichern“ mindestens 56 px, erstes Feld fokussiert, kein HART-Befund von `npm run visual:metrics`
 * (messeSeite). Dazu die Tastatur-Probe (F8): Das Fenster schrumpft auf die Hälfte (wie bei offener Bildschirmtastatur), das erste Feld und
 * „Ergebnis speichern“ bleiben sichtbar bzw. per Scrollen im Blatt erreichbar (unter der Mindesthöhe scrollt die ganze Fläche, DialogSurface). Die Abnahme „Zifferntastatur offen“ am echten Gerät bleibt offen (F8).
 * Bilder: Ordner aus G3N_N4_BILDER (sonst Testausgabe). Läuft nur im Projekt `desktop` am Dev-Server (setzt Fenster selbst).
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
const FAELLE = ['leer', 'eingabe', 'laeuft'] as const;

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
  const m: { befunde: { metrik: string; selektor: string; ist: string }[] } = await page.evaluate(messeSeite, {
    art, g, randPx: 0, monitorSchrift: null, ebuPruefen: false, extraInhalte: [],
    primarySelektor: '[data-primary], [data-variant="primary"]',
  });
  return m.befunde.filter((b) => hart.has(b.metrik)).map((b) => `${b.metrik} ${b.selektor} ${b.ist}`);
}

/** Blatt öffnen: geplantes Spiel über das Ergebnisfeld, laufendes über „Spiel beenden und Ergebnis eintragen“ (@SL-195, @FU-112). */
async function oeffneBlatt(page: Page, fall: (typeof FAELLE)[number], query: string): Promise<void> {
  await page.goto(`/tests/e2e/harness/aktionsblatt.html?zustand=${fall === 'laeuft' ? 'laeuft' : 'geplant'}&rechte=leitung${query}`);
  if (fall === 'laeuft') {
    await page.locator('[data-testid^="match-name-"]:visible, [data-testid^="match-row-time-"]:visible').first().click();
    await page.getByTestId('match-action-endAndEnter').click();
  } else {
    await page.locator('[data-testid^="match-goals-"]:visible, [data-testid^="match-circle-"]:visible').first().click(); // Karte: Torzahl, Tabelle: Ergebnisfeld
  }
  await expect(page.getByTestId('result-sheet')).toBeVisible();
  await animationenFertig(page); // das Blatt gleitet 0,3 s ein; erst danach messen
}

test.describe('@SL-195 Blatt „Endergebnis“: Darstellung und Tastatur-Probe (Prüfstand)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstand nur am Dev-Server (im gebauten Stand nicht vorhanden)');
  });

  for (const g of GERAETE) {
    for (const thema of ['light', 'dark'] as const) {
      for (const fall of FAELLE) {
        for (const sprache of [{ name: 'de', query: '' }, { name: 'en-langtext', query: '&sprache=en&lang=1' }] as const) {
          test(`@SL-195 @OB-022 ${g.name}, ${thema}, ${fall}, ${sprache.name}: Blatt im Fenster, Größen, erstes Feld fokussiert, kein HART-Befund`, async ({ page }, testInfo) => {
            await page.setViewportSize({ width: g.width, height: g.height });
            await page.emulateMedia({ colorScheme: thema });
            await oeffneBlatt(page, fall, sprache.query);
            await expect(page.getByTestId('result-sheet-score-home')).toBeFocused(); // Cursor im ersten Feld (@SL-195)
            if (fall === 'eingabe') {
              await page.getByTestId('result-sheet-score-home').fill('3');
              await page.getByTestId('result-sheet-score-away').fill('1');
            }
            const blatt = page.getByTestId('result-sheet');

            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            for (const breit of await blatt.evaluate((el) => [el, ...Array.from(el.querySelectorAll('*'))].map((k) => k.scrollWidth - k.clientWidth))) {
              expect(breit, 'kein waagerechter Überlauf im Blatt').toBeLessThanOrEqual(1);
            }
            const speichern = (await page.getByTestId('result-sheet-save').boundingBox())!;
            expect(speichern.height, 'Ergebnis speichern mindestens 56 px').toBeGreaterThan(55.9);
            expect(speichern.y + speichern.height, 'Ergebnis speichern ganz im Fenster').toBeLessThanOrEqual(g.height);
            for (const id of ['result-sheet-score-home', 'result-sheet-score-away', 'result-sheet-minus-home', 'result-sheet-plus-home', 'result-sheet-minus-away', 'result-sheet-plus-away', 'result-sheet-cancel', 'result-sheet-close']) {
              const box = (await page.getByTestId(id).boundingBox())!;
              expect(box.height, `${id} mindestens 44 px hoch`).toBeGreaterThan(43.9);
              expect(box.x + box.width, `${id} rechts im Fenster`).toBeLessThanOrEqual(g.width);
            }
            // Fuß wie im Mockup: ab 360 px „Abbrechen“ und „Ergebnis speichern“ in einer Zeile (@OB-061), bündig mit dem Titel (Kopf, Liste, Fuß teilen den Seitenrand)
            const abbrechen = (await page.getByTestId('result-sheet-cancel').boundingBox())!;
            const titel = (await blatt.getByRole('heading').first().boundingBox())!;
            expect(Math.abs(abbrechen.y - speichern.y), 'Abbrechen und Speichern in einer Zeile').toBeLessThan(2);
            expect(Math.abs(abbrechen.x - titel.x), 'Fuß bündig mit dem Titel').toBeLessThanOrEqual(1);
            // „Tore während des Spiels trägst du im Cockpit ein“ + „Zum Cockpit“ nur im laufenden Spiel
            await expect(page.getByTestId('result-sheet-cockpit-note')).toHaveCount(fall === 'laeuft' ? 1 : 0);
            const feldBreite = (await page.getByTestId('result-sheet-score-home').boundingBox())!;
            expect(feldBreite.width, 'Tor-Feld groß (Token sizing.scoreField)').toBeGreaterThan(g.width >= 390 ? 55.9 : 43.9);
            const schrift = await page.getByTestId('result-sheet-score-home').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
            expect(schrift, 'Schrift der Felder mindestens 16 px').toBeGreaterThanOrEqual(16);
            await animationenFertig(page); // Übergänge der Tasten abwarten, sonst misst der Kontrast eine Zwischenfarbe
            const ordner = process.env.G3N_N4_BILDER ?? testInfo.outputDir;
            mkdirSync(ordner, { recursive: true });
            await page.screenshot({ path: join(ordner, `n4-${g.name}-${thema}-${fall}-${sprache.name}.png`) });
            expect(await hartBefunde(page, g.art), 'kein HART-Befund').toEqual([]);
          });
        }
      }
    }
  }

  test('@SL-195 Tastatur-Probe (F8): bei halbiertem Fenster bleiben das erste Feld und „Ergebnis speichern“ sichtbar bzw. im Blatt erreichbar', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await oeffneBlatt(page, 'leer', '');
    await page.setViewportSize({ width: 360, height: 320 }); // etwa die Hälfte: Bildschirmtastatur offen
    await expect.poll(() => page.evaluate(() => window.innerHeight)).toBe(320);
    await animationenFertig(page);
    const feld = page.getByTestId('result-sheet-score-home');
    const speichern = page.getByTestId('result-sheet-save');
    // Beide sind sichtbar oder per Scrollen im Blatt erreichbar: nach dem Heranscrollen liegen sie ganz im Fenster
    for (const ziel of [speichern, feld]) {
      await ziel.scrollIntoViewIfNeeded();
      const box = (await ziel.boundingBox())!;
      expect(box.y, 'im Fenster (oben)').toBeGreaterThanOrEqual(0);
      expect(box.y + box.height, 'im Fenster (unten)').toBeLessThanOrEqual(320);
    }
    await feld.fill('2');
    await page.getByTestId('result-sheet-score-away').fill('1');
    await expect(page.getByTestId('result-sheet-save')).toBeEnabled();
  });
});
