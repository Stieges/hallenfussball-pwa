/**
 * Ablauf „Gruppe abschließen“ und „Gruppe wieder öffnen“ (GA4 A-13c; Mockup A-13c). Die Regeln kommen rein aus
 * `groupCompletionPlan` (Paket A-13a); dieser Hook hält nur den Zustand der Oberfläche und ruft `completeGroup` bzw.
 * `reopenGroup` des Repositories (A-13b-C) auf:
 *   Taste → Plan → offene Spiele (Hinweis, @TM-054) | Gleichstand (Dialog „Gleichstand entscheiden“ im Modus „mit Abschluss“,
 *   @TM-043, @TM-048, @TM-049) | bereit (Dialog mit Tabelle und Wirkung, @TM-044) → `completeGroup`.
 * Ohne Eingabe wird nichts aufgerufen (@TM-049). Ohne Netz gilt der Abschluss samt Entscheidung sofort auf dem Gerät und wird
 * nachgereicht (A-15c, @W2A-062, @TM-146, @TM-147; das Repository reiht ein). Nur mit dem Recht `manageLifecycle` (Turnierleitung,
 * Co-Admin); der Helfer sieht nur Zustände.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useRepositories } from '../../../core/contexts/RepositoryContext';
import { NetworkError, RetryLaterError } from '../../../core/errors';
import type { CompleteGroupResult, ReopenGroupResult } from '../../../core/repositories/groupCompletionCloud';
import { activeCompletion } from '../../../core/standings/groupCompletions';
import type { DecisionDraft } from '../../../core/standings/decisions';
import { groupIds, groupState, proposeGroupCompletion } from '../../../core/services/GroupCompletionService';
import { draftToDecision, planCompletion, type CompletionPlan, type NewDecision } from '../../../core/services/groupCompletionPlan';
import type { OpenTieBlock } from '../../../core/standings/tieViews';
import type { Tournament } from '../../../types/tournament';
import { useStandingTie } from '../standings/standingTieContext';
import { lastLogId } from './completionLog';
import { reassignAfterCorrection, recompletionKey } from '../../../core/services/followUps';
import { recompletionFailed, useRecompletionFailuresVersion } from '../../../hooks/recompletionFailures';

export type ReadyPlan = Extract<CompletionPlan, { code: 'READY' }>;

/** Fehler, der im Dialog steht (nichts gespeichert, neuer Versuch erlaubt). */
export type CompletionError = 'OFFLINE' | 'RETRY_LATER' | 'UNKNOWN' | 'FORBIDDEN';
export type NoticeKind = 'openMatches' | 'already' | 'tableChanged' | 'differently' | 'decidedElsewhere';
export type ReopenError = CompletionError | 'NOT_COMPLETED' | 'REASON_REQUIRED';

export type CompletionFlow =
  | { step: 'idle' }
  | { step: 'tie'; groupId: string; blocks: OpenTieBlock[]; decisions: NewDecision[] }
  | { step: 'confirm'; groupId: string; plan: ReadyPlan; busy: boolean; error: CompletionError | null }
  /** `knownLogId`: höchste Verlaufs-Kennung beim Start des Ablaufs – genannt wird nur, wer danach eingetragen hat (@W2A-060). */
  | { step: 'notice'; groupId: string; kind: NoticeKind; open?: number; knownLogId?: number }
  | { step: 'reopen'; groupId: string; reason: string; busy: boolean; error: ReopenError | null };

export const MAX_REOPEN_REASON = 500;

export interface GroupCompletionApi {
  /** Turnierleitung oder Co-Admin (`manageLifecycle`): bekommt Banner, Tasten und Dialoge. */
  canManage: boolean;
  online: boolean;
  tournament: Tournament;
  flow: CompletionFlow;
  /** Fertige Gruppen ohne geltenden Abschluss, die zuerst fertige zuerst (@TM-044, @TM-058); leer ohne Recht. */
  proposals: string[];
  /** Gruppen, die nach einer Korrektur „Besetzung prüfen“ zeigen (abgeschlossen, danach geändert). */
  staleGroups: string[];
  begin: (groupId: string) => void;
  beginReopen: (groupId: string) => void;
  setReopenReason: (reason: string) => void;
  confirmReopen: () => void;
  /** Ein Gleichstands-Entwurf aus dem Dialog (Modus „mit Abschluss“). */
  acceptDraft: (draft: DecisionDraft) => void;
  /** Der Gleichstands-Dialog schließt sich: nach einem angenommenen Entwurf läuft der Ablauf weiter, sonst ist er abgebrochen. */
  dismissTie: () => void;
  confirm: () => void;
  close: () => void;
}

