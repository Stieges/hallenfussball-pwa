/**
 * React-Anbindung des Beitritts per Helfer-QR-Code (A-17b). Dünner Regler: der Zustandsautomat (`joinFlow.ts`) und die Schritte
 * mit Wirkung (`joinFlowSteps.ts`) kommen aus A-17a; hier werden nur Sitzung, Abmelden, Zähler und Zugangs-Index
 * hereingereicht und die Schritte beim Betreten der jeweiligen Stufe ausgelöst.
 *
 * - `loading` → Code prüfen (Sitzung nur lesen, nie anlegen; S-5).
 * - `signingOut` → „Weiter“ der Rückfrage (Netz, wartende Einträge, dann nur dieses Gerät abmelden; @HE-089, @HE-092, @HE-093).
 * - `submitting` → Gerätesitzung, dann Anfrage (S-5).
 * Das Unmounten verwirft eine laufende Antwort (`cancelled`), damit nach dem Verlassen nichts mehr gesetzt wird.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ensureDeviceSession, readSessionInfo } from '../../core/auth/deviceSession';
import { deviceLabel } from '../../core/device/deviceLabel';
import { useRepositories } from '../../core/contexts/RepositoryContext';
import { LocalMatchStore } from '../../core/match/client/LocalMatchStore';
import { supabase } from '../../lib/supabase';
import { captureFeatureError } from '../../lib/sentry';
import { useAuth } from '../auth/hooks/useAuth';
import { countWaitingBeforeSignOut } from '../collaboration/outbox/countWaitingEntries';
import {
  initialJoinFlowState,
  joinFlowReducer,
  type JoinFlowEvent,
  type JoinFlowState,
  type JoinTournament,
} from './joinFlow';
import { confirmSignOut, createJoinFlowDeps, loadJoinInfo, submitJoinRequest, type JoinFlowDeps } from './joinFlowSteps';
import { syncHelperAccessEntry } from './helperAccessStore';

/** Nur Anzeige: Turnier (Turnierkarte) und der abgeschickte Name („Anfrage von …“). */
export interface JoinFlowMeta {
  tournament: JoinTournament | null;
  name: string;
}

export interface UseJoinFlowResult {
  state: JoinFlowState;
  meta: JoinFlowMeta;
  /** Anzeigename eines echt angemeldeten Kontos (kein Gast, keine Gerätesitzung), sonst `null`. */
  accountName: string | null;
  setName(name: string): void;
  submit(): void;
  confirmSignOut(): void;
  cancel(): void;
  /** „Erneut versuchen“ in `accountWaiting` und `offline` (Review #331 N-7). */
  recheck(): void;
}

const UNEXPECTED: JoinFlowEvent = { type: 'infoFailed', error: { kind: 'unexpected', message: 'Beitritt: Schritt hat geworfen' } };

export function useJoinFlow(code: string, injectedDeps?: JoinFlowDeps): UseJoinFlowResult {
  const { user, isGuest, isAnonymous, logout } = useAuth();
  const { tournamentRepository } = useRepositories();
  const [state, dispatch] = useReducer(joinFlowReducer, code, initialJoinFlowState);
  const [meta, setMeta] = useState<JoinFlowMeta>({ tournament: null, name: '' });

  const logoutRef = useRef(logout);
  const repositoryRef = useRef<unknown>(tournamentRepository);
  useEffect(() => {
    logoutRef.current = logout;
    repositoryRef.current = tournamentRepository;
  }, [logout, tournamentRepository]);

  const deps = useMemo<JoinFlowDeps>(
    () =>
      injectedDeps ??
      createJoinFlowDeps(supabase, {
        readSession: () => readSessionInfo(supabase?.auth ?? null),
        countWaiting: (accountId) => countWaitingBeforeSignOut(() => new LocalMatchStore(), accountId, repositoryRef.current),
        signOutLocal: () => logoutRef.current({ scope: 'local' }),
        ensureDeviceSession: () => ensureDeviceSession(supabase?.auth ?? null),
        deviceLabel: () => deviceLabel(navigator.userAgent, navigator.maxTouchPoints),
        syncEntry: (deviceUserId, tournamentId, info, joinCode) => {
          syncHelperAccessEntry(deviceUserId, tournamentId, info, joinCode);
        },
        reportError: (error) => captureFeatureError(error, 'helpers', 'join'),
      }),
    [injectedDeps],
  );

  // Eine Stufe mit Wirkung ausführen und das Ergebnis als Ereignis zurückgeben; ein geworfener Fehler wird Sentry-pflichtig.
  const runStep = useCallback(
    (step: () => Promise<JoinFlowEvent>, onEvent?: (event: JoinFlowEvent) => void) => {
      let cancelled = false;
      void step()
        .catch((error: unknown): JoinFlowEvent => {
          deps.reportError(error instanceof Error ? error : new Error(String(error)));
          return UNEXPECTED;
        })
        .then((event) => {
          if (cancelled) {
            return;
          }
          onEvent?.(event);
          dispatch(event);
        });
      return () => {
        cancelled = true;
      };
    },
    [deps],
  );

  const step = state.step;
  const stateCode = state.code;
  useEffect(() => {
    if (step !== 'loading') {
      return undefined;
    }
    return runStep(
      () => loadJoinInfo(stateCode, deps),
      (event) => {
        if (event.type === 'infoLoaded' && event.info.tournament) {
          const { tournament } = event.info;
          setMeta((previous) => ({ ...previous, tournament }));
        }
      },
    );
  }, [step, stateCode, deps, runStep]);

  useEffect(() => {
    if (step !== 'signingOut') {
      return undefined;
    }
    return runStep(
      () => confirmSignOut(stateCode, deps),
      (event) => {
        if (event.type === 'infoLoaded' && event.info.tournament) {
          const { tournament } = event.info;
          setMeta((previous) => ({ ...previous, tournament }));
        }
      },
    );
  }, [step, stateCode, deps, runStep]);

  const submitting = state.step === 'submitting' ? state : null;
  useEffect(() => {
    if (!submitting) {
      return undefined;
    }
    return runStep(
      () => submitJoinRequest(submitting, deps),
      (event) => {
        if (event.type === 'requestDone') {
          const tournament = event.result.tournament ?? submitting.tournament;
          setMeta({ tournament, name: submitting.name.trim() });
        }
      },
    );
  }, [submitting, deps, runStep]);

  const accountName = user !== null && !isGuest && !isAnonymous && user.isAnonymous !== true ? user.name : null;

  return {
    state,
    meta,
    accountName,
    setName: useCallback((name: string) => dispatch({ type: 'nameChanged', name }), []),
    submit: useCallback(() => dispatch({ type: 'submit' }), []),
    confirmSignOut: useCallback(() => dispatch({ type: 'confirmSignOut' }), []),
    cancel: useCallback(() => dispatch({ type: 'cancel' }), []),
    recheck: useCallback(() => dispatch({ type: 'recheck' }), []),
  };
}
