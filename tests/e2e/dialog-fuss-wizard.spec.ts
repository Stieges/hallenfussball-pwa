/**
 * S1-Fixrunde A3: Der Wizard nutzt den gemeinsamen Dialog-Baustein an zwei Stellen – „Neuplanung prüfen“ (ReplanPanel, `Dialog`
 * mit festem Kopf, Tasten im Inhalt) und die Rückfrage „Änderungen speichern?“ (ConfirmDialog mit Kopf- und Fuß-Slot).
 * Prüft bei 360×640 (hell/dunkel): Titel, Schließen bzw. Tasten stehen im Fenster, der Kopf bleibt beim Scrollen stehen; Bilder
 * nach S1_BILDER (Vorsatz S1_PHASE). Läuft nur im Projekt `desktop`.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { buildVisualTournament } from './visual/helpers';

const TEAMS = ['00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a4'];
const geplant = (id: string, round: number, a: number, b: number) => ({
  id, round, teamA: TEAMS[a], teamB: TEAMS[b], field: 1, matchStatus: 'scheduled', scheduledTime: `2026-03-14T09:${String(round * 10).padStart(2, '0')}:00.000Z`,
});

async function bild(page: Page, outputDir: string, name: string) {
  const ordner = process.env.S1_BILDER ?? outputDir;
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${process.env.S1_PHASE ?? 'lauf'}-${name}.png`) });
}

const imFenster = (page: Page, testid: string) =>
  page.evaluate((id) => {
    const r = document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
    return !!r && r.top >= 0 && r.bottom <= window.innerHeight;
  }, testid);

test.describe('S1 Wizard: gemeinsamer Dialog bei 360×640', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
  });

  for (const thema of ['light', 'dark'] as const) {
    test(`${thema}: Neuplanung prüfen (ReplanPanel) – Kopf fest, Tasten erreichbar`, async ({ page, seedIndexedDB }, testInfo) => {
      await page.setViewportSize({ width: 360, height: 640 });
      await page.emulateMedia({ colorScheme: thema });
      const turnier = buildVisualTournament({ id: 'wiz1', title: 'Nordstadt Hallencup', matches: [geplant('m1', 1, 0, 2), geplant('m2', 2, 1, 3), geplant('m3', 3, 0, 3)].map((m) => ({ ...m, matchStatus: 'scheduled' as const })) });
      await seedIndexedDB({ tournaments: [turnier] });
      await page.goto('/#/tournament/wiz1/edit');
      await page.locator('button', { hasText: /^6$/ }).click();
      await page.getByTestId('wizard-show-preview').click();
      await expect(page.getByTestId('replan-panel')).toBeVisible();
      await page.waitForTimeout(600);
      await bild(page, testInfo.outputDir, `wizard-replan-handy-360x640-${thema}-geoeffnet`);
      const kopf = await page.getByTestId('dialog-surface-header').boundingBox();
      expect(kopf && kopf.y >= 0 && kopf.y + kopf.height <= 640).toBe(true);
      await page.mouse.move(180, 400);
      for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 3000); await page.waitForTimeout(120); }
      const kopfNachher = await page.getByTestId('dialog-surface-header').boundingBox();
      expect(kopfNachher?.y).toBeCloseTo(kopf?.y ?? -1, 0);
      await bild(page, testInfo.outputDir, `wizard-replan-handy-360x640-${thema}-ganz-unten`);
      expect(await page.getByRole('button', { name: 'Abbrechen' }).last().boundingBox().then((b) => !!b && b.y + b.height <= 640)).toBe(true);
    });

    test(`${thema}: Rückfrage „Änderungen speichern?“ – drei Tasten im Fuß`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 360, height: 640 });
      await page.emulateMedia({ colorScheme: thema });
      await page.goto('/#/tournament/new');
      await page.locator('input[placeholder*="Hallencup"]').first().fill('Wizard Testturnier');
      await page.getByRole('button', { name: 'Zurück' }).first().click();
      await expect(page.getByTestId('confirm-dialog-confirm')).toBeVisible();
      await page.waitForTimeout(600);
      await bild(page, testInfo.outputDir, `wizard-rueckfrage-handy-360x640-${thema}`);
      expect(await imFenster(page, 'confirm-dialog-confirm')).toBe(true);
      expect(await imFenster(page, 'dialog-surface-header')).toBe(true);
      // keine Taste läuft seitlich aus dem Fenster (drei Tasten umbrechen)
      for (const id of ['confirm-dialog-cancel', 'confirm-dialog-secondary', 'confirm-dialog-confirm']) {
        const b = await page.getByTestId(id).boundingBox();
        expect(b && b.x >= 0 && b.x + b.width <= 360, `${id}: ${JSON.stringify(b)}`).toBe(true);
      }
      await expect(page.getByTestId('dialog-surface-footer').getByTestId('confirm-dialog-confirm')).toBeVisible();
    });
  }
});
