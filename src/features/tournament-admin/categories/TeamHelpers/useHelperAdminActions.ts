/**
 * useHelperAdminActions – Helfer-QR-Code und Entscheidungen der Turnierleitung (A-18a): Code anzeigen/erneuern
 * (`ensure_helper_code`, `rotate_helper_code`), Anfrage zulassen/ablehnen (`decide_join_request`), Zugang entziehen oder auf
 * „Nur zusehen“ stellen (`change_helper_access`).
 *
 * Regeln:
 * - Alles geht nur mit Netz (@HE-047): ohne Netz ruft der Hook den Server nicht an, merkt nichts vor und meldet `offline`.
 * - Der Server entscheidet (S-1): Zulassen schickt die gewählte Prüfzahl mit; bei `CHECK_MISMATCH` ändert sich nichts und der
 *   Hook meldet `checkMismatch`. Die Anzeige ändert der Hook nie selbst: nach jeder gelungenen Änderung holt die Seite die
 *   Liste neu (`onChanged`). Entzug nur im Client gibt es nicht.
 * - Antworten laufen durch `helperAccessView` (Plan § 3.2); Programmierfehler (22023 `INVALID_FIELD`/`INVALID_OPTION`) gehen
 *   an Sentry und zeigen „Das hat nicht geklappt – bitte noch einmal“, geändert wird nichts.
 *
 * Szenarien: @HE-001 @HE-006 @HE-007 @HE-008 @HE-011 @HE-021 @HE-040 @HE-047 @HE-055 @HE-062 @HE-102 @HE-105 @LZ-044.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  callChangeHelperAccess,
  callDecideJoinRequest,
  callEnsureHelperCode,
  callRotateHelperCode,
  helperAccessView,
  type HelperCodeResult,
  type HelperRpcError,
  type HelperRpcResult,
} from '../../../../core/repositories/helperAccessRpc';
import { captureFeatureError } from '../../../../lib/sentry';
import { supabase } from '../../../../lib/supabase';
import { useOnlineStatus } from '../../../../hooks/useOnlineStatus';

export interface HelperCodeInfo {
  code: string;
  validUntil: string;
  openRequests: number;
}

export type HelperCodeState = 'loading' | 'ready' | 'closed' | 'noRight' | 'error';

/** Meldung der letzten Aktion; die Seite zeigt sie als Hinweis. */
export type HelperActionNotice =
  | { kind: 'offline' }
  | { kind: 'alreadyDecided'; decidedBy: string | null }
  | { kind: 'requestExpired' }
  | { kind: 'failed' };

/** Ergebnis einer Aktion für die aufrufende Seite: `done` schließt das Blatt, `checkMismatch` lässt es offen. */
export type HelperActionOutcome = 'done' | 'checkMismatch' | 'failed';

export interface UseHelperAdminActionsReturn {
  code: HelperCodeInfo | null;
  codeState: HelperCodeState;
  busy: boolean;
  isOnline: boolean;
  notice: HelperActionNotice | null;
  clearNotice: () => void;
  approve: (requestId: string, checkNumber: number, field: number | null) => Promise<HelperActionOutcome>;
  decline: (requestId: string) => Promise<HelperActionOutcome>;
  changeAccess: (memberId: string, action: 'revoke' | 'watch_only') => Promise<HelperActionOutcome>;
  renewCode: (openRequests: 'keep' | 'decline') => Promise<HelperActionOutcome>;
}

