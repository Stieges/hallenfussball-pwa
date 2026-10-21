/**
 * tests/e2e/cloud/kopf-verbinden.cloud.spec.ts — @SL-168: „Verbinden“ im schmalen Kopf, wenn das Netz da ist, aber nichts durchkommt.
 *
 * Hallen-WLAN ohne Internet: `navigator.onLine` bleibt true, die Übertragung `append_match_events` scheitert (Route abgebrochen, wie
 * @FU-013). Dann gehört die Pille „Verbinden“ mit „Offline“ und „N Einträge warten“ in den Kopf; klappt es, verschwindet sie wieder.
 * Beim normalen Senden erscheint nie eine Pille (auch nicht kurz).
 *
 * Es wird NICHTS in die Datenbank geschrieben: Abbruch und „Erfolg“ der Übertragung sind abgefangene Antworten der Seite, die Spiele
 * der Engine-Cups bleiben unverbraucht. Jeder Test hat seinen eigenen Cup (`KOPFVERBINDEN`, `KOPFNORMAL`, Seed: `npm run test:env:seed`);
 * `expectSeededEngineMatch` stellt als Erstes sicher, dass der Seed frisch ist und das Spiel noch läuft (sonst klare Meldung statt eines
 * Folgefehlers).
 */

import type { Page, Route } from '@playwright/test';
import { test, expect } from './fixtures';
import { blockAppendRpcNoInternet, engineCupTarget, expectEngineMatchRunningUi, expectOutboxSettled, expectSeededEngineMatch, newRoleContext, openCockpit } from './engineHelpers';
import { enterGoal } from './helpers';
import { engineCupIds } from './testData';

const APPEND_RPC = '**/rest/v1/rpc/append_match_events';

/** Die Übertragung „klappt“: jeder Eintrag wird angenommen, ohne dass der Server etwas schreibt. */
async function acceptAppendRpcWithoutWriting(page: Page): Promise<() => Promise<void>> {
  let seq = 1000;
  const handler = async (route: Route): Promise<void> => {
    const body = route.request().postDataJSON() as { p_events?: Array<{ id: string }> };
    const results = (body.p_events ?? []).map((event) => ({ id: event.id, status: 'accepted', seq: (seq += 1) }));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results, state: null, serverTime: Date.now() }) });
  };
  await page.route(APPEND_RPC, handler);
  return () => page.unroute(APPEND_RPC, handler);
}

