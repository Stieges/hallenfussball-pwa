/**
 * R2 PR 3 – „Wertung bei Nichtantritt“ im Browser (lokaler Speicher/Gast, ohne Server), Laptop 1280 px und Handy 360 px.
 * - @W2A-025: Turnier-Einstellungen (Admin Center → Match Cockpit) und Wizard Schritt 3 (Abschnitt Match Cockpit Pro): vorbelegt 2,
 *   3 eingestellt → nach dem Neuladen steht 3 (gespeichert).
 * - @W2A-078: ist ein Spiel als Nichtantritt gewertet, ist das Feld gesperrt und der Grund steht am Feld.
 * Bilder für die Bildprüfung nach R2C_BILDER (sonst in den Ausgabeordner des Tests). Läuft nur im Projekt `desktop` (setzt die
 * Fenstergröße selbst).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { buildVisualTournament } from './visual/helpers';

const ID = 'r2c-wertung';
/** Team-IDs wie in `buildVisualTournament` (FC Nordstadt, SV Südpark, TSV Westtal). */
const TEAMS = ['00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a3'];
const ZEIT = '2026-03-14T09:00:00.000Z';

const spiel = (n: number, a: number, b: number, gewertet: boolean) => ({
  id: `r2c-m${String(n)}`, round: n, field: 1, isFinal: false, phase: 'groupStage',
  slotA: { kind: 'team', teamId: TEAMS[a] }, slotB: { kind: 'team', teamId: TEAMS[b] }, scheduledTime: ZEIT, time: '09:00',
  ...(gewertet
    ? { matchStatus: 'finished', status: 'FINISHED', scoreA: 2, scoreB: 0, decidedBy: 'forfeit', forfeitAbsent: 'B', finishedAt: '2026-03-14T09:10:00.000Z' }
    : { matchStatus: 'scheduled', status: 'SCHEDULED' }),
});

function turnier(gewertet: boolean): Record<string, unknown> {
  const basis = buildVisualTournament({ id: ID, title: 'Hallencup Nord', extra: { forfeitScore: { winner: 2, loser: 0 } } });
  return { ...basis, matches: [spiel(1, 0, 1, gewertet), spiel(2, 1, 2, false), spiel(3, 0, 2, false)] };
}

async function bild(page: Page, outputDir: string, name: string): Promise<void> {
  const ordner = process.env.R2C_BILDER ?? outputDir;
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${name}.png`), fullPage: false });
}

async function zumFeld(page: Page): Promise<void> {
  const feld = page.getByTestId('settings-forfeit-score-field');
  await feld.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
}

async function oeffneEinstellungen(page: Page): Promise<void> {
  await page.goto(`/#/tournament/${ID}/admin/match-cockpit`);
  await expect(page.getByTestId('settings-forfeit-score')).toBeVisible({ timeout: 15000 });
}

async function oeffneWizard(page: Page): Promise<void> {
  await page.goto(`/#/tournament/${ID}/edit?step=3`);
  const abschnitt = page.getByRole('button', { name: /Match Cockpit Pro/ });
  await expect(abschnitt).toBeVisible({ timeout: 15000 });
  if ((await abschnitt.getAttribute('aria-expanded')) === 'false') { await abschnitt.click(); }
  await expect(page.getByTestId('settings-forfeit-score')).toBeVisible();
}

const GERAETE = [
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'handy', width: 360, height: 800 },
] as const;

test.describe('Wertung bei Nichtantritt (@W2A-025, @W2A-078)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
  });

  for (const geraet of GERAETE) {
    test(`${geraet.name}: Turnier-Einstellungen – 3 eingestellt, nach dem Neuladen gespeichert (@W2A-025)`, async ({ page, seedIndexedDB }, testInfo) => {
      await page.setViewportSize({ width: geraet.width, height: geraet.height });
      await seedIndexedDB({ tournaments: [turnier(false)] });
      await oeffneEinstellungen(page);
      const feld = page.getByTestId('settings-forfeit-score');
      await expect(feld).toHaveValue('2');
      await expect(feld).toBeEnabled();
      await zumFeld(page);
      await bild(page, testInfo.outputDir, `einstellungen-frei-${geraet.name}`);

      await feld.fill('3');
      await feld.blur();
      await expect(page.getByTestId('settings-forfeit-score-field')).toContainText('3:0');
      await page.reload();
      await expect(page.getByTestId('settings-forfeit-score')).toHaveValue('3', { timeout: 15000 });
    });

    test(`${geraet.name}: Turnier-Einstellungen – ein Spiel gewertet: Feld gesperrt, Grund am Feld (@W2A-078)`, async ({ page, seedIndexedDB }, testInfo) => {
      await page.setViewportSize({ width: geraet.width, height: geraet.height });
      await seedIndexedDB({ tournaments: [turnier(true)] });
      await oeffneEinstellungen(page);
      await expect(page.getByTestId('settings-forfeit-score')).toBeDisabled();
      await expect(page.getByTestId('settings-forfeit-score-locked')).toContainText('schon ein Spiel als Nichtantritt gewertet');
      await zumFeld(page);
      await bild(page, testInfo.outputDir, `einstellungen-gesperrt-${geraet.name}`);
    });

    test(`${geraet.name}: Wizard Schritt 3 – Feld da, ungültiger Wert abgelehnt, gesperrt mit Wertung (@W2A-025, @W2A-078)`, async ({ page, seedIndexedDB }, testInfo) => {
      await page.setViewportSize({ width: geraet.width, height: geraet.height });
      await seedIndexedDB({ tournaments: [turnier(false)] });
      await oeffneWizard(page);
      const feld = page.getByTestId('settings-forfeit-score');
      await expect(feld).toHaveValue('2');
      await feld.fill('0');
      await feld.blur();
      await expect(page.getByTestId('settings-forfeit-score-field')).toContainText('Gültig: 1 bis 20 Tore');
      await zumFeld(page);
      await bild(page, testInfo.outputDir, `wizard-ungueltig-${geraet.name}`);

      await seedIndexedDB({ tournaments: [turnier(true)] });
      await oeffneWizard(page);
      await expect(page.getByTestId('settings-forfeit-score')).toBeDisabled();
      await expect(page.getByTestId('settings-forfeit-score-locked')).toBeVisible();
      await zumFeld(page);
      await bild(page, testInfo.outputDir, `wizard-gesperrt-${geraet.name}`);
    });
  }
});
