/**
 * H4-17 (@HT-059, @OB-087): im Cockpit zeigt die Statuszeile nur Störungen. Am Prüfstand tests/e2e/harness/cockpit-statuszeile.html: der echte Kopf
 * (`ManagementTabKopf` → `CockpitSlimHeader` mit Feldwahl „Feld 1“ von zwei Feldern, `ConnectionPill`, echte Hooks von `HallStatusZeile`) über dem echten
 * `LiveCockpit` mit laufendem Spiel. Gemessen wird die Reihe Foul, Zeitstrafe, Karte beider Seiten: ihre Unterkante und bis wohin sie sichtbar ist
 * (Tipp-Test von oben nach unten). Bei „bereit“, „bereit mit Prüfen“ und ohne Lautsprecher steht keine Zeile und die Reihe ist ganz im Bild (360×640, 390×664,
 * 1280×720); bei einer Störung steht die Pille. `alt=1` ist der Kopf wie vor H4-17 und dient nur dem Vorher-Wert (Messung ohne Bewertung der Reihe).
 * Bilder: Ordner aus H417_BILDER (sonst Testausgabe). Läuft nur im Projekt `desktop` am Dev-Server.
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
const REIHE = ['foul-button-home', 'penalty-button-home', 'card-button-home', 'foul-button-away', 'penalty-button-away', 'card-button-away'] as const;
const KEINE_ZEILE = ['ohne', 'bereit', 'pruefen', 'eigen'] as const;
const STOERUNG: Record<'feld2' | 'ton', string> = { feld2: 'Lautsprecher Feld 2 nicht bereit', ton: 'Ton nicht aktiv – hier klicken' };
const ZEILE = '[data-testid="hallenton-status-zeile"]';

/** Hängt die Messung an `messwerte.jsonl` im Bilderordner (nur wenn H417_BILDER gesetzt ist). */
function notiere(name: string, m: Messung): void {
  const ordner = process.env.H417_BILDER;
  if (ordner) { appendFileSync(join(ordner, 'messwerte.jsonl'), `${JSON.stringify({ name, ...m })}\n`); }
}

