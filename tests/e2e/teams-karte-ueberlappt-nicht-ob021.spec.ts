/**
 * @OB-021 Reiter „Teams“ (Turnierleitung) am Handy: nichts überlappt, nichts ragt aus der Karte.
 * Gemessen bei 360 und 412 Pixeln mit „SG Taching/Tengling“ (Name mit Schrägstrich, @ZM-207) und offener Umbenennen-Bearbeitung:
 * - das Rechteck des Teamnamens schneidet das Rechteck des Auf-/Zuklapp-Pfeils nicht;
 * - der Pfeil ist mindestens 44 × 44 Pixel groß (VISUAL-DESIGN, Touch);
 * - „Abbrechen“ und „Speichern“ liegen vollständig in der Karte.
 * Saat: Messlauf-Turnier (`helpers/messlaufTaching.ts`), lokal ohne Datenbank. Bilder nach TEAMS_BILDER (sonst Testausgabe).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat } from '../../scripts/visual-metrics/saat/lader.mjs';
import { messSaat, SCHRAEGSTRICH_NAME, TURNIER_ID } from './helpers/messlaufTaching';
import { animationenFertig } from './helpers/animationenFertig';

const BREITEN = [360, 412, 768, 1280] as const;

interface Rechteck { links: number; rechts: number; oben: number; unten: number; breite: number; hoehe: number }

async function rechteck(page: Page, testId: string): Promise<Rechteck> {
  return page.getByTestId(testId).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { links: r.left, rechts: r.right, oben: r.top, unten: r.bottom, breite: r.width, hoehe: r.height };
  });
}

async function oeffne(page: Page, breite: number): Promise<{ id: string }> {
  await page.setViewportSize({ width: breite, height: 900 });
  const saat = messSaat();
  await installiereSaat(page.context(), saat);
  await page.goto(`/#/tournament/${TURNIER_ID}/teams`);
  const kopf = page.locator('[data-testid^="team-expand-toggle-"]').filter({ hasText: SCHRAEGSTRICH_NAME });
  await expect(kopf.first()).toBeVisible({ timeout: 25000 });
  const id = (await kopf.first().getAttribute('data-testid'))?.replace('team-expand-toggle-', '') ?? '';
  expect(id).not.toBe('');
  return { id };
}

async function bild(page: Page, outputDir: string, name: string): Promise<void> {
  const ordner = process.env.TEAMS_BILDER ?? outputDir;
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${name}.png`), fullPage: false });
}

for (const breite of BREITEN) {
  test.describe(`@OB-021 Teams-Karte bei ${String(breite)} Pixeln`, () => {
    test(`@OB-021 Teamname überlappt den Pfeil nicht, Pfeil ≥ 44 × 44 (${String(breite)})`, async ({ page }, testInfo) => {
      const { id } = await oeffne(page, breite);
      await animationenFertig(page);
      const name = await rechteck(page, `team-name-${id}`);
      const pfeil = await rechteck(page, `team-expand-arrow-${id}`);
      const karte = await rechteck(page, `team-card-${id}`);
      await bild(page, testInfo.outputDir, `${String(breite)}-zu`);
      // Jede Karte: der gerenderte Text jedes Namens (nicht nur sein Kasten) berührt den Pfeil seiner Karte nicht
      const ueberlaeufer = await page.locator('[data-testid^="team-card-"]').evaluateAll((karten) => karten.flatMap((k) => {
        const pfeilKasten = k.querySelector('[data-testid^="team-expand-arrow-"]')?.getBoundingClientRect();
        const text = k.querySelector('[data-testid^="team-name-"]');
        if (pfeilKasten === undefined || text === null) { return []; }
        const bereich = document.createRange();
        bereich.selectNodeContents(text);
        const trifft = Array.from(bereich.getClientRects()).some((r) => r.width > 0 && r.right > pfeilKasten.left && r.left < pfeilKasten.right && r.bottom > pfeilKasten.top && r.top < pfeilKasten.bottom);
        return trifft ? [text.textContent ?? ''] : [];
      }));
      expect(ueberlaeufer, 'kein Name läuft unter den Pfeil seiner Karte').toEqual([]);
      const ueberlappt = name.links < pfeil.rechts && pfeil.links < name.rechts && name.oben < pfeil.unten && pfeil.oben < name.unten;
      expect(ueberlappt, `Name ${JSON.stringify(name)} schneidet Pfeil ${JSON.stringify(pfeil)}`).toBe(false);
      expect(pfeil.breite, 'Pfeil Breite').toBeGreaterThanOrEqual(44);
      expect(pfeil.hoehe, 'Pfeil Höhe').toBeGreaterThanOrEqual(44);
      expect(name.rechts, 'Name endet in der Karte').toBeLessThanOrEqual(karte.rechts);
      expect(pfeil.rechts, 'Pfeil liegt in der Karte').toBeLessThanOrEqual(karte.rechts);
    });

    test(`@OB-021 Umbenennen offen: Abbrechen und Speichern liegen in der Karte (${String(breite)})`, async ({ page }, testInfo) => {
      const { id } = await oeffne(page, breite);
      await page.getByTestId(`team-expand-arrow-${id}`).click();
      await page.getByTestId(`team-edit-button-${id}`).click();
      await page.getByTestId(`team-rename-input-${id}`).fill('SG Tengling/Taching Neu');
      await animationenFertig(page);
      const karte = await rechteck(page, `team-card-${id}`);
      const speichern = await rechteck(page, `team-rename-save-${id}`);
      const gruppe = await rechteck(page, `team-rename-buttons-${id}`);
      await bild(page, testInfo.outputDir, `${String(breite)}-bearbeiten`);
      expect(speichern.rechts, 'Speichern endet in der Karte').toBeLessThanOrEqual(karte.rechts);
      expect(gruppe.rechts, 'Tastengruppe endet in der Karte').toBeLessThanOrEqual(karte.rechts);
      expect(speichern.links, 'Speichern beginnt in der Karte').toBeGreaterThanOrEqual(karte.links);
    });
  });
}
