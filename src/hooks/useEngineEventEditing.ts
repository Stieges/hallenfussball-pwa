/**
 * useEngineEventEditing (C3b-1, Plan §2 Nr. 4/5): Minus, Rueckgaengig, Loeschen und Bearbeiten im
 * Cockpit. Engine-Spiele (lokale Kopie MIT Ereignissen) laufen ueber RETRACT/AMEND
 * (`MatchCommands`), Altspiele ueber die unveraenderten Alt-Handler. Liefert EIN Ergebnisobjekt
 * (Bedienbarkeit, Beschriftung mit Ziel, Hinweise mit Grund) plus die Aktionen -- `LiveCockpit`
 * delegiert nur noch.
 *
 * - Zielwahl/Sperren: `retractTargets` (G1, G1a, G1b, G2, G2a, G3, G5), `readOnly` sticht die Sperren.
 * - G4: Erfolgs-Toast NACH aufgeloestem `submit` (lokale Vorpruefung bestanden + gespeichert), nennt das Ziel.
 * - G10: AMEND sendet nur geaenderte Felder (`playerNumber` bzw. `clear`), nie `incomplete`.
 * - W6: kein Fehler wird in die UI geworfen, Ablehnung/Speicher-voll werden als Toast gezeigt.
 */
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LocalStoreFullError,
  MatchCommands,
  canAmendField,
  checkRetract,
  describeEventTarget,
  minusTarget,
  undoTarget,
  type BlockReason,
  type RetractTarget,
  type TargetInput,
} from '../core/match/client';
import type { MatchContext } from '../core/match';
import { useMatchEngineContextOptional } from '../features/match-engine/useMatchEngineContext';
import { useActorRole } from './useActorRole';
import {
  HINT_KEYS,
  KIND_KEYS,
  legacyCanMinus,
  type EventEditingParams,
  type EventFieldChanges,
  type Side,
  type SideState,
} from './engineEventEditingSupport';

export type { EditingMatch, EventEditingParams, EventFieldChanges, LegacyEditHandlers, Side, SideState } from './engineEventEditingSupport';

