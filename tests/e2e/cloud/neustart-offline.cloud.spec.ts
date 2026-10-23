/**
 * tests/e2e/cloud/neustart-offline.cloud.spec.ts — A-07g: @FU-007 "Neustart ohne Netz".
 *
 * Szenario (docs/anforderungen/plattform/2026-09-24_fundament-gemeinsamer-stand.md):
 *   Gegeben Toms Gerät hat kein Netz und 2 wartende Einträge
 *   Wenn der Browser beendet und die App neu geöffnet wird
 *   Dann öffnet sich das Spiel auf Feld 2 mit dem lokalen Stand
 *   Und das Gerät zeigt "2 Einträge warten"
 *
 * Was "offline öffnen" hier bedeutet (ehrlich): Die Cloud-Projekte laufen mit `serviceWorkers: 'block'`
 * (playwright.config.ts) und der Dev-Server liefert keinen Service Worker (`devOptions.enabled: false`).
 * Ein Seitenaufruf mit `context.setOffline(true)` scheitert deshalb schon am App-Code selbst. Der
 * Neustart wird so nachgestellt: Der App-Code kommt vom Dev-Server (wie aus dem Service-Worker-Cache),
 * aber JEDE Verbindung zum Backend ist getrennt (HTTP abgebrochen, Realtime-Socket zu,
 * `navigator.onLine === false`). Der Gerätespeicher (IndexedDB + localStorage) wird per
 * `storageState({ indexedDB: true })` vom ersten Context in den neuen übernommen.
 * Nicht bewiesen wird damit, dass der Service Worker die App-Hülle offline ausliefert.
 *
 * "Feld 2": der Engine-Cup hat genau ein Spiel; das Feld ist für die Szenario-Aussage (das Spiel
 * der Person öffnet sich) nicht ausschlaggebend und wird nicht geprüft.
 */

import { test, expect } from './fixtures';
import { engineCupTarget, expectEngineMatchRunningUi, expectOutboxSettled, expectSeededEngineMatch, fetchEngineRows, newRoleContext, openCockpit } from './engineHelpers';
import { AUTH_DIR } from './fixtures';
import { getLocalServiceRoleClient } from './helpers';
import { enterGoal } from './helpers';
import { engineCupIds } from './testData';
import path from 'node:path';
import type { Browser, BrowserContext, Page } from '@playwright/test';

/** Trennt jede Verbindung zum Backend (HTTP, Realtime, Anmeldung); der App-Code vom Dev-Server bleibt erreichbar. */
async function cutBackend(context: BrowserContext): Promise<void> {
  const backendOrigin = new URL(getLocalServiceRoleClient().url).origin;
  await context.route((url) => url.origin === backendOrigin, (route) => route.abort('internetdisconnected'));
  await context.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    void ws.close();
  });
  await context.addInitScript(() => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false });
  });
}

async function newConsentContext(browser: Browser, storageState: Awaited<ReturnType<BrowserContext['storageState']>> | string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ storageState });
  await context.addInitScript(() => {
    window.localStorage.setItem('app:consent', JSON.stringify({ errorTracking: true, sessionReplay: false, timestamp: Date.now(), version: 1 }));
  });
  return { context, page: await context.newPage() };
}

test.describe('@FU-007 Neustart ohne Netz', () => {
  test('@FU-007 zwei Einträge offline, Browser zu, neu geöffnet ohne Netz: das Spiel öffnet sich mit dem lokalen Stand und "2 Einträge warten"', async ({ browser }) => {
    test.setTimeout(90_000);
    const ids = engineCupIds('NEUSTART');
    const baseRows = await expectSeededEngineMatch(engineCupTarget('NEUSTART'));
    const first = await newRoleContext(browser, 'helper');
    let snapshot: Awaited<ReturnType<BrowserContext['storageState']>>;
    try {
      await openCockpit(first.page, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(first.page);
      await expectOutboxSettled(first.page);
      await expect(first.page.locator('[data-testid="scoreboard-box-links"]')).toHaveText('1');

      await first.context.setOffline(true);
      await enterGoal(first.page, 'home');
      await enterGoal(first.page, 'away');
      await expect(first.page.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '2', { timeout: 5000 });
      await expect(first.page.locator('[data-testid="scoreboard-box-links"]')).toHaveText('2');
      await expect(first.page.locator('[data-testid="scoreboard-box-rechts"]')).toHaveText('1');
      snapshot = await first.context.storageState({ indexedDB: true });
    } finally {
      // "Browser beenden": der Context ist weg, nur der Gerätespeicher bleibt in `snapshot`.
      await first.context.close();
    }
    expect((await fetchEngineRows(ids.matchId)).length).toBe(baseRows);

    const second = await newConsentContext(browser, snapshot);
    try {
      await cutBackend(second.context);
      await openCockpit(second.page, ids.tournamentId, ids.matchId);
      // Das Spiel öffnet sich mit dem lokalen Stand 2:1 (Seed 1:0 plus zwei lokale Tore) ...
      await expect(second.page.locator('[data-testid="scoreboard-state"]')).toHaveText('Live', { timeout: 15000 });
      await expect(second.page.locator('[data-testid="scoreboard-box-links"]')).toHaveText('2', { timeout: 15000 });
      await expect(second.page.locator('[data-testid="scoreboard-box-rechts"]')).toHaveText('1');
      // ... und das Gerät zeigt "2 Einträge warten".
      await expect(second.page.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '2', { timeout: 10000 });
      await expect(second.page.locator('[data-testid="sync-status"]')).toHaveAttribute('aria-label', /^2 Einträge warten/);
    } finally {
      await second.context.close();
    }
    expect((await fetchEngineRows(ids.matchId)).length).toBe(baseRows);
  });

  test('@FU-007 Gegenbeispiel: leerer Gerätespeicher ohne Netz öffnet kein Spiel und zeigt keinen Zähler (kein Fantasie-Stand)', async ({ browser }) => {
    test.setTimeout(60_000);
    const ids = engineCupIds('NEUSTART');
    await expectSeededEngineMatch(engineCupTarget('NEUSTART'));
    const { context, page } = await newConsentContext(browser, path.join(AUTH_DIR, 'helper.json'));
    try {
      await cutBackend(context);
      await openCockpit(page, ids.tournamentId, ids.matchId);
      // `scoreboard-state` gibt es auch ohne Spiel (dort leer); `scoreboard-score` steht nur mit einem Spiel im Cockpit
      await expect(page.locator('[data-testid="scoreboard-score"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="scoreboard-box-links"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="sync-status"][data-pending]:not([data-pending="0"])')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
