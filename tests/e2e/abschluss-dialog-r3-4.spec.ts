/**
 * R3-4 (Regel T2-UI): Dialog „Turnier abschließen“, Karten der Verwaltung und Zustand C im Browser – über den Prüfstand
 * tests/e2e/harness/abschluss-dialog.html, weil Konto, Server und ein abgeschlossenes Turnier offline fehlen. Echte Komponenten,
 * echte Tokens, echte Texte. Geräte Laptop 1280×720, Handy 360×640 und 390×844, je hell und dunkel; Bilder gegen die abgenommenen
 * Mockups Runde 2 (`mockups/runde-2026-10-25/abschluss-r2/`).
 * - @LZ-010/@LZ-012/@LZ-013 (A), @LZ-009 (B), @LZ-018 (Warnung), @LZ-019 (kein Netz), @LZ-021 (Speichern läuft/nicht bestätigt),
 *   @LZ-024 (Fehler), @LZ-007/@LZ-008/@LZ-005 (Verwaltung), @LZ-009/@LZ-039/@LZ-091 (Zustand C), @LZ-050/@LZ-091 kein Wieder-öffnen-Knopf.
 * Je Fall: Text sichtbar, keine waagrechte Rollleiste, Haupttaste im Bild (Handy: fester Fuß), `messeSeite` (visual:metrics) ohne
 * HART-Befund. Bilder: Ordner aus R3_4_BILDER (sonst Testausgabe). Läuft nur im Projekt `desktop` und nur am Dev-Server.
 */
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen; die echte Messfunktion von `npm run visual:metrics`
import { messeSeite } from '../../scripts/visual-metrics/browser-messung.mjs';

const GERAETE = [
  { name: 'laptop-1280x720', width: 1280, height: 720, art: 'desktop' },
  { name: 'handy-360x640', width: 360, height: 640, art: 'handy' },
  { name: 'handy-390x844', width: 390, height: 844, art: 'handy' },
] as const;

/** Die HART-Grenzwerte der visuellen Prüfung (`scripts/visual-metrics/grenzwerte.json`), die für Dialog und Verwaltung gelten. */
const GRENZEN = {
  'ueberlauf.dokument': 1, 'ueberlauf.element': 1, 'text.abgeschnitten': 1, 'ueberlappung.text': 2, 'verdeckt.bedienelement': true,
  'titel.wortbruch': 0, 'kontrast.text': 4.5, 'kontrast.text-gross': 3, 'touch.min': 44, 'touch.primaer': 56, 'primaer.sichtbar': 0, 'schrift.min': 11,
};

interface Szene { id: string; kennung: string; sichtbar: string; text: RegExp | string; haupt?: string; hauptText?: string; nicht?: string[] }