async function oeffne(page: Page, fall: string, g: (typeof GROESSEN)[number], thema: 'light' | 'dark', alt = false): Promise<void> {
  await page.setViewportSize({ width: g.width, height: g.height });
  await page.emulateMedia({ colorScheme: thema });
  await page.clock.setFixedTime(new Date(2026, 10, 21, 14, 0));
  await page.goto(`/tests/e2e/harness/cockpit-statuszeile.html?fall=${fall}${alt ? '&alt=1' : ''}`);
  await page.getByTestId('foul-button-home').waitFor({ timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // Die Zeile kommt nach der ersten Antwort des (gefälschten) Servers; „eigen“/„ton“ stehen sofort aus dem Gerät
  await expect(page.getByTestId('cockpit-slim-header')).toBeVisible();
}

interface Messung { zeile: number; zeileUnten: number; reiheUnten: number; sichtbarBis: number; fensterHoehe: number; imBild: boolean; streifen: number }

/** Unterkante der Reihe Foul/Zeitstrafe/Karte und bis wohin ihre schlechteste Taste sichtbar ist (von oben nach unten angetippt). */
async function messe(page: Page): Promise<Messung> {
  return page.evaluate(({ reihe, zeile }) => {
    const rects = reihe.map((id) => ({ id, r: document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect() }));
    const unten = Math.max(...rects.map((x) => x.r.bottom));
    let schlechtesteSichtbar = Infinity;
    for (const { id, r } of rects) {
      let bis = 0;
      for (let y = Math.floor(r.top); y < window.innerHeight; y += 1) {
        if (document.elementFromPoint(r.left + r.width / 2, y)?.closest(`[data-testid="${id}"]`) !== null) { bis = y + 1; }
      }
      schlechtesteSichtbar = Math.min(schlechtesteSichtbar, bis - r.bottom);
    }
    const z = document.querySelector(zeile);
    return {
      zeile: z ? Math.round(z.getBoundingClientRect().height) : 0, zeileUnten: z ? Math.round(z.getBoundingClientRect().bottom) : 0,
      reiheUnten: Math.round(unten), sichtbarBis: Math.round(unten + schlechtesteSichtbar), fensterHoehe: window.innerHeight,
      imBild: unten <= window.innerHeight + 0.5 && schlechtesteSichtbar >= -1,
      streifen: document.querySelectorAll('[data-testid="hallenton-geraet-streifen"]').length,
    };
  }, { reihe: [...REIHE], zeile: ZEILE });
}

test.describe('@HT-059 H4-17 Cockpit: Statuszeile nur bei Störungen (Prüfstand)', () => {
  test.beforeEach(({ browserName, page }, testInfo) => {
    page.on('pageerror', (e) => { testInfo.annotations.push({ type: 'seitenfehler', description: e.message.slice(0, 300) }); });
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstand nur am Dev-Server (im gebauten Stand nicht vorhanden)');
  });

  for (const g of GROESSEN) {
    for (const thema of ['light', 'dark'] as const) {
      for (const fall of KEINE_ZEILE) {
        test(`@HT-059 ${fall} ${g.name}, ${thema}: keine Statuszeile, Foul-Reihe ganz im Bild, kein Streifen`, async ({ page }, testInfo) => {
          await oeffne(page, fall, g, thema);
          await page.getByTestId('cockpit-verbindung').waitFor();
          // Die Abfrage des Servers ist beantwortet, wenn die Verwaltung dieselbe Zeile zeigen würde: hier gibt es sie nie
          await expect(page.locator(ZEILE)).toHaveCount(0);
          await expect(page.getByText('bereit', { exact: false })).toHaveCount(0);
          const m = await messe(page);
          notiere(`nachher ${fall} ${g.name} ${thema}`, m);
          await speichereBild(page, testInfo.outputDir, 'H417_BILDER', `h4-17-${fall}-${g.name}-${thema}`, false);
          expect(m.zeile).toBe(0);
          if (fall === 'pruefen') {
            // @HT-050 (nicht Teil von H4-17, bleibt unverändert): die ruhige Zeile „Hallenton-Ausgang geändert“ steht unter der Tafel und kostet am
            // 360×640-Handy selbst den Platz der Foul-Reihe – gemessen und im Bericht als Befund genannt, hier nicht bewertet
            await expect(page.getByTestId('cockpit-hall-ausgang-geaendert')).toBeVisible();
          }
          if (!(fall === 'pruefen' && g.name === '360x640')) {
            expect(m.imBild, `Foul-Reihe im Bild: ${JSON.stringify(m)}`).toBe(true);
          }
          expect(m.streifen, 'Streifen erscheint nicht ersatzweise').toBe(0);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'kein waagerechtes Scrollen').toBe(true);
          expect(await hartBefunde(page, g.art), 'kein HART-Befund der visuellen Messung').toEqual([]);
        });
      }
      for (const fall of ['feld2', 'ton'] as const) {
        test(`@HT-059 ${fall} ${g.name}, ${thema}: nur die Störungspille steht, Pille ≥ 44 px, nichts läuft über`, async ({ page }, testInfo) => {
          await oeffne(page, fall, g, thema);
          const zeile = page.locator(ZEILE);
          await expect(zeile).toBeVisible({ timeout: 15_000 });
          // Mit zwei und mehr Einträgen gilt am schmalen Handy die Kurzform; hier steht genau ein Eintrag
          expect(await zeile.getByRole('button').allTextContents()).toEqual([STOERUNG[fall]]);
          for (const k of await zeile.getByRole('button').all()) { expect((await k.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44); }
          const m = await messe(page);
          notiere(`nachher ${fall} ${g.name} ${thema}`, m);
          await speichereBild(page, testInfo.outputDir, 'H417_BILDER', `h4-17-${fall}-${g.name}-${thema}`, false);
          expect(m.streifen, 'der Streifen steht nicht zusätzlich zur Kopfzeile').toBe(0);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'kein waagerechtes Scrollen').toBe(true);
          expect(await hartBefunde(page, g.art), 'kein HART-Befund der visuellen Messung').toEqual([]);
        });
      }
    }
  }

  // Vorher-Werte (Kopf wie auf main: Statuszeile ohne `nurStoerungen`), gleiche Daten; gemessen, nicht bewertet – nur dass die Zeile da war
  for (const g of GROESSEN) {
    for (const thema of ['light', 'dark'] as const) {
      for (const fall of ['bereit', 'pruefen'] as const) {
        test(`Vorher (Kopf wie main) ${fall} ${g.name}, ${thema}: Messung`, async ({ page }, testInfo) => {
          await oeffne(page, fall, g, thema, true);
          await expect(page.locator(ZEILE)).toBeVisible({ timeout: 15_000 });
          const m = await messe(page);
          notiere(`vorher ${fall} ${g.name} ${thema}`, m);
          await speichereBild(page, testInfo.outputDir, 'H417_BILDER', `vorher-${fall}-${g.name}-${thema}`, false);
        });
      }
    }
  }
});
