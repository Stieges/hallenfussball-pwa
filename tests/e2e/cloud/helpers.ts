/**
 * tests/e2e/cloud/helpers.ts — gemeinsame Helfer für die "cloud"-E2E-Tests (Task T3,
 * .superpowers/sdd/2026-09-24-testumgebung/task-T3-brief.md).
 *
 * Importiert ausschließlich aus `tests/e2e/cloud/testData.ts` (einzige Quelle für
 * E-Mails/Passwort/Rollen) — keine Werte hier verstreut nochmal literal.
 */

import type { Browser, BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { E2E_USERS, E2E_TEST_PASSWORD, type E2EUserKey } from './testData';
import { getLocalSupabaseStatus } from '../../../scripts/lib/localSupabaseStatus';
import { assertLocalSupabaseTarget } from '../../../scripts/lib/assertLocalSupabaseTarget';
import { schliesseTorAuswahl } from '../helpers/cockpitNeu';
import { localDateIso } from '../../../src/core/view/time';

// =============================================================================
// LOGIN (über die Oberfläche, Brief Abschnitt 2)
// =============================================================================

/**
 * Öffnet den Login-Screen. Gleiche Logik wie `tests/e2e/flows/auth.spec.ts#navigateToLogin`
 * (dort für die offline-Suite, hier für die cloud-Suite dupliziert statt geteilt importiert —
 * die offline-Datei liegt außerhalb von `tests/e2e/cloud`, das die cloud-Projekte laut Brief
 * exklusiv als `testDir` nutzen).
 */
export async function gotoLogin(page: Page): Promise<void> {
  await page.goto('/#/');
  await page.waitForLoadState('networkidle');

  const loginEmail = page.locator('[data-testid="login-email-input"]');
  if (await loginEmail.isVisible({ timeout: 1000 }).catch(() => false)) {
    return;
  }

  const mobileAuthButton = page.locator('[data-testid="auth-mobile-button"]');
  if (await mobileAuthButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await mobileAuthButton.click({ force: true });
    const bottomSheetLogin = page.locator('[data-testid="bottomsheet-login"]');
    await expect(bottomSheetLogin).toBeVisible({ timeout: 3000 });
    await bottomSheetLogin.click();
    await expect(loginEmail).toBeVisible({ timeout: 5000 });
    return;
  }

  const desktopLoginButton = page.locator('[data-testid="auth-login-button"]');
  await desktopLoginButton.click({ force: true });
  await expect(loginEmail).toBeVisible({ timeout: 5000 });
}

/**
 * Meldet `userKey` über die Oberfläche an (login-email-input/login-password-input/
 * login-submit-button, Brief-Vorgabe — kein direkter Supabase-Client-Aufruf). Wartet danach auf
 * ein sichtbares "angemeldet"-Merkmal (`auth-avatar-button`, gesetzt sobald `isAuthenticated`).
 *
 * `userKey` muss ein Konto mit Passwort haben (`E2E_USERS`, alle außer `google` — Login per
 * Passwort, `google` hat bewusst keines, siehe `scripts/e2e-seed.ts`).
 */
export async function loginAsRole(page: Page, userKey: Exclude<E2EUserKey, 'google'>): Promise<void> {
  const user = E2E_USERS[userKey];
  await gotoLogin(page);

  await page.locator('[data-testid="login-email-input"]').fill(user.email);
  await page.locator('[data-testid="login-password-input"]').fill(E2E_TEST_PASSWORD);
  await page.locator('[data-testid="login-submit-button"]').click();

  await expect(page.locator('[data-testid="auth-avatar-button"]')).toBeVisible({ timeout: 15000 });
}

/**
 * Zurück zum Spielplan, wenn die Seite den Live-Bereich im schmalen Rahmen zeigt (@SL-140: nur Kopf mit „Zurück“, Spielfläche und Leiste,
 * keine App-Navigation, kein Konto-Menü). Ohne diesen Rahmen passiert nichts. Danach stehen App-Navigation und Konto-Menü wieder da.
 */
export async function verlasseLiveRahmen(page: Page): Promise<void> {
  const zurueck = page.getByTestId('cockpit-zurueck');
  if ((await zurueck.count()) > 0) {
    await zurueck.click();
  }
  await expect(page.locator('[data-testid="auth-avatar-button"]')).toBeVisible({ timeout: 15000 });
}

/**
 * Vom Live-Bereich (schmaler Rahmen, @SL-140) zum Spielplan: „Zurück“ im Kopf führt zum Spielplan des Turniers, dort steht die App-Navigation.
 */
export async function vomLiveZumSpielplan(page: Page): Promise<void> {
  await page.getByTestId('cockpit-zurueck').click();
  await expect(page.locator('[data-testid="desktop-tab-spielplan"]')).toBeVisible({ timeout: 15000 });
}

/**
 * Meldet den aktuell angemeldeten Nutzer über die Oberfläche ab (Avatar-Menü,
 * `auth-avatar-button` → `auth-logout-button`, siehe `src/components/layout/AuthSection.tsx`).
 * Wartet danach auf ein "abgemeldet"-Merkmal -- Desktop zeigt `auth-login-button`, Mobile
 * `auth-mobile-button` (gleiche Unterscheidung wie `gotoLogin()` oben).
 */
export async function logoutViaUi(page: Page): Promise<void> {
  await verlasseLiveRahmen(page);
  await page.locator('[data-testid="auth-avatar-button"]').click();
  await page.locator('[data-testid="auth-logout-button"]').click();

  const desktopLoginButton = page.locator('[data-testid="auth-login-button"]');
  const mobileAuthButton = page.locator('[data-testid="auth-mobile-button"]');
  await expect(desktopLoginButton.or(mobileAuthButton)).toBeVisible({ timeout: 10000 });
}

// =============================================================================
// RÜCKBAU IN `finally` (Fixrunde 3, N16)
// =============================================================================

/**
 * N16: Führt einen Rückbau-Aufruf (Service-Role-PATCH in einem `finally`-Block) sicher aus --
 * schlägt er fehl, wird das LAUT geloggt, aber NICHT erneut geworfen.
 *
 * Begründung für "loggen statt werfen" (die beiden Optionen aus dem Auftrag): Ein `finally`-Block,
 * der selbst wirft, ÜBERSCHREIBT in JavaScript einen bereits aus dem `try`-Block propagierenden
 * Fehler (Sprachsemantik, kein Playwright-Spezifikum) -- genau die eigentliche, aussagekräftige
 * Fehlermeldung (z. B. die Z1- oder Fehler-B-Assertion, die den Test überhaupt erst `test.fail()`
 * erfüllt) würde dann durch eine generische "Rückbau fehlgeschlagen"-Meldung ERSETZT und wäre aus
 * dem Testprotokoll nicht mehr ablesbar -- ein Rückschritt gegenüber I4 (Fehlermeldungen müssen
 * den tatsächlichen Bruchpunkt zeigen). Ein lauter `console.error()` macht den verschmutzten
 * Zustand trotzdem sichtbar (CI-Protokoll, Playwright hängt Konsolen-Ausgaben an den jeweiligen
 * Testfall an) UND verdeckt nicht, woran der Test eigentlich lag.
 */
export async function safeCleanup(description: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error(
      `[N16] RÜCKBAU FEHLGESCHLAGEN (${description}) -- Zustand bleibt VERSCHMUTZT, der nächste Lauf startet ggf. darauf auf. Ursache:`,
      error
    );
  }
}

