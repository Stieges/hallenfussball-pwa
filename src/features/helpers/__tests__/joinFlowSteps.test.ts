/**
 * Schritte mit Wirkung (A-17a): Reihenfolge Netz → wartende Einträge → Abmelden, Gerätesitzung erst beim Absenden (S-5).
 * Gegenbeispiele aus dem Plan: ohne Netz kein Abmelden (@HE-093), „Abbrechen“ → kein signOut, keine Anfrage (@HE-090),
 * echtes Konto → nie signInAnonymously, „Abmelden gelingt, dann reißt das Netz“ → Name bleibt, kein Konto zurück.
 */
import { describe, expect, it, vi } from 'vitest';
import type { HelperRpcResult, JoinCodeInfo, RequestHelperAccessResult } from '../../../core/repositories/helperAccessRpc';
import { ensureDeviceSession, readSessionInfo, type DeviceSessionLike } from '../../../core/auth/deviceSession';
import { initialJoinFlowState, joinFlowReducer, type JoinFlowState } from '../joinFlow';
import { confirmSignOut, createJoinFlowDeps, loadJoinInfo, submitJoinRequest, type JoinFlowDeps } from '../joinFlowSteps';

const CUP = { id: 't-cup', title: 'Live-Cup', date: '2026-11-28' };
const OPEN: JoinCodeInfo = { state: 'open', relation: 'none', tournament: CUP, shareCode: null };
const PENDING: RequestHelperAccessResult = { result: 'PENDING', state: 'open', relation: 'pending', tournament: CUP, checkNumber: 47 };

const ok = <T,>(data: T): HelperRpcResult<T> => ({ ok: true, data });
const offline = <T,>(): HelperRpcResult<T> => ({ ok: false, error: { kind: 'network' } });

/**
 * Gerät mit auth-js-ähnlichem Speicher: `signOutLocal` entfernt das Konto, `ensureDeviceSession` ist die echte Funktion
 * gegen eine Auth-Attrappe – so zählt jeder Aufruf von `signInAnonymously`.
 */
function device(start: DeviceSessionLike | null, overrides: Partial<JoinFlowDeps> = {}) {
  let session = start;
  const auth = {
    getSession: vi.fn(async () => ({ data: { session }, error: null as unknown })),
    signInAnonymously: vi.fn(async () => {
      session = { user: { id: 'anon-tom', is_anonymous: true } };
      return { data: { session }, error: null as unknown };
    }),
  };
  const calls: string[] = [];
  const deps: JoinFlowDeps = {
    loadInfo: vi.fn(async () => { calls.push('loadInfo'); return ok(OPEN); }),
    readSession: () => readSessionInfo(auth),
    countWaiting: vi.fn(async () => { calls.push('countWaiting'); return 0; }),
    signOutLocal: vi.fn(async () => { calls.push('signOutLocal'); session = null; return { ok: true }; }),
    ensureDeviceSession: () => ensureDeviceSession(auth),
    requestAccess: vi.fn(async () => { calls.push('requestAccess'); return ok(PENDING); }),
    deviceLabel: () => 'phone',
    syncEntry: vi.fn(),
    reportError: vi.fn(),
    ...overrides,
  };
  return { deps, auth, calls };
}

const GRETA: DeviceSessionLike = { user: { id: 'greta', is_anonymous: false } };
const TOM_DEVICE: DeviceSessionLike = { user: { id: 'anon-tom', is_anonymous: true } };

async function scan(deps: JoinFlowDeps): Promise<JoinFlowState> {
  return joinFlowReducer(initialJoinFlowState('CODE123456'), await loadJoinInfo('CODE123456', deps));
}

async function submit(state: JoinFlowState, deps: JoinFlowDeps, name = 'Tom'): Promise<JoinFlowState> {
  const sub = joinFlowReducer(joinFlowReducer(state, { type: 'nameChanged', name }), { type: 'submit' });
  if (sub.step !== 'submitting') {throw new Error(`erwartet submitting, war ${sub.step}`);}
  return joinFlowReducer(sub, await submitJoinRequest(sub, deps));
}

