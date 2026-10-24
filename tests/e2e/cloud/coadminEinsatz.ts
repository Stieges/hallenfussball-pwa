/**
 * tests/e2e/cloud/coadminEinsatz.ts -- Hilfen für `coadmin-einsatz.cloud.spec.ts` (CA-7, Paket "Co-Admin einsatzfähig").
 *
 * Jeder Fall stellt seine Vorbedingungen selbst her und räumt sie wieder ab:
 * - `cloneReleaseCup` legt eine EIGENE Kopie des Freigabe-Cup an (neue Ids, privat, Datum heute, Co-Admin `coadmin`).
 *   So stört kein Fall einen anderen und keine andere Datei (publish-coadmin ändert den Freigabe-Cup selbst).
 *   Nichts hängt an der Uhrzeit des Seeds: kein laufendes Engine-Spiel, Zeiten setzt der Fall selbst.
 * - Die Betreiber-Vorlage (`scripts/betrieb/co-admin-eintragen.sql`) wird WÖRTLICH gelesen und im Datenbank-Container
 *   des lokalen Stacks per `docker exec ... psql` als Rolle postgres ausgeführt (wie das SQL-Editor-Fenster im
 *   Dashboard). Der CI-Job hat Docker (der Stack läuft dort in Containern, `scripts/local-db-apply.sh` nutzt denselben Weg).
 * Nur gegen den lokalen Stack: `getLocalServiceRoleClient` sperrt gegen Produktion, der Container-Name kommt aus
 * `supabase/config.toml` (`supabase_db_<project_id>`).
 */
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';
import { fetchUserIdByEmail } from './engineHelpers';
import { localDateIso } from '../../../src/core/view/time';
import { getLocalServiceRoleClient, gotoLogin } from './helpers';
import { E2E_RELEASE_CUP_ID, E2E_TEST_PASSWORD, E2E_USERS } from './testData';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// =============================================================================
// REST (Service-Rolle und mit Zugangsschlüssel einer Person)
// =============================================================================

type Row = Record<string, unknown> & { id?: string };

/** Service-Rolle (umgeht RLS): nur zum Herstellen, Prüfen und Aufräumen. Wirft bei jedem Fehlerstatus. */
export async function svc(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', pathAndQuery: string, body?: unknown): Promise<Row[]> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}${pathAndQuery}`, {
    method,
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: method === 'GET' || method === 'PATCH' ? 'return=representation' : 'return=minimal' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) { throw new Error(`${method} ${pathAndQuery}: ${res.status} ${await res.text()}`); }
  const text = await res.text();
  return text === '' ? [] : (JSON.parse(text) as Row[]);
}

export interface TokenResult { status: number; text: string; json: unknown }

/** PostgREST mit dem Zugangsschlüssel einer Person (z. B. einer frisch angelegten Maria), Fehlerstatus wird zurückgegeben. */
export async function restWithToken(token: string, method: 'GET' | 'POST' | 'PATCH', pathAndQuery: string, body?: unknown): Promise<TokenResult> {
  const { url, anonKey } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    method,
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown;
  try { json = text === '' ? null : JSON.parse(text); } catch { json = null; }
  return { status: res.status, text, json };
}

// =============================================================================
// KONTEN (wie "Add user" im Dashboard: bestätigt, mit Passwort)
// =============================================================================

export async function createAccount(email: string, name: string): Promise<string> {
  const created = await svcAuth('POST', '/auth/v1/admin/users', { email, password: E2E_TEST_PASSWORD, email_confirm: true, user_metadata: { name } });
  return String(created.id);
}

export async function deleteAccount(userId: string): Promise<void> {
  await svcAuth('DELETE', `/auth/v1/admin/users/${userId}`);
}

