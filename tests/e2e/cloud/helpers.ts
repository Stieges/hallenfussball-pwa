/**
 * tests/e2e/cloud/helpers.ts — gemeinsame Helfer für die "cloud"-E2E-Tests (Task T3,
 * .superpowers/sdd/2026-09-24-testumgebung/task-T3-brief.md).
 *
 * Importiert ausschließlich aus `tests/e2e/cloud/testData.ts` (einzige Quelle für
 * E-Mails/Passwort/Rollen) — keine Werte hier verstreut nochmal literal.
 */

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { E2E_USERS, E2E_TEST_PASSWORD, type E2EUserKey } from './testData';
import { getLocalSupabaseStatus } from '../../../scripts/lib/localSupabaseStatus';
import { assertLocalSupabaseTarget } from '../../../scripts/lib/assertLocalSupabaseTarget';

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
 * Meldet den aktuell angemeldeten Nutzer über die Oberfläche ab (Avatar-Menü,
 * `auth-avatar-button` → `auth-logout-button`, siehe `src/components/layout/AuthSection.tsx`).
 * Wartet danach auf ein "abgemeldet"-Merkmal -- Desktop zeigt `auth-login-button`, Mobile
 * `auth-mobile-button` (gleiche Unterscheidung wie `gotoLogin()` oben).
 */
export async function logoutViaUi(page: Page): Promise<void> {
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
 * Stellt sicher, dass das aktuell im Cockpit gewählte Spiel läuft -- klickt
 * `match-start-button`, falls das Spiel noch nicht gestartet ist (`match-pause-button` noch
 * nicht sichtbar). Kein Effekt, wenn schon ein Spiel läuft. `page` muss bereits auf der
 * Live-Cockpit-Seite eines Turniers mit Schreibrecht sein (owner/coadmin/helper).
 */
export async function ensureMatchRunning(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="match-status-badge"]')).toBeVisible({ timeout: 15000 });
  const startButton = page.locator('[data-testid="match-start-button"]');
  if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await startButton.click();
  }
  await expect(page.locator('[data-testid="match-pause-button"]')).toBeVisible({ timeout: 15000 });
}

/**
 * Abschluss-Review (final-review.md, I2/Ruling AG): liest per Service-Role direkt aus
 * `public.matches`, welches Spiel eines Turniers der Seed NIE angerührt hat (DB-Default
 * `match_status='scheduled'`, kein Score, kein Timer) -- höchste `round`/`slot`-Kombination, rein
 * um deterministisch IMMER dasselbe (das "letzte") Spiel zu treffen, nicht das seed-`running`-Spiel.
 * Gebraucht vom C-NSTART-Test (`two-devices.cloud.spec.ts`): Direktnavigation mit `?matchId=`
 * (`TournamentManagementScreen.tsx#matchIdFromUrl`) statt einer Dropdown-Auswahl -- Letztere
 * triggert bei bereits laufendem Spiel einen Bestätigungsdialog (`ManagementTab.tsx#handleMatch
 * SelectionChange`), den `?matchId=` umgeht (der `initialMatchId`-Effekt dort beendet das laufende
 * Spiel automatisch, ohne Dialog -- siehe `forceMatchRunning()` unten für den Rückbau).
 */
