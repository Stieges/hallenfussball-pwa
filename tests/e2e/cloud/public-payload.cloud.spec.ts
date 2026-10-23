/**
 * tests/e2e/cloud/public-payload.cloud.spec.ts — B-14 (E-A2, Review Focus 6): öffentliche Daten nur über die
 * Server-Funktionen mit Positivliste. ROHE REST-Aufrufe ohne App gegen den lokalen Stack (Gateway wie in der Cloud:
 * `/rest/v1/...` mit dem öffentlichen Schlüssel), dazu die Byte-Messung mit echten Gateway-Kopfzeilen.
 *
 * Eigene Turnierkopie je Fall (cloneReleaseCup, Service-Rolle nur zum Herstellen und Aufräumen), nur auf cloud-desktop.
 * Der gleiche Inhalt steht als Container-Beweis in scripts/public-payload-check.sh (Wegwerf-Postgres + PostgREST).
 */
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import { getLocalServiceRoleClient, safeCleanup } from './helpers';
import { cloneReleaseCup, deleteCup, restWithToken, svc, type ClonedCup } from './coadminEinsatz';
import { appendAsRole, getStoredAccessToken } from './engineHelpers';

interface Raw { status: number; json: unknown; text: string; headerBytes: number }
type Reply = Record<string, unknown> & { state?: string; matches?: Array<Record<string, unknown>> };

function parseJson(text: string): unknown {
  try { return text === '' ? null : JSON.parse(text) as unknown; } catch { return null; }
}