async function svcAuth(method: 'POST' | 'DELETE', pathAndQuery: string, body?: unknown): Promise<Record<string, unknown>> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}${pathAndQuery}`, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) { throw new Error(`${method} ${pathAndQuery}: ${res.status} ${await res.text()}`); }
  const text = await res.text();
  return text === '' ? {} : (JSON.parse(text) as Record<string, unknown>);
}

/** Anmeldung über die Oberfläche auf einem frischen Gerät (Passwort); wartet auf das Avatar-Zeichen. */
export async function loginWithPassword(page: Page, email: string): Promise<void> {
  await gotoLogin(page);
  await page.locator('[data-testid="login-email-input"]').fill(email);
  await page.locator('[data-testid="login-password-input"]').fill(E2E_TEST_PASSWORD);
  await page.locator('[data-testid="login-submit-button"]').click();
  await expect(page.locator('[data-testid="auth-avatar-button"]')).toBeVisible({ timeout: 15000 });
}

// =============================================================================
// EIGENE KOPIE DES FREIGABE-CUP
// =============================================================================

export interface ClonedCup {
  id: string;
  title: string;
  ownerId: string;
  monitorId: string;
  matchId: string;
  /** Titel der ersten Mannschaft (steht im Spielplan). */
  firstTeamName: string;
}

function collectIds(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) { value.forEach((v) => collectIds(v, into)); return; }
  if (value !== null && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'id' && typeof inner === 'string') { into.add(inner.toLowerCase()); }
      collectIds(inner, into);
    }
  }
}

/**
 * Kopie des Freigabe-Cup mit neuen Ids: Turnier (privat, ohne Code, Datum heute, Version 1), Mannschaften, Spiele; Monitor
 * und Sponsor stehen im `config` des Turniers und werden mit umgeschrieben. `coadmin` steht als Co-Admin drin
 * (`withCoAdmin: false` = ohne Mitglieder, wie die Kopie fürs Proben: `tournamentCopy.ts` kopiert keine Mitglieder).
 */
export async function cloneReleaseCup(label: string, options: { withCoAdmin?: boolean } = {}): Promise<ClonedCup> {
  const [source] = await svc('GET', `/rest/v1/tournaments?id=eq.${E2E_RELEASE_CUP_ID}`);
  if (!source) { throw new Error(`Freigabe-Cup (${E2E_RELEASE_CUP_ID}) fehlt -- npm run test:env:seed.`); }
  const teams = await svc('GET', `/rest/v1/teams?tournament_id=eq.${E2E_RELEASE_CUP_ID}`);
  const matches = await svc('GET', `/rest/v1/matches?tournament_id=eq.${E2E_RELEASE_CUP_ID}`);

  const config = source.config as { monitors?: Array<{ id: string }> };
  const ids = new Set<string>([String(source.id), ...teams.map((r) => String(r.id)), ...matches.map((r) => String(r.id))]);
  collectIds([config.monitors, (source.config as { sponsors?: unknown }).sponsors], ids);
  const renamed = new Map([...ids].map((id) => [id, randomUUID()]));
  const remap = <T,>(rows: T): T => JSON.parse(JSON.stringify(rows).replace(UUID, (hit) => renamed.get(hit.toLowerCase()) ?? hit)) as T;

  const title = `CA7 ${label} ${randomUUID().slice(0, 6)}`;
  const { change_revision: _drop, ...tournamentRow } = remap(source);
  const tournament = {
    ...tournamentRow, title, date: localDateIso(), is_public: false, share_code: null, share_code_created_at: null,
    version: 1, deleted_at: null,
  };
  await svc('POST', '/rest/v1/tournaments', [tournament]);
  try {
    await svc('POST', '/rest/v1/teams', remap(teams));
    await svc('POST', '/rest/v1/matches', remap(matches));
    if (options.withCoAdmin !== false) {
      await addMember(String(tournament.id), await fetchUserIdByEmail(E2E_USERS.coadmin.email), 'co-admin', String(source.owner_id));
    }
  } catch (error) {
    await deleteCup(String(tournament.id));
    throw error;
  }
  return {
    id: String(tournament.id), title, ownerId: String(source.owner_id),
    monitorId: renamed.get((config.monitors?.[0]?.id ?? '').toLowerCase()) ?? '',
    matchId: renamed.get(String(matches[0].id).toLowerCase()) ?? '',
    firstTeamName: String(remap(teams)[0].name),
  };
}

/** Hartes Löschen (Service-Rolle): Mannschaften, Spiele, Mitglieder, Lebenszeichen gehen per Kaskade mit. */
export async function deleteCup(id: string): Promise<void> {
  await svc('DELETE', `/rest/v1/tournaments?id=eq.${id}`);
}

/** Mitgliedschaft wie der Betreiber-Eintrag: angenommen, vom Eigentümer. Nur für seed-eigene Konten (Maria geht über die Vorlage). */
export async function addMember(tournamentId: string, userId: string, role: 'co-admin' | 'collaborator', ownerId: string): Promise<void> {
  await svc('POST', '/rest/v1/tournament_collaborators', [{
    id: randomUUID(), tournament_id: tournamentId, user_id: userId, role, invited_by: ownerId, accepted_at: new Date().toISOString(), team_ids: [],
  }]);
}

export async function cupRow(id: string): Promise<{ is_public: boolean; share_code: string | null; share_code_created_at: string | null; version: number | null; location_name: string | null }> {
  const [row] = await svc('GET', `/rest/v1/tournaments?id=eq.${id}&select=is_public,share_code,share_code_created_at,version,location_name`);
  return row as never;
}

// =============================================================================
// GERÄT: lokale Kopie in IndexedDB (`hallenfussball`/`cache`, Schlüssel `tournaments`)
// =============================================================================

export interface LocalCopy { version: number | null; title: string; locationName: string | null; teamNames: string[] }

export async function localCopy(page: Page, tournamentId: string): Promise<LocalCopy | null> {
  return page.evaluate(async (id) => new Promise<LocalCopy | null>((resolve) => {
    const request = indexedDB.open('hallenfussball');
    request.onsuccess = () => {
      const read = request.result.transaction('cache', 'readonly').objectStore('cache').get('tournaments');
      read.onsuccess = () => {
        const list = ((read.result as { value?: Array<{ id: string; version?: number; title: string; location?: { name?: string }; teams?: Array<{ name: string }> }> } | undefined)?.value ?? []);
        const found = list.find((t) => t.id === id);
        resolve(found ? { version: found.version ?? null, title: found.title, locationName: found.location?.name ?? null, teamNames: (found.teams ?? []).map((team) => team.name) } : null);
      };
      read.onerror = () => resolve(null);
    };
    request.onerror = () => resolve(null);
  }), tournamentId);
}

// =============================================================================
// BETREIBER-VORLAGE per psql im Datenbank-Container
// =============================================================================

export type VorlageBlock = '0' | '1' | '2a' | '2b' | '3';

function dbContainer(): string {
  const projectId = /^project_id\s*=\s*"([^"]+)"/m.exec(readFileSync(path.join(REPO_ROOT, 'supabase', 'config.toml'), 'utf8'))?.[1];
  if (!projectId) { throw new Error('project_id fehlt in supabase/config.toml'); }
  const listed = spawnSync('docker', ['ps', '--filter', `name=supabase_db_${projectId}`, '--format', '{{.Names}}'], { encoding: 'utf8' });
  const name = listed.stdout.split('\n').find((line) => line.trim() !== '')?.trim();
  if (!name) { throw new Error(`Kein Datenbank-Container supabase_db_${projectId} gefunden (docker ps: ${listed.stderr.trim() || 'leer'}) -- läuft der lokale Stack?`); }
  return name;
}

/** Block `n` der Vorlage, wörtlich (zwischen den Zeilen "-- ##### BLOCK n"). */
function vorlageBlock(block: VorlageBlock): string {
  const text = readFileSync(path.join(REPO_ROOT, 'scripts', 'betrieb', 'co-admin-eintragen.sql'), 'utf8');
  const parts = text.split(/^-- ##### /m).slice(1);
  const found = parts.find((part) => part.startsWith(`BLOCK ${block} `) || part.startsWith(`BLOCK ${block}\n`));
  if (!found) { throw new Error(`Block ${block} fehlt in scripts/betrieb/co-admin-eintragen.sql`); }
  return found.slice(found.indexOf('\n') + 1);
}

export interface VorlageResult { status: number; rows: string[][]; stdout: string; stderr: string }

/** Führt einen Block mit ersetzten Platzhaltern aus. Zeilen kommen als Spalten (psql `-A -F'|'`), Meldungen (NOTICE) in `stderr`. */
export function runVorlage(block: VorlageBlock, tournamentId: string, mail: string): VorlageResult {
  const sql = vorlageBlock(block).replaceAll('<turnier-id>', tournamentId).replaceAll('<mail>', mail);
  const run = spawnSync('docker', ['exec', '-i', dbContainer(), 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qtA', '-F', '|'], { input: sql, encoding: 'utf8' });
  const stdout = run.stdout ?? '';
  return {
    status: run.status ?? -1, stdout, stderr: run.stderr ?? '',
    rows: stdout.split('\n').filter((line) => line.trim() !== '').map((line) => line.split('|')),
  };
}

/** Die zwölf Rechte, die Block 2b prüft, und welche davon die Co-Admin laut `rolePermissions.json` hat. */
export function coAdminRightsExpected(): { all: string[]; granted: Set<string> } {
  const json = JSON.parse(readFileSync(path.join(REPO_ROOT, 'src', 'features', 'auth', 'permissions', 'rolePermissions.json'), 'utf8')) as { roles: Record<string, string[]> };
  return {
    all: ['writeMatchData', 'correctEvents', 'leadMatches', 'tournamentSettings', 'teams', 'restructure', 'manageSchedule', 'manageLifecycle', 'manageScreens', 'manageHelpers', 'deleteTournament', 'manageMembers'],
    granted: new Set(json.roles['co-admin']),
  };
}