// =============================================================================
// SYNC-STATUS (Brief Abschnitt 3)
// =============================================================================

export interface WaitForSyncOptions {
  /** Timeout in ms, Default 15000. */
  timeoutMs?: number;
}

/**
 * Wartet, bis die `SyncStatusBar` (`data-testid="sync-status"`) `data-state="idle"` UND
 * `data-pending="0"` meldet. Nutzt `page.waitForFunction`, weil beide Attribute gleichzeitig
 * erfüllt sein müssen (kein reines `toHaveAttribute`, das nur ein Attribut auf einmal prüft).
 *
 * Wirft mit einer sprechenden Fehlermeldung (aktueller state/pending), wenn das Timeout
 * abläuft — kein stilles Timeout von Playwright selbst.
 */
export async function waitForSync(page: Page, options: WaitForSyncOptions = {}): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 15000;
  const locator = page.locator('[data-testid="sync-status"]');
  await expect(locator).toBeVisible({ timeout: timeoutMs });

  try {
    await expect(locator).toHaveAttribute('data-state', 'idle', { timeout: timeoutMs });
    await expect(locator).toHaveAttribute('data-pending', '0', { timeout: timeoutMs });
  } catch {
    const state = await locator.getAttribute('data-state');
    const pending = await locator.getAttribute('data-pending');
    throw new Error(
      `waitForSync: sync-status wurde nicht idle innerhalb von ${timeoutMs}ms ` +
      `(data-state="${state}", data-pending="${pending}").`
    );
  }
}

