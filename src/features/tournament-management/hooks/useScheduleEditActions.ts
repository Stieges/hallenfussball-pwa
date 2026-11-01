/**
 * useScheduleEditActions – Änderungen am Spielplan: Tauschen, Schiedsrichter, Feld, neu verteilen, zurücksetzen.
 *
 * Im Bearbeiten-Modus landet alles im Entwurf (`useScheduleDraft`, @ZP-101). Außerhalb davon gibt es nur noch den
 * Block „Manuelle Schiedsrichter-Zuweisung“: Auswahl und „Zuteilung zurücksetzen“ speichern dort sofort (@W3-011, @W3-034).
 * Angepfiffene Spiele (läuft, Halbzeit, beendet) ändern weder Platz noch Feld noch Schiedsrichter (@ZP-093).
 */
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tournament } from '../../../types/tournament';
import { useConfirmDialog, type ConfirmDialogProps } from '../../../components/ui/ConfirmDialog';
import { isStartedMatch } from '../../schedule-editor/utils/startedGuard';
import { redistributeFields } from '../../schedule-editor/utils/autoReassign';
import { applyDraftSteps, diffStep, fieldStep, refereeStep, swapStep, type DraftStep } from '../schedule-draft/draftSteps';
import { matchNumberLookup } from '../schedule-draft/draftTexts';
import { redistributeOpenReferees } from '../schedule-draft/refereeRedistribution';
import type { ScheduleDraftControls } from './useScheduleDraft';

interface UseScheduleEditActionsOptions {
  /** gespeichertes Turnier */
  tournament: Tournament;
  draft: ScheduleDraftControls;
  onTournamentUpdate: (tournament: Tournament) => void;
  showSuccess: (message: string) => void;
  showWarning: (message: string) => void;
}

export interface ScheduleEditActions {
  /** `false` = abgelehnt (angepfiffenes Spiel beteiligt, @ZP-093) */
  handleMatchSwap: (matchId1: string, matchId2: string) => boolean;
  handleRedistributeSR: () => void;
  handleRedistributeFields: () => void;
  handleRefereeAssignment: (matchId: string, refereeNumber: number | null) => void;
  handleResetRefereeAssignments: () => void;
  handleFieldChange: (matchId: string, fieldNumber: number) => void;
  /** Raster: das geänderte Turnier wird zum Schritt im Entwurf */
  handleGridChange: (next: Tournament) => void;
  /** Spiele, die angepfiffen sind (gesperrt für Schiedsrichter, Feld, Platz) */
  lockedMatchIds: ReadonlySet<string>;
  /** Rückfrage „n Spiele wurden von Hand zugeteilt – trotzdem neu verteilen?“ (@W3-035) */
  overwriteDialogProps: ConfirmDialogProps;
}

