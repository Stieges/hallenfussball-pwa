/**
 * tests/e2e/cloud/engineHelpers.ts — Hilfen für Tests auf Engine-Spielen (A-23, übernimmt C3b-3a).
 *
 * Engine-Spiele haben ihren Zustand nur im Ereignisprotokoll: Rückbau per Spalten-PATCH oder
 * Soft-Delete gibt es nicht mehr, "Rückbau" heißt neu seeden (`npm run test:env:seed`).
 * `expectSeededEngineMatch` prüft deshalb als ERSTER Schritt jedes Engine-Tests, dass der Seed
 * unverbraucht und frisch genug ist; `expectEngineMatchRunningUi` ersetzt `ensureMatchRunning`
 * und klickt nie.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import { AUTH_DIR, type LoggedInRole } from './fixtures';
import { getLocalServiceRoleClient } from './helpers';
import { e2eUuid } from './e2eUuid';
import { isSeedTooOld } from './seedAge';
import { engineCupSeedEventIds, engineCupIds, getEngineCup, type EngineCupForm, type EngineCupSlug } from './engineCups';

/** Restzeit-Reserve: ein Seed gilt als zu alt, wenn weniger als 5 min Spielzeit übrig sind. */
const CLIENT_FORMAT = 1;

// =============================================================================
// TOKEN + RPC ALS ROLLE
// =============================================================================

/**
 * Liest den von `cloud-setup` gespeicherten Access-Token aus `playwright/.auth/<rolle>.json`
 * (zuvor lokal in `roles.cloud.spec.ts`). Kein zweiter Login.
 */
export function getStoredAccessToken(role: LoggedInRole): string {
  const raw = JSON.parse(readFileSync(path.join(AUTH_DIR, `${role}.json`), 'utf8')) as {
    origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>;
  };
  const item = raw.origins?.[0]?.localStorage?.find((entry) => entry.name === 'sb-127-auth-token');
  if (!item) {
    throw new Error(
      `getStoredAccessToken: kein "sb-127-auth-token" in playwright/.auth/${role}.json gefunden -- lief cloud-setup?`
    );
  }
  const session = JSON.parse(item.value) as { access_token?: unknown };
  if (typeof session.access_token !== 'string') {
    throw new Error(`getStoredAccessToken: access_token für Rolle "${role}" fehlt oder ist kein String.`);
  }
  return session.access_token;
}

export interface AppendAsRoleEvent {
  id: string;
  type: string;
  at: number;
  section: number | null;
  clockMs: number | null;
  teamId: string | null;
  targetId: string | null;
  payload: Record<string, unknown>;
}

export interface AppendAsRoleResult {
  results: Array<{ id: string | null; status: string; code?: string }>;
}

/** Ruft `append_match_events` MIT dem JWT der Rolle auf (Muster `serverHasTournamentPermission`). */
export async function appendAsRole(
  role: LoggedInRole,
  matchId: string,
  events: readonly AppendAsRoleEvent[]
): Promise<AppendAsRoleResult> {
  const { url, anonKey } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/rpc/append_match_events`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${getStoredAccessToken(role)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_match_id: matchId, p_events: events, p_client_format: CLIENT_FORMAT }),
  });
  if (!res.ok) {
    throw new Error(`appendAsRole(${role}, ${matchId}) fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as AppendAsRoleResult;
}

// =============================================================================
// DB-LESER (Service-Role)
// =============================================================================

export interface EngineRowRecord {
  id: string;
  type: string;
  target_event_id: string | null;
  client_time: string | null;
  payload: Record<string, unknown>;
}