/** Roh-Aufruf als Zuschauerin ohne Konto (Mama Petra): nur der öffentliche Schlüssel. */
async function anon(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Raw> {
  const { url, anonKey } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let headerBytes = `HTTP/1.1 ${res.status} ${res.statusText}\r\n\r\n`.length;
  res.headers.forEach((value, key) => { headerBytes += key.length + value.length + 4; });
  return { status: res.status, json: parseJson(text), text, headerBytes };
}

const pub = async (code: string, since: number | null = null): Promise<Raw> =>
  anon('POST', 'rpc/public_tournament', { share_code: code, since_version: since });
const reply = (raw: Raw): Reply => raw.json as Reply;
const rows = (raw: Raw): number => (Array.isArray(raw.json) ? raw.json.length : -raw.status);

/** Kopie, öffentlich mit eigenem Code, Konfiguration ergänzt. */
async function sharedCopy(label: string, config: Record<string, unknown> = {}): Promise<ClonedCup & { code: string }> {
  const cup = await cloneReleaseCup(label, { withCoAdmin: false });
  const code = randomUUID().replace(/[^0-9a-f]/g, '').slice(0, 6).toUpperCase();
  const [row] = await svc('GET', `/rest/v1/tournaments?id=eq.${cup.id}&select=config`);
  await svc('PATCH', `/rest/v1/tournaments?id=eq.${cup.id}`, {
    is_public: true, share_code: code, share_code_created_at: new Date().toISOString(),
    config: { ...(row.config as Record<string, unknown>), ...config },
  });
  return { ...cup, code };
}

async function patchConfig(cupId: string, change: Record<string, unknown>): Promise<void> {
  const [row] = await svc('GET', `/rest/v1/tournaments?id=eq.${cupId}&select=config`);
  await svc('PATCH', `/rest/v1/tournaments?id=eq.${cupId}`, { config: { ...(row.config as Record<string, unknown>), ...change } });
}

/** Anpfiff und Tor (Rückennummer 9, 3. Minute) als Turnierleitung über den echten Schreibweg. */
async function startWithGoal(matchId: string): Promise<string> {
  const [match] = await svc('GET', `/rest/v1/matches?id=eq.${matchId}&select=team_a_id`);
  const teamA = String(match.team_a_id);
  const now = Date.now();
  const result = await appendAsRole('owner', matchId, [
    { id: randomUUID(), type: 'MATCH_START', at: now - 200_000, section: 1, clockMs: null, teamId: null, targetId: null, payload: {} },
    { id: randomUUID(), type: 'GOAL', at: now - 60_000, section: 1, clockMs: 130_000, teamId: teamA, targetId: null, payload: { playerNumber: 9 } },
  ]);
  expect(result.results.map((r) => r.status)).toEqual(['accepted', 'accepted']);
  return teamA;
}

test.describe('B-14 Öffentliche Daten nur über die Positivliste (rohe REST-Aufrufe, lokaler Stack)', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Eigene Turnierkopien je Fall, nur auf cloud-desktop.');
  });

  test('Review Focus 6 Pflichttest: anon liest tournaments, teams, matches, monitors nicht direkt – die Server-Funktion schon', async () => {
    const cup = await sharedCopy('rf6');
    try {
      expect(rows(await anon('GET', `tournaments?share_code=eq.${cup.code}&select=id`))).toBe(0);
      expect(rows(await anon('GET', `tournaments?select=id`))).toBe(0);
      expect(rows(await anon('GET', `teams?tournament_id=eq.${cup.id}&select=id`))).toBe(0);
      expect(rows(await anon('GET', `matches?tournament_id=eq.${cup.id}&select=id`))).toBe(0);
      expect(rows(await anon('GET', `monitors?tournament_id=eq.${cup.id}&select=id`))).toBe(0);
      expect(rows(await anon('GET', `sponsors?tournament_id=eq.${cup.id}&select=id`))).toBe(0);
      const answer = reply(await pub(cup.code));
      expect(answer.state).toBe('full');
      expect((answer.tournament as Record<string, unknown>).title).toBe(cup.title);
    } finally {
      await safeCleanup('Kopie löschen', () => deleteCup(cup.id));
    }
  });

  test('@ZM-068 @ZM-100 @ZM-063 nicht geteilt und unbekannt: dieselbe Antwort, nichts über das Turnier', async () => {
    const cup = await cloneReleaseCup('zm068', { withCoAdmin: false });
    try {
      await svc('PATCH', `/rest/v1/tournaments?id=eq.${cup.id}`, { share_code: 'B14NIX' }); // Code vorhanden, nicht geteilt
      const unshared = await pub('B14NIX');
      const unknown = await pub('ZZZZZ9');
      expect(unshared.text).toBe(unknown.text);
      expect(reply(unshared)).toEqual({ state: 'not_found' });
      expect(unshared.text).not.toContain(cup.title);
    } finally {
      await safeCleanup('Kopie löschen', () => deleteCup(cup.id));
    }
  });

  test('@ZM-066 @ZM-101 @ZM-065 @ZM-067 @ZM-069 Zurücknehmen: Zuschauer-Link nichts, Monitor-Link weiter; erneut teilen: derselbe Code', async () => {
    const cup = await sharedCopy('zm066');
    const token = getStoredAccessToken('owner');
    try {
      const priv = await restWithToken(token, 'POST', 'rpc/make_tournament_private', { tournament_id: cup.id });
      expect(priv.status).toBeLessThan(300);
      expect(reply(await pub(cup.code))).toEqual({ state: 'not_found' });
      const monitor = await anon('POST', 'rpc/display_tournament', { tournament_id: cup.id, monitor_id: cup.monitorId, since_version: null });
      expect(reply(monitor).state).toBe('full');
      const again = await restWithToken(token, 'POST', 'rpc/make_tournament_public', { tournament_id: cup.id });
      expect((again.json as Array<{ share_code: string }>)[0].share_code).toBe(cup.code);
      expect(reply(await pub(cup.code)).state).toBe('full');
    } finally {
      await safeCleanup('Kopie löschen', () => deleteCup(cup.id));
    }
  });

  test('@ZM-036 gelöschtes Turnier: not_found', async () => {
    const cup = await sharedCopy('zm036');
    try {
      await svc('PATCH', `/rest/v1/tournaments?id=eq.${cup.id}`, { deleted_at: new Date().toISOString() });
      expect(reply(await pub(cup.code))).toEqual({ state: 'not_found' });
    } finally {
      await safeCleanup('Kopie löschen', () => deleteCup(cup.id));
    }
  });

  test('@ZM-096 @ZM-097 @W1-030 @W1-031 @W1-032 Kontaktperson nur mit Häkchen, nie Ansprechpartner der Teams, nie am Monitor', async () => {
    const cup = await sharedCopy('kontakt', { contactInfo: { name: 'Olga Orga', email: 'olga@orga.test', phone: '0171 1112223' } });
    try {
      await svc('PATCH', `/rest/v1/teams?tournament_id=eq.${cup.id}`, { contact_name: 'Trainer Nordmann', contact_email: 'nord@verein.test', contact_phone: '0160 9998887' });
      const ohne = await pub(cup.code);
      for (const secret of ['Olga Orga', 'olga@orga.test', '0171 1112223', 'Trainer Nordmann', 'nord@verein.test', '0160 9998887']) {
        expect(ohne.text, secret).not.toContain(secret);
      }
      await patchConfig(cup.id, { contactInfo: { name: 'Olga Orga', email: 'olga@orga.test', phone: '0171 1112223', showPublic: true } });
      const mit = await pub(cup.code);
      expect(((reply(mit).tournament as Record<string, unknown>).config as Record<string, unknown>).contactInfo)
        .toMatchObject({ name: 'Olga Orga', email: 'olga@orga.test', phone: '0171 1112223' });
      expect(mit.text).not.toContain('Trainer Nordmann');
      const monitor = await anon('POST', 'rpc/display_tournament', { tournament_id: cup.id, monitor_id: cup.monitorId, since_version: null });
      expect(monitor.text).not.toContain('Olga Orga');
      expect(monitor.text).not.toContain('Trainer Nordmann');
    } finally {
      await safeCleanup('Kopie löschen', () => deleteCup(cup.id));
    }
  });

  test('@ZM-098 @ME-018 keine internen Angaben, keine Monitore, keine Urheber der Einträge', async () => {
    const cup = await sharedCopy('intern', { adminNotes: 'Schlüssel bei Hausmeister Kurt' });
    try {
      await startWithGoal(cup.matchId);
      const answer = await pub(cup.code);
      expect(answer.text).not.toContain('Hausmeister Kurt');
      expect(answer.text).not.toContain(cup.monitorId);
      expect(answer.text).not.toContain('"monitors"');
      expect(answer.text).not.toContain('"sponsors"');
      expect(answer.text).not.toContain('"actor"');
      expect(answer.text).not.toContain(cup.ownerId);
    } finally {
      await safeCleanup('Kopie löschen', () => deleteCup(cup.id));
    }
  });

  test('@ZM-001 @ZM-099 @ZM-102 Schalter am Server: Vorbelegung, ausgeschaltete Inhalte fehlen, Live-Stand aus verrät nichts', async () => {
    const cup = await sharedCopy('schalter');
    try {
      const teamA = await startWithGoal(cup.matchId);
      const match = (raw: Raw) => reply(raw).matches?.find((m) => m.id === cup.matchId) ?? {};
      // Vorbelegung: Live-Stand und Ereignisse an, Torschützen aus
      const vor = await pub(cup.code);
      expect(match(vor).score_a).toBe(1);
      expect((match(vor).events as unknown[]).length).toBe(1);
      expect(reply(vor)).not.toHaveProperty('scorers');
      // Ereignisse aus
      await patchConfig(cup.id, { publicEvents: false });
      expect(match(await pub(cup.code))).not.toHaveProperty('events');
      // Torschützen an, Live-Stand aus: laufendes Spiel ohne Stand, Tor zählt nicht
      await patchConfig(cup.id, { publicEvents: true, publicScorers: true, publicLiveScore: false });
      const aus = await pub(cup.code);
      expect(match(aus)).not.toHaveProperty('score_a');
      expect(reply(aus).scorers).toEqual([]);
      // Gegenbeispiel: Live-Stand an -> Torschütze Nr. 9 mit 1 Tor
      await patchConfig(cup.id, { publicLiveScore: true });
      expect(reply(await pub(cup.code)).scorers).toEqual([{ team_id: teamA, number: 9, goals: 1 }]);
    } finally {
      await safeCleanup('Kopie löschen', () => deleteCup(cup.id));
    }
  });

  // eslint-disable-next-line no-empty-pattern
  test('Messung: Bytes je Antwort mit echten Gateway-Kopfzeilen (Voll, keine Änderung, Delta 1 Tor)', async ({}, testInfo) => {
    test.setTimeout(90_000);
    const cup = await sharedCopy('messung');
    try {
      const teamA = await startWithGoal(cup.matchId);
      // Version steht erst 5 s nach der letzten Änderung still (Nachlauf, Migration Abschnitt 4).
      let version = 0;
      await expect.poll(async () => {
        version = reply(await pub(cup.code)).version as number;
        return reply(await pub(cup.code, version)).state;
      }, { timeout: 30_000, intervals: [2_000] }).toBe('unchanged');
      const full = await pub(cup.code);
      const unchanged = await pub(cup.code, version);
      const notFound = await pub('ZZZZZ9');
      const result = await appendAsRole('owner', cup.matchId, [{
        id: randomUUID(), type: 'GOAL', at: Date.now(), section: 1, clockMs: 200_000, teamId: teamA, targetId: null, payload: { playerNumber: 10 },
      }]);
      expect(result.results.map((r) => r.status)).toEqual(['accepted']);
      const delta = await pub(cup.code, version);
      expect(reply(delta).state).toBe('delta');
      const size = (raw: Raw) => ({ header: raw.headerBytes, body: Buffer.byteLength(raw.text) });
      const messung = { full: size(full), unchanged: size(unchanged), delta: size(delta), notFound: size(notFound) };
      await testInfo.attach('b14-messung.json', { body: JSON.stringify(messung, null, 2), contentType: 'application/json' });
      expect(messung.unchanged.body).toBeLessThan(200);
    } finally {
      await safeCleanup('Kopie löschen', () => deleteCup(cup.id));
    }
  });
});