export async function fetchUntouchedMatchId(tournamentId: string): Promise<string> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(
    `${url}/rest/v1/matches?tournament_id=eq.${tournamentId}&match_status=eq.scheduled&order=round.desc,slot.desc&limit=1&select=id`,
    { headers }
  );
  if (!res.ok) {
    throw new Error(`fetchUntouchedMatchId(${tournamentId}) fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<{ id: string }>;
  const row = rows[0];
  if (!row) {
    throw new Error(`fetchUntouchedMatchId(${tournamentId}): kein Spiel mit match_status='scheduled' gefunden.`);
  }
  return row.id;
}

/**
 * Gegenstück zu `fetchUntouchedMatchId()`: liest die ID des aktuell laufenden Spiels eines
 * Turniers -- gebraucht vom C-NSTART-Test, um sich VOR der Direktnavigation zu merken, welches
 * Spiel `forceMatchRunning()` im `finally` wiederherstellen muss (die ID ist nicht deterministisch
 * ableitbar, `generateFullSchedule()` vergibt sie erst zur Seed-Laufzeit).
 */
export async function fetchRunningMatchId(tournamentId: string): Promise<string> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(
    `${url}/rest/v1/matches?tournament_id=eq.${tournamentId}&match_status=eq.running&limit=1&select=id`,
    { headers }
  );
  if (!res.ok) {
    throw new Error(`fetchRunningMatchId(${tournamentId}) fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<{ id: string }>;
  const row = rows[0];
  if (!row) {
    throw new Error(`fetchRunningMatchId(${tournamentId}): kein laufendes Spiel gefunden.`);
  }
  return row.id;
}

/**
 * I6/N16-Gegenstück zu `resetRunningMatchScore()` für den C-NSTART-Test: setzt EIN Spiel per ID
 * zurück auf `running` + festen Score/Timer. Anders als `resetRunningMatchScore()` (Filter
 * `match_status=eq.running`, trifft also NICHTS mehr, sobald der Status bereits gewechselt hat)
 * greift dieser Rückbau per ID auch dann, wenn `ManagementTab`s `initialMatchId`-Effekt das Spiel
 * zwischenzeitlich automatisch beendet hat (siehe `fetchUntouchedMatchId()`-Kommentar oben).
 *
 * Fixrunde 1 (M4, Review `task-A1-review.md`): setzt zusätzlich `actual_end`, `decided_by`,
 * `timer_paused_at` und `live_state` zurück auf `null` -- den Baseline-Zustand des Seeds (der das
 * laufende Spiel per Service-Role-Bypass anlegt, NIE über `MatchExecutionService`, siehe
 * `scripts/e2e-seed.ts`). Ohne diese vier Felder hinterließ ein `finishMatch()`-Aufruf
 * (`MatchExecutionService.persistFinalResult` setzt sie) Reste, die kein bestehender Test
 * bemerkte, aber die Baseline-Annahme "wie frisch geseedet" verletzten -- z. B. bliebe
 * `decided_by` auf `'regular'` stehen, obwohl das Spiel wieder als laufend gilt.
 */
export async function forceMatchRunning(matchId: string, homeScore: number, awayScore: number): Promise<void> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/matches?id=eq.${matchId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      match_status: 'running',
      score_a: homeScore,
      score_b: awayScore,
      timer_start_time: new Date().toISOString(),
      timer_elapsed_seconds: 300,
      timer_paused_at: null,
      actual_end: null,
      decided_by: null,
      live_state: null,
    }),
  });
  if (!res.ok) {
    throw new Error(`forceMatchRunning(${matchId}) fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
}

/**
 * Task A1 (Sofortschutz): liest die (nicht gelöschten) `match_events`-IDs eines Spiels --
 * Baseline VOR einer Aktion, um danach per Diff genau die NEU entstandenen Events zu erkennen
 * und gezielt zurückzubauen (siehe `softDeleteMatchEvents()`). Ohne diesen Rückbau bleibt z. B.
 * das `STATUS_CHANGE`-Ereignis eines `finishMatch()`-Aufrufs mit einem hohen `timestamp_seconds`
 * dauerhaft in der Tabelle stehen -- ein späterer Test in derselben `serial`-Kette
 * (`two-devices.cloud.spec.ts`, "Ereignis löschen") ermittelt das "letzte" Ereignis für
 * `handleUndoLastEvent` und traf dabei fälschlich dieses alte, zeitlich spätere Ereignis statt
 * des gerade eingetragenen Tors -- beobachtet als hängengebliebener Score nach einem Rückgängig-
 * Klick.
 */
export async function fetchMatchEventIds(matchId: string): Promise<string[]> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(
    `${url}/rest/v1/match_events?match_id=eq.${matchId}&is_deleted=eq.false&select=id`,
    { headers }
  );
  if (!res.ok) {
    throw new Error(`fetchMatchEventIds(${matchId}) fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<{ id: string }>;
  return rows.map((row) => row.id);
}

/**
 * Gegenstück zu `fetchMatchEventIds()`: markiert die übergebenen Event-IDs als gelöscht
 * (`is_deleted=true`, dieselbe Soft-Delete-Spalte wie `MatchExecutionService.deleteEvent()`) --
 * kein Effekt, wenn `ids` leer ist.
 */
export async function softDeleteMatchEvents(ids: string[]): Promise<void> {
  if (ids.length === 0) { return; }
  const { url, headers } = getLocalServiceRoleClient();
  const idList = ids.map((id) => `"${id}"`).join(',');
  const res = await fetch(`${url}/rest/v1/match_events?id=in.(${idList})`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ is_deleted: true }),
  });
  if (!res.ok) {
    throw new Error(`softDeleteMatchEvents(${ids.join(',')}) fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
}

/**
 * Task A1 (Sofortschutz): liest `localStorage['mutation_queue_failed_v1']` (Dead-Letter der
 * `MutationQueue`, siehe `MutationQueue.ts#failedStorageKey`) auf `page` und gibt die
 * `type`-Werte der darin enthaltenen Mutationen zurück (leeres Array, wenn der Schlüssel fehlt
 * oder leer ist). Gebraucht vom "Helfer beendet Spiel"-Test, um zu beweisen, dass nach einem
 * Spielende KEINE `SAVE_TOURNAMENT`-Mutation dort gelandet ist (vorher: RLS lehnt den vollen
 * Turnier-Save für einen Helfer ab → nach Retries Dead-Letter).
 */
export async function fetchFailedMutationTypes(page: Page): Promise<string[]> {
  const raw = await page.evaluate(() => window.localStorage.getItem('mutation_queue_failed_v1'));
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
export async function fetchQueuedMutationTypes(page: Page): Promise<string[]> {
  const raw = await page.evaluate(() => window.localStorage.getItem('mutation_queue_v1'));
  if (!raw) { return []; }
  const parsed = JSON.parse(raw) as Array<{ type?: string }>;
  return parsed.map((item) => item.type).filter((type): type is string => typeof type === 'string');
}

/**
 * Trägt ein Tor für `side` ein: klickt `goal-button-{side}`, überspringt den
 * Torschützen-Dialog (`dialog-skip-button`, siehe `GoalScorerDialog.tsx`) -- der Test braucht
 * nur den Zähler, keinen Spieler.
 */
export async function enterGoal(page: Page, side: 'home' | 'away'): Promise<void> {
  await page.locator(`[data-testid="goal-button-${side}"]`).click();
  const skipButton = page.locator('[data-testid="dialog-skip-button"]');
  await expect(skipButton).toBeVisible({ timeout: 5000 });
  await skipButton.click();
}

/**
 * I6 (Fixrunde 1): Setzt den Spielstand des aktuell LAUFENDEN Spiels eines Turniers auf den
 * übergebenen Seed-Ausgangswert zurück -- gebraucht von allen vier Tests in
 * `two-devices.cloud.spec.ts` (Fixrunde 2/N4: darunter der ehemals eigenständige Offline-Test),
 * die alle dasselbe laufende Live-Cup-Spiel für ihren Echtzeit-Nachweis verwenden. Seit die
 * Realtime-Publikation lokal korrekt gesetzt ist (Ruling W), schreibt ein
 * Tor den `matches`-Zeilen-Score tatsächlich durch (nur der `match_events`-Insert scheitert
 * weiter an Fehler A) -- ohne Rückbau würden sich aufeinanderfolgende Testläufe im selben
 * `test:e2e:cloud`-Lauf gegenseitig verkoppeln (I6).
 */
export async function resetRunningMatchScore(
  tournamentId: string,
  homeScore: number,
  awayScore: number
): Promise<void> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(
    `${url}/rest/v1/matches?tournament_id=eq.${tournamentId}&match_status=eq.running`,
    {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ score_a: homeScore, score_b: awayScore }),
    }
  );
  if (!res.ok) {
    throw new Error(`resetRunningMatchScore(${tournamentId}) fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
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
