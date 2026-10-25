/**
 * R3-3 (Regel T2-UI): Sperre nach dem Abschluss im Browser (lokaler Speicher/Gast, ohne Server), Laptop 1280×720 und Handy 360×640,
 * hell und dunkel. Das Turnier trägt `lifecycleStatus: 'finished'` (so kommt der Server-Zustand an, R3-1).
 * - @LZ-036 / @ZP-087: Spielplan ohne „Spielplan bearbeiten“ und „Zeiten verschieben“; Teams und Einstellungen lesend mit dem Hinweis
 *   „Das Turnier ist abgeschlossen“ (statt „Ändern nur durch die Turnierleitung“); der Wizard (alle 5 Schritte) öffnet nicht.
 * - @LZ-037: Gefahrenbereich ohne „Ergebnisse zurücksetzen“; Zuschauer-Schalter gesperrt, „Öffentliche Ansicht“ bleibt bedienbar.
 * - Gegenbeispiel: dasselbe Turnier ohne Abschluss bietet alles an.
 * Je Fall: kein waagrechter Überlauf; Bilder nach R3_3_BILDER (sonst Testausgabe). Läuft nur im Projekt `desktop`, nur am Dev-Server.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { buildVisualTournament } from './visual/helpers';
// @ts-expect-error – .mjs ohne Typen; die echte Messfunktion von `npm run visual:metrics`
import { messeSeite } from '../../scripts/visual-metrics/browser-messung.mjs';

const ID = 'r3-3-sperre';
const TEAMS = ['00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a3'];
const ZEIT = '2026-03-14T09:00:00.000Z';

const spiel = (n: number, a: number, b: number) => ({
  id: `r33-m${String(n)}`, round: n, field: 1, isFinal: false, phase: 'groupStage',
  slotA: { kind: 'team', teamId: TEAMS[a] }, slotB: { kind: 'team', teamId: TEAMS[b] }, scheduledTime: ZEIT, time: '09:00',
  matchStatus: 'scheduled', status: 'SCHEDULED',
});

function turnier(abgeschlossen: boolean): Record<string, unknown> {
  const basis = buildVisualTournament({ id: ID, title: 'Hallencup Nord' });
  return {
    ...basis,
    publishedAt: '2026-03-01T08:00:00.000Z',
    isPublic: true,
    shareCode: 'ABC123',
    matches: [spiel(1, 0, 1), spiel(2, 1, 2), spiel(3, 0, 2)],
    ...(abgeschlossen ? { lifecycleStatus: 'finished' } : {}),
  };
}

const GERAETE = [
  { name: 'laptop', width: 1280, height: 720 },
  { name: 'handy', width: 360, height: 640 },
] as const;
const THEMEN = ['light', 'dark'] as const;

async function bild(page: Page, outputDir: string, name: string): Promise<void> {
  const ordner = process.env.R3_3_BILDER ?? outputDir;
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${name}.png`), fullPage: false });
}

async function keinUeberlauf(page: Page): Promise<void> {
  const breite = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, fenster: window.innerWidth }));
  expect(breite.scroll, 'keine waagrechte Rollleiste').toBeLessThanOrEqual(breite.fenster);
}

test.describe('R3-3 Sperre nach dem Abschluss (T2-UI)', () => {
  test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'nur am Dev-Server');
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
  });

  for (const g of GERAETE) {
    for (const thema of THEMEN) {
      test(`@LZ-036 @ZP-087 ${g.name}, ${thema}: abgeschlossen – Hinweis oben, Spielplan ohne Bearbeiten/Verschieben`, async ({ page, seedIndexedDB }, testInfo) => {
        await page.setViewportSize({ width: g.width, height: g.height });
        await page.emulateMedia({ colorScheme: thema });
        await seedIndexedDB({ tournaments: [turnier(true)] });
        await page.goto(`/#/tournament/${ID}/schedule`);
        await expect(page.getByTestId('tournament-closed-hint').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('tournament-closed-hint').first()).toContainText('Das Turnier ist abgeschlossen');
        await expect(page.getByTestId('schedule-edit-start')).toHaveCount(0);
        await expect(page.getByTestId('schedule-shift-button')).toHaveCount(0);
        await keinUeberlauf(page);
        await bild(page, testInfo.outputDir, `spielplan-abgeschlossen-${g.name}-${thema}`);
      });
    }

    test(`@LZ-036 ${g.name}: Teams und Einstellungen lesend mit „abgeschlossen“ statt „Turnierleitung“`, async ({ page, seedIndexedDB }, testInfo) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await seedIndexedDB({ tournaments: [turnier(true)] });
      await page.goto(`/#/tournament/${ID}/teams`);
      await expect(page.getByTestId('tournament-closed-hint').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('lead-only-hint')).toHaveCount(0);
      await keinUeberlauf(page);
      await bild(page, testInfo.outputDir, `teams-abgeschlossen-${g.name}`);

      await page.goto(`/#/tournament/${ID}/settings`);
      await expect(page.getByTestId('tournament-closed-hint').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('wizard-edit-edit-teams')).toHaveCount(0);
      await keinUeberlauf(page);
      await bild(page, testInfo.outputDir, `einstellungen-abgeschlossen-${g.name}`);
    });

    test(`@LZ-036 @ZP-087 ${g.name}: der Wizard öffnet in keinem der fünf Schritte, es steht der Hinweis mit Weg zurück`, async ({ page, seedIndexedDB }, testInfo) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await seedIndexedDB({ tournaments: [turnier(true)] });
      for (const schritt of [1, 2, 3, 4, 5]) {
        await page.goto(`/#/tournament/${ID}/edit?step=${String(schritt)}`);
        await expect(page.getByTestId('wizard-closed-notice')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('tournament-closed-hint')).toContainText('Das Turnier ist abgeschlossen');
      }
      await keinUeberlauf(page);
      const m: { befunde: { metrik: string }[] } = await page.evaluate(messeSeite, {
        art: g.name === 'handy' ? 'handy' : 'desktop',
        g: { 'primaer.sichtbar': 0, 'touch.primaer': 56 },
        randPx: 0,
        primarySelektor: '[data-primary], [data-variant="primary"]',
        extraInhalte: [],
      });
      expect(m.befunde.filter((b) => b.metrik === 'primaer.sichtbar' || b.metrik === 'touch.primaer')).toEqual([]);
      await bild(page, testInfo.outputDir, `wizard-abgeschlossen-${g.name}`);
      await page.getByTestId('wizard-closed-back').click();
      await expect(page).toHaveURL(new RegExp(`/tournament/${ID}$`));
    });

    test(`@LZ-037 ${g.name}: Gefahrenbereich ohne Zurücksetzen; Zuschauer-Schalter gesperrt, öffentliche Ansicht bedienbar`, async ({ page, seedIndexedDB }, testInfo) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await seedIndexedDB({ tournaments: [turnier(true)] });
      await page.goto(`/#/tournament/${ID}/admin/danger-zone`);
      await expect(page.getByTestId('tournament-closed-hint')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('danger-zone-delete')).toHaveCount(0);
      await bild(page, testInfo.outputDir, `gefahrenbereich-abgeschlossen-${g.name}`);

      await page.goto(`/#/tournament/${ID}/admin/visibility`);
      await expect(page.getByTestId('visibility-scores-toggle')).toBeDisabled({ timeout: 15000 });
      await expect(page.getByTestId('visibility-rankings-toggle')).toBeDisabled();
      await keinUeberlauf(page);
      await bild(page, testInfo.outputDir, `sichtbarkeit-abgeschlossen-${g.name}`);
    });

    test(`Gegenbeispiel ${g.name}: dasselbe Turnier ohne Abschluss – Spielplan bearbeiten, Verschieben, Wizard und Zuschauer-Schalter angeboten`, async ({ page, seedIndexedDB }) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await seedIndexedDB({ tournaments: [turnier(false)] });
      await page.goto(`/#/tournament/${ID}/schedule`);
      await expect(page.getByTestId('schedule-edit-start')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('schedule-shift-button')).toBeVisible();
      await expect(page.getByTestId('tournament-closed-hint')).toHaveCount(0);

      await page.goto(`/#/tournament/${ID}/admin/visibility`);
      await expect(page.getByTestId('visibility-scores-toggle')).toBeEnabled({ timeout: 15000 });

      await page.goto(`/#/tournament/${ID}/edit?step=2`);
      await expect(page.getByTestId('wizard-closed-notice')).toHaveCount(0);
    });
  }
});