export function useScheduleEditActions({ tournament, draft, onTournamentUpdate, showSuccess, showWarning }: UseScheduleEditActionsOptions): ScheduleEditActions {
  const { t } = useTranslation('tournament');
  const { isEditing, draftTournament, addStep } = draft;
  const working = isEditing ? draftTournament : tournament;
  const overwrite = useConfirmDialog({ title: t('draft.overwriteTitle'), message: '', variant: 'warning', confirmText: t('draft.overwriteConfirm'), cancelText: t('draft.overwriteCancel') });
  const askOverwrite = overwrite.confirm;

  const lockedMatchIds = useMemo(() => new Set(working.matches.filter(isStartedMatch).map((m) => m.id)), [working.matches]);

  /** Außerhalb des Bearbeiten-Modus: sofort speichern (nur Block „Manuelle Schiedsrichter-Zuweisung“). */
  const applyNow = useCallback((step: DraftStep) => {
    const result = applyDraftSteps(tournament, [step]);
    if (result.appliedSteps > 0) { onTournamentUpdate({ ...result.tournament, updatedAt: new Date().toISOString() }); }
    return result.appliedSteps > 0;
  }, [tournament, onTournamentUpdate]);

  const handleMatchSwap = useCallback((matchId1: string, matchId2: string): boolean => {
    if (!isEditing) { return false; }
    if (lockedMatchIds.has(matchId1) || lockedMatchIds.has(matchId2)) {
      showWarning(t('schedule.startedLocked'));
      return false;
    }
    if (!addStep(swapStep(working, matchId1, matchId2))) { return false; }
    const numberOf = matchNumberLookup(working.matches);
    showSuccess(t('actions.matchesSwapped', { match1: numberOf(matchId1), match2: numberOf(matchId2) }));
    return true;
  }, [isEditing, lockedMatchIds, working, addStep, showSuccess, showWarning, t]);

  const handleRedistributeSR = useCallback(() => {
    if (!isEditing) { return; }
    const { step, overwrittenManualIds } = redistributeOpenReferees(working);
    if (!step) { showSuccess(t('actions.refereesAlreadyOptimal')); return; }
    const add = () => { addStep(step); showSuccess(t('actions.refereesRedistributed', { count: step.patches.length })); };
    if (overwrittenManualIds.length === 0) { add(); return; }
    // @W3-035: Handarbeit geht nicht still verloren
    void askOverwrite({ message: t('draft.overwriteManual', { count: overwrittenManualIds.length }) }).then((ok) => { if (ok) { add(); } });
  }, [isEditing, working, addStep, askOverwrite, showSuccess, t]);

  const handleRedistributeFields = useCallback(() => {
    if (!isEditing) { return; }
    const { changes } = redistributeFields(working.matches, working.numberOfFields);
    if (changes.length === 0) { showSuccess(t('actions.fieldsAlreadyOptimal')); return; }
    addStep({ kind: 'redistributeFields', atomic: false, patches: changes.map((c) => ({ matchId: c.matchId, field: c.newValue as number })) });
    showSuccess(t('actions.fieldsRedistributed', { count: changes.length }));
  }, [isEditing, working, addStep, showSuccess, t]);

  const handleRefereeAssignment = useCallback((matchId: string, refereeNumber: number | null) => {
    if (lockedMatchIds.has(matchId)) { showWarning(t('schedule.refereeLocked')); return; }
    const step = refereeStep(working, matchId, refereeNumber);
    if (!step) { return; }
    if (isEditing) { addStep(step); } else { applyNow(step); }
  }, [lockedMatchIds, working, isEditing, addStep, applyNow, showWarning, t]);

  // @W3-034: nach der Rückfrage (im Block) die Schiedsrichter der offenen Spiele nach den Regeln neu verteilen
  const handleResetRefereeAssignments = useCallback(() => {
    const { step } = redistributeOpenReferees(working, 'resetReferees');
    if (!step) { showSuccess(t('actions.refereesAlreadyOptimal')); return; }
    if (isEditing) { addStep(step); } else { applyNow(step); }
    showSuccess(t('actions.refereesReset'));
  }, [working, isEditing, addStep, applyNow, showSuccess, t]);

  const handleFieldChange = useCallback((matchId: string, fieldNumber: number) => {
    if (lockedMatchIds.has(matchId)) { showWarning(t('schedule.startedLocked')); return; }
    if (isEditing) { addStep(fieldStep(working, matchId, fieldNumber)); }
  }, [lockedMatchIds, isEditing, working, addStep, showWarning, t]);

  const handleGridChange = useCallback((next: Tournament) => {
    if (isEditing) { addStep(diffStep(working.matches, next.matches)); }
  }, [isEditing, working.matches, addStep]);

  return {
    handleMatchSwap,
    handleRedistributeSR,
    handleRedistributeFields,
    handleRefereeAssignment,
    handleResetRefereeAssignments,
    handleFieldChange,
    handleGridChange,
    lockedMatchIds,
    overwriteDialogProps: overwrite.dialogProps,
  };
}