describe('@HE-089 Konto scannt → Rückfrage → Abmelden nur auf diesem Gerät → Beitritt ohne Konto', () => {
  it('Weiter: Netz geprüft, Einträge gezählt, dann logout(local); Gerätesitzung erst beim Absenden', async () => {
    const { deps, auth, calls } = device(GRETA);
    let state = await scan(deps);
    expect(state.step).toBe('accountConfirm');
    expect(auth.signInAnonymously).not.toHaveBeenCalled();

    state = joinFlowReducer(state, { type: 'confirmSignOut' });
    state = joinFlowReducer(state, await confirmSignOut('CODE123456', deps));
    expect(state).toMatchObject({ step: 'form', name: '' });
    // Reihenfolge: zuerst Netz (Code erneut geprüft), dann Zählen, dann Abmelden.
    expect(calls).toEqual(['loadInfo', 'countWaiting', 'loadInfo', 'countWaiting', 'signOutLocal']);
    expect(auth.signInAnonymously).not.toHaveBeenCalled();

    state = await submit(state, deps);
    expect(state).toEqual({ step: 'show', code: 'CODE123456', view: { view: 'waiting', checkNumber: 47 } });
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(deps.requestAccess).toHaveBeenCalledWith('CODE123456', 'Tom', 'phone');
    // Der Zugang gehört zur Gerätesitzung, nicht zu Gretas Konto.
    expect(deps.syncEntry).toHaveBeenCalledWith('anon-tom', 't-cup', expect.objectContaining({ relation: 'pending', checkNumber: 47 }), 'CODE123456');
  });
});

