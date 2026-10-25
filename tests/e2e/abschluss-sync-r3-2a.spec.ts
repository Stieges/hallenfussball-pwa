/**
 * R3-2a (Regel T2-UI): Texte nach dem Turnierabschluss im Browser – über den Prüfstand tests/e2e/harness/abschluss-sync.html, weil
 * Konto, abgeschlossener Server-Stand und gescheiterte Übertragungen offline fehlen. Geräte 1280×720 und 360×640, je hell und dunkel.
 * - @HE-070 @FU-057: Liste gestörter Übertragungen „Nicht übernommen – Turnier ist abgeschlossen“, kein „Erneut versuchen“.
 * - @FU-018: Hinweis „Turnier ist abgeschlossen – 2 Einträge an die Turnierleitung übergeben“.
 * - Plan H-9: Rückfrage „Spielleitung übernehmen?“ nennt den Abschluss, Haupttaste gesperrt.
 * Je Fall: Text vollständig sichtbar, keine waagrechte Rollleiste, visual:metrics-Messung (Haupttaste sichtbar/Tippfläche) ohne
 * HART-Befund. Bilder: Ordner aus R3_2A_BILDER (sonst Testausgabe). Läuft nur im Projekt `desktop` und nur am Dev-Server.
 */
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen; die echte Messfunktion von `npm run visual:metrics`
import { messeSeite } from '../../scripts/visual-metrics/browser-messung.mjs';

const GERAETE = [
  { name: 'laptop-1280x720', width: 1280, height: 720, art: 'desktop' },
  { name: 'handy-360x640', width: 360, height: 640, art: 'handy' },
] as const;

const FAELLE = [
  { ansicht: 'liste', kennung: '@HE-070 @FU-057', text: 'Nicht übernommen – Turnier ist abgeschlossen', ziel: 'sync-failed-reason-r3-2a-1' },
  { ansicht: 'hinweis', kennung: '@FU-018', text: 'Turnier ist abgeschlossen – 2 Einträge an die Turnierleitung übergeben', ziel: 'outbox-notice' },
  { ansicht: 'uebernahme', kennung: '@HE-070', text: 'Das Turnier ist abgeschlossen – Übernehmen ist nicht mehr möglich', ziel: 'takeover-fehler' },
] as const;

const imGebautenStand = !!process.env.CI_E2E_USE_PREVIEW;

test.describe('R3-2a Texte nach dem Abschluss (T2-UI)', () => {
  test.skip(imGebautenStand, 'Prüfstand nur am Dev-Server (gehört nicht in den Build)');

  for (const fall of FAELLE) {
    for (const g of GERAETE) {
      for (const thema of ['light', 'dark'] as const) {
        test(`${fall.kennung} ${fall.ansicht}, ${g.name}, ${thema}: Text vollständig sichtbar, keine waagrechte Rollleiste, Messung ohne HART-Befund`, async ({ page }, testInfo) => {
          test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt Fenster selbst)');
          await page.setViewportSize({ width: g.width, height: g.height });
          await page.emulateMedia({ colorScheme: thema });
          await page.goto(`/tests/e2e/harness/abschluss-sync.html?ansicht=${fall.ansicht}`);

          const ziel = page.getByTestId(fall.ziel);
          await expect(ziel).toHaveText(fall.text);
          await expect(ziel).toBeInViewport({ ratio: 1 });
          if (fall.ansicht === 'liste') {
            await expect(page.getByTestId('sync-retry-r3-2a-1')).toHaveCount(0);
          }
          if (fall.ansicht === 'uebernahme') {
            await expect(page.getByTestId('takeover-confirm')).toBeDisabled();
          }
          const breite = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, fenster: window.innerWidth }));
          expect(breite.scroll, 'keine waagrechte Rollleiste').toBeLessThanOrEqual(breite.fenster);

          const ordner = process.env.R3_2A_BILDER ?? testInfo.outputDir;
          mkdirSync(ordner, { recursive: true });
          await page.screenshot({ path: join(ordner, `${fall.ansicht}-${g.name}-${thema}.png`) });

          const m: { befunde: { metrik: string; schwere?: string; ist: string }[] } = await page.evaluate(messeSeite, {
            art: g.art,
            g: { 'primaer.sichtbar': 0, 'touch.primaer': 56 },
            randPx: 0,
            primarySelektor: '[data-primary], [data-variant="primary"]',
            extraInhalte: [],
          });
          expect(m.befunde.filter((b) => b.metrik === 'primaer.sichtbar' || b.metrik === 'touch.primaer')).toEqual([]);
        });
      }
    }
  }
});