export function useEngineEventEditing({ tournamentId, match, readOnly, legacy, notify }: EventEditingParams) {
  const { t } = useTranslation('cockpit');
  const context = useMatchEngineContextOptional();
  const actor = useActorRole(tournamentId);

  const commands = useMemo(
    () =>
      context
        ? new MatchCommands({ engine: context.engine, store: context.store, sender: context.sender, accountId: context.accountId })
        : null,
    [context],
  );

  /** Engine-Spiel = lokale Kopie mit Ereignissen; sonst Altspiel (Alt-Handler). */
  const engineInput = useMemo((): { input: TargetInput; ctx: MatchContext } | null => {
    if (!context || !match) {
      return null;
    }
    const matchId = match.id.toLowerCase();
    const view = context.engine.view(matchId);
    if (!view || view.log.length === 0) {
      return null;
    }
    const ctx: MatchContext = { matchId, teamAId: match.homeTeam.id, teamBId: match.awayTeam.id };
    return { ctx, input: { state: view.result.state, log: view.log, ctx, actor, at: context.engine.serverNow() } };
  }, [context, match, actor]);

  const targetText = useCallback(
    (target: RetractTarget): string => {
      const kind = t(KIND_KEYS[target.kind]);
      return target.playerNumber !== undefined
        ? t('engine.retract.targetNumbered', { kind, number: target.playerNumber })
        : t('engine.retract.target', { kind });
    },
    [t],
  );
  const hintOf = useCallback((reason: BlockReason | null) => (reason === null ? undefined : t(HINT_KEYS[reason])), [t]);

  const undoSel = useMemo(() => (engineInput ? undoTarget(engineInput.input) : null), [engineInput]);
  const minusSel = useMemo(
    () =>
      engineInput && match
        ? { home: minusTarget(engineInput.input, match.homeTeam.id), away: minusTarget(engineInput.input, match.awayTeam.id) }
        : null,
    [engineInput, match],
  );

  const sideState = (side: Side): SideState => {
    if (!match || readOnly) {
      return { canMinus: false };
    }
    if (!minusSel) {
      return { canMinus: legacyCanMinus(match, side) };
    }
    const selection = minusSel[side];
    const teamName = side === 'home' ? match.homeTeam.name : match.awayTeam.name;
    return {
      canMinus: selection.target !== null,
      label: selection.target ? t('engine.retract.minusAria', { target: targetText(selection.target), teamName }) : undefined,
      hint: hintOf(selection.blockReason),
    };
  };

  const finishedStatus = engineInput?.input.state.status === 'finished';
  const goalHint =
    !readOnly && engineInput && finishedStatus
      ? t(actor === 'leitung' ? 'engine.retract.hint.finishedLeitung' : 'engine.retract.hint.goalFinished')
      : undefined;

  /** G4/W6: Erfolgs-Toast erst nach aufgeloestem submit, Fehler als Toast. */
  const run = useCallback(
    async (job: () => Promise<void>, done: string): Promise<void> => {
      try {
        await job();
        notify.success(done);
      } catch (error) {
        notify.error(error instanceof LocalStoreFullError ? t('engine.storeFull') : t('engine.invalid'));
      }
    },
    [notify, t],
  );

  const retract = useCallback(
    (target: RetractTarget): Promise<void> => {
      if (!commands || !engineInput) {
        return Promise.resolve();
      }
      return run(
        () => commands.retract(engineInput.ctx.matchId, engineInput.ctx, actor, target.id),
        t('engine.retract.done', { target: targetText(target) }),
      );
    },
    [commands, engineInput, actor, run, t, targetText],
  );

  const minus = useCallback(
    (side: Side): Promise<void> => {
      if (!match) {
        return Promise.resolve();
      }
      const target = minusSel?.[side].target;
      if (target) {
        return retract(target);
      }
      if (!minusSel && legacyCanMinus(match, side)) {
        legacy.onGoal(match.id, side === 'home' ? match.homeTeam.id : match.awayTeam.id, -1);
      }
      return Promise.resolve();
    },
    [match, minusSel, retract, legacy],
  );

  const undo = useCallback((): Promise<void> => {
    if (undoSel) {
      return undoSel.target ? retract(undoSel.target) : Promise.resolve();
    }
    if (match) {
      legacy.onUndoLastEvent(match.id);
    }
    return Promise.resolve();
  }, [undoSel, match, retract, legacy]);

  const remove = useCallback(
    (eventId: string): Promise<void> => {
      if (!match) {
        return Promise.resolve();
      }
      if (!engineInput) {
        legacy.onDeleteEvent?.(match.id, eventId);
        return Promise.resolve();
      }
      const check = checkRetract(engineInput.input, eventId);
      const target = describeEventTarget(engineInput.input.state, eventId);
      if (!check.allowed || !target) {
        notify.error(hintOf(check.blockReason) ?? t('engine.invalid'));
        return Promise.resolve();
      }
      return retract(target);
    },
    [match, engineInput, legacy, notify, hintOf, t, retract],
  );

  const update = useCallback(
    (eventId: string, changes: EventFieldChanges): Promise<void> => {
      if (!match) {
        return Promise.resolve();
      }
      const nextNumber = changes.clearPlayerNumber ? undefined : changes.playerNumber;
      if (!engineInput || !commands) {
        if (changes.clearPlayerNumber || changes.playerNumber !== undefined) {
          legacy.onUpdateEvent?.(match.id, eventId, { playerNumber: nextNumber, incomplete: nextNumber === undefined });
        }
        return Promise.resolve();
      }
      const { state } = engineInput.input;
      const current = Object.hasOwn(state.details, eventId) ? state.details[eventId].playerNumber : undefined;
      const target = describeEventTarget(state, eventId);
      const unchanged = changes.clearPlayerNumber ? current === undefined : nextNumber === undefined || nextNumber === current;
      if (!target || unchanged) {
        return Promise.resolve();
      }
      if (!canAmendField(engineInput.input, eventId, 'playerNumber').allowed) {
        notify.error(t('engine.amend.locked'));
        return Promise.resolve();
      }
      const after: RetractTarget = { ...target, playerNumber: nextNumber };
      return run(
        () => commands.amend(engineInput.ctx.matchId, engineInput.ctx, actor, eventId,
          changes.clearPlayerNumber ? {} : { playerNumber: nextNumber }, changes.clearPlayerNumber ? ['playerNumber'] : []),
        t('engine.amend.done', { target: targetText(after) }),
      );
    },
    [match, engineInput, commands, actor, legacy, notify, run, t, targetText],
  );

  /** Sperrtext fuer "Loeschen" im Bearbeiten-Dialog (G3), `undefined` = erlaubt. */
  const deleteBlock = (eventId: string): string | undefined => {
    if (!engineInput || readOnly) {
      return undefined;
    }
    return hintOf(checkRetract(engineInput.input, eventId).blockReason);
  };

  /** G5: Sperrtext fuer das Nummernfeld (Helfer, nach Abpfiff, Nummer schon gesetzt), sonst `undefined`. */
  const amendLock = (eventId: string): string | undefined => {
    if (!engineInput || readOnly) {
      return undefined;
    }
    return canAmendField(engineInput.input, eventId, 'playerNumber').reason === 'finishedHelperLocked'
      ? t('engine.amend.locked')
      : undefined;
  };

  const legacyCanUndo = match !== null && match.events.length > 0 && match.status !== 'FINISHED';
  const canUndo = !readOnly && (undoSel ? undoSel.target !== null : legacyCanUndo);

  return {
    canUndo,
    undoLabel: !readOnly && undoSel?.target ? t('engine.retract.undoLabel', { target: targetText(undoSel.target) }) : undefined,
    undoHint: readOnly ? undefined : hintOf(undoSel?.blockReason ?? null),
    sides: { home: sideState('home'), away: sideState('away') },
    goalHint,
    minus,
    undo,
    update,
    remove,
    deleteBlock,
    amendLock,
  };
}