async function getJson<T>(pathAndQuery: string, label: string): Promise<T> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, { headers });
  if (!res.ok) {
    throw new Error(`${label} fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/** Engine-Zeilen (`event_format IS NOT NULL`) eines Spiels in Annahme-Reihenfolge. */
export function fetchEngineRows(matchId: string): Promise<EngineRowRecord[]> {
  return getJson<EngineRowRecord[]>(
    `match_events?match_id=eq.${matchId}&event_format=not.is.null&order=seq.asc&select=id,type,target_event_id,client_time,payload`,
    `fetchEngineRows(${matchId})`
  );
}

/** Autor (`match_event_authors.user_id`) eines angenommenen Ereignisses. */
export async function fetchEventAuthorUserId(eventId: string): Promise<string | null> {
  const rows = await getJson<Array<{ user_id: string | null }>>(
    `match_event_authors?event_id=eq.${eventId}&select=user_id`,
    `fetchEventAuthorUserId(${eventId})`
  );
  return rows[0]?.user_id ?? null;
}

/** Konto-ID eines Testnutzers (für Autor-Vergleiche), über die lokale Profiltabelle. */
export async function fetchUserIdByEmail(email: string): Promise<string> {
  const rows = await getJson<Array<{ id: string }>>(`profiles?email=eq.${encodeURIComponent(email)}&select=id`, `fetchUserIdByEmail(${email})`);
  const row = rows[0];
  if (!row) {
    throw new Error(`fetchUserIdByEmail(${email}): kein Profil gefunden.`);
  }
  return row.id;
}

async function fetchServerNowMs(): Promise<number> {
  const { url, anonKey } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/rpc/server_time`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) {
    throw new Error(`server_time fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { serverTime: number };
  return body.serverTime;
}

// =============================================================================
// SEED-VORBEDINGUNG
// =============================================================================

export interface SeededEngineTarget {
  label: string;
  matchId: string;
  /** Exakte Menge der Seed-Ereignis-IDs (Engine-Zeilen). */
  seedEventIds: readonly string[];
  form: EngineCupForm;
  expected: { status: string; scoreA: number; scoreB: number };
}

export function engineCupTarget(slug: EngineCupSlug): SeededEngineTarget {
  const cup = getEngineCup(slug);
  return {
    label: `Engine-Cup ${slug}`,
    matchId: engineCupIds(slug).matchId,
    seedEventIds: engineCupSeedEventIds(slug),
    form: cup.form,
    expected: cup.expected,
  };
}

/**
 * Laufendes Engine-Spiel des Live-Cups bzw. Public-Cups (S6/S7): die Spiel-ID entsteht beim Seed
 * (Spielplan-Generator), die Ereignis-IDs leiten sich aus ihr ab (`event:<prefix>:<matchId>:<key>`).
 */
export async function runningEngineTarget(tournamentId: string, idPrefix: string, label: string): Promise<SeededEngineTarget> {
  const rows = await getJson<Array<{ id: string }>>(
    `matches?tournament_id=eq.${tournamentId}&match_status=eq.running&select=id`,
    `runningEngineTarget(${label})`
  );
  if (rows.length !== 1) {
    throw new Error(`${label}: erwartet genau ein laufendes Spiel, gefunden ${rows.length} -- Seed verbraucht, npm run test:env:seed.`);
  }
  const matchId = rows[0].id;
  return {
    label,
    matchId,
    seedEventIds: ['start', 'goal-home'].map((key) => e2eUuid(`event:${idPrefix}:${matchId}:${key}`)),
    form: 'running',
    expected: { status: 'running', scoreA: 1, scoreB: 0 },
  };
}

/**
 * Pflicht als erster Schritt jedes Engine-Tests. Prüft (1) die Menge der Engine-Ereignis-IDs ==
 * Seed-IDs (exakt), (2) Status und Ergebnis der Seed-Form, (3) nur `running`: Restzeit mit
 * Serverzeit. Gibt die Anzahl der Engine-Zeilen zurück -- neue Tests prüfen "genau eine neue
 * Zeile" gegenüber diesem Stand.
 */
export async function expectSeededEngineMatch(target: SeededEngineTarget): Promise<number> {
  const rows = await fetchEngineRows(target.matchId);
  const actualIds = rows.map((row) => row.id).sort();
  const expectedIds = [...target.seedEventIds].sort();
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error(
      `${target.label}: Seed verbraucht -- npm run test:env:seed (Engine-Zeilen ${rows.map((row) => row.type).join(',') || '-'}, ` +
        `erwartet ${expectedIds.length}, gefunden ${actualIds.length}).`
    );
  }
  const [match] = await getJson<Array<{ match_status: string | null; score_a: number | null; score_b: number | null; live_state: unknown }>>(
    `matches?id=eq.${target.matchId}&select=match_status,score_a,score_b,live_state`,
    `expectSeededEngineMatch(${target.label})`
  );
  const { status, scoreA, scoreB } = target.expected;
  if (match?.match_status !== status || (match.score_a ?? 0) !== scoreA || (match.score_b ?? 0) !== scoreB) {
    throw new Error(
      `${target.label}: Seed verbraucht -- npm run test:env:seed (Stand ${match?.match_status} ${match?.score_a}:${match?.score_b}, erwartet ${status} ${scoreA}:${scoreB}).`
    );
  }
  if (target.form === 'running') {
    const startRow = rows.find((row) => row.type === 'MATCH_START');
    const live = match.live_state as { durationSeconds?: number } | null;
    if (!startRow?.client_time || typeof live?.durationSeconds !== 'number') {
      throw new Error(`${target.label}: MATCH_START oder live_state fehlt -- npm run test:env:seed.`);
    }
    const serverNow = await fetchServerNowMs();
    const ageMs = serverNow - Date.parse(startRow.client_time);
    if (isSeedTooOld(ageMs, live.durationSeconds)) {
      throw new Error(`${target.label}: Seed zu alt (${Math.round(ageMs / 1000)} s seit Anpfiff) -- npm run test:env:seed.`);
    }
  }
  return rows.length;
}

// =============================================================================
// UI
// =============================================================================

/**
 * Ersatz für `ensureMatchRunning` (S9): prüft strikt, dass das gewählte Engine-Spiel LÄUFT
 * (Status-Badge, Pause-Button sichtbar, KEIN Start-Button) -- und klickt nie.
 */
export async function expectEngineMatchRunningUi(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="scoreboard-state"]')).toHaveText('Live', { timeout: 15000 });
  await expect(page.locator('[data-testid="match-pause-button"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-testid="match-start-button"]')).toHaveCount(0);
}

/** Öffnet das Cockpit eines festen Spiels (`?matchId=` pinnt die Auswahl, kein stilles Umschalten). */
export async function openCockpit(page: Page, tournamentId: string, matchId: string): Promise<void> {
  await page.goto(`/#/tournament/${tournamentId}/live?matchId=${matchId}`);
  await page.waitForLoadState('networkidle');
}

/** Eigener Context mit gespeicherter Anmeldung und Consent (für Offline-/Online-Wechsel). */
export async function newRoleContext(browser: Browser, role: LoggedInRole): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ storageState: path.join(AUTH_DIR, `${role}.json`) });
  await context.addInitScript(() => {
    window.localStorage.setItem('app:consent', JSON.stringify({ errorTracking: true, sessionReplay: false, timestamp: Date.now(), version: 1 }));
  });
  return { context, page: await context.newPage() };
}

