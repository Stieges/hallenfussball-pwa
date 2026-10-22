/**
 * Beitritt per Helfer-QR-Code – reiner Zustandsautomat (Plan GA5 v2.1 A-17a, § 3.2). Ohne React, ohne Aufrufe; die
 * Schritte mit Wirkung (Laden, Abmelden, Anfrage) stehen in `joinFlowSteps.ts` und liefern die Ereignisse hierher.
 *
 * Ablauf:
 *   loading ─infoLoaded→ form (Gerät/ohne Sitzung, Code offen) | accountConfirm | accountWaiting | show(<Anzeige § 3.2>)
 *   accountConfirm ─confirmSignOut→ signingOut ─signedOut→ form       (@HE-089)
 *                  ─cancel→ cancelled (angemeldet, keine Anfrage)       (@HE-090)
 *   signingOut ─signOutBlocked→ show(offline) | accountWaiting         (@HE-093, @HE-092)
 *   form ─submit→ submitting ─requestDone→ show(waiting | …)            (@HE-001, @HE-095)
 *                            ─sessionFailed/requestFailed→ form + Hinweis, Name bleibt (@HE-015)
 *
 * Ein Konto, das das Turnier leitet, sieht „Du leitest dieses Turnier bereits“ ohne Rückfrage (@HE-091) – das entscheidet
 * `helperAccessView` (Beziehung `leader` vor jedem Code-Zustand). Nach dem Abmelden führt kein Weg zurück zum Konto
 * („Abmelden gelingt, dann reißt das Netz“: Name bleibt, erneut versuchen).
 */
import {
  helperAccessView,
  type HelperAccessStatus,
  type HelperAccessView,
  type HelperRpcError,
  type RequestHelperAccessResult,
} from '../../core/repositories/helperAccessRpc';
import type { DeviceSessionFailure, SessionKind } from '../../core/auth/deviceSession';

/** Länge des Namens wie am Server (`request_helper_access`, 1–40 Zeichen nach dem Kürzen der Ränder). */
export const HELPER_NAME_MAX_LENGTH = 40;

export interface JoinTournament {
  id: string;
  title: string;
  date: string;
}

/** Hinweis im Namensformular; Eingaben bleiben erhalten (§ 3.2 „Netz/Zeitüberschreitung“, „Auth 429“, `INVALID_NAME`). */
export type JoinFormNotice = 'offline' | 'authRateLimited' | 'invalidName' | 'unexpected';

/** Namensformular (auch während des Absendens): Eingaben bleiben bei jedem Fehler erhalten. */
interface JoinFormFields {
  code: string;
  tournament: JoinTournament | null;
  shareCode: string | null;
  name: string;
  notice: JoinFormNotice | null;
}

export type JoinFlowState =
  | { step: 'loading'; code: string }
  | { step: 'show'; code: string; view: HelperAccessView }
  | { step: 'accountConfirm'; code: string; tournament: JoinTournament | null; shareCode: string | null }
  | { step: 'accountWaiting'; code: string; waitingCount: number }
  | { step: 'signingOut'; code: string; tournament: JoinTournament | null; shareCode: string | null }
  | { step: 'cancelled'; code: string }
  | (JoinFormFields & { step: 'form' })
  | (JoinFormFields & { step: 'submitting' });

export type JoinFlowEvent =
  | { type: 'infoLoaded'; info: HelperAccessStatus; session: SessionKind; waitingCount: number }
  | { type: 'infoFailed'; error: HelperRpcError }
  | { type: 'confirmSignOut' }
  | { type: 'cancel' }
  | { type: 'signOutBlocked'; reason: 'offline' } | { type: 'signOutBlocked'; reason: 'waiting'; waitingCount: number }
  | { type: 'signedOut' }
  | { type: 'nameChanged'; name: string }
  | { type: 'submit' }
  | { type: 'sessionFailed'; reason: DeviceSessionFailure }
  | { type: 'requestDone'; result: RequestHelperAccessResult }
  | { type: 'requestFailed'; error: HelperRpcError };

export function initialJoinFlowState(code: string): JoinFlowState {
  return { step: 'loading', code };
}

export function isValidHelperName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= HELPER_NAME_MAX_LENGTH;
}

function show(code: string, view: HelperAccessView): JoinFlowState {
  return { step: 'show', code, view };
}

