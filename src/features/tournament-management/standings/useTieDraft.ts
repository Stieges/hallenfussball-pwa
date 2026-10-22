/**
 * Zustand und Speichern des Entscheidungs-Dialogs (Paket TB-B, TB-6c). Der Dialog führt in drei Schritten – Wahl,
 * Strafstoßschießen, Reihenfolge – und meldet „schon entschieden“. Geprüft wird zuerst am Eintrag selbst (`checkDraftFields`:
 * Sieger, Reihenfolge, Grund; dann ruft nichts den Dienst auf, @W2A-061), dann beim Speichern gegen die frische Tabelle
 * (`StandingDecisionService.decide`, @W2A-060). Modus „mit Abschluss“ (GA4 A-13c) prüft nur (`validateDraft`) und gibt den
 * Entwurf zurück, statt zu speichern (@TM-146).
 */
import { useCallback, useMemo, useState } from 'react';
import type { Tournament } from '../../../types/tournament';
import type { OpenTieBlock } from '../../../core/standings/tieViews';
import { checkDraftFields, DECISION_REASON_MAX_LENGTH, type DecisionDraft, type DecisionErrorCode } from '../../../core/standings/decisions';
import { validateDraft } from '../../../core/standings/validateDraft';
import { useStandingTie } from './standingTieContext';

export type TieStep = 'choice' | 'shootout' | 'order' | 'seen';
export type TieError = DecisionErrorCode | 'UNKNOWN';
export type TieDialogMode = 'table' | 'withClose';

export interface UseTieDraftOptions {
  tournament: Tournament;
  block: OpenTieBlock;
  mode: TieDialogMode;
  onDraft?: (draft: DecisionDraft) => void;
  onClose: () => void;
}

const parseCount = (value: string): number | null => (value.trim() === '' ? null : Number(value));

export function useTieDraft({ tournament, block, mode, onDraft, onClose }: UseTieDraftOptions) {
  const tie = useStandingTie();
  const [step, setStep] = useState<TieStep>(block.mayShare ? 'choice' : block.size === 2 ? 'shootout' : 'order');
  const [scores, setScores] = useState<[string, string]>(['', '']);
  const [order, setOrder] = useState<string[]>(block.teamIds);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<TieError | null>(null);
  const [triedSave, setTriedSave] = useState(false);
  const [busy, setBusy] = useState(false);
  const online = tie?.online ?? true;
  const needsNet = mode === 'table' && !online;

  const shootoutDraft = useMemo<DecisionDraft | null>(() => {
    const [a, b] = [parseCount(scores[0]), parseCount(scores[1])];
    if (a === null || b === null || block.teamIds.length !== 2) {
      return null;
    }
    const [teamA, teamB] = block.teamIds;
    const aWins = a > b;
    return {
      groupId: block.groupId,
      teamIds: [teamA, teamB],
      order: aWins ? [teamA, teamB] : [teamB, teamA],
      kind: 'shootout',
      shootout: { winner: Math.max(a, b), loser: Math.min(a, b) },
    };
  }, [scores, block]);

  const draftOf = useCallback((kind: 'shared' | 'shootout' | 'order'): DecisionDraft | null => {
    if (kind === 'shared') {
      return { groupId: block.groupId, teamIds: block.teamIds, order: block.teamIds, kind: 'shared' };
    }
    if (kind === 'shootout') {
      return shootoutDraft;
    }
    return { groupId: block.groupId, teamIds: block.teamIds, order, kind: 'order', reason };
  }, [block, order, reason, shootoutDraft]);

  /** Fehler am Feld des Strafstoßschießens, erst nach einem Speichern-Versuch (Mockup Zustand 9). */
  const shootoutFieldError = triedSave && shootoutDraft !== null && checkDraftFields(shootoutDraft) === 'SHOOTOUT_NEEDS_WINNER'
    ? { a: scores[0], b: scores[1] }
    : null;

  const canSave = step === 'shootout'
    ? shootoutDraft !== null
    : step === 'order' && reason.trim().length > 0 && reason.length <= DECISION_REASON_MAX_LENGTH;

  const submit = useCallback(async (kind: 'shared' | 'shootout' | 'order'): Promise<void> => {
    setTriedSave(true);
    setError(null);
    const draft = draftOf(kind);
    if (draft === null) {
      return;
    }
    const fieldError = checkDraftFields(draft);
    if (fieldError !== null) {
      setError(kind === 'shootout' ? null : fieldError); // Sieger fehlt: Meldung steht am Feld
      return;
    }
    if (mode === 'withClose') {
      const check = validateDraft(draft, tournament);
      if (!check.ok) {
        setError(check.code);
        return;
      }
      onDraft?.(draft);
      onClose();
      return;
    }
    if (tie === null || !online) {
      setError('OFFLINE');
      return;
    }
    setBusy(true);
    try {
      const result = await tie.service.decide(tournament.id, draft);
      if (result.ok) {
        tie.onChanged();
        onClose();
      } else if (result.code === 'ALREADY_DECIDED') {
        tie.onChanged();
        setStep('seen');
      } else {
        setError(result.code);
      }
    } catch {
      setError('UNKNOWN');
    } finally {
      setBusy(false);
    }
  }, [draftOf, mode, tournament, onDraft, onClose, tie, online]);

  const setScore = useCallback((index: 0 | 1, value: string) => {
    setTriedSave(false);
    setScores((current) => (index === 0 ? [value, current[1]] : [current[0], value]));
  }, []);

  const move = useCallback((index: number, direction: -1 | 1) => {
    setOrder((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  return { step, setStep, scores, setScore, order, move, reason, setReason, error, busy, canSave, needsNet, shootoutDraft, shootoutFieldError, submit };
}
