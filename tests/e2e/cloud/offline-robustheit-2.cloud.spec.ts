/**
 * tests/e2e/cloud/offline-robustheit-2.cloud.spec.ts — A-06m: genau einmal, Einzel-Ablehnung,
 * Realtime unterbrochen.
 *
 * Szenarien (docs/anforderungen/plattform/2026-09-24_fundament-gemeinsamer-stand.md):
 *   @FU-010 Wiederholte Übertragung erzeugt keinen zweiten Eintrag
 *   @FU-011 Ein nicht übernommener Eintrag hält die anderen nicht auf
 *   @FU-025 Realtime-Verbindung unterbrochen, Ausweichen auf Abfrage
 *
 * Wie in A-06l hat jeder Fall sein eigenes Turnier ("Engine-Cup", `engineCups.ts`); ein verbrauchter
 * Cup braucht `npm run test:env:seed`. Das Netz wird nicht per `setOffline` getrennt, wo es auf
 * `navigator.onLine === true` ankommt (Übertragung per `page.route`, Realtime per `routeWebSocket`).
 */

import type { BrowserContext, Page, Route, WebSocketRoute } from '@playwright/test';
import { test, expect } from './fixtures';
import {
  appendAsRole,
  engineCupTarget,
  expectEngineMatchRunningUi,
  expectOutboxSettled,
  expectSeededEngineMatch,
  fetchEngineRows,
  newRoleContext,
  openCockpit,
  type AppendAsRoleEvent,
} from './engineHelpers';
import { enterGoal } from './helpers';
import { engineCupIds } from './testData';

const APPEND_RPC_PATTERN = '**/rest/v1/rpc/append_match_events';
const REALTIME_SOCKET_PATTERN = /\/realtime\/v1\/websocket/;
/** Gültige UUID, die in keinem Spiel vorkommt: der Server lehnt den Eintrag als ungültig ab. */
const UNKNOWN_TEAM_ID = '00000000-0000-4000-8000-000000000bad';

interface AppendBody {
  p_match_id: string;
  p_events: AppendAsRoleEvent[];
  [key: string]: unknown;
}

function appendBodyOf(route: Route): AppendBody {
  return route.request().postDataJSON() as AppendBody;
}

/** Wartet, bis das Cockpit steht und der Ausgang leer ist. */
async function openSettledCockpit(page: Page, tournamentId: string, matchId: string): Promise<void> {
  await openCockpit(page, tournamentId, matchId);
  await expectEngineMatchRunningUi(page);
  await expect(page.locator('[data-testid="sync-status"]')).toBeVisible({ timeout: 10000 });
  await expectOutboxSettled(page);
}

async function openHelperCockpit(context: BrowserContext, tournamentId: string, matchId: string): Promise<Page> {
  const page = await context.newPage();
  await openSettledCockpit(page, tournamentId, matchId);
  return page;
}

async function enterYellowCardWithoutDetails(page: Page, side: 'home' | 'away'): Promise<void> {
  await page.locator(`[data-testid="yellow-card-button-${side}"]`).click();
  await page.getByRole('button', { name: 'Ohne Details' }).click();
}

/** Zeitstrafe ohne Rückennummer: der Knopf am Team wählt Dauer und Team vor, es bleibt "Ohne Nr.". */
async function enterTimePenaltyWithoutNumber(page: Page, teamName: string): Promise<void> {
  await page.getByRole('button', { name: `Zeitstrafe für ${teamName}` }).click();
  await page.getByRole('button', { name: /Ohne Nr\./ }).click();
}

