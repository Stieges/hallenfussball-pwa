/**
 * A-27 Geräte-Rollen gegen den lokalen CI-Stack, roh an der Schnittstelle (brief-A-27.md § 6.1 Schritt 5).
 * Der Stack läuft mit der Repo-config.toml (anonyme Anmeldung an, Hook „Before User Created“) und allen Migrationen
 * inkl. 20261110_002. Gerätesitzungen entstehen wie `signInAnonymously` (POST /auth/v1/signup ohne E-Mail);
 * Mitgliedschaften helper/screen legt die Service-Rolle an (wie später Beitritt A-16 bzw. Kopplung B-20).
 * Nur gegen den lokalen Stack (`getLocalServiceRoleClient` sperrt gegen Produktion). Nur cloud-desktop.
 *
 * @HE-082 Lena (gescannt, nicht zugelassen): Turnier/Vorlage/Mitgliedschaft direkt an den Server → abgelehnt, nichts entsteht.
 * @AN-045 Tom (Helfer-Zugang ohne Konto) legt kein Turnier an.
 * @ME-059 der gekoppelte Hallen-Rechner: Tor abgelehnt, Monitor-Einstellung bleibt. Gegen: Maria (Co-Admin) ändert ihn.
 * @AN-006 / @AN-005 Konto direkt beim Server anlegen → abgelehnt, es entsteht kein Konto. Gegen: Gerätesitzung entsteht.
 * @AN-006 (Review K1, C-ANON-ZU-KONTO) eine Gerätesitzung macht sich nicht per E-Mail zum Konto (Trigger auf auth.users).
 */
import { test, expect } from './fixtures';
import { getLocalServiceRoleClient } from './helpers';
import { anonymousSession, restAsRole, restWithToken, serviceRest } from './restAsRole';
import { E2E_LIVE_CUP_ID } from './testData';

const STAND = { title: 'Gerätesitzung A-27', date: '2026-11-10', number_of_teams: 4, group_phase_duration: 10 };