const IDLE: CompletionFlow = { step: 'idle' };

const errorOf = (error: unknown): CompletionError => {
  if (error instanceof NetworkError && error.isOffline) {
    return 'OFFLINE';
  }
  return error instanceof RetryLaterError ? 'RETRY_LATER' : 'UNKNOWN';
};

const TABLE_CHANGED = ['STALE_VERSION', 'RANKING_MISMATCH', 'TIE_DECISION_REQUIRED', 'SHARED_NOT_ALLOWED', 'INVALID_TIE_DECISIONS'];

export function useGroupCompletion(tournament: Tournament): GroupCompletionApi {
  const tie = useStandingTie();
  const { tournamentRepository } = useRepositories();
  const [flow, setFlow] = useState<CompletionFlow>(IDLE);
  const flowRef = useRef(flow);
  flowRef.current = flow;
  const draftAccepted = useRef(false);
  const startLogId = useRef(0);
  const canManage = tie?.canDecide ?? false;
  const online = tie?.online ?? true;
  const onChanged = tie?.onChanged;

  const proposals = useMemo(() => (canManage ? proposeGroupCompletion(tournament) : []), [canManage, tournament]);
  // Review #384 M3 (@TM-150 Zeile 2 „ohne dass ‚Besetzung prüfen‘ erscheint“): eine veraltete Gruppe, die der Auslöser nach der
  // Korrektur gleich erneut abschließt (Leitung, mit Netz, Anfrage vorhanden, noch nicht gescheitert), zeigt den Hinweis nicht
  const failuresVersion = useRecompletionFailuresVersion();
  const staleGroups = useMemo(() => {
    if (!canManage) {
      return [];
    }
    const autoDone = (g: string): boolean => {
      if (!online) {
        return false;
      }
      const request = reassignAfterCorrection(tournament, g);
      return request !== null && !recompletionFailed(recompletionKey(tournament.id, request));
    };
    return groupIds(tournament).filter((g) => groupState(tournament, g) === 'stale' && !autoDone(g));
    // failuresVersion: neu rechnen, sobald ein Versuch scheitert oder gelingt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, online, tournament, failuresVersion]);

  const reload = useCallback(() => { onChanged?.(); }, [onChanged]);

  const handleResult = useCallback((groupId: string, plan: ReadyPlan, result: CompleteGroupResult, knownLogId: number): void => {
    if (result.status === 'ok') {
      reload();
      setFlow(result.alreadyCompleted ? { step: 'notice', groupId, kind: 'already', knownLogId } : IDLE);
      return;
    }
    if (result.status === 'forbidden') {
      setFlow({ step: 'confirm', groupId, plan, busy: false, error: 'FORBIDDEN' });
      return;
    }
    if (result.status === 'rejected' && result.code === 'OPEN_MATCHES') {
      reload();
      setFlow({ step: 'notice', groupId, kind: 'openMatches', ...(result.open !== undefined ? { open: result.open } : {}) });
      return;
    }
    // @W2A-060: schon anders abgeschlossen bzw. schon entschieden (Gruppe dann nicht abgeschlossen) – der Hinweis nennt, wer
    if (result.status === 'rejected' && (result.code === 'COMPLETED_DIFFERENTLY' || result.code === 'DECIDED_ELSEWHERE')) {
      reload();
      setFlow({ step: 'notice', groupId, kind: result.code === 'DECIDED_ELSEWHERE' ? 'decidedElsewhere' : 'differently', knownLogId });
      return;
    }
    if (result.status === 'rejected' && TABLE_CHANGED.includes(result.code)) {
      reload();
      setFlow({ step: 'notice', groupId, kind: 'tableChanged' });
      return;
    }
    setFlow({ step: 'confirm', groupId, plan, busy: false, error: 'UNKNOWN' });
  }, [reload]);

  const submit = useCallback(async (groupId: string, plan: ReadyPlan): Promise<void> => {
    setFlow({ step: 'confirm', groupId, plan, busy: true, error: null });
    const knownLogId = startLogId.current; // Stand des Verlaufs beim Start des Ablaufs (@W2A-060)
    try {
      if (tournamentRepository.completeGroup === undefined) {
        throw new Error('Repository kann Gruppen nicht abschließen');
      }
      handleResult(groupId, plan, await tournamentRepository.completeGroup(tournament.id, plan.request), knownLogId);
    } catch (error) {
      setFlow({ step: 'confirm', groupId, plan, busy: false, error: errorOf(error) });
    }
  }, [tournamentRepository, tournament.id, handleResult]);

  const route = useCallback((groupId: string, decisions: NewDecision[]): void => {
    const plan = planCompletion(tournament, groupId, decisions);
    switch (plan.code) {
    case 'OPEN_MATCHES': setFlow({ step: 'notice', groupId, kind: 'openMatches', open: plan.open }); return;
    case 'UNKNOWN_GROUP': setFlow({ step: 'notice', groupId, kind: 'tableChanged' }); return;
    case 'DECISION_REQUIRED': setFlow({ step: 'tie', groupId, blocks: plan.blocks, decisions }); return;
    case 'READY':
      if (decisions.length > 0) {
        void submit(groupId, plan); // die letzte Eingabe schließt die Gruppe in einem Zug ab (Mockup Zustand 15)
      } else {
        setFlow({ step: 'confirm', groupId, plan, busy: false, error: null });
      }
    }
  }, [tournament, submit]);

  const begin = useCallback((groupId: string) => {
    // @W2A-060: was das Gerät beim Start schon kannte, nennt der Hinweis nie (auch nicht, wenn der Stand währenddessen neu lädt)
    startLogId.current = lastLogId(tournament);
    route(groupId, []);
  }, [route, tournament]);

  const acceptDraft = useCallback((draft: DecisionDraft): void => {
    const current = flowRef.current;
    if (current.step !== 'tie') {
      return;
    }
    draftAccepted.current = true;
    route(current.groupId, [...current.decisions, draftToDecision(tournament, draft, crypto.randomUUID())]);
  }, [tournament, route]);

  const dismissTie = useCallback((): void => {
    if (draftAccepted.current) {
      draftAccepted.current = false; // der Dialog schließt sich nach der Eingabe, der Ablauf geht weiter
      return;
    }
    setFlow(IDLE);
  }, []);

  const confirm = useCallback((): void => {
    if (flow.step === 'confirm' && !flow.busy) {
      void submit(flow.groupId, flow.plan);
    }
  }, [flow, submit]);

  const beginReopen = useCallback((groupId: string): void => {
    if (activeCompletion(tournament, groupId) !== undefined) {
      setFlow({ step: 'reopen', groupId, reason: '', busy: false, error: null });
    }
  }, [tournament]);

  const setReopenReason = useCallback((reason: string): void => {
    setFlow((current) => (current.step === 'reopen' ? { ...current, reason, error: null } : current));
  }, []);

  const confirmReopen = useCallback((): void => {
    if (flow.step !== 'reopen' || flow.busy) {
      return;
    }
    const { groupId } = flow;
    const reason = flow.reason.trim();
    if (reason.length === 0 || reason.length > MAX_REOPEN_REASON) {
      setFlow({ ...flow, error: 'REASON_REQUIRED' });
      return;
    }
    if (!online) {
      setFlow({ ...flow, error: 'OFFLINE' });
      return;
    }
    setFlow({ ...flow, busy: true, error: null });
    void (async () => {
      try {
        if (tournamentRepository.reopenGroup === undefined) {
          throw new Error('Repository kann Gruppen nicht öffnen');
        }
        const result: ReopenGroupResult = await tournamentRepository.reopenGroup(tournament.id, groupId, reason);
        if (result.status === 'ok') {
          reload();
          setFlow(IDLE);
        } else if (result.status === 'rejected') {
          setFlow({ step: 'reopen', groupId, reason: flow.reason, busy: false, error: result.code === 'NOT_COMPLETED' || result.code === 'REASON_REQUIRED' ? result.code : 'UNKNOWN' });
          if (result.code === 'NOT_COMPLETED') {
            reload();
          }
        } else {
          setFlow({ step: 'reopen', groupId, reason: flow.reason, busy: false, error: result.status === 'forbidden' ? 'FORBIDDEN' : 'UNKNOWN' });
        }
      } catch (error) {
        setFlow({ step: 'reopen', groupId, reason: flow.reason, busy: false, error: errorOf(error) });
      }
    })();
  }, [flow, online, tournamentRepository, tournament.id, reload]);

  const close = useCallback((): void => {
    setFlow((current) => (('busy' in current && current.busy) ? current : IDLE));
  }, []);

  return { canManage, online, tournament, flow, proposals, staleGroups, begin, beginReopen, setReopenReason, confirmReopen, acceptDraft, dismissTie, confirm, close };
}