// =============================================================================
// LIVE-COCKPIT (Task T4: two-devices.cloud.spec.ts -- inkl. des ehemals eigenständigen
// offline.cloud.spec.ts, siehe Fixrunde 2/N4)
// =============================================================================

/**
 * A-07g Fixrunde 1 (F4): Seit A-07b (@FU-006) schreibt jede Turnier-Warteschlange unter dem
 * Schlüssel ihres Kontos (`MutationQueue.ts#accountScopedKey`). Einzige Quelle für diese Namen in
 * den E2E-Tests; die Konto-ID eines Testnutzers liefert `fetchUserIdByEmail` (engineHelpers.ts).
 */
export const LEGACY_QUEUE_KEYS = ['mutation_queue_v1', 'mutation_queue_failed_v1'] as const;

export function queueKeys(userId: string): { queue: string; failed: string } {
  return { queue: `mutation_queue_v1:${userId}`, failed: `mutation_queue_failed_v1:${userId}` };
}

/**
 * Wache gegen einen erneuten Schlüsselwechsel: nach dem Neuladen ist der Altschlüssel (ohne Konto)
 * leer, weil die Queue ihn übernommen hat. Ohne diese Wache bliebe ein Test, der den falschen
 * Schlüssel liest, leise grün oder leise rot.
 */
export async function expectLegacyQueueKeysEmpty(page: Page): Promise<void> {
  const values = await page.evaluate((keys) => keys.map((key) => window.localStorage.getItem(key)), [...LEGACY_QUEUE_KEYS]);
  for (const value of values) {
    expect(value === null || value === '[]').toBe(true);
  }
}

/**
 * Task A1 (Sofortschutz): liest die Dead-Letter-Liste (`queueKeys(userId).failed`) (Dead-Letter der
 * `MutationQueue`, siehe `MutationQueue.ts#failedStorageKey`) auf `page` und gibt die
 * `type`-Werte der darin enthaltenen Mutationen zurück (leeres Array, wenn der Schlüssel fehlt
 * oder leer ist). Gebraucht vom "Helfer beendet Spiel"-Test, um zu beweisen, dass nach einem
 * Spielende KEINE `SAVE_TOURNAMENT`-Mutation dort gelandet ist (vorher: RLS lehnt den vollen
 * Turnier-Save für einen Helfer ab → nach Retries Dead-Letter).
 */
export async function fetchFailedMutationTypes(page: Page, userId: string): Promise<string[]> {
  const { failed } = queueKeys(userId);
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), failed);
  if (!raw) { return []; }
  const parsed = JSON.parse(raw) as Array<{ type?: string }>;
  return parsed.map((item) => item.type).filter((type): type is string => typeof type === 'string');
}