describe('@HE-090 Abbrechen', () => {
  it('kein signOut, keine Gerätesitzung, keine Anfrage (S-5: Scan + Abbrechen → kein signInAnonymously)', async () => {
    const { deps, auth } = device(GRETA);
    const state = joinFlowReducer(await scan(deps), { type: 'cancel' });
    expect(state.step).toBe('cancelled');
    expect(deps.signOutLocal).not.toHaveBeenCalled();
    expect(deps.requestAccess).not.toHaveBeenCalled();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('S-5 ohne Sitzung: Scannen und Anzeigen legen keine Gerätesitzung an', async () => {
    const { deps, auth } = device(null);
    expect(await scan(deps)).toMatchObject({ step: 'form' });
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(deps.countWaiting).not.toHaveBeenCalled();
  });
});

describe('@HE-091 wer leitet, wird nicht abgemeldet', () => {
  it('Konto des Eigentümers: „Du leitest dieses Turnier bereits“, kein Zählen, kein signOut, keine Anfrage', async () => {
    const { deps, auth } = device({ user: { id: 'olli', is_anonymous: false } }, {
      loadInfo: vi.fn(async () => ok<JoinCodeInfo>({ state: 'open', relation: 'leader', tournament: CUP })),
    });
    expect(await scan(deps)).toMatchObject({ step: 'show', view: { view: 'leader', tournamentId: 't-cup' } });
    expect(deps.countWaiting).not.toHaveBeenCalled();
    expect(deps.signOutLocal).not.toHaveBeenCalled();
    expect(deps.requestAccess).not.toHaveBeenCalled();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('wird während der Rückfrage Co-Admin: „Weiter“ meldet nicht ab, zeigt „leitet“', async () => {
    const loadInfo = vi.fn(async () => ok<JoinCodeInfo>(OPEN));
    const { deps } = device(GRETA, { loadInfo });
    let state = joinFlowReducer(await scan(deps), { type: 'confirmSignOut' });
    loadInfo.mockResolvedValueOnce(ok<JoinCodeInfo>({ state: 'open', relation: 'leader', tournament: CUP }));
    state = joinFlowReducer(state, await confirmSignOut('CODE123456', deps));
    expect(state).toMatchObject({ step: 'show', view: { view: 'leader' } });
    expect(deps.signOutLocal).not.toHaveBeenCalled();
  });
});

describe('@HE-092 Einträge warten', () => {
  it('beim Scan 2 wartende Einträge → kein Weiter, kein signOut; erneuter Scan nach dem Senden → Rückfrage', async () => {
    const countWaiting = vi.fn(async () => 2);
    const { deps } = device(GRETA, { countWaiting });
    expect(await scan(deps)).toEqual({ step: 'accountWaiting', code: 'CODE123456', waitingCount: 2 });
    expect(countWaiting).toHaveBeenCalledWith('greta');
    expect(deps.signOutLocal).not.toHaveBeenCalled();

    countWaiting.mockResolvedValue(0);
    expect(await scan(deps)).toMatchObject({ step: 'accountConfirm' });
  });

  it('Eintrag kommt zwischen Rückfrage und „Weiter“ dazu → nicht abmelden', async () => {
    const countWaiting = vi.fn(async () => 0);
    const { deps } = device(GRETA, { countWaiting });
    let state = joinFlowReducer(await scan(deps), { type: 'confirmSignOut' });
    countWaiting.mockResolvedValue(1);
    state = joinFlowReducer(state, await confirmSignOut('CODE123456', deps));
    expect(state).toEqual({ step: 'accountWaiting', code: 'CODE123456', waitingCount: 1 });
    expect(deps.signOutLocal).not.toHaveBeenCalled();
  });

  it('Zählfehler beim Scan → kein „Weiter“, gesperrt wie „Erst verbinden“ (fail-closed, Review #331 M-1)', async () => {
    const countWaiting = vi.fn(async (): Promise<number> => { throw new Error('IndexedDB'); });
    const { deps } = device(GRETA, { countWaiting });
    expect(await scan(deps)).toEqual({ step: 'accountWaiting', code: 'CODE123456', waitingCount: null });
    expect(deps.signOutLocal).not.toHaveBeenCalled();
    // Erneut scannen, wenn die Zählung wieder geht → Rückfrage wie sonst.
    countWaiting.mockResolvedValue(0);
    expect(await scan(deps)).toMatchObject({ step: 'accountConfirm' });
  });

  it('Zählfehler zwischen Rückfrage und „Weiter“ → nicht abmelden', async () => {
    const countWaiting = vi.fn(async (): Promise<number> => 0);
    const { deps } = device(GRETA, { countWaiting });
    let state = joinFlowReducer(await scan(deps), { type: 'confirmSignOut' });
    countWaiting.mockRejectedValueOnce(new Error('IndexedDB'));
    state = joinFlowReducer(state, await confirmSignOut('CODE123456', deps));
    expect(state).toEqual({ step: 'accountWaiting', code: 'CODE123456', waitingCount: null });
    expect(deps.signOutLocal).not.toHaveBeenCalled();
  });
});

describe('@HE-093 ohne Netz kein Abmelden', () => {
  it('Scan ohne Netz → Netz-Hinweis, kein signOut', async () => {
    const { deps } = device(GRETA, { loadInfo: vi.fn(async () => offline<JoinCodeInfo>()) });
    expect(await scan(deps)).toMatchObject({ step: 'show', view: { view: 'offline' } });
    expect(deps.signOutLocal).not.toHaveBeenCalled();
  });

  it('Netz reißt zwischen Rückfrage und „Weiter“ → Netz-Hinweis, kein signOut (Prüfung vor dem Abmelden)', async () => {
    const loadInfo = vi.fn(async () => ok<JoinCodeInfo>(OPEN));
    const { deps, auth } = device(GRETA, { loadInfo });
    let state = joinFlowReducer(await scan(deps), { type: 'confirmSignOut' });
    loadInfo.mockResolvedValueOnce(offline<JoinCodeInfo>());
    state = joinFlowReducer(state, await confirmSignOut('CODE123456', deps));
    expect(state).toEqual({ step: 'show', code: 'CODE123456', view: { view: 'offline' } });
    expect(deps.signOutLocal).not.toHaveBeenCalled();
    await expect(readSessionInfo(auth)).resolves.toEqual({ kind: 'account', userId: 'greta' });
  });

  it('anderer Fehler beim erneuten Prüfen → Anzeige des Fehlers, kein signOut', async () => {
    const loadInfo = vi.fn(async () => ok<JoinCodeInfo>(OPEN));
    const { deps } = device(GRETA, { loadInfo });
    loadInfo.mockResolvedValueOnce({ ok: false, error: { kind: 'unexpected', message: 'PGRST202' } });
    expect(await confirmSignOut('CODE123456', deps)).toEqual({ type: 'infoFailed', error: { kind: 'unexpected', message: 'PGRST202' } });
    expect(deps.signOutLocal).not.toHaveBeenCalled();
  });
});

describe('Record-Opt-out: Abmelden gelingt, dann reißt das Netz', () => {
  it('Name bleibt, „erneut versuchen“ geht, kein Konto zurück', async () => {
    const requestAccess = vi.fn(async () => offline<RequestHelperAccessResult>());
    const { deps, auth } = device(GRETA, { requestAccess });
    let state = joinFlowReducer(await scan(deps), { type: 'confirmSignOut' });
    state = joinFlowReducer(state, await confirmSignOut('CODE123456', deps));
    state = await submit(state, deps, 'Greta');
    expect(state).toMatchObject({ step: 'form', name: 'Greta', notice: 'offline' });
    // Kein Weg zurück zum Konto: die Sitzung ist die Gerätesitzung, nie wieder Greta.
    await expect(readSessionInfo(auth)).resolves.toEqual({ kind: 'device', userId: 'anon-tom' });
    expect(deps.signOutLocal).toHaveBeenCalledTimes(1);

    requestAccess.mockResolvedValueOnce(ok(PENDING));
    const retry = joinFlowReducer(state, { type: 'submit' });
    if (retry.step !== 'submitting') {throw new Error('submitting erwartet');}
    state = joinFlowReducer(retry, await submitJoinRequest(retry, deps));
    expect(state).toMatchObject({ step: 'show', view: { view: 'waiting', checkNumber: 47 } });
    // Zweiter Versuch nutzt dieselbe Gerätesitzung.
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('@HE-015 Gerätesitzung ohne Netz nicht anlegbar → Name bleibt, keine Anfrage', async () => {
    const { deps } = device(null, { ensureDeviceSession: async () => ({ ok: false, reason: 'network' }) });
    expect(await submit(await scan(deps), deps, 'Tom')).toMatchObject({ step: 'form', name: 'Tom', notice: 'offline' });
    expect(deps.requestAccess).not.toHaveBeenCalled();
    expect(deps.reportError).not.toHaveBeenCalled();
  });
});

describe('@HE-095 @HE-074 Wiedereinstieg auf demselben Gerät', () => {
  it('zugelassen mit Feld 2: Feld öffnet ohne Namenseingabe, keine Anfrage, keine neue Sitzung; Index nachgeführt', async () => {
    const info: JoinCodeInfo = { state: 'open', relation: 'accepted', tournament: CUP, field: 2 };
    const { deps, auth } = device(TOM_DEVICE, { loadInfo: vi.fn(async () => ok(info)) });
    expect(await scan(deps)).toMatchObject({ step: 'show', view: { view: 'openField', field: 2 } });
    expect(deps.requestAccess).not.toHaveBeenCalled();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(deps.syncEntry).toHaveBeenCalledWith('anon-tom', 't-cup', info, 'CODE123456');
  });

  it('@HE-098 Zugang entzogen → „Du hast keinen Zugriff mehr“, Index nachgeführt', async () => {
    const info: JoinCodeInfo = { state: 'open', relation: 'revoked', tournament: CUP };
    const { deps } = device(TOM_DEVICE, { loadInfo: vi.fn(async () => ok(info)) });
    expect(await scan(deps)).toMatchObject({ step: 'show', view: { view: 'noAccess' } });
    expect(deps.syncEntry).toHaveBeenCalledWith('anon-tom', 't-cup', info, 'CODE123456');
  });

  it('N-1 Gegenbeispiel: ein Konto-Scan fasst den Index nie an (auch mit Turnier-Angabe)', async () => {
    const forAccount = device(GRETA);
    await scan(forAccount.deps);
    const leader = device({ user: { id: 'olli', is_anonymous: false } }, {
      loadInfo: vi.fn(async () => ok<JoinCodeInfo>({ state: 'open', relation: 'leader', tournament: CUP })),
    });
    await scan(leader.deps);
    expect(forAccount.deps.syncEntry).not.toHaveBeenCalled();
    expect(leader.deps.syncEntry).not.toHaveBeenCalled();
  });

  it('ohne Turnier-Angabe (Code ungültig) oder ohne Gerätesitzung wird der Index nicht angefasst', async () => {
    const a = device(TOM_DEVICE, { loadInfo: vi.fn(async () => ok<JoinCodeInfo>({ state: 'invalid' })) });
    await scan(a.deps);
    expect(a.deps.syncEntry).not.toHaveBeenCalled();
    const b = device(null);
    await scan(b.deps);
    expect(b.deps.syncEntry).not.toHaveBeenCalled();
  });
});

describe('Absenden: Fehler und Meldungen', () => {
  it('ACCOUNT_SESSION trotz Gerätesitzung → Sentry + „Bitte noch einmal scannen“', async () => {
    const { deps } = device(null, { requestAccess: vi.fn(async () => ok<RequestHelperAccessResult>({ result: 'ACCOUNT_SESSION' })) });
    expect(await submit(await scan(deps), deps)).toMatchObject({ step: 'show', view: { view: 'retryScan' } });
    expect(deps.reportError).toHaveBeenCalledTimes(1);
    expect(deps.syncEntry).not.toHaveBeenCalled();
  });

  it('Gerätesitzung: unexpected/unavailable → Sentry; rateLimited ohne Sentry', async () => {
    for (const reason of ['unexpected', 'unavailable'] as const) {
      const { deps } = device(null, { ensureDeviceSession: async () => ({ ok: false, reason, message: 'm' }) });
      await submit(await scan(deps), deps);
      expect(deps.reportError).toHaveBeenCalledTimes(1);
    }
    const { deps } = device(null, { ensureDeviceSession: async () => ({ ok: false, reason: 'rateLimited' }) });
    expect(await submit(await scan(deps), deps)).toMatchObject({ step: 'form', notice: 'authRateLimited' });
    expect(deps.reportError).not.toHaveBeenCalled();
  });

  it('N-2 accountSession → Sentry nur, wenn schon der Scan das Konto sah; kommt es nach dem Scan zurück, kein Sentry', async () => {
    // Scan ohne Sitzung, danach kommt ein Konto zurück (Wettlauf): „Bitte noch einmal scannen“, ohne Sentry.
    const race = device(null, { ensureDeviceSession: async () => ({ ok: false, reason: 'accountSession' }) });
    expect(await submit(await scan(race.deps), race.deps)).toMatchObject({ step: 'show', view: { view: 'retryScan' } });
    expect(race.deps.reportError).not.toHaveBeenCalled();
    // Scan sah das Konto, es wurde abgemeldet, beim Absenden ist es wieder da: das ist ein Fehler im Ablauf → Sentry.
    const seen = device(GRETA, { ensureDeviceSession: async () => ({ ok: false, reason: 'accountSession' }) });
    let state = joinFlowReducer(await scan(seen.deps), { type: 'confirmSignOut' });
    state = joinFlowReducer(state, await confirmSignOut('CODE123456', seen.deps));
    expect(await submit(state, seen.deps)).toMatchObject({ step: 'show', view: { view: 'retryScan' } });
    expect(seen.deps.reportError).toHaveBeenCalledTimes(1);
  });

  it('F-1 Sitzung beim „Weiter“ nicht lesbar (unknown) → nicht abmelden, Netz-Hinweis, nie still ins Formular', async () => {
    const { deps } = device(GRETA, { readSession: vi.fn(async () => ({ kind: 'unknown' as const, userId: null })) });
    const event = await confirmSignOut('CODE123456', deps);
    expect(event).toEqual({ type: 'signOutBlocked', reason: 'offline' });
    expect(deps.signOutLocal).not.toHaveBeenCalled();
  });

  it('unerwartete Server-Antwort → Sentry, Formular bleibt; INVALID_NAME ohne Sentry', async () => {
    const a = device(null, { requestAccess: vi.fn(async () => ({ ok: false as const, error: { kind: 'unexpected' as const, message: '23505 dup' } })) });
    expect(await submit(await scan(a.deps), a.deps)).toMatchObject({ step: 'form', notice: 'unexpected' });
    expect(a.deps.reportError).toHaveBeenCalledTimes(1);
    const b = device(null, { requestAccess: vi.fn(async () => ({ ok: false as const, error: { kind: 'invalidInput' as const, reason: 'INVALID_NAME' as const } })) });
    expect(await submit(await scan(b.deps), b.deps)).toMatchObject({ step: 'form', notice: 'invalidName' });
    expect(b.deps.reportError).not.toHaveBeenCalled();
  });

  it.each(['ROTATED', 'EXPIRED', 'CLOSED', 'INVALID'] as const)('N-6 Ergebnis %s ohne Beziehung → alter Index-Eintrag des Turniers wird entfernt', async (code) => {
    const { deps } = device(null, { requestAccess: vi.fn(async () => ok<RequestHelperAccessResult>({ result: code })) });
    await submit(await scan(deps), deps);
    expect(deps.syncEntry).toHaveBeenCalledWith('anon-tom', 't-cup', { relation: 'none' }, 'CODE123456');
  });

  it('@HE-098 EXISTING bei abgeschlossenem Turnier: Index bekommt die Server-Form (state closed) zum Ableiten', async () => {
    const result: RequestHelperAccessResult = { result: 'EXISTING', state: 'closed', relation: 'accepted', tournament: CUP, field: 2 };
    const { deps } = device(null, { requestAccess: vi.fn(async () => ok(result)) });
    expect(await submit(await scan(deps), deps)).toMatchObject({ view: { view: 'finalStandings' } });
    expect(deps.syncEntry).toHaveBeenCalledWith('anon-tom', 't-cup', expect.objectContaining({ state: 'closed', relation: 'accepted' }), 'CODE123456');
  });

  it('EXISTING ohne Turnier in der Antwort nutzt das Turnier aus dem Scan für den Index', async () => {
    const { deps } = device(null, { requestAccess: vi.fn(async () => ok<RequestHelperAccessResult>({ result: 'EXISTING', relation: 'pending', checkNumber: 12 })) });
    await submit(await scan(deps), deps);
    expect(deps.syncEntry).toHaveBeenCalledWith('anon-tom', 't-cup', expect.objectContaining({ relation: 'pending', tournament: CUP }), 'CODE123456');
  });
});

describe('createJoinFlowDeps', () => {
  it('ruft join_code_info und request_helper_access über den Client', async () => {
    const rpc = vi.fn(async () => ({ data: { state: 'invalid' }, error: null }));
    const client = { rpc } as unknown as Parameters<typeof createJoinFlowDeps>[0];
    const { deps } = device(null);
    const wired = createJoinFlowDeps(client, deps);
    await wired.loadInfo('ABC');
    expect(rpc).toHaveBeenCalledWith('join_code_info', { p_code: 'ABC' });
    await wired.requestAccess('ABC', 'Tom', 'phone');
    expect(rpc).toHaveBeenCalledWith('request_helper_access', { p_code: 'ABC', p_display_name: 'Tom', p_device_label: 'phone' });
  });
});
