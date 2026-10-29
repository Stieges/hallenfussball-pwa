/**
 * M1b (@ME-071, @ME-072): Monitor-Editor mit Entwurf, Speichern und Abbrechen im Browser.
 * Geräte Laptop 1440×900, Handy 360×640 und 390×844; Fuß mit „Abbrechen“/„Speichern“ bleibt im Bild, `messeSeite`
 * (visual:metrics) am geöffneten Dialog ohne HART-Befund (Haupttaste sichtbar, Touch-Ziel). Bilder: Ordner aus M1B_BILDER.
 * Läuft nur im Projekt `desktop`.
 */
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { buildVisualTournament } from './visual/helpers';
// @ts-expect-error – .mjs ohne Typen; die echte Messfunktion von `npm run visual:metrics`
import { messeSeite } from '../../scripts/visual-metrics/browser-messung.mjs';

const ID = 'monitor-editor-m1b';
const GERAETE = [
  { name: 'laptop-1440x900', width: 1440, height: 900, art: 'desktop' },
  { name: 'handy-360x640', width: 360, height: 640, art: 'handy' },
  { name: 'handy-390x844', width: 390, height: 844, art: 'handy' },
] as const;

const MONITOR = {
  id: 'mon-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500, theme: 'dark',
  performanceMode: 'auto', slides: [
    { id: 's1', type: 'live', config: { fieldId: 'field-1' }, duration: null, order: 0 },
    { id: 's2', type: 'next-matches', config: { matchCount: 3 }, duration: null, order: 1 },
  ],
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
};

async function oeffneEditor(page: Page, seed: (d: Record<string, unknown>) => Promise<void>) {
  await seed({ tournaments: [buildVisualTournament({ id: ID, title: 'Nordstadt Hallencup', monitors: [MONITOR] })] });
  await page.goto(`/#/tournament/${ID}/monitors`);
  await page.getByRole('button', { name: /bearbeiten/ }).first().click();
  await expect(page.getByTestId('monitor-editor-save')).toBeVisible();
  await page.waitForTimeout(500);
}

async function bild(page: Page, testInfo: { outputDir: string }, name: string) {
  const ordner = process.env.M1B_BILDER ?? testInfo.outputDir;
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${name}.png`) });
}

test.describe('@ME-071 @ME-072 Monitor-Editor mit Speichern und Abbrechen', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
  });

  for (const g of GERAETE) {
    test(`${g.name}: Fuß mit „Abbrechen“ und „Speichern“ im Bild, Messung ohne HART-Befund`, async ({ page, seedIndexedDB }, testInfo) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await oeffneEditor(page, seedIndexedDB);
      await bild(page, testInfo, `editor-${g.name}`);

      for (const id of ['monitor-editor-cancel', 'monitor-editor-save']) {
        const box = await page.getByTestId(id).boundingBox();
        expect(box, id).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThanOrEqual(g.height);
      }
      const save = await page.getByTestId('monitor-editor-save').boundingBox();
      expect(save!.height).toBeGreaterThanOrEqual(56);

      const m: { befunde: { metrik: string; ist: string }[] } = await page.evaluate(messeSeite, {
        art: g.art,
        g: { 'primaer.sichtbar': 0, 'touch.primaer': 56, 'touch.min': 44, 'ueberlauf.dokument': 1 },
        randPx: 0,
        primarySelektor: '[data-primary], [data-variant="primary"]',
        extraInhalte: [],
      });
      expect(m.befunde.filter((b) => ['primaer.sichtbar', 'touch.primaer', 'ueberlauf.dokument'].includes(b.metrik))).toEqual([]);
    });
  }

  test('laptop: Änderung, „Abbrechen“ verwirft; Änderung, ✕ fragt, „Speichern“ zeigt „Gespeichert“ und der Wert gilt', async ({ page, seedIndexedDB }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await oeffneEditor(page, seedIndexedDB);

    await page.getByLabel('Slide-Dauer (Sek.)').selectOption('30');
    await page.getByTestId('monitor-editor-cancel').click();
    await expect(page.getByTestId('monitor-editor-save')).toBeHidden();
    await page.getByRole('button', { name: /bearbeiten/ }).first().click();
    await expect(page.getByLabel('Slide-Dauer (Sek.)')).toHaveValue('15');

    await page.getByLabel('Slide-Dauer (Sek.)').selectOption('30');
    await page.getByTestId('monitor-editor-close').click();
    await expect(page.getByText('Änderungen verwerfen?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Weiter bearbeiten' })).toBeFocused();
    // Einblendung abwarten: die Fläche der Rückfrage muss deckend sein
    await expect.poll(() => page.evaluate(() => {
      const panels = [...document.querySelectorAll<HTMLElement>('[role="alertdialog"], [role="dialog"]')];
      return Math.min(...panels.map((p) => Number(getComputedStyle(p).opacity)));
    })).toBe(1);
    await bild(page, testInfo, 'rueckfrage-laptop-1440x900');
    await page.getByRole('button', { name: 'Weiter bearbeiten' }).click();

    await page.getByTestId('monitor-editor-save').click();
    await expect(page.getByText('Gespeichert')).toBeVisible();
    await expect(page.getByTestId('monitor-editor-save')).toBeHidden();
    await page.getByRole('button', { name: /bearbeiten/ }).first().click();
    await expect(page.getByLabel('Slide-Dauer (Sek.)')).toHaveValue('30');
  });

  test('laptop: leerer Name zeigt den Hinweis am Feld, nichts wird gespeichert', async ({ page, seedIndexedDB }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await oeffneEditor(page, seedIndexedDB);
    await page.getByLabel('Name', { exact: true }).fill('');
    await page.getByTestId('monitor-editor-save').click();
    await expect(page.getByTestId('monitor-name-error')).toHaveText('Name ist erforderlich');
    await expect(page.getByTestId('monitor-editor-save')).toBeVisible();
    await bild(page, testInfo, 'namensfehler-laptop-1440x900');
  });
});
