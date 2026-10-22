/**
 * B-15 – Zuschauer-Seite ohne Neuladen (ohne lokalen Stack): die Seite liest im Takt von 10 Sekunden und im Hintergrund gar nicht.
 *
 * Quelle ist der heutige Weg (Adapter (a)) über den lokalen Speicher des Browsers (Saat `hallencup-messlauf`, /live/MESS26): ändert
 * sich der Eintrag im Speicher, ist das für die Seite „das Tor auf dem Server“. Gemessen wird in echter Zeit:
 *  - @ZM-021 Tor → nach höchstens 10 Sekunden steht der neue Stand da, ohne Neuladen und ohne Navigation.
 *  - @ZM-029 @ZM-030 Seite im Hintergrund: in dieser Zeit ändert sich nichts; zurück im Vordergrund steht der Stand nach höchstens 10 Sekunden da.
 * Das Gegenstück mit zwei Kontexten gegen den Server (Tor von Tom → Mama Petras Handy) bleibt `public-view.cloud.spec.ts`.
 * Läuft nur im Projekt `desktop` (setzt das Fenster selbst).
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const HANDY = { width: 360, height: 640 };
const FINALE = '00000003-0000-4000-8000-000000000016';
const TAKT_MS = 10_000;

interface StoredMatch { id: string; scoreA?: number }
interface StoredTournament { id: string; matches: StoredMatch[] }

/** Setzt die Tore der Heimseite des Finales im lokalen Speicher, wie ein Tor auf dem Server. */
async function setzeFinaleHeimtore(page: Page, tore: number): Promise<void> {
  await page.evaluate(async ({ finale, tore: neu }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('hallenfussball', 1);
      request.onsuccess = () => { resolve(request.result); };
      request.onerror = () => { reject(request.error ?? new Error('IndexedDB')); };
    });
    const entry = await new Promise<{ key: string; value: StoredTournament[] }>((resolve, reject) => {
      const request = db.transaction('cache', 'readonly').objectStore('cache').get('tournaments');
      request.onsuccess = () => { resolve(request.result as { key: string; value: StoredTournament[] }); };
      request.onerror = () => { reject(request.error ?? new Error('IndexedDB')); };
    });
    const value = entry.value.map((t) => (t.id === 'hallencup-messlauf'
      ? { ...t, matches: t.matches.map((m) => (m.id === finale ? { ...m, scoreA: neu } : m)) }
      : t));
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('cache', 'readwrite');
      tx.objectStore('cache').put({ key: 'tournaments', value });
      tx.oncomplete = () => { resolve(); };
      tx.onerror = () => { reject(tx.error ?? new Error('IndexedDB')); };
    });
    db.close();
  }, { finale: FINALE, tore });
}

async function setzeSichtbarkeit(page: Page, state: 'visible' | 'hidden'): Promise<void> {
  await page.evaluate((next) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => next });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

const heimtore = (page: Page) => page.locator(`[data-testid="final-card-${FINALE}"] [data-testid^="final-goals-"]`).nth(0);

test.describe('B-15 Zuschauer-Seite 360×640 ohne Neuladen (/live/MESS26)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'setzt das Fenster selbst');
    await page.setViewportSize(HANDY);
    await installiereSaat(page.context(), leseSaat('hallencup-messlauf'));
    await page.goto('/#/live/MESS26');
    await expect(heimtore(page)).toHaveText('2', { timeout: 25000 });
  });

  test('@ZM-021 ein Tor im Finale steht nach höchstens 10 Sekunden auf der Seite, ohne Neuladen', async ({ page }) => {
    test.setTimeout(60_000);
    let neuGeladen = false;
    page.on('framenavigated', () => { neuGeladen = true; });
    await setzeFinaleHeimtore(page, 3);
    await expect(heimtore(page)).toHaveText('3', { timeout: TAKT_MS + 3000 });
    expect(neuGeladen).toBe(false);
  });

  test('@ZM-029 @ZM-030 im Hintergrund ändert sich nichts; zurück im Vordergrund steht der Stand nach höchstens 10 Sekunden da', async ({ page }) => {
    test.setTimeout(90_000);
    await setzeSichtbarkeit(page, 'hidden');
    await setzeFinaleHeimtore(page, 4);
    await page.waitForTimeout(TAKT_MS + 4000);
    // Gegenbeispiel zum Vordergrund: zwei Takte lang kein Abruf, der Stand von vorher bleibt
    await expect(heimtore(page)).toHaveText('2');

    await setzeSichtbarkeit(page, 'visible');
    await expect(heimtore(page)).toHaveText('4', { timeout: TAKT_MS + 3000 });
  });
});