const SZENEN: Szene[] = [
  { id: 'dlg-a', kennung: '@LZ-010 @LZ-012 @LZ-013', sichtbar: 'finish-open-list', text: /3 Dinge sind noch offen/, haupt: 'finish-back', hauptText: 'Zurück zur Verwaltung', nicht: ['tournament-finish-confirm'] },
  { id: 'dlg-alang', kennung: '@LZ-010 (50-Zeichen-Namen)', sichtbar: 'finish-open-list', text: /Gleichstand auf Platz 1/, haupt: 'finish-back', nicht: ['tournament-finish-confirm'] },
  { id: 'dlg-b', kennung: '@LZ-009', sichtbar: 'finish-ready', text: /Das passiert beim Abschließen/, haupt: 'tournament-finish-confirm', hauptText: 'Turnier abschließen' },
  { id: 'dlg-blang', kennung: '@LZ-009 @LZ-018 (50-Zeichen-Namen, Warnung)', sichtbar: 'finish-winner', text: /Platz 1 per Strafstoßschießen entschieden/, haupt: 'tournament-finish-confirm' },
  { id: 'dlg-bw', kennung: '@LZ-018', sichtbar: 'finish-warning', text: /Feld 1: 2 Einträge noch nicht übertragen/, haupt: 'tournament-finish-confirm' },
  { id: 'dlg-silent', kennung: '@FU-068 Review #392 H2', sichtbar: 'finish-warning', text: /Gerät meldet sich nicht/, haupt: 'tournament-finish-confirm' },
  { id: 'dlg-bt', kennung: '@ZM-012', sichtbar: 'finish-consequences', text: /Endstand und Torschützen werden gespeichert/, haupt: 'tournament-finish-confirm' },
  { id: 'dlg-nonet', kennung: '@LZ-019', sichtbar: 'finish-offline', text: /Kein Netz/, haupt: 'tournament-finish-confirm' },
  { id: 'dlg-busy', kennung: '@LZ-021', sichtbar: 'finish-sending', text: /Der Endstand wird gespeichert/, haupt: 'tournament-finish-confirm', hauptText: 'Wird gespeichert' },
  { id: 'dlg-unconf', kennung: '@LZ-021', sichtbar: 'finish-unconfirmed', text: /Noch nicht bestätigt/, haupt: 'tournament-finish-retry', hauptText: 'Erneut versuchen' },
  { id: 'dlg-err', kennung: '@LZ-024', sichtbar: 'finish-error', text: /Es wurde nichts verändert/, haupt: 'tournament-finish-retry', hauptText: 'Erneut versuchen' },
  { id: 'dlg-stale', kennung: 'E4', sichtbar: 'finish-error', text: /Der Stand hat sich geändert/, haupt: 'tournament-finish-retry', hauptText: 'Stand neu laden' },
  { id: 'dlg-done-by', kennung: 'H-5 @LZ-026', sichtbar: 'finish-error', text: /Das Turnier hat Maria bereits abgeschlossen/, haupt: 'finish-back' },
  { id: 'vw-vorschlag', kennung: '@LZ-007', sichtbar: 'finish-suggestion', text: /Alles entschieden – Endstand prüfen und Turnier abschließen/, haupt: 'tournament-finish-open' },
  { id: 'vw-ohne', kennung: '@LZ-008', sichtbar: 'finish-status', text: /Einträge in der Klärungsliste sind noch offen/, nicht: ['finish-suggestion'] },
  { id: 'vw-spaet', kennung: '@LZ-005', sichtbar: 'finish-late-hint', text: /Das letzte Spiel war am/ },
  { id: 'c', kennung: '@LZ-009 @LZ-039 @LZ-091', sichtbar: 'tournament-ended', text: /Wieder öffnen geht nur über den Betreiber/, haupt: 'public-view-open', hauptText: 'Zuschauer-Ansicht öffnen' },
  { id: 'c-leer', kennung: '@LZ-009', sichtbar: 'late-entries-empty', text: /Bisher ist nach dem Abschluss nichts eingetroffen/, haupt: 'public-view-open' },
];

const imGebautenStand = !!process.env.CI_E2E_USE_PREVIEW;

async function messung(page: Page, art: string): Promise<{ metrik: string; selektor: string; ist: unknown }[]> {
  const m: { befunde: { metrik: string; selektor: string; ist: unknown; schwere?: string }[] } = await page.evaluate(messeSeite, {
    art, g: GRENZEN, randPx: 0, primarySelektor: '[data-primary], [data-variant="primary"]', extraInhalte: [],
  });
  return m.befunde.filter((b) => b.schwere === undefined || b.schwere === 'HART');
}