/** Der Ausgang des Geräts ist leer: nichts wartet (`data-pending="0"`), nichts wurde abgelehnt. */
export async function expectOutboxSettled(page: Page, timeout = 10000): Promise<void> {
  await expect(page.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '0', { timeout });
  await expect(page.locator('[data-testid="sync-status-rejected"]')).toHaveCount(0);
}

// =============================================================================
// A-06l: ABGEFANGENE ÜBERTRAGUNG (kein setOffline: navigator.onLine bleibt true)
// =============================================================================

const APPEND_RPC_PATTERN = '**/rest/v1/rpc/append_match_events';

export interface AppendRpcBlock {
  /** Anzahl der bisher abgefangenen Anfragen. */
  count(): number;
  /** Hebt die Sperre auf; weitere Anfragen laufen durch. */
  release(): Promise<void>;
}

/**
 * Hallen-WLAN ohne Internet: jede Übertragung (`append_match_events`) scheitert mit
 * `internetdisconnected`, das Gerät hält sich aber weiter für online.
 */
export async function blockAppendRpcNoInternet(page: Page): Promise<AppendRpcBlock> {
  let count = 0;
  const handler = (route: Route): Promise<void> => {
    count += 1;
    return route.abort('internetdisconnected');
  };
  await page.route(APPEND_RPC_PATTERN, handler);
  return { count: () => count, release: () => page.unroute(APPEND_RPC_PATTERN, handler) };
}

/**
 * Hängende Anfrage: die erste Übertragung bekommt nie eine Antwort (weder `fulfill` noch
 * `abort`), alle weiteren laufen ungehindert zum Server.
 */
export async function holdFirstAppendRpc(page: Page): Promise<{ count(): number }> {
  let count = 0;
  await page.route(APPEND_RPC_PATTERN, (route) => {
    count += 1;
    if (count === 1) {
      return undefined;
    }
    return route.continue();
  });
  return { count: () => count };
}

/** Schluckt das `online`-Ereignis, damit nur der Resync beim Zurückkehren die Übertragung anstoßen kann. */
export async function swallowOnlineEvents(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    window.addEventListener('online', (event) => event.stopImmediatePropagation(), true);
  });
}

/** Simuliert Sperren und Entsperren des Tablets: `hidden`, dann `visible`, jeweils mit `visibilitychange`. */
export async function simulateWakeFromSleep(page: Page): Promise<void> {
  await page.evaluate(() => {
    const setState = (state: 'hidden' | 'visible'): void => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    setState('hidden');
    setState('visible');
  });
}