/**
 * Fixrunde 1 (I1, Review `task-A1-review.md`): Gegenstück zu `fetchFailedMutationTypes()` für die
 * NOCH AUSSTEHENDE Warteschlange `localStorage['mutation_queue_v1']` (`MutationQueue.ts#storageKey`
 * -- GenericMutationQueue erreicht das Dead-Letter erst nach `MAX_RETRIES = 5` GETRENNTEN
 * Anstößen, ein einzelner fehlgeschlagener Versuch kurz nach dem Klick liegt vorher hier, mit
 * `retryCount` >= 1). Ohne diese zusätzliche Prüfung wäre der A1-Kernfix (kein voller
 * Turnier-Save mehr nach Spielende) durch den Cloud-E2E-Test NICHT abgesichert -- eine
 * `SAVE_TOURNAMENT`-Mutation, die scheitert, aber noch nicht 5 Versuche hinter sich hat, tauchte
 * in `mutation_queue_failed_v1` gar nicht auf.
 */
export async function fetchQueuedMutationTypes(page: Page, userId: string): Promise<string[]> {
  const { queue } = queueKeys(userId);
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), queue);
  if (!raw) { return []; }
  const parsed = JSON.parse(raw) as Array<{ type?: string }>;
  return parsed.map((item) => item.type).filter((type): type is string => typeof type === 'string');
}

/** Zeitstrafe ohne Rückennummer: der Knopf am Team wählt Dauer und Team vor, es bleibt "Ohne Nr.". */
export async function enterTimePenaltyWithoutNumber(page: Page, teamName: string): Promise<void> {
  await page.getByRole('button', { name: `Zeitstrafe ${teamName}` }).click();
  await schliesseTorAuswahl(page);
}

/**
 * Trägt ein Tor für `side` ein: klickt `goal-button-{side}`, schließt die
 * Nummernauswahl („ohne Nummer“, `EntrySheets`/`NumberPicker`; das Tor zählt schon mit dem ersten Tipp) -- der Test braucht
 * nur den Zähler, keinen Spieler.
 */
export async function enterGoal(page: Page, side: 'home' | 'away'): Promise<void> {
  await page.locator(`[data-testid="goal-button-${side}"]`).click();
  await schliesseTorAuswahl(page);
}

/**
 * A2 (.superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-brief.md): liest Score UND
 * Status eines Spiels direkt aus der DB -- gebraucht vom Test "Olli speichert das Turnier,
 * während Tom ein Spiel leitet", um NACH einem vollen Turnier-Save des owners zu prüfen, dass
 * der Live-Stand des helpers steht, NICHT der (potenziell veraltete) lokale Stand des owners.
 */
export interface MatchScoreRow {
  score_a: number | null;
  score_b: number | null;
  match_status: string | null;
}

/**
 * A2 Fixrunde 2 (Cloud-Nachweis Ergebniskorrektur): liest ID + Score eines BEENDETEN Spiels --
 * der Live-Cup-Seed legt genau zwei an (`matchDone1`/`matchDone2` in `e2e-seed.ts`, keine feste
 * ID). `order=score_a.desc` macht die Auswahl deterministisch (immer dasselbe der zwei Spiele).
 */