test.describe('R3-4 Turnier abschließen: Dialog, Verwaltung, Zustand C (T2-UI)', () => {
  test.skip(imGebautenStand, 'Prüfstand nur am Dev-Server (gehört nicht in den Build)');

  for (const szene of SZENEN) {
    for (const g of GERAETE) {
      for (const thema of ['light', 'dark'] as const) {
        test(`${szene.kennung} ${szene.id}, ${g.name}, ${thema}: Text sichtbar, Haupttaste im Bild, keine Rollleiste, Messung ohne HART-Befund`, async ({ page }, testInfo) => {
          test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt Fenster selbst)');
          await page.setViewportSize({ width: g.width, height: g.height });
          await page.emulateMedia({ colorScheme: thema });
          await page.goto(`/tests/e2e/harness/abschluss-dialog.html?szene=${szene.id}`);
          if (szene.id === 'dlg-nonet') {
            await expect(page.getByTestId('finish-ready')).toBeVisible();
            await page.context().setOffline(true); // „Kein Netz“ mitten im Dialog (@LZ-019)
            await expect(page.getByTestId('tournament-finish-confirm')).toBeDisabled();
            await expect(page.getByTestId('finish-footer-hint')).toHaveText('Abschließen geht erst mit Verbindung');
          }
          await expect(page.getByTestId(szene.sichtbar).first()).toBeVisible();
          await expect(page.locator('body')).toContainText(szene.text);
          if (szene.haupt !== undefined) {
            const haupt = page.getByTestId(szene.haupt).first();
            await expect(haupt).toBeVisible();
            if (szene.hauptText !== undefined) {
              await expect(haupt).toContainText(szene.hauptText);
            }
            if (szene.id.startsWith('dlg-') && g.art === 'handy') {
              await expect(haupt, 'Handy: die Haupttaste steht im festen Fuß, ohne Scrollen im Bild').toBeInViewport({ ratio: 1 });
            }
          }
          for (const weg of szene.nicht ?? []) {
            await expect(page.getByTestId(weg)).toHaveCount(0);
          }
          // Daniel 25.10.: nie ein Bestätigungs-Häkchen, nie ein Knopf „Wieder öffnen“
          await expect(page.getByRole('checkbox')).toHaveCount(0);
          await expect(page.getByRole('button', { name: /wieder öffnen/i })).toHaveCount(0);
          await page.evaluate(() => Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished))); // Einblend-Animation des Dialogs abwarten
          const breite = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, fenster: window.innerWidth }));
          expect(breite.scroll, 'keine waagrechte Rollleiste').toBeLessThanOrEqual(breite.fenster);

          const ordner = process.env.R3_4_BILDER ?? testInfo.outputDir;
          mkdirSync(ordner, { recursive: true });
          await page.screenshot({ path: join(ordner, `${szene.id}-${g.name}-${thema}.png`) });

          expect(await messung(page, g.art), `${szene.id} ${g.name} ${thema}: HART-Befunde der Messung`).toEqual([]);
        });
      }
    }
  }

  test('@LZ-009 Dialog B, Handy 360×640: der Inhalt scrollt, der Fuß mit der Haupttaste bleibt stehen', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt Fenster selbst)');
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/tests/e2e/harness/abschluss-dialog.html?szene=dlg-b');
    const haupt = page.getByTestId('tournament-finish-confirm');
    await expect(haupt).toBeInViewport({ ratio: 1 });
    await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
    const vorher = await haupt.boundingBox();
    const scrollt = await page.getByTestId('finish-dialog-body').locator('..').evaluate((el) => { el.scrollTop = el.scrollHeight; return el.scrollHeight > el.clientHeight; });
    expect(scrollt, 'der Inhalt ist länger als der Bildschirm und scrollt').toBe(true);
    const nachher = await haupt.boundingBox();
    expect(nachher?.y, 'der Fuß klebt unten, nur der Inhalt scrollt').toBe(vorher?.y);
    const hoehe = await page.getByTestId('finish-dialog').evaluate((el) => el.getBoundingClientRect().height);
    expect(hoehe, 'Vollbild').toBe(640);
  });

  test('@LZ-009 „Alle 6 Plätze anzeigen“ klappt die Liste auf und wieder zu', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt Fenster selbst)');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/tests/e2e/harness/abschluss-dialog.html?szene=dlg-b');
    await expect(page.getByTestId('finish-places').getByRole('listitem')).toHaveCount(3);
    await page.getByTestId('finish-places-toggle').click();
    await expect(page.getByTestId('finish-places').getByRole('listitem')).toHaveCount(6);
    await page.getByTestId('finish-places-toggle').click();
    await expect(page.getByTestId('finish-places').getByRole('listitem')).toHaveCount(3);
  });

  test('englische Texte: Dialog B auf Englisch', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt Fenster selbst)');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/tests/e2e/harness/abschluss-dialog.html?szene=dlg-b&sprache=en');
    await expect(page.getByTestId('tournament-finish-confirm')).toContainText('Close tournament');
    await expect(page.getByTestId('finish-consequences')).toContainText('Only the operator can reopen it.');
  });
});
