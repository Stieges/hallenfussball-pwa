/**
 * Tabellenzeile im Spielplan der Verwaltung am Laptop (Entscheidung Daniel 18.10., @OB-065, @OB-066, @ZM-162):
 * Abzeichen statt Uhrzeit in derselben Spalte – die Feld-Spalte steht in jeder Zeile an derselben Stelle –, im Ergebnisfeld
 * der Stand mit der Restzeit klein darunter, ohne das Wort „Restzeit“.
 * Saat `hallencup-messlauf`; ein Gruppenspiel läuft (seit 65 s, 1:0), ein weiteres ist geplant, ein drittes ist ausgefallen
 * (langes Abzeichen „ausgefallen“: die Spalte darf sich nicht nach dem Inhalt richten).
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

interface SaatSpiel { id: string; isFinal?: boolean; matchStatus?: string; scoreA?: number; scoreB?: number; timerStartTime?: string; timerElapsedSeconds?: number; finishedAt?: string; decidedBy?: string; liveState?: unknown }

async function oeffne(page: Page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  const saat = leseSaat('hallencup-messlauf');
  const turnier = saat.datenbanken[0].eintraege.tournaments.find((t: { id: string }) => t.id === 'hallencup-messlauf') as { matches: SaatSpiel[] };
  const gruppe = turnier.matches.filter((m) => m.isFinal !== true);
  Object.assign(gruppe[0], { matchStatus: 'running', scoreA: 1, scoreB: 0, timerElapsedSeconds: 0, timerStartTime: '@jetzt-65s', finishedAt: undefined, decidedBy: undefined, liveState: undefined });
  Object.assign(gruppe[2], { matchStatus: 'skipped', scoreA: undefined, scoreB: undefined, timerStartTime: undefined, timerElapsedSeconds: undefined, finishedAt: undefined, decidedBy: undefined, skippedReason: 'Platz gesperrt', liveState: undefined });
  for (const m of [gruppe[1]]) {
    Object.assign(m, { matchStatus: 'scheduled', scoreA: undefined, scoreB: undefined, timerStartTime: undefined, timerElapsedSeconds: undefined, finishedAt: undefined, decidedBy: undefined, liveState: undefined });
  }
  // die Engine-Kopien dieser Spiele entfernen: in der Verwaltung hat die Engine Vorrang vor dem Zwischenspeicher
  const ids = [gruppe[0].id, gruppe[1].id, gruppe[2].id].map((id) => id.toLowerCase());
  const kopien = saat.datenbanken[1].eintraege as Record<string, { matchId: string }>;
  saat.datenbanken[1].eintraege = Object.fromEntries(Object.entries(kopien).filter(([, kopie]) => !ids.includes(kopie.matchId)));
  await installiereSaat(page.context(), saat);
  await page.goto('/#/tournament/hallencup-messlauf/schedule');
  await expect(page.locator('[data-testid^="match-row-time-"]').first()).toBeVisible({ timeout: 25000 });
}

const spalte = async (page: Page, zeile: string) => (await page.locator(`[role="row"]:has([data-testid="${zeile}"])`).locator('text=/^Feld 1$|^Feld 2$/').first().boundingBox())?.x;

test.describe('@OB-065 Abzeichen statt Uhrzeit in der Tabellenzeile', () => {
  test('@OB-065 Live-Zeile: „Live“ statt Uhrzeit, geplante Zeile: Uhrzeit; „Feld“ steht in beiden an derselben x-Position (±1 px)', async ({ page }) => {
    await oeffne(page);
    const zeiten = page.locator('[data-testid^="match-row-time-"]');
    const live = zeiten.filter({ hasText: /^Live$/ });
    const geplant = zeiten.filter({ hasText: /^\d{2}:\d{2}$/ });
    await expect(live).toHaveCount(1);
    expect(await geplant.count()).toBeGreaterThan(0);
    const idLive = await live.first().getAttribute('data-testid');
    const idGeplant = await geplant.first().getAttribute('data-testid');
    const xLive = await spalte(page, idLive ?? '');
    const xGeplant = await spalte(page, idGeplant ?? '');
    expect(xLive).toBeDefined();
    expect(Math.abs((xLive ?? 0) - (xGeplant ?? 100))).toBeLessThanOrEqual(1);
    const ausgefallen = zeiten.filter({ hasText: /^ausgefallen$/ });
    await expect(ausgefallen).toHaveCount(1);
    const xAusgefallen = await spalte(page, (await ausgefallen.first().getAttribute('data-testid')) ?? '');
    expect(Math.abs((xAusgefallen ?? 0) - (xLive ?? 100))).toBeLessThanOrEqual(1);
    // nie beides: die Live-Zeile trägt keine Uhrzeit in der Zeit-Spalte
    await expect(live.first()).not.toContainText(/\d{2}:\d{2}/);
  });

  test('@ZM-162 Ergebnisfeld der Live-Zeile: Stand „1:0“, darunter klein die Restzeit (9:xx) ohne das Wort „Restzeit“', async ({ page }) => {
    await oeffne(page);
    const uhr = page.locator('[data-testid^="match-row-clock-"]');
    await expect(uhr).toHaveCount(1);
    await expect(uhr).toHaveText(/^8:5\d$|^8:4\d$/);
    const feld = page.locator('[data-testid^="match-circle-"]', { has: uhr });
    await expect(feld).toContainText('1:0');
    await expect(feld).not.toContainText('Restzeit');
  });
});