export async function fetchFinishedMatchRow(
  tournamentId: string
): Promise<{ id: string; score_a: number; score_b: number }> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(
    `${url}/rest/v1/matches?tournament_id=eq.${tournamentId}&match_status=eq.finished&order=score_a.desc&limit=1&select=id,score_a,score_b`,
    { headers }
  );
  if (!res.ok) {
    throw new Error(`fetchFinishedMatchRow(${tournamentId}) fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<{ id: string; score_a: number; score_b: number }>;
  const row = rows[0];
  if (!row) {
    throw new Error(`fetchFinishedMatchRow(${tournamentId}): kein beendetes Spiel gefunden.`);
  }
  return row;
}

export async function fetchMatchRow(matchId: string): Promise<MatchScoreRow> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(
    `${url}/rest/v1/matches?id=eq.${matchId}&select=score_a,score_b,match_status`,
    { headers }
  );
  if (!res.ok) {
    throw new Error(`fetchMatchRow(${matchId}) fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as MatchScoreRow[];
  const row = rows[0];
  if (!row) {
    throw new Error(`fetchMatchRow(${matchId}): kein Spiel gefunden.`);
  }
  return row;
}

/**
 * A2: liest die `id` eines Teams über seinen (zum Zeitpunkt des Aufrufs eindeutigen) Namen --
 * gebraucht, um den per UI umbenannten Team-Namen im `finally`-Block gezielt per Service-Role
 * zurückzubauen, ohne dass die UI zu diesem Zeitpunkt noch erreichbar sein muss.
 */
export async function fetchTeamIdByName(tournamentId: string, name: string): Promise<string> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(
    `${url}/rest/v1/teams?tournament_id=eq.${tournamentId}&name=eq.${encodeURIComponent(name)}&select=id`,
    { headers }
  );
  if (!res.ok) {
    throw new Error(`fetchTeamIdByName(${tournamentId}, ${name}) fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<{ id: string }>;
  const row = rows[0];
  if (!row) {
    throw new Error(`fetchTeamIdByName(${tournamentId}, ${name}): kein Team mit diesem Namen gefunden.`);
  }
  return row.id;
}

/**
 * A2: liest den aktuellen Namen eines Teams per Service-Role -- Gegenstück zu `setTeamName()`,
 * gebraucht um NACH dem Reconnect zu prüfen, dass die UI-Umbenennung tatsächlich in der DB
 * ankam (Beweis, dass A2 nur die Live-/Ergebnis-Spalten sperrt, nicht die Schedule-Spalten).
 */
export async function fetchTeamName(teamId: string): Promise<string | null> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/teams?id=eq.${teamId}&select=name`, { headers });
  if (!res.ok) {
    throw new Error(`fetchTeamName(${teamId}) fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<{ name: string }>;
  return rows[0]?.name ?? null;
}

/**
 * A2: setzt den Namen eines Teams per Service-Role zurück -- Rückbau-Gegenstück zur UI-Umbenennung
 * im Test (das per Service-Role gesetzt wird, statt erneut über die UI zu laufen, damit der
 * Rückbau nicht von einer ggf. selbst fehlgeschlagenen UI-Interaktion abhängt, N16).
 */
export async function setTeamName(teamId: string, name: string): Promise<void> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/teams?id=eq.${teamId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error(`setTeamName(${teamId}) fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
}

// =============================================================================
// SERVICE-ROLE REST-ZUGRIFF (Fixrunde 1, M1: EINE Stelle statt drei Kopien in
// `auth.cloud.spec.ts`/`public-view.cloud.spec.ts`/`publish-coadmin.cloud.spec.ts`) --
// `playwright.config.ts` importiert `getLocalSupabaseStatus` bereits direkt, "kein
// tsx-Node-Kontext" war als Begründung für eigene `execSync`-Kopien falsch (Review I5/M1):
// Playwright-Testdateien laufen selbst unter Node, nicht im Browser.
// =============================================================================

export interface LocalServiceRoleClient {
  url: string;
  serviceRoleKey: string;
  /** Für Aufrufe MIT einem echten Nutzer-JWT (PostgREST verlangt `apikey` unabhängig vom
   *  `Authorization`-Bearer-Token) -- siehe `roles.cloud.spec.ts#serverHasTournamentPermission`. */
  anonKey: string;
  mailpitUrl: string;
  /** Fertige Header für `fetch()` gegen `${url}/rest/v1/...` mit Service-Role-Rechten. */
  headers: { apikey: string; Authorization: string };
}

let cachedServiceRoleClient: LocalServiceRoleClient | null = null;

/**
 * Liest URL/Service-Role-Key/Mailpit-URL EINMAL pro Datei/Worker-Prozess (M2: `supabase status`
 * ist ein Docker-Aufruf, nicht bei jedem `expect.poll()`-Durchlauf erneut nötig) und sperrt
 * zusätzlich gegen Produktion (`assertLocalSupabaseTarget`, M1) -- VOR jedem Service-Role-
 * Schreibzugriff dieser Cloud-Specs, dieselbe Sperre wie `scripts/e2e-seed.ts`.
 */
export function getLocalServiceRoleClient(): LocalServiceRoleClient {
  if (cachedServiceRoleClient) {
    return cachedServiceRoleClient;
  }
  const status = getLocalSupabaseStatus();
  assertLocalSupabaseTarget(status.url, status.serviceRoleKey);
  cachedServiceRoleClient = {
    url: status.url,
    serviceRoleKey: status.serviceRoleKey,
    anonKey: status.anonKey,
    mailpitUrl: status.mailpitUrl,
    headers: { apikey: status.serviceRoleKey, Authorization: `Bearer ${status.serviceRoleKey}` },
  };
  return cachedServiceRoleClient;
}

// =============================================================================
// A-07d3: ABMELDEN, ANDERE GERÄTE ABMELDEN, KONTO-TRENNUNG
// =============================================================================

/** Frischer Browser-Kontext OHNE gespeicherte Anmeldung (ein „Gerät“), mit Einwilligung gesetzt. */
export async function newFreshContext(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.localStorage.setItem('app:consent', JSON.stringify({ errorTracking: true, sessionReplay: false, timestamp: Date.now(), version: 1 }));
  });
  return { context, page: await context.newPage() };
}

/** Zugangsschlüssel der Sitzung dieses Geräts (`sb-*-auth-token` im localStorage) oder null. */
export async function readSessionAccessToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith('sb-') && key.endsWith('-auth-token')) {
        const parsed = JSON.parse(window.localStorage.getItem(key) ?? 'null') as { access_token?: unknown } | null;
        return typeof parsed?.access_token === 'string' ? parsed.access_token : null;
      }
    }
    return null;
  });
}

