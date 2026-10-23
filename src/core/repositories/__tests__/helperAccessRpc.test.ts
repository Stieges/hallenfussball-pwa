/**
 * A-16 (Plan GA5 v2.1 § 3.2): Zuordnung Server-Ergebnis → Anzeige, Fehler-Arten und Zugangs-Index `helper:access:v1`.
 * Werte aus dem Gherkin (`docs/anforderungen/2026-09-24_helfer-am-turniertag.md`): Live-Cup, Tom (Handy, Feld 2), Olli,
 * Maria, Prüfzahl 42. Antworten im Format der SQL-Funktionen (jsonb, Schlüssel wie in
 * `supabase/migrations/20261110_008_helper_join.sql`; im Container mit `scripts/helper-join-check.sh` gegengeprüft).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  HELPER_ACCESS_STORAGE_KEY,
  callDecideJoinRequest,
  callHelperAccessStatus,
  callJoinCodeInfo,
  callListHelperAccess,
  callRequestHelperAccess,
  classifyHelperRpcError,
  helperAccessView,
  parseHelperAccessIndex,
  type HelperAccessStatus,
} from '../helperAccessRpc';

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

function clientWith(result: RpcResult | Error) {
  const rpc = vi.fn(() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)));
  return { client: { rpc } as never, rpc };
}

const LIVE_CUP = { id: 't-live', title: 'Live-Cup', date: '2026-11-28' };
const info = (extra: Partial<HelperAccessStatus>): HelperAccessStatus => ({ state: 'open', tournament: LIVE_CUP, ...extra });

describe('§ 3.2 Zuordnung Code-Info / Zugangsstatus → Anzeige', () => {
  it('@HE-103 Code nie vergeben → „Dieser Code ist nicht gültig“, kein Turnier', () => {
    expect(helperAccessView({ source: 'info', info: { state: 'invalid' }, session: 'none' })).toEqual({ view: 'invalidCode' });
  });
  it('@HE-007 @HE-076 erneuerter Code ohne Beziehung → „nicht mehr gültig“', () => {
    expect(helperAccessView({ source: 'info', info: { state: 'rotated' }, session: 'device' })).toEqual({ view: 'codeRotated' });
  });
  it('@HE-009 abgelaufener Code → „Dieser Code ist abgelaufen“', () => {
    expect(helperAccessView({ source: 'info', info: { state: 'expired' }, session: 'none' })).toEqual({ view: 'codeExpired' });
  });
  it('@HE-038 @LZ-044 abgeschlossenes Turnier → kein Beitritt', () => {
    expect(helperAccessView({ source: 'info', info: { state: 'closed' }, session: 'none' })).toEqual({ view: 'tournamentClosed' });
  });
  it('@HE-033 offener Code ohne Sitzung → Info + Name, Weg zur Zuschauer-Ansicht nur bei geteiltem Turnier', () => {
    expect(helperAccessView({ source: 'info', info: info({ relation: 'none', shareCode: 'ABC123' }), session: 'none' }))
      .toEqual({ view: 'joinForm', shareCode: 'ABC123' });
    expect(helperAccessView({ source: 'info', info: info({ relation: 'none', shareCode: null }), session: 'device' }))
      .toEqual({ view: 'joinForm', shareCode: null });
  });
  it('@HE-089 offener Code, mit Konto angemeldet → Konto-Weg (Rückfrage/Einträge warten, A-17a)', () => {
    expect(helperAccessView({ source: 'info', info: info({ relation: 'none' }), session: 'account' })).toEqual({ view: 'accountScan' });
  });
  it('@HE-091 Olli oder Maria scannen → „Du leitest dieses Turnier bereits“, auch bei abgelaufenem Code', () => {
    expect(helperAccessView({ source: 'info', info: info({ relation: 'leader' }), session: 'account' }))
      .toEqual({ view: 'leader', tournamentId: 't-live' });
    expect(helperAccessView({ source: 'info', info: info({ state: 'expired', relation: 'leader' }), session: 'account' }))
      .toEqual({ view: 'leader', tournamentId: 't-live' });
  });
  it('@HE-001 @OB-053 offene Anfrage → Warteschirm mit Prüfzahl', () => {
    expect(helperAccessView({ source: 'info', info: info({ relation: 'pending', checkNumber: 42 }), session: 'device' }))
      .toEqual({ view: 'waiting', checkNumber: 42 });
  });
  it('@HE-004 @HE-008 abgelehnt → „Anfrage abgelehnt“', () => {
    expect(helperAccessView({ source: 'info', info: info({ relation: 'declined' }), session: 'device' })).toEqual({ view: 'declined', codeOpen: true });
  });
  it('@HE-008 @HE-102 abgelehnt: codeOpen nur bei offenem Code (einzelne Ablehnung), nicht beim alten Code', () => {
    expect(helperAccessView({ source: 'info', info: info({ state: 'open', relation: 'declined' }), session: 'device' })).toEqual({ view: 'declined', codeOpen: true });
    expect(helperAccessView({ source: 'info', info: info({ state: 'rotated', relation: 'declined' }), session: 'device' })).toEqual({ view: 'declined', codeOpen: false });
  });
  it('@HE-011 verfallen → „Anfrage verfallen“', () => {
    expect(helperAccessView({ source: 'info', info: info({ relation: 'expired' }), session: 'device' })).toEqual({ view: 'requestExpired' });
  });
  it('@HE-095 @HE-037 zugelassen mit Feld 2 → Feld 2 öffnen; @HE-040 ohne Feld → Feld 1', () => {
    expect(helperAccessView({ source: 'info', info: info({ relation: 'accepted', field: 2, closed: false }), session: 'device' }))
      .toEqual({ view: 'openField', tournamentId: 't-live', field: 2 });
    expect(helperAccessView({ source: 'info', info: info({ relation: 'accepted', field: null }), session: 'device' }))
      .toEqual({ view: 'openField', tournamentId: 't-live', field: 1 });
  });
  it('@HE-098 Z.3 Code abgelaufen, Turnier läuft, Zugang besteht → Feld öffnet sich', () => {
    expect(helperAccessView({ source: 'info', info: info({ state: 'expired', relation: 'accepted', field: 2, closed: false }), session: 'device' }))
      .toEqual({ view: 'openField', tournamentId: 't-live', field: 2 });
  });
  it('@HE-098 Z.2 Turnier abgeschlossen → Endstand, kein Eintrag', () => {
    expect(helperAccessView({ source: 'info', info: info({ state: 'closed', relation: 'accepted', field: 2, closed: true }), session: 'device' }))
      .toEqual({ view: 'finalStandings', tournamentId: 't-live' });
  });
  it('@HE-055 Z.2 zum Zuschauer gemacht → „Du kannst nur noch zusehen“', () => {
    expect(helperAccessView({ source: 'info', info: info({ relation: 'viewer', field: 2 }), session: 'device' }))
      .toEqual({ view: 'watchOnly', tournamentId: 't-live' });
  });
  it('@HE-098 Z.1 @HE-055 Z.1 entzogen → „Du hast keinen Zugriff mehr“', () => {
    expect(helperAccessView({ source: 'info', info: info({ relation: 'revoked' }), session: 'device' })).toEqual({ view: 'noAccess' });
  });
  it('Review L-2: Zugangsstatus {relation:"none"} (keine Anfrage dieses Geräts) → eigene Art, nie unerwartet oder „Feld öffnen“', () => {
    expect(helperAccessView({ source: 'info', info: { relation: 'none' }, session: 'device' })).toEqual({ view: 'noRequest' });
    expect(helperAccessView({ source: 'info', info: { relation: 'none' }, session: 'account' })).toEqual({ view: 'noRequest' });
  });
  it('Gegenbeispiel L-2: offener Code ohne Beziehung bleibt Info + Name; Antwort ganz ohne Beziehung und Zustand → unerwartet', () => {
    expect(helperAccessView({ source: 'info', info: info({ relation: 'none', shareCode: null }), session: 'device' }))
      .toEqual({ view: 'joinForm', shareCode: null });
    expect(helperAccessView({ source: 'info', info: {}, session: 'device' })).toEqual({ view: 'unexpected' });
  });
  it('Review L-2: callHelperAccessStatus nimmt {relation:"none"} an und führt zur eigenen Art', async () => {
    const res = await callHelperAccessStatus(clientWith({ data: { relation: 'none' }, error: null }).client, 't-live');
    expect(res).toEqual({ ok: true, data: { relation: 'none' } });
    expect(res.ok && helperAccessView({ source: 'info', info: res.data, session: 'device' })).toEqual({ view: 'noRequest' });
  });
});

describe('§ 3.2 Zuordnung Anfrage / Entscheidung / Fehler → Anzeige', () => {
  it('@HE-001 Anfrage gestellt → Warteschirm mit derselben Prüfzahl', () => {
    expect(helperAccessView({ source: 'request', result: { result: 'PENDING', ...info({ relation: 'pending', checkNumber: 42 }) } }))
      .toEqual({ view: 'waiting', checkNumber: 42 });
  });
  it('@HE-095 derselbe QR noch einmal → EXISTING zugelassen → Feld 2, keine neue Anfrage', () => {
    expect(helperAccessView({ source: 'request', result: { result: 'EXISTING', ...info({ relation: 'accepted', field: 2 }) } }))
      .toEqual({ view: 'openField', tournamentId: 't-live', field: 2 });
  });
  it('@HE-004 per Tipp abgelehnt, erneut gescannt → EXISTING abgelehnt', () => {
    expect(helperAccessView({ source: 'request', result: { result: 'EXISTING', ...info({ relation: 'declined' }) } }))
      .toMatchObject({ view: 'declined' });
  });
  it('BUSY → „Zu viele offene Anfragen …“; ACCOUNT_SESSION → „Bitte noch einmal scannen“', () => {
    expect(helperAccessView({ source: 'request', result: { result: 'BUSY' } })).toEqual({ view: 'busy' });
    expect(helperAccessView({ source: 'request', result: { result: 'ACCOUNT_SESSION' } })).toEqual({ view: 'retryScan' });
  });
  it('@HE-076 @HE-009 @HE-038 @HE-103 Anfrage auf nicht offenen Code → wie der Code-Zustand', () => {
    expect(helperAccessView({ source: 'request', result: { result: 'ROTATED' } })).toEqual({ view: 'codeRotated' });
    expect(helperAccessView({ source: 'request', result: { result: 'EXPIRED' } })).toEqual({ view: 'codeExpired' });
    expect(helperAccessView({ source: 'request', result: { result: 'CLOSED' } })).toEqual({ view: 'tournamentClosed' });
    expect(helperAccessView({ source: 'request', result: { result: 'INVALID' } })).toEqual({ view: 'invalidCode' });
  });
  it('@HE-006 Maria entscheidet nach Olli → „bereits von Olli entschieden“', () => {
    expect(helperAccessView({ source: 'decide', result: { result: 'ALREADY_DECIDED', status: 'accepted', decidedBy: 'Olli' } }))
      .toEqual({ view: 'alreadyDecided', decidedBy: 'Olli' });
  });
  it('@HE-105 falsche Prüfzahl → „Prüfzahl passt nicht“; richtige → gespeichert', () => {
    expect(helperAccessView({ source: 'decide', result: { result: 'CHECK_MISMATCH' } })).toEqual({ view: 'checkMismatch' });
    expect(helperAccessView({ source: 'decide', result: { result: 'OK', memberId: 'm-tom' } })).toEqual({ view: 'decided' });
  });
  it('@HE-011 Entscheidung über verfallene Anfrage → „Anfrage verfallen“', () => {
    expect(helperAccessView({ source: 'decide', result: { result: 'EXPIRED' } })).toEqual({ view: 'requestExpired' });
  });
  it('@HE-062 42501 → „Nur die Turnierleitung kann Helfer verwalten“; @HE-015 Netz → offline; S-6 Auth 429', () => {
    expect(helperAccessView({ source: 'error', error: { kind: 'notAuthorized' } })).toEqual({ view: 'leaderOnly' });
    expect(helperAccessView({ source: 'error', error: { kind: 'network' } })).toEqual({ view: 'offline' });
    expect(helperAccessView({ source: 'authRateLimited' })).toEqual({ view: 'authRateLimited' });
  });
  it('Review L-3: NOT_SIGNED_IN auf dem Helfer-Gerät → „Bitte noch einmal scannen“, nie „Nur die Turnierleitung …“', () => {
    expect(helperAccessView({ source: 'error', error: { kind: 'noSession' } })).toEqual({ view: 'retryScan' });
    expect(helperAccessView({ source: 'error', error: { kind: 'noSession' } })).not.toEqual({ view: 'leaderOnly' });
  });
  it('22023 INVALID_NAME → Feldprüfung; andere Eingabefehler und Unerwartetes → unexpected', () => {
    expect(helperAccessView({ source: 'error', error: { kind: 'invalidInput', reason: 'INVALID_NAME' } })).toEqual({ view: 'invalidName' });
    expect(helperAccessView({ source: 'error', error: { kind: 'invalidInput', reason: 'INVALID_FIELD' } })).toEqual({ view: 'unexpected' });
    expect(helperAccessView({ source: 'error', error: { kind: 'unexpected', message: 'x' } })).toEqual({ view: 'unexpected' });
  });
});

describe('Fehler-Arten der Aufrufe', () => {
  it('@HE-015 kein Code = Netz; Gegenbeispiel: Netzfehler wird nie zu „Code ungültig“', () => {
    expect(classifyHelperRpcError({ message: 'TypeError: Failed to fetch' })).toEqual({ kind: 'network' });
    expect(classifyHelperRpcError({ code: '', message: 'x' })).toEqual({ kind: 'network' });
  });
  it('42501 = kein Recht; 22023 nur mit festem Grund; PGRST202 (Funktion fehlt vor dem Einspielen) = unerwartet', () => {
    expect(classifyHelperRpcError({ code: '42501', message: 'Not authorized' })).toEqual({ kind: 'notAuthorized' });
    expect(classifyHelperRpcError({ code: '42501', message: 'NOT_SIGNED_IN' })).toEqual({ kind: 'noSession' });
    expect(classifyHelperRpcError({ code: '22023', message: 'INVALID_NAME' })).toEqual({ kind: 'invalidInput', reason: 'INVALID_NAME' });
    expect(classifyHelperRpcError({ code: '22023', message: 'anderes' })).toEqual({ kind: 'unexpected', message: '22023 anderes' });
    expect(classifyHelperRpcError({ code: 'PGRST202', message: 'not found' }).kind).toBe('unexpected');
  });
  it('Transportfehler (TypeError) → Netz; andere Ausnahme → unerwartet; ohne Client → unerwartet', async () => {
    expect(await callJoinCodeInfo(clientWith(new TypeError('Failed to fetch')).client, 'ABCDEFGHJK'))
      .toEqual({ ok: false, error: { kind: 'network' } });
    expect((await callJoinCodeInfo(clientWith(new Error('kaputt')).client, 'ABCDEFGHJK')).ok).toBe(false);
    expect(await callJoinCodeInfo(null, 'ABCDEFGHJK')).toEqual({ ok: false, error: { kind: 'unexpected', message: 'Supabase ist nicht konfiguriert' } });
  });
  it('@HE-103 Antwort {state:"invalid"} wird angenommen; Antwort außerhalb des Schemas → unerwartet', async () => {
    const { client, rpc } = clientWith({ data: { state: 'invalid' }, error: null });
    expect(await callJoinCodeInfo(client, 'ZZZZZZZZZZ')).toEqual({ ok: true, data: { state: 'invalid' } });
    expect(rpc).toHaveBeenCalledWith('join_code_info', { p_code: 'ZZZZZZZZZZ' });
    expect((await callJoinCodeInfo(clientWith({ data: { state: 'kaputt' }, error: null }).client, 'X')).ok).toBe(false);
  });
  it('Review L-3: Anfrage ohne Sitzung (42501 NOT_SIGNED_IN) → noSession; Gegenbeispiel: 42501 Not authorized bleibt kein Recht', async () => {
    const noSession = await callRequestHelperAccess(
      clientWith({ data: null, error: { code: '42501', message: 'NOT_SIGNED_IN' } }).client, 'ABCDEFGHJK', 'Tom', null);
    expect(noSession).toEqual({ ok: false, error: { kind: 'noSession' } });
    expect(!noSession.ok && helperAccessView({ source: 'error', error: noSession.error })).toEqual({ view: 'retryScan' });
    const leader = await callDecideJoinRequest(
      clientWith({ data: null, error: { code: '42501', message: 'Not authorized' } }).client, 'r-1', { accept: false });
    expect(!leader.ok && helperAccessView({ source: 'error', error: leader.error })).toEqual({ view: 'leaderOnly' });
  });
  it('S-5: die Anfrage sendet Name und Gerätebezeichnung als Parameter', async () => {
    const { client, rpc } = clientWith({ data: { result: 'PENDING', state: 'open', relation: 'pending', checkNumber: 42, tournament: LIVE_CUP }, error: null });
    const res = await callRequestHelperAccess(client, 'ABCDEFGHJK', 'Tom', 'Handy');
    expect(rpc).toHaveBeenCalledWith('request_helper_access', { p_code: 'ABCDEFGHJK', p_display_name: 'Tom', p_device_label: 'Handy' });
    expect(res.ok && res.data.checkNumber).toBe(42);
  });
  it('@HE-105 Zulassen sendet die Prüfzahl mit, Ablehnen nicht', async () => {
    const { client, rpc } = clientWith({ data: { result: 'CHECK_MISMATCH' }, error: null });
    expect(await callDecideJoinRequest(client, 'r-tom', { accept: true, checkNumber: 17, field: 2 }))
      .toEqual({ ok: true, data: { result: 'CHECK_MISMATCH' } });
    expect(rpc).toHaveBeenCalledWith('decide_join_request', { p_request_id: 'r-tom', p_accept: true, p_field: 2, p_check_number: 17 });
    await callDecideJoinRequest(client, 'r-fremd', { accept: false });
    expect(rpc).toHaveBeenLastCalledWith('decide_join_request', { p_request_id: 'r-fremd', p_accept: false });
  });
  it('@HE-021 @HE-106 @HE-052 Übersicht mit Namens-Hinweisen und „steuert“ wird gelesen', async () => {
    const data = {
      requests: [{ id: 'r-2', name: 'Tom', deviceLabel: 'Tablet', checkNumber: 42, createdAt: '2026-11-28T11:03:00+00:00',
        sameName: 3, sameNamePending: 1, sameNameMember: { deviceLabel: 'Handy', acceptedAt: '2026-11-28T10:00:00+00:00' },
        sameNameDeclinedAt: '2026-11-28T11:03:00+00:00' }],
      members: [{ memberId: 'm-tom', name: 'Tom', deviceLabel: 'Handy', field: 2, mode: 'helper', revokedAt: null,
        acceptedAt: '2026-11-28T10:00:00+00:00', lastSeenAt: null, controls: [2] }],
    };
    expect(await callListHelperAccess(clientWith({ data, error: null }).client, 't-live')).toEqual({ ok: true, data });
  });
});

describe('Zugangs-Index helper:access:v1', () => {
  const entry = {
    tournamentId: 't-live', title: 'Live-Cup', date: '2026-11-28', code: 'ABCDEFGHJK', field: 2, relation: 'accepted',
    closed: false, checkNumber: null, homeHintDismissed: false, offlineReadyAt: null, updatedAt: '2026-11-28T10:00:00Z',
  };
  it('Schlüssel ist helper:access:v1', () => {
    expect(HELPER_ACCESS_STORAGE_KEY).toBe('helper:access:v1');
  });
  it('@HE-074 gültiger Index derselben Gerätesitzung wird gelesen', () => {
    const raw = { version: 1, deviceUserId: 'u-tom', entries: [entry] };
    expect(parseHelperAccessIndex(raw, 'u-tom')).toEqual(raw);
  });
  it('Gegenbeispiel: andere Sitzung, fremde Version, kaputt oder ohne Sitzung → verwerfen (null)', () => {
    expect(parseHelperAccessIndex({ version: 1, deviceUserId: 'u-tom', entries: [entry] }, 'u-greta')).toBeNull();
    expect(parseHelperAccessIndex({ version: 2, deviceUserId: 'u-tom', entries: [] }, 'u-tom')).toBeNull();
    expect(parseHelperAccessIndex({ version: 1, deviceUserId: 'u-tom', entries: [{ ...entry, relation: 'leader' }] }, 'u-tom')).toBeNull();
    expect(parseHelperAccessIndex({ version: 1, deviceUserId: 'u-tom', entries: [] }, null)).toBeNull();
  });
});