export function useHelperAdminActions(tournamentId: string, enabled: boolean, onChanged: () => Promise<void>): UseHelperAdminActionsReturn {
  const { isOnline } = useOnlineStatus();
  const [code, setCode] = useState<HelperCodeInfo | null>(null);
  const [codeState, setCodeState] = useState<HelperCodeState>('loading');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<HelperActionNotice | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const failFromError = useCallback((error: HelperRpcError, action: string): HelperActionOutcome => {
    const view = helperAccessView({ source: 'error', error });
    if (view.view === 'offline') {
      setNotice({ kind: 'offline' });
    } else {
      if (view.view === 'unexpected' || view.view === 'retryScan') {
        captureFeatureError(new Error(`helper admin ${action}: ${error.kind}`), 'helpers', action, { error });
      }
      setNotice({ kind: 'failed' });
    }
    return 'failed';
  }, []);

  const applyCodeResult = useCallback((result: HelperRpcResult<HelperCodeResult>) => {
    if (!result.ok) {
      setCodeState(result.error.kind === 'notAuthorized' ? 'noRight' : 'error');
      if (result.error.kind !== 'notAuthorized' && result.error.kind !== 'network') {
        captureFeatureError(new Error(`ensure_helper_code: ${result.error.kind}`), 'helpers', 'code');
      }
      return false;
    }
    if (result.data.result === 'CLOSED') {
      setCode(null);
      setCodeState('closed');
      return true;
    }
    setCode({ code: result.data.code, validUntil: result.data.validUntil, openRequests: result.data.openRequests });
    setCodeState('ready');
    return true;
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void callEnsureHelperCode(supabase, tournamentId).then((result) => {
      if (alive.current) {
        applyCodeResult(result);
      }
    });
  }, [tournamentId, enabled, applyCodeResult, isOnline]);

  /** Ein Aufruf mit Netzprüfung (@HE-047): ohne Netz kein Aufruf, nichts vorgemerkt. */
  const run = useCallback(async <T,>(call: () => Promise<HelperRpcResult<T>>, action: string, done: (data: T) => HelperActionOutcome | Promise<HelperActionOutcome>): Promise<HelperActionOutcome> => {
    if (!isOnline) {
      setNotice({ kind: 'offline' });
      return 'failed';
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await call();
      if (!result.ok) {
        return failFromError(result.error, action);
      }
      return await done(result.data);
    } finally {
      if (alive.current) {
        setBusy(false);
      }
    }
  }, [isOnline, failFromError]);

  const approve = useCallback((requestId: string, checkNumber: number, field: number | null) =>
    run(() => callDecideJoinRequest(supabase, requestId, { accept: true, checkNumber, field }), 'approve', async (data): Promise<HelperActionOutcome> => {
      const view = helperAccessView({ source: 'decide', result: data });
      switch (view.view) {
        case 'decided':
          await onChanged();
          return 'done';
        case 'checkMismatch':
          return 'checkMismatch';
        case 'alreadyDecided':
          setNotice({ kind: 'alreadyDecided', decidedBy: view.decidedBy });
          await onChanged();
          return 'failed';
        case 'requestExpired':
          setNotice({ kind: 'requestExpired' });
          await onChanged();
          return 'failed';
        default:
          setNotice({ kind: 'failed' });
          return 'failed';
      }
    }), [run, onChanged]);

  const decline = useCallback((requestId: string) =>
    run(() => callDecideJoinRequest(supabase, requestId, { accept: false }), 'decline', async (data): Promise<HelperActionOutcome> => {
      const view = helperAccessView({ source: 'decide', result: data });
      if (view.view === 'decided') {
        await onChanged();
        return 'done';
      }
      if (view.view === 'alreadyDecided') {
        setNotice({ kind: 'alreadyDecided', decidedBy: view.decidedBy });
      } else if (view.view === 'requestExpired') {
        setNotice({ kind: 'requestExpired' });
      } else {
        setNotice({ kind: 'failed' });
      }
      await onChanged();
      return 'failed';
    }), [run, onChanged]);

  const changeAccess = useCallback((memberId: string, action: 'revoke' | 'watch_only') =>
    run(() => callChangeHelperAccess(supabase, memberId, action), action, async (): Promise<HelperActionOutcome> => {
      await onChanged();
      return 'done';
    }), [run, onChanged]);

  const renewCode = useCallback((openRequests: 'keep' | 'decline') =>
    run(() => callRotateHelperCode(supabase, tournamentId, openRequests), 'renew', async (data): Promise<HelperActionOutcome> => {
      applyCodeResult({ ok: true, data });
      await onChanged();
      return 'done';
    }), [run, tournamentId, applyCodeResult, onChanged]);

  const clearNotice = useCallback(() => setNotice(null), []);

  return { code, codeState, busy, isOnline, notice, clearNotice, approve, decline, changeAccess, renewCode };
}