/** HTTP-Status von `GET /auth/v1/user` mit diesem Zugangsschlüssel: 200 = Sitzung gilt, 403 = Sitzung beendet. */
export async function fetchAuthUserStatus(accessToken: string): Promise<number> {
  const { url, anonKey } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` } });
  return res.status;
}

/**
 * Abmelden über die Oberfläche, wenn Einträge warten: die Abmelde-Warnung erscheint (mit der
 * erwarteten Anzahl im Titel) und wird bestätigt. Danach ist das Gerät abgemeldet.
 */
export async function logoutViaUiConfirmingWarning(page: Page, waitingCount: number): Promise<void> {
  await verlasseLiveRahmen(page);
  await page.locator('[data-testid="auth-avatar-button"]').click();
  await page.locator('[data-testid="auth-logout-button"]').click();
  const dialog = page.locator('[data-testid="logout-warning-dialog"]');
  await expect(dialog).toBeVisible({ timeout: 5000 });
  // Wortlaut aus common.json (outbox.logoutWarning.title_one/_other), Anzahl als Parameter.
  const expectedTitle = waitingCount === 1
    ? '1 Eintrag noch nicht übertragen'
    : `${waitingCount} Einträge noch nicht übertragen`;
  await expect(page.getByRole('dialog')).toContainText(expectedTitle);
  // DA-2a (@OB-061/@OB-062) am echten Weg: Titel im festen Kopf, beide Tasten im festen Fuß, Haupttaste „Trotzdem abmelden“
  // zuletzt und ohne Scrollen vollständig im Fenster
  await expect(page.locator('[data-testid="dialog-surface-header"]')).toContainText(expectedTitle);
  const fuss = page.locator('[data-testid="dialog-surface-footer"]');
  await expect(fuss.locator('[data-testid="logout-warning-cancel"]')).toBeVisible();
  const haupt = await fuss.locator('[data-testid="logout-warning-confirm"]').boundingBox();
  const fenster = page.viewportSize();
  expect(haupt, 'Haupttaste hat eine Box').not.toBeNull();
  if (haupt && fenster) {
    expect(haupt.y).toBeGreaterThanOrEqual(0);
    expect(haupt.y + haupt.height).toBeLessThanOrEqual(fenster.height);
  }
  // Erst nach der Bestätigung wird abgemeldet: bis dahin besteht die Sitzung noch.
  expect(await readSessionAccessToken(page)).not.toBeNull();
  await page.locator('[data-testid="logout-warning-confirm"]').click();
  // Auf der Cockpit-Seite zeigt das Gerät danach „Turnier nicht gefunden“ ohne Kopfzeile (kein
  // Konto-Inhalt mehr), deshalb ist die gelöschte Sitzung das Merkmal, nicht ein Anmelde-Knopf.
  await expect(dialog).toHaveCount(0, { timeout: 10000 });
  await expect.poll(() => readSessionAccessToken(page), { timeout: 10000 }).toBeNull();
  await expect(page.locator('[data-testid="auth-avatar-button"]')).toHaveCount(0);
}

/** Profil öffnen und „Auf allen anderen Geräten abmelden“ bestätigen; wartet auf die Erfolgsmeldung. */
export async function logoutOtherDevicesViaUi(page: Page): Promise<void> {
  await page.goto('/#/profile');
  await page.locator('[data-testid="logout-others"]').click();
  await page.locator('[data-testid="confirm-dialog-confirm"]').click();
  await expect(page.getByText('Die anderen Geräte werden abgemeldet', { exact: false })).toBeVisible({ timeout: 10000 });
}

/**
 * Legt im Gastmodus ein lokales Turnier an (IndexedDB `hallenfussball/cache`, Schlüssel
 * `tournaments`, wie die Offline-Suite) und lädt neu. Die Seite muss vorher einmal geladen sein
 * (die Datenbank entsteht beim Start). Rückgabe: die Turnier-ID.
 */
export async function seedGuestTournament(page: Page, title: string): Promise<string> {
  const id = await page.evaluate(async (tournamentTitle) => {
    // Entwurf mit den Standardwerten der App selbst (Vite-Dev-Server liefert die Quelle aus).
    const modulePath = '/src/core/services/TournamentCreationService.ts';
    const { TournamentCreationService } = (await import(/* @vite-ignore */ modulePath)) as {
      TournamentCreationService: new (repository: object) => {
        createDraft: (data: object) => { id: string };
      };
    };
    const draft = new TournamentCreationService({}).createDraft({
      title: tournamentTitle,
      ageClass: 'U13',
      date: localDateIso(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      timeSlot: '09:00 - 16:00',
      startTime: '09:00',
      location: { name: 'Gast-Halle' },
      numberOfTeams: 2,
      teams: [
        { id: 'guest-team-1', name: 'Gast Team 1' },
        { id: 'guest-team-2', name: 'Gast Team 2' },
      ],
    });
    const stored = { ...(JSON.parse(JSON.stringify(draft)) as object), ownerId: 'guest' };
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('hallenfussball', 1);
      request.onerror = () => reject(new Error('IndexedDB nicht zu öffnen'));
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('cache', 'readwrite');
        transaction.objectStore('cache').put({ key: 'tournaments', value: [stored] });
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => { db.close(); reject(new Error('Schreiben in IndexedDB fehlgeschlagen')); };
      };
    });
    return draft.id;
  }, title);
  await page.reload();
  await page.waitForLoadState('networkidle');
  return id;
}

/** Anzahl Turniere in der Datenbank mit diesem Titel (Service-Rolle) -- Beleg „nicht hochgeladen“. */
export async function countTournamentsByTitle(title: string): Promise<number> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/tournaments?title=eq.${encodeURIComponent(title)}&select=id`, { headers });
  if (!res.ok) {
    throw new Error(`countTournamentsByTitle(${title}) fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
  return ((await res.json()) as unknown[]).length;
}