function onInfoLoaded(code: string, event: Extract<JoinFlowEvent, { type: 'infoLoaded' }>): JoinFlowState {
  const view = helperAccessView({ source: 'info', info: event.info, session: event.session });
  const tournament = event.info.tournament ?? null;
  if (view.view === 'accountScan') {
    // @HE-092: solange Einträge warten, gibt es kein „Weiter“; @HE-089: sonst Rückfrage vor dem Abmelden.
    return event.waitingCount > 0
      ? { step: 'accountWaiting', code, waitingCount: event.waitingCount }
      : { step: 'accountConfirm', code, tournament, shareCode: event.info.shareCode ?? null };
  }
  if (view.view === 'joinForm') {
    return { step: 'form', code, tournament, shareCode: view.shareCode, name: '', notice: null };
  }
  return show(code, view);
}

const SESSION_NOTICES: Record<Exclude<DeviceSessionFailure, 'accountSession'>, JoinFormNotice> = {
  network: 'offline',
  rateLimited: 'authRateLimited',
  unavailable: 'unexpected',
  unexpected: 'unexpected',
};

function formNoticeForError(error: HelperRpcError): JoinFormNotice | null {
  switch (error.kind) {
    case 'network':
      return 'offline';
    case 'invalidInput':
      return error.reason === 'INVALID_NAME' ? 'invalidName' : 'unexpected';
    case 'unexpected':
      return 'unexpected';
    case 'noSession':
    case 'notAuthorized':
      return null;
  }
}

function onSubmitting(state: Extract<JoinFlowState, { step: 'submitting' }>, event: JoinFlowEvent): JoinFlowState {
  switch (event.type) {
    case 'sessionFailed':
      // Ein Konto ist (wieder) angemeldet: nie still eine Gerätesitzung daneben anlegen – neu scannen.
      return event.reason === 'accountSession'
        ? show(state.code, { view: 'retryScan' })
        : { ...state, step: 'form', notice: SESSION_NOTICES[event.reason] };
    case 'requestDone':
      return show(state.code, helperAccessView({ source: 'request', result: event.result }));
    case 'requestFailed': {
      const notice = formNoticeForError(event.error);
      return notice
        ? { ...state, step: 'form', notice }
        : show(state.code, helperAccessView({ source: 'error', error: event.error }));
    }
    default:
      return state;
  }
}

export function joinFlowReducer(state: JoinFlowState, event: JoinFlowEvent): JoinFlowState {
  switch (state.step) {
    case 'loading':
      if (event.type === 'infoLoaded') {
        return onInfoLoaded(state.code, event);
      }
      if (event.type === 'infoFailed') {
        return show(state.code, helperAccessView({ source: 'error', error: event.error }));
      }
      return state;
    case 'accountConfirm':
      if (event.type === 'confirmSignOut') {
        return { step: 'signingOut', code: state.code, tournament: state.tournament, shareCode: state.shareCode };
      }
      if (event.type === 'cancel') {
        return { step: 'cancelled', code: state.code };
      }
      return state;
    case 'signingOut':
      switch (event.type) {
        case 'signOutBlocked':
          return event.reason === 'offline'
            ? show(state.code, { view: 'offline' })
            : { step: 'accountWaiting', code: state.code, waitingCount: event.waitingCount };
        case 'signedOut':
          return { step: 'form', code: state.code, tournament: state.tournament, shareCode: state.shareCode, name: '', notice: null };
        case 'infoLoaded':
          // Beim erneuten Prüfen hat sich der Code geändert (erneuert, abgelaufen, schon leitend …).
          return onInfoLoaded(state.code, event);
        case 'infoFailed':
          return show(state.code, helperAccessView({ source: 'error', error: event.error }));
        default:
          return state;
      }
    case 'form':
      if (event.type === 'nameChanged') {
        return { ...state, name: event.name, notice: state.notice === 'invalidName' ? null : state.notice };
      }
      if (event.type === 'submit') {
        return isValidHelperName(state.name)
          ? { ...state, step: 'submitting', notice: null }
          : { ...state, notice: 'invalidName' };
      }
      return state;
    case 'submitting':
      return onSubmitting(state, event);
    case 'show':
    case 'accountWaiting':
    case 'cancelled':
      return state;
  }
}