test.describe('@SL-168 Verbinden im Kopf bei Netz ohne Durchkommen', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Engine-Cups nur auf cloud-desktop.');
  });

  test('online, aber Senden scheitert: Pille „Verbinden“ mit „Offline“ und „1 Eintrag wartet“, Kopf gleich hoch; Versuch „Verbinde …“; Misserfolg wieder „Verbinden“; Netz frei und Verbinden: Pille weg, Punkt', async ({ browser }) => {
    test.setTimeout(120_000);
    const ids = engineCupIds('KOPFVERBINDEN');
    await expectSeededEngineMatch(engineCupTarget('KOPFVERBINDEN'));
    const { context, page } = await newRoleContext(browser, 'owner');
    try {
      await openCockpit(page, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(page);
      await expectOutboxSettled(page);
      const status = page.getByTestId('cockpit-verbindung');
      const knopf = page.getByTestId('cockpit-verbindung-verbinden');
      const hoehe = async () => (await page.getByTestId('cockpit-slim-header').boundingBox())?.height ?? 0;
      await expect(status).toHaveAttribute('data-status', 'online');
      await expect(knopf).toHaveCount(0);
      const hoeheOnline = await hoehe();

      const block = await blockAppendRpcNoInternet(page);
      await enterGoal(page, 'home');
      await expect(page.getByTestId('sync-status')).toHaveAttribute('data-pending', '1', { timeout: 10000 });
      // Das Gerät hält sich für online – trotzdem erscheint die Pille, sobald der Versuch gescheitert ist und der Ausgang wartet
      expect(await page.evaluate(() => navigator.onLine)).toBe(true);
      await expect(knopf).toBeVisible({ timeout: 15000 });
      await expect(status).toHaveAttribute('data-status', 'offline');
      await expect(status).toContainText('Offline');
      await expect(status).toContainText('1 Eintrag wartet');
      expect(Math.abs((await hoehe()) - hoeheOnline), 'Kopfhöhe mit Pille unverändert').toBeLessThanOrEqual(1);

      // Tippen: „Verbinde …“ in derselben Pille; scheitert es (Route weiter gesperrt), steht wieder „Verbinden“
      await knopf.click();
      await expect(knopf).toContainText('Verbinde …');
      expect(Math.abs((await hoehe()) - hoeheOnline), 'Kopfhöhe bei „Verbinde …“ unverändert').toBeLessThanOrEqual(1);
      await expect(knopf).not.toContainText('Verbinde …');
      await expect(knopf).toContainText('Verbinden');
      await expect(status).toContainText('1 Eintrag wartet');
      expect(block.count()).toBeGreaterThan(1);

      // Netz frei: der nächste Versuch klappt, die Pille verschwindet, der Kopf zeigt den Punkt
      await block.release();
      const frei = await acceptAppendRpcWithoutWriting(page);
      await knopf.click();
      await expect(knopf).toContainText('Verbinde …');
      await expect(knopf).toHaveCount(0, { timeout: 10000 });
      await expect(status).toHaveAttribute('data-status', 'online');
      await expect(page.getByTestId('sync-status')).toHaveAttribute('data-pending', '0', { timeout: 10000 });
      await expect(page.getByText(/Wieder verbunden|Reconnected/)).toHaveCount(0);
      expect(Math.abs((await hoehe()) - hoeheOnline), 'Kopfhöhe nach Erfolg unverändert').toBeLessThanOrEqual(1);
      await frei();
    } finally {
      await context.close();
    }
  });

  test('online, Senden klappt: nie eine Pille „Verbinden“, auch nicht kurz', async ({ browser }) => {
    test.setTimeout(90_000);
    const ids = engineCupIds('KOPFNORMAL');
    await expectSeededEngineMatch(engineCupTarget('KOPFNORMAL'));
    const { context, page } = await newRoleContext(browser, 'owner');
    try {
      await openCockpit(page, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(page);
      await expectOutboxSettled(page);
      const frei = await acceptAppendRpcWithoutWriting(page);
      // Jede Veränderung am Kopf mitschreiben: erscheint der Knopf oder kippt der Status auch nur für einen Augenblick, wird es gemerkt
      await page.evaluate(() => {
        const merk = { knopf: false, offline: false };
        (window as unknown as { __verbindung: typeof merk }).__verbindung = merk;
        const pruefe = (): void => {
          if (document.querySelector('[data-testid="cockpit-verbindung-verbinden"]')) { merk.knopf = true; }
          if (document.querySelector('[data-testid="cockpit-verbindung"][data-status="offline"]')) { merk.offline = true; }
        };
        new MutationObserver(pruefe).observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
        pruefe();
      });
      await enterGoal(page, 'home');
      await enterGoal(page, 'away');
      await expect(page.getByTestId('sync-status')).toHaveAttribute('data-pending', '0', { timeout: 10000 });
      await page.waitForTimeout(3000);
      const gemerkt = await page.evaluate(() => (window as unknown as { __verbindung: { knopf: boolean; offline: boolean } }).__verbindung);
      expect(gemerkt, 'keine Pille, nie „offline“').toEqual({ knopf: false, offline: false });
      await expect(page.getByTestId('cockpit-verbindung')).toHaveAttribute('data-status', 'online');
      await expect(page.getByTestId('cockpit-verbindung-verbinden')).toHaveCount(0);
      await frei();
    } finally {
      await context.close();
    }
  });
});
