/**
 * tests/e2e/cloud/smoke.spec.ts — Rauchtest der lokalen Cloud-Testumgebung (Task T3, Brief
 * Abschnitt 4). NUR ein Beweis, dass Login-je-Rolle + Sichtbarkeits-Grundregeln funktionieren —
 * die eigentlichen Rollen-Abläufe (Einladen, Rollenwechsel, DangerZone, ...) kommen in Task T4.
 *
 * Läuft nur in den `cloud-*`-Projekten (testDir `tests/e2e/cloud`, hängt von `cloud-setup` ab,
 * siehe playwright.config.ts). Braucht einen laufenden lokalen Stack mit Seed-Daten
 * (`npm run test:env:up` bzw. `test:env:reset` zuerst) — kein eigenständiger Start hier.
 */

import { test, expect } from './fixtures';
import {
  E2E_LIVE_CUP_ID,
  E2E_PUBLIC_CUP_ID,
  E2E_DRAFT_CUP_ID,
  E2E_STRANGER_CUP_ID,
  E2E_LIVE_CUP_TITLE,
  E2E_PUBLIC_CUP_TITLE,
  E2E_DRAFT_CUP_TITLE,
  E2E_STRANGER_CUP_TITLE,
  E2E_PUBLIC_CUP_SHARE_CODE,
} from './testData';

test.describe('Cloud-Rauchtest', () => {
  test('owner sieht Live-Cup, Public-Cup und Entwurf-Cup auf dem Dashboard', async ({ asRole }) => {
    const page = await asRole('owner');
    await page.goto('/#/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator(`[data-testid="tournament-card-${E2E_LIVE_CUP_ID}"]`)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(E2E_LIVE_CUP_TITLE, { exact: true })).toBeVisible();

    await expect(page.locator(`[data-testid="tournament-card-${E2E_PUBLIC_CUP_ID}"]`)).toBeVisible();
    await expect(page.getByText(E2E_PUBLIC_CUP_TITLE, { exact: true })).toBeVisible();

    await expect(page.locator(`[data-testid="tournament-card-${E2E_DRAFT_CUP_ID}"]`)).toBeVisible();
    await expect(page.getByText(E2E_DRAFT_CUP_TITLE, { exact: true })).toBeVisible();

    // Fremd-Cup (owner: stranger) darf NICHT sichtbar sein.
    await expect(page.locator(`[data-testid="tournament-card-${E2E_STRANGER_CUP_ID}"]`)).toHaveCount(0);
  });

  test('stranger sieht nur den Fremd-Cup', async ({ asRole }) => {
    const page = await asRole('stranger');
    await page.goto('/#/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator(`[data-testid="tournament-card-${E2E_STRANGER_CUP_ID}"]`)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(E2E_STRANGER_CUP_TITLE, { exact: true })).toBeVisible();

    await expect(page.locator(`[data-testid="tournament-card-${E2E_LIVE_CUP_ID}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-testid="tournament-card-${E2E_PUBLIC_CUP_ID}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-testid="tournament-card-${E2E_DRAFT_CUP_ID}"]`)).toHaveCount(0);
  });

  test('anonym erscheint der Public-Cup unter /#/live/E2EPUB', async ({ page }) => {
    await page.goto(`/#/live/${E2E_PUBLIC_CUP_SHARE_CODE}`);
    await page.waitForLoadState('networkidle');

    // getByText(exact) trifft zwei <h1>Public-Cup</h1> (Desktop- + Mobile-Kopfzeile, beide im
    // DOM, per CSS je nach Breakpoint ein-/ausgeblendet) -- .first() reicht, weil beide denselben
    // Text tragen und schon EIN sichtbarer Treffer den Turniernamen beweist.
    await expect(page.getByText(E2E_PUBLIC_CUP_TITLE, { exact: true }).first()).toBeVisible({ timeout: 15000 });
  });
});