test.describe('A-27 Geräte-Rollen an der Schnittstelle', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright verlangt das Objektmuster als ersten Parameter
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Rohe Server-Proben nur auf cloud-desktop (Bremse anonymer Anmeldungen).');
  });

  test('@AN-006 Gegenbeispiel: eine anonyme Gerätesitzung entsteht (is_anonymous)', async () => {
    const lena = await anonymousSession();
    expect(lena.isAnonymous).toBe(true);
  });

  test('@AN-006 @AN-005 Konto direkt beim Server anlegen wird abgelehnt, es entsteht kein Konto', async () => {
    const { url, anonKey, headers } = getLocalServiceRoleClient();
    const email = `a27-registrierung-${Date.now()}@example.test`;
    const res = await fetch(`${url}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Geheim-12345' }),
    });
    expect(res.status).toBe(403);
    const users = (await (await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers })).json()) as { users: { email?: string }[] };
    expect(users.users.some((u) => u.email === email)).toBe(false);
  });

  test('@AN-006 eine anonyme Gerätesitzung setzt eine E-Mail: abgelehnt, bleibt anonym, kein Turnier', async () => {
    const { url, anonKey, headers } = getLocalServiceRoleClient();
    const lena = await anonymousSession();
    const umwandeln = await fetch(`${url}/auth/v1/user`, {
      method: 'PUT',
      headers: { apikey: anonKey, Authorization: `Bearer ${lena.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `a27-umwandlung-${Date.now()}@example.test` }),
    });
    expect(umwandeln.status).toBeGreaterThanOrEqual(400);
    const nutzer = (await (await fetch(`${url}/auth/v1/admin/users/${lena.userId}`, { headers })).json()) as { is_anonymous?: boolean; email?: string };
    expect(nutzer.is_anonymous).toBe(true);
    expect(nutzer.email ?? '').toBe('');
    const turnier = await restWithToken(lena.accessToken, 'POST', 'tournaments', { ...STAND, owner_id: lena.userId });
    expect(turnier.status).toBeGreaterThanOrEqual(400);
    expect((await serviceRest('GET', `tournaments?owner_id=eq.${lena.userId}&select=id`)).json).toEqual([]);
  });

  test('@HE-082 Lena legt weder Turnier noch Vorlage noch Mitgliedschaft an', async () => {
    const lena = await anonymousSession();
    const turnier = await restWithToken(lena.accessToken, 'POST', 'tournaments', { ...STAND, owner_id: lena.userId });
    const vorlage = await restWithToken(lena.accessToken, 'POST', 'tournament_templates', { owner_id: lena.userId, name: 'Lenas Vorlage', config: {} });
    const mitglied = await restWithToken(lena.accessToken, 'POST', 'tournament_collaborators', {
      tournament_id: E2E_LIVE_CUP_ID, user_id: lena.userId, role: 'helper', accepted_at: new Date().toISOString(),
    });
    expect([turnier.status, vorlage.status, mitglied.status].every((s) => s >= 400)).toBe(true);
    expect((await serviceRest('GET', `tournaments?owner_id=eq.${lena.userId}&select=id`)).json).toEqual([]);
    expect((await serviceRest('GET', `tournament_templates?owner_id=eq.${lena.userId}&select=id`)).json).toEqual([]);
    expect((await serviceRest('GET', `tournament_collaborators?user_id=eq.${lena.userId}&select=id`)).json).toEqual([]);
  });

  test('@HE-082 Gegenbeispiel: Olli legt ein Turnier an', async () => {
    const owner = (await serviceRest('GET', `tournaments?id=eq.${E2E_LIVE_CUP_ID}&select=owner_id`)).json as { owner_id: string }[];
    const res = await restAsRole('owner', 'POST', 'tournaments', { ...STAND, title: 'Ollis A-27-Gegenprobe', owner_id: owner[0].owner_id });
    expect(res.status).toBe(201);
    const id = (res.json as { id: string }[])[0].id;
    await serviceRest('DELETE', `tournaments?id=eq.${id}`);
  });

  test('@AN-045 Tom mit Helfer-Zugang (ohne Konto) legt kein Turnier an', async () => {
    const tom = await anonymousSession();
    const m = await serviceRest('POST', 'tournament_collaborators', {
      tournament_id: E2E_LIVE_CUP_ID, user_id: tom.userId, role: 'helper', accepted_at: new Date().toISOString(),
    });
    expect(m.status).toBe(201);
    try {
      const res = await restWithToken(tom.accessToken, 'POST', 'tournaments', { ...STAND, owner_id: tom.userId });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect((await serviceRest('GET', `tournaments?owner_id=eq.${tom.userId}&select=id`)).json).toEqual([]);
    } finally {
      await serviceRest('DELETE', `tournament_collaborators?user_id=eq.${tom.userId}`);
    }
  });

  test('@ME-059 der gekoppelte Hallen-Rechner trägt kein Tor ein und ändert den Monitor nicht; Gegen: Maria ändert ihn', async () => {
    const halle = await anonymousSession();
    await serviceRest('POST', 'tournament_collaborators', {
      tournament_id: E2E_LIVE_CUP_ID, user_id: halle.userId, role: 'screen', accepted_at: new Date().toISOString(),
    });
    const monitor = await serviceRest('POST', 'monitors', {
      tournament_id: E2E_LIVE_CUP_ID, name: 'Hallenmonitor Halle', type: 'slideshow', config: { slides: [{ type: 'standings' }] },
    });
    const monitorId = (monitor.json as { id: string }[])[0].id;
    try {
      const spiel = (await serviceRest('GET', `matches?tournament_id=eq.${E2E_LIVE_CUP_ID}&select=id&limit=1`)).json as { id: string }[];
      const tor = await restWithToken(halle.accessToken, 'POST', 'rpc/append_match_events', {
        p_match_id: spiel[0].id, p_client_format: 1, p_device_id: null,
        p_events: [{ id: crypto.randomUUID(), type: 'GOAL', at: 1000, section: 1, clockMs: 0, payload: {} }],
      });
      expect((tor.json as { results: { code: string }[] }).results[0].code).toBe('FORBIDDEN_ACTOR');
      await restWithToken(halle.accessToken, 'PATCH', `monitors?id=eq.${monitorId}`, { config: { slides: [] } });
      const nachHalle = (await serviceRest('GET', `monitors?id=eq.${monitorId}&select=config`)).json as { config: { slides: unknown[] } }[];
      expect(nachHalle[0].config.slides).toHaveLength(1);
      const maria = await restAsRole('coadmin', 'PATCH', `monitors?id=eq.${monitorId}`, { config: { slides: [{ type: 'live' }, { type: 'schedule' }] } });
      expect(maria.status).toBe(200);
      const nachMaria = (await serviceRest('GET', `monitors?id=eq.${monitorId}&select=config`)).json as { config: { slides: unknown[] } }[];
      expect(nachMaria[0].config.slides).toHaveLength(2);
    } finally {
      await serviceRest('DELETE', `monitors?id=eq.${monitorId}`);
      await serviceRest('DELETE', `tournament_collaborators?user_id=eq.${halle.userId}`);
    }
  });
});
