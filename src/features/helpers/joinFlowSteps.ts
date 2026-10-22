/**
 * Schritte mit Wirkung für den Beitritt per Helfer-QR-Code (Plan GA5 v2.1 A-17a). Jeder Schritt liefert genau ein
 * Ereignis für `joinFlowReducer`; die React-Anbindung (`useJoinFlow`, A-17b) ruft sie auf und dispatcht.
 *
 * Reihenfolge-Regeln (je mit Test und Mutation):
 * - S-5: `ensureDeviceSession` erst in `submitJoinRequest`, nie beim Laden oder in der Rückfrage.
 * - @HE-093: Abmelden erst, nachdem der Server erreichbar war (Code erneut geprüft) – ohne Netz kein Abmelden.
 * - @HE-092: Abmelden nur ohne wartende Einträge des Kontos (`countWaitingBeforeSignOut`, wie `useGuardedLogout`).
 * - Abmelden über `logout({ scope: 'local' })` (`logoutAction`): andere Geräte des Kontos bleiben angemeldet (@HE-089).
 */
import {
  callJoinCodeInfo,
  callRequestHelperAccess,
  type HelperRpcResult,
  type JoinCodeInfo,
  type RequestHelperAccessResult,
} from '../../core/repositories/helperAccessRpc';
import type { DeviceSessionResult, SessionInfo } from '../../core/auth/deviceSession';
import type { JoinFlowEvent, JoinFlowState } from './joinFlow';

export interface JoinFlowDeps {
  /** `join_code_info` (geht auch ohne Sitzung, Rolle anon). */
  loadInfo(code: string): Promise<HelperRpcResult<JoinCodeInfo>>;
  /** Sitzung dieses Geräts lesen – legt nie eine an. */
  readSession(): Promise<SessionInfo>;
  /** Wartende Einträge des angemeldeten Kontos (`countWaitingBeforeSignOut`). */
  countWaiting(accountId: string): Promise<number>;
  /** Nur dieses Gerät abmelden (`logout({ scope: 'local' })`). */
  signOutLocal(): Promise<unknown>;
  /** Gerätesitzung anlegen oder weiterverwenden (`ensureDeviceSession`). */
  ensureDeviceSession(): Promise<DeviceSessionResult>;
  requestAccess(code: string, name: string, deviceLabel: string | null): Promise<HelperRpcResult<RequestHelperAccessResult>>;
  deviceLabel(): string | null;
  /** Zugangs-Index nachführen (`syncHelperAccessEntry`). */
  syncEntry(deviceUserId: string, tournamentId: string, info: JoinCodeInfo, code: string): void;
  /** Programmierfehler melden (Sentry), z. B. `ACCOUNT_SESSION` (§ 3.2). */
  reportError(error: Error): void;
}

/** Wirkt nur auf die Anzeige: Ein Konto mit offenem Code ohne eigene Beziehung führt zur Rückfrage (§ 3.2). */
function needsAccountDecision(info: JoinCodeInfo, session: SessionInfo): boolean {
  return session.kind === 'account' && info.state === 'open' && (info.relation === undefined || info.relation === 'none');
}

async function waitingFor(session: SessionInfo, deps: JoinFlowDeps): Promise<number> {
  if (session.userId === null) {
    return 0;
  }
  try {
    return await deps.countWaiting(session.userId);
  } catch {
    return 0;
  }
}

function syncIfDevice(session: SessionInfo, info: JoinCodeInfo, code: string, deps: JoinFlowDeps): void {
  if (session.kind === 'device' && session.userId !== null && info.tournament) {
    deps.syncEntry(session.userId, info.tournament.id, info, code);
  }
}

/** Scan: Code prüfen, Sitzung lesen (ohne anzulegen), bei Konto wartende Einträge zählen. */
export async function loadJoinInfo(code: string, deps: JoinFlowDeps): Promise<JoinFlowEvent> {
  const session = await deps.readSession();
  const response = await deps.loadInfo(code);
  if (!response.ok) {
    return { type: 'infoFailed', error: response.error };
  }
  syncIfDevice(session, response.data, code, deps);
  const waitingCount = needsAccountDecision(response.data, session) ? await waitingFor(session, deps) : 0;
  return { type: 'infoLoaded', info: response.data, session: session.kind, waitingCount };
}

/**
 * „Weiter“ in der Rückfrage (@HE-089). Erst Netz (Code erneut prüfen), dann wartende Einträge, dann abmelden.
 * Hat sich der Code inzwischen geändert, kommt die neue Code-Info zurück statt abzumelden.
 */
export async function confirmSignOut(code: string, deps: JoinFlowDeps): Promise<JoinFlowEvent> {
  const session = await deps.readSession();
  const response = await deps.loadInfo(code);
  if (!response.ok) {
    return response.error.kind === 'network'
      ? { type: 'signOutBlocked', reason: 'offline' }
      : { type: 'infoFailed', error: response.error };
  }
  if (!needsAccountDecision(response.data, session)) {
    return { type: 'infoLoaded', info: response.data, session: session.kind, waitingCount: 0 };
  }
  const waitingCount = await waitingFor(session, deps);
  if (waitingCount > 0) {
    return { type: 'signOutBlocked', reason: 'waiting', waitingCount };
  }
  await deps.signOutLocal();
  return { type: 'signedOut' };
}

/** Name absenden: jetzt erst Gerätesitzung (S-5), dann Anfrage; Index nachführen. */
export async function submitJoinRequest(
  state: Extract<JoinFlowState, { step: 'submitting' }>,
  deps: JoinFlowDeps,
): Promise<JoinFlowEvent> {
  const session = await deps.ensureDeviceSession();
  if (!session.ok) {
    if (session.reason === 'accountSession' || session.reason === 'unexpected' || session.reason === 'unavailable') {
      deps.reportError(new Error(`Helfer-Beitritt: Gerätesitzung ${session.reason}${session.message ? ` – ${session.message}` : ''}`));
    }
    return { type: 'sessionFailed', reason: session.reason };
  }
  const response = await deps.requestAccess(state.code, state.name.trim(), deps.deviceLabel());
  if (!response.ok) {
    if (response.error.kind === 'unexpected') {
      deps.reportError(new Error(`Helfer-Beitritt: ${response.error.message}`));
    }
    return { type: 'requestFailed', error: response.error };
  }
  const result = response.data;
  if (result.result === 'ACCOUNT_SESSION') {
    deps.reportError(new Error('Helfer-Beitritt: ACCOUNT_SESSION trotz Gerätesitzung'));
  }
  const tournament = result.tournament ?? state.tournament;
  if ((result.result === 'PENDING' || result.result === 'EXISTING') && tournament) {
    deps.syncEntry(session.userId, tournament.id, { ...result, state: result.state ?? 'open', tournament }, state.code);
  }
  return { type: 'requestDone', result };
}

/** Standard-Verdrahtung der Server-Aufrufe; die React-Anbindung (A-17b) reicht Sitzung, Abmelden und Zähler herein. */
export function createJoinFlowDeps(
  client: Parameters<typeof callJoinCodeInfo>[0],
  rest: Omit<JoinFlowDeps, 'loadInfo' | 'requestAccess'>,
): JoinFlowDeps {
  return {
    ...rest,
    loadInfo: (code) => callJoinCodeInfo(client, code),
    requestAccess: (code, name, label) => callRequestHelperAccess(client, code, name, label),
  };
}
