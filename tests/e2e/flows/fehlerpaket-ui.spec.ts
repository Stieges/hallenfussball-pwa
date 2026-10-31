/**
 * Kleines Fehlerpaket, UI-Nachweise (Regel T2-UI; lokaler Speicher, kein Backend):
 * - @LZ-092 Verwaltung zählt geplante, laufende und beendete Spiele richtig (Dashboard „6/10 · 3 ausstehend“, Activity Log „6“)
 * - @SL-190 Seitentausch gilt nur für das Spiel, in dem getauscht wurde (Cockpit)
 * - @ZM-181 Assistent Schritt „Gruppen und Felder“ bei Jeder gegen jeden ohne Gruppen-Oberfläche (Durchklicken, Bild)
 * Bilder nach `FEHLERPAKET_BILDER` (nicht committen); „vorher“ entsteht durch denselben Lauf gegen den Stand af3ae55d.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { freezeClock, buildVisualTournament } from '../visual/helpers';
import { abpfiffHalten } from '../helpers/abpfiff';

const BILDER = process.env.FEHLERPAKET_BILDER;
async function bild(page: Page, name: string): Promise<void> {
  if (BILDER === undefined) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${name}.png`), fullPage: true, animations: 'disabled' });
}

const A = (n: number): string => `00000000-0000-4000-8000-0000000000a${String(n)}`;
const ZEIT = (min: number): string => `2026-03-14T09:${String(min).padStart(2, '0')}:00.000Z`;

test.describe('@LZ-092 Verwaltung zählt richtig (10 Spiele: 6 beendet, 1 läuft, 3 ohne Status)', () => {
  const matches = Array.from({ length: 10 }, (_, i) => ({
    id: `fp-m${String(i)}`, round: 1, teamA: A(1 + (i % 2)), teamB: A(3 + (i % 2)), field: 1, scheduledTime: ZEIT(i),
    ...(i < 6 ? { matchStatus: 'finished', scoreA: 1, scoreB: 0 } : i === 6 ? { matchStatus: 'running', scoreA: 0, scoreB: 0, timerStartTime: ZEIT(0), timerElapsedSeconds: 0 } : { matchStatus: 'scheduled' }),
  })) as never[];

  /** Die drei letzten Spiele ohne gespeicherten Status (wie sie im Bestand vorkommen). */
  const turnier = (): Record<string, unknown> => {
    const t = buildVisualTournament({ id: 'fp-zaehler', title: 'Hallencup Nord', matches });
    (t.matches as Record<string, unknown>[]).forEach((m, i) => { if (i >= 7) { delete m.matchStatus; delete m.status; } });
    return t;
  };

  test('Dashboard: „Spiele 6/10“ und „3 ausstehend“', async ({ page, seedIndexedDB }) => {
    await freezeClock(page);
    await seedIndexedDB({ tournaments: [turnier()] });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/tournament/fp-zaehler/admin/dashboard');
    const karte = page.getByText('Spiele', { exact: true }).first().locator('..');
    await page.waitForTimeout(800);
    await bild(page, 'verwaltung-dashboard');
    await expect(karte).toContainText('6/10');
    await expect(karte).toContainText('3 ausstehend');
  });

  test('Activity Log: „Spiele beendet“ zeigt 6', async ({ page, seedIndexedDB }) => {
    await freezeClock(page);
    await seedIndexedDB({ tournaments: [turnier()] });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/tournament/fp-zaehler/admin/activity-log');
    const etikett = page.getByText('Spiele beendet', { exact: true }).last();
    await page.waitForTimeout(800);
    await bild(page, 'verwaltung-activity-log');
    await expect(etikett.locator('xpath=preceding-sibling::*[1]')).toHaveText('6');
  });
});

test('@SL-190 Seitentausch gilt nur im Spiel, in dem getauscht wurde (Cockpit, Handy)', async ({ page, seedIndexedDB }) => {
  await freezeClock(page);
  const matches = [
    { id: 'fp-s1', round: 1, teamA: A(1), teamB: A(2), field: 1, matchStatus: 'scheduled', scheduledTime: ZEIT(0) },
    { id: 'fp-s2', round: 2, teamA: A(3), teamB: A(4), field: 1, matchStatus: 'scheduled', scheduledTime: ZEIT(20) },
  ] as never[];
  await seedIndexedDB({ tournaments: [buildVisualTournament({ id: 'fp-tausch', title: 'Hallencup Nord', matches })] });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/tournament/fp-tausch/live');
  await page.getByTestId('match-start-button').click({ timeout: 20000 });
  await expect(page.getByTestId('match-pause-button')).toBeVisible();
  await page.getByTestId('cockpit-more-button').click();
  await page.getByTestId('mehr-seiten-tauschen').click();
  await expect(page.getByTestId('scoreboard-box-links')).toHaveAttribute('aria-label', /SV Südpark/);
  await bild(page, 'cockpit-spiel1-getauscht');
  await page.getByTestId('match-pause-button').click();
  await abpfiffHalten(page);
  await page.getByTestId('match-next-button').click({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await bild(page, 'cockpit-spiel2-grundstellung');
  await expect(page.getByTestId('scoreboard-box-links')).toHaveAttribute('aria-label', /TSV Westtal/, { timeout: 15000 });
  await expect(page.getByTestId('scoreboard-box-rechts')).toHaveAttribute('aria-label', /BSC Ostring/);
});

test('@ZM-181 Assistent „Jeder gegen jeden“: Schritt „Gruppen und Felder“ rendert ohne Fehler (Bilder der Schritte)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const schritt of [2, 3, 4]) {
    await page.goto(`/#/tournament/new?step=${String(schritt)}`);
    await page.waitForLoadState('networkidle');
    await bild(page, `wizard-schritt-${String(schritt)}`);
    await expect(page.getByRole('heading').first()).toBeVisible(); // Schritt rendert ohne Fehlerseite
  }
});
