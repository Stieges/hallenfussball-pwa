/**
 * H4-8 (@HT-016, @HT-017, @HT-041, @HT-042, @HT-046): der Unterpunkt „Hallenton“ im Admin-Center am Prüfstand
 * tests/e2e/harness/hallenton-unterpunkt.html (echte Seitenleiste, echte Seitenansicht, Daten von Hand), bei 360×640 und 1280×720, hell
 * und dunkel. Zustände: bereit, nicht bereit, meldet sich nicht, Status unbekannt, Testton-Quittung, gesperrt. Je Fall: die Wortlaute der
 * Anforderung stehen da, nichts läuft über, jede Taste ≥ 44 px, kein HART-Befund der Messung von `npm run visual:metrics`.
 * Bilder: Ordner aus H48_BILDER (sonst Testausgabe). Läuft nur im Projekt `desktop` am Dev-Server (setzt das Fenster selbst).
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
  // Die Anmelde-Tasten (`auth-*`, AuthSection) gehören nicht zu H4-8: ihr bestehender Befund (Avatar 40×40 px am Handy) steht im Bericht
  return m.befunde.filter((b) => hart.has(b.metrik) && !b.selektor.includes('data-testid="auth-')).map((b) => `${b.metrik} ${b.selektor} ${b.ist}`);
}

async function bild(page: Page, outputDir: string, name: string) {
  const ordner = process.env.H48_BILDER ?? outputDir;
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${name}.png`), fullPage: true });
}


const FAELLE = ['bereit', 'nicht-bereit', 'meldet-sich-nicht', 'status-unbekannt', 'testton', 'gesperrt'] as const;
type Fall = (typeof FAELLE)[number];

async function pruefeWortlaute(page: Page, fall: Fall): Promise<void> {
  const feld1 = page.getByTestId('lautsprecher-feld-1-zustand');
  const feld2 = page.getByTestId('lautsprecher-feld-2-zustand');
  await expect(feld2, '@HT-016 Feld ohne Lautsprecher bleibt neutral').toHaveText('kein Hallen-Lautsprecher');
  await expect(page.getByTestId('lautsprecher-feld-1-geraet')).toContainText('Laptop Turnierleitung');
  switch (fall) {
    case 'bereit':
      await expect(feld1).toHaveText('bereit');
      await expect(page.getByTestId('hallenton-kein-netz')).toHaveCount(0);
      await expect(page.getByTestId('testton-hier-anhoeren')).toBeVisible();
      await expect(page.getByTestId('testton-halle-1')).toBeVisible();
      break;
    case 'nicht-bereit':
      await expect(feld1).toContainText('nicht bereit – Ton nicht aktiviert');
      break;
    case 'meldet-sich-nicht':
      await expect(feld1).toContainText('meldet sich nicht (zuletzt 14:02)');
      break;
    case 'status-unbekannt':
      await expect(feld1).toHaveText('Status unbekannt');
      await expect(page.getByTestId('hallenton-kein-netz')).toContainText('Kein Netz – Status unbekannt');
      await expect(page.getByTestId('testton-feld-1-ergebnis')).toContainText('Kein Testton: kein Netz');
      break;
    case 'testton':
      await page.getByTestId('testton-halle-1').click(); // der eigene Auftrag; erst seine Quittung zählt (@HT-017)
      await expect(page.getByTestId('testton-feld-1-ergebnis')).toContainText('gespielt 14:02');
      break;
    case 'gesperrt':
      await expect(feld1).toHaveText('bereit');
      await expect(page.getByTestId('hallenton-abgeschlossen')).toBeVisible();
      await expect(page.getByTestId('hallenton-testton')).toHaveCount(0);
      break;
  }
}

test.describe('@HT-016 @HT-017 @HT-041 @HT-046 H4-8 Unterpunkt „Hallenton“ (Prüfstand)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstand nur am Dev-Server (im gebauten Stand nicht vorhanden)');
  });

  for (const fall of FAELLE) {
    for (const g of GERAETE) {
      for (const thema of ['light', 'dark'] as const) {
        test(`@HT-017 ${fall} ${g.name}, ${thema}: Wortlaute, Tasten ≥ 44 px, nichts läuft über`, async ({ page }, testInfo) => {
          await page.setViewportSize({ width: g.width, height: g.height });
          await page.emulateMedia({ colorScheme: thema });
          await page.goto(`/tests/e2e/harness/hallenton-unterpunkt.html?fall=${fall}`);
          await expect(page.getByTestId('hallenton-seite')).toBeVisible();
          await pruefeWortlaute(page, fall);
          // @HT-022: Seitenleiste ab 768 px mit „Hallenton“ nach „Match Cockpit“ und der Pille „neu“
          if (!g.schmal) {
            await expect(page.getByRole('button', { name: /Hallenton/ })).toHaveAttribute('aria-current', 'page');
            await expect(page.getByTestId('admin-neu-hallenton')).toHaveText('neu');
          }
          for (const k of await page.locator('[data-testid="hallenton-seite"] button').all()) {
            const box = await k.boundingBox();
            expect(box?.height ?? 0, `Taste ${await k.textContent()}`).toBeGreaterThanOrEqual(44);
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'kein waagerechtes Scrollen').toBe(true);
          const ueberlauf = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="hallenton-seite"] *')).filter((el) => el.scrollWidth - el.clientWidth > 1).map((el) => el.textContent));
          expect(ueberlauf, 'kein Überlauf').toEqual([]);
          // Die Seitenleiste ist bestehender Code (H4-8 fügt nur den Eintrag „Hallenton“ mit der Pille „neu“ ein): ihre Befunde stehen als
          // Anmerkung im Bericht, die Seite selbst muss ohne HART-Befund sein. Farbübergänge (0,15 s) vorher abwarten.
          await page.evaluate(() => window.scrollTo(0, 0)); // der Klick im Fall „testton“ scrollt die Seite; gemessen wird vom Seitenanfang
          await page.waitForTimeout(400);
          for (const b of await hartBefunde(page, g.art)) {
            testInfo.annotations.push({ type: 'befund-gesamt', description: b });
          }
          await page.addStyleTag({ content: 'aside { visibility: hidden; }' });
          expect(await hartBefunde(page, g.art), 'kein HART-Befund der visuellen Messung (Seite ohne Seitenleiste)').toEqual([]);
          await page.addStyleTag({ content: 'aside { visibility: visible; }' });
          await bild(page, testInfo.outputDir, `h4-8-${fall}-${g.name}-${thema}`);
        });
      }
    }
  }
});