test.describe('Offline-Robustheit des Ausgangs (2)', () => {
  // Playwright verlangt syntaktisch ein Destrukturierungs-Muster als erstes Argument.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Engine-Cups nur auf cloud-desktop.');
  });

  /**
   * Die erste Übertragung erreicht den Server, die Antwort geht verloren. Das Gerät schickt dasselbe
   * Tor (gleiche Ereignis-ID) erneut. `answers` hält, was der Server auf jeden Versuch geantwortet hat.
   */
  async function loseFirstResponse(page: Page): Promise<{ attempts: () => number; answers: string[]; sent: AppendAsRoleEvent[][] }> {
    const state = { count: 0, answers: [] as string[], sent: [] as AppendAsRoleEvent[][] };
    await page.route(APPEND_RPC_PATTERN, async (route) => {
      state.count += 1;
      state.sent.push(appendBodyOf(route).p_events);
      const response = await route.fetch();
      const json = (await response.json()) as { results: Array<{ status: string }> };
      state.answers.push(json.results[0]?.status ?? 'leer');
      if (state.count === 1) {
        await route.abort('connectionreset');
        return;
      }
      await route.fulfill({ response, json });
    });
    return { attempts: () => state.count, answers: state.answers, sent: state.sent };
  }

  test('@FU-010 Bestätigung verloren: dasselbe Tor kommt erneut, der Server antwortet "duplicate", es gibt es genau einmal und es gilt als übertragen', async ({ browser }) => {
    test.setTimeout(90_000);
    const ids = engineCupIds('DOPPELT');
    const baseRows = await expectSeededEngineMatch(engineCupTarget('DOPPELT'));
    const { context, page } = await newRoleContext(browser, 'owner');
    // Ohne Live-Verbindung: nur die Antwort des Servers ("duplicate") kann den Eintrag als übertragen
    // abhaken. Mit Live-Verbindung siehe den fixme-Fall unten (Anzeige bleibt auf "wartet").
    await context.routeWebSocket(REALTIME_SOCKET_PATTERN, (ws) => {
      void ws.close();
    });
    try {
      await openSettledCockpit(page, ids.tournamentId, ids.matchId);
      const syncStatus = page.locator('[data-testid="sync-status"]');
      const lost = await loseFirstResponse(page);

      await enterGoal(page, 'home');
      await expect.poll(() => lost.attempts(), { timeout: 10000 }).toBeGreaterThanOrEqual(2);
      await expect(syncStatus).toHaveAttribute('data-pending', '0', { timeout: 10000 });
      await expect(page.locator('[data-testid="sync-status-rejected"]')).toHaveCount(0);
      expect(lost.sent[0][0].id).toBe(lost.sent[1][0].id);
      expect(lost.answers.slice(0, 2)).toEqual(['accepted', 'duplicate']);
      expect((await fetchEngineRows(ids.matchId)).length).toBe(baseRows + 1);

      // Serverseitig: dieselbe Ereignis-ID noch einmal -> "duplicate", weiterhin nur eine Zeile.
      const again = await appendAsRole('owner', ids.matchId, lost.sent[0]);
      expect(again.results[0].status).toBe('duplicate');
      expect((await fetchEngineRows(ids.matchId)).length).toBe(baseRows + 1);

      // Gegenbeispiel: ein anderes Tor (neue ID) ist ein zweiter Eintrag.
      await enterGoal(page, 'away');
      await expect(syncStatus).toHaveAttribute('data-pending', '0', { timeout: 10000 });
      await expect.poll(async () => (await fetchEngineRows(ids.matchId)).length, { timeout: 10000 }).toBe(baseRows + 2);
    } finally {
      await context.close();
    }
  });

  test('@FU-010 Bestätigung verloren, Live-Verbindung steht: das Gerät zeigt das Tor als übertragen', async ({ browser }) => {
    test.fixme(
      true,
      'Produktfehler A-06m-P1: kommt die Bestätigung per Live-Push vor dem Wiederholen an, bleibt der Zähler auf "1 Eintrag wartet – kein Internet" ' +
        '(src/core/match/client/OutboxSender.ts:239-240, tryOneBatch kehrt bei leerer Warteschlange ohne refresh() zurück; Zähler wird erst beim nächsten Antippen/Eintrag neu berechnet).'
    );
    test.setTimeout(60_000);
    const ids = engineCupIds('DOPPELTLIVE');
    await expectSeededEngineMatch(engineCupTarget('DOPPELTLIVE'));
    const { context, page } = await newRoleContext(browser, 'owner');
    try {
      await openSettledCockpit(page, ids.tournamentId, ids.matchId);
      await loseFirstResponse(page);
      await enterGoal(page, 'home');
      await expect(page.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '0', { timeout: 10000 });
    } finally {
      await context.close();
    }
  });

  test('@FU-011 Karte wird vom Server nicht übernommen: Tor und Zeitstrafe kommen auf allen Geräten an, nur die Karte ist "nicht übernommen"', async ({ browser, asRole }) => {
    test.setTimeout(120_000);
    const ids = engineCupIds('TEILABLEHNUNG');
    const baseRows = await expectSeededEngineMatch(engineCupTarget('TEILABLEHNUNG'));
    const ownerPage = await asRole('owner');
    const { context: helperContext, page: helperPage } = await newRoleContext(browser, 'helper');
    try {
      await openSettledCockpit(ownerPage, ids.tournamentId, ids.matchId);
      await openSettledCockpit(helperPage, ids.tournamentId, ids.matchId);
      const helperStatus = helperPage.locator('[data-testid="sync-status"]');

      // Der Server bekommt für die Karte ein Team, das es im Spiel nicht gibt, und lehnt nur sie ab.
      await helperPage.route(APPEND_RPC_PATTERN, async (route) => {
        const body = appendBodyOf(route);
        const tampered = { ...body, p_events: body.p_events.map((event) => (event.type === 'YELLOW_CARD' ? { ...event, teamId: UNKNOWN_TEAM_ID } : event)) };
        await route.continue({ postData: JSON.stringify(tampered) });
      });

      await helperContext.setOffline(true);
      await enterGoal(helperPage, 'home');
      await enterYellowCardWithoutDetails(helperPage, 'away');
      await enterTimePenaltyWithoutNumber(helperPage, ids.awayTeamName);
      await expect(helperStatus).toHaveAttribute('data-pending', '3', { timeout: 5000 });
      expect((await fetchEngineRows(ids.matchId)).length).toBe(baseRows);

      await helperContext.setOffline(false);
      // Tor und Zeitstrafe sind in der DB, die Karte nicht.
      await expect.poll(async () => (await fetchEngineRows(ids.matchId)).length, { timeout: 20000 }).toBe(baseRows + 2);
      const rows = await fetchEngineRows(ids.matchId);
      expect(rows.length).toBe(baseRows + 2);
      expect(rows.filter((row) => row.type === 'YELLOW_CARD')).toHaveLength(0);
      expect(rows.filter((row) => row.type === 'TIME_PENALTY')).toHaveLength(1);

      // Helfer: nichts wartet mehr, genau ein Eintrag ist "nicht übernommen".
      await expect(helperStatus).toHaveAttribute('data-pending', '0', { timeout: 15000 });
      await expect(helperPage.locator('[data-testid="sync-status-rejected"]')).toBeVisible({ timeout: 10000 });
      await helperPage.locator('[data-testid="sync-status-rejected"]').click();
      await expect(helperPage.locator('[data-testid="outbox-rejected-item"]')).toHaveCount(1);
      // Zweites Gerät: das Tor ist da, die Karte steht nirgends.
      await expect(ownerPage.locator('[data-testid="score-home"]')).toHaveText('2', { timeout: 10000 });
      await expect(ownerPage.getByText(/Zeitstrafe/).first()).toBeVisible({ timeout: 10000 });
      await expect(ownerPage.locator('[data-testid="sync-status-rejected"]')).toHaveCount(0);
    } finally {
      await helperContext.close();
    }
  });

  test('@FU-011 Gegenbeispiel: ohne abgelehnte Karte werden alle drei Einträge übernommen', async ({ browser }) => {
    test.setTimeout(90_000);
    const ids = engineCupIds('ALLEDREI');
    const baseRows = await expectSeededEngineMatch(engineCupTarget('ALLEDREI'));
    const { context, page } = await newRoleContext(browser, 'helper');
    try {
      await openSettledCockpit(page, ids.tournamentId, ids.matchId);
      await context.setOffline(true);
      await enterGoal(page, 'home');
      await enterYellowCardWithoutDetails(page, 'away');
      await enterTimePenaltyWithoutNumber(page, ids.awayTeamName);
      await expect(page.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '3', { timeout: 5000 });
      await context.setOffline(false);
      await expect(page.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '0', { timeout: 20000 });
      await expect(page.locator('[data-testid="sync-status-rejected"]')).toHaveCount(0);
      const rows = await fetchEngineRows(ids.matchId);
      expect(rows.length).toBe(baseRows + 3);
      expect(rows.map((row) => row.type)).toEqual(expect.arrayContaining(['GOAL', 'YELLOW_CARD', 'TIME_PENALTY']));
    } finally {
      await context.close();
    }
  });

  test('@FU-025 Realtime-Kanal geschlossen: Olli sieht Toms Tor nach höchstens 10 s und den Hinweis "Live-Verbindung unterbrochen"', async ({ browser }) => {
    test.setTimeout(120_000);
    const ids = engineCupIds('REALTIME');
    await expectSeededEngineMatch(engineCupTarget('REALTIME'));
    const { context: ollisContext, page: ollisPage } = await newRoleContext(browser, 'owner');
    const { context: tomsContext } = await newRoleContext(browser, 'helper');

    // Ollis Realtime-Socket läuft zunächst normal durch und lässt sich später "vom Server" schließen.
    const openSockets: WebSocketRoute[] = [];
    let cut = false;
    await ollisContext.routeWebSocket(REALTIME_SOCKET_PATTERN, (ws) => {
      if (cut) {
        void ws.close();
        return;
      }
      ws.connectToServer();
      openSockets.push(ws);
    });
    try {
      await openSettledCockpit(ollisPage, ids.tournamentId, ids.matchId);
      const tomsPage = await openHelperCockpit(tomsContext, ids.tournamentId, ids.matchId);
      const hint = ollisPage.locator('[data-testid="realtime-interrupted-hint"]');
      const ollisHome = ollisPage.locator('[data-testid="score-home"]');
      await expect(ollisHome).toHaveText('1');

      // Gegenbeispiel: solange der Kanal offen ist, gibt es keinen Hinweis -- und Toms Tor kommt per Push an.
      expect(openSockets.length).toBeGreaterThan(0);
      await expect(hint).toHaveCount(0);
      await enterGoal(tomsPage, 'home');
      await expect(ollisHome).toHaveText('2', { timeout: 10000 });
      await expect(hint).toHaveCount(0);

      // Der Server schließt die Verbindung, jeder Wiederaufbau wird sofort wieder geschlossen.
      cut = true;
      await Promise.all(openSockets.map((ws) => ws.close()));
      await expect(hint).toBeVisible({ timeout: 20000 });
      await expect(hint).toHaveText('Live-Verbindung unterbrochen');

      await enterGoal(tomsPage, 'away');
      await expect(ollisPage.locator('[data-testid="score-away"]')).toHaveText('1', { timeout: 10000 });
      await expect(hint).toBeVisible();
    } finally {
      await ollisContext.close();
      await tomsContext.close();
    }
  });

  for (const variant of [
    { slug: 'TABWECHSEL' as const, title: 'normal (mit Pause auf dem Spielplan)', pauseMs: 1500 },
    { slug: 'TABSCHNELL' as const, title: 'schnell (unter 1 s)', pauseMs: 0 },
  ]) {
    test(`@FU-025 Tab-Wechsel Live -> Spielplan -> Live ${variant.title}: Toms Tor erscheint in 10 s oder der Hinweis steht`, async ({ browser }) => {
      test.setTimeout(90_000);
      const ids = engineCupIds(variant.slug);
      await expectSeededEngineMatch(engineCupTarget(variant.slug));
      const { context: ollisContext, page: ollisPage } = await newRoleContext(browser, 'owner');
      const { context: tomsContext } = await newRoleContext(browser, 'helper');
      try {
        await openSettledCockpit(ollisPage, ids.tournamentId, ids.matchId);
        const tomsPage = await openHelperCockpit(tomsContext, ids.tournamentId, ids.matchId);

        await ollisPage.locator('[data-testid="desktop-tab-spielplan"]').click();
        if (variant.pauseMs > 0) {
          await ollisPage.waitForTimeout(variant.pauseMs);
        }
        await ollisPage.locator('[data-testid="desktop-tab-live"]').click();
        await expectEngineMatchRunningUi(ollisPage);
        const ollisHome = ollisPage.locator('[data-testid="score-home"]');
        await expect(ollisHome).toHaveText('1', { timeout: 10000 });

        await enterGoal(tomsPage, 'home');
        const goalAt = Date.now();
        // Entweder sieht Olli das Tor nach höchstens 10 s, oder der Hinweis ist sichtbar -- nie beides nicht.
        await expect
          .poll(
            async () => (await ollisHome.innerText()) === '2' || (await ollisPage.locator('[data-testid="realtime-interrupted-hint"]').count()) > 0,
            { timeout: 10000, intervals: [250], message: 'weder Tor noch Hinweis nach 10 s' }
          )
          .toBe(true);
        const sawGoal = (await ollisHome.innerText()) === '2';
        test.info().annotations.push({ type: 'Ergebnis', description: `${sawGoal ? 'Tor sichtbar' : 'nur Hinweis'} nach ${Date.now() - goalAt} ms` });
      } finally {
        await ollisContext.close();
        await tomsContext.close();
      }
    });
  }
});
