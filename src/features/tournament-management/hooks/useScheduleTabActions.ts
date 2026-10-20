/**
 * useScheduleTabActions - Action handlers for ScheduleTab
 *
 * Extracts all action handlers from ScheduleTab to reduce component complexity.
 * Handles: redistribution (SR, fields), match swaps, score changes,
 * referee assignments, and field changes.
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Tournament } from '../../../types/tournament';
import { autoReassignReferees, redistributeFields } from '../../schedule-editor';
import { useScheduleResultEntry, type ScheduleResultEntry } from './useScheduleResultEntry';

interface UseScheduleTabActionsProps {
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
  isEditing: boolean;
  saveToHistory: () => void;
  showSuccess: (message: string) => void;
  showWarning: (message: string) => void;
  setPendingReferee: (matchId: string, referee: number | null) => void;
  setPendingField: (matchId: string, field: number) => void;
  lockFinishedResults: boolean;
}

interface UseScheduleTabActionsResult {
  handleRedistributeSR: () => void;
  handleRedistributeFields: () => void;
  handleMatchSwap: (matchId1: string, matchId2: string) => void;
  handleScoreChange: (matchId: string, scoreA: number, scoreB: number) => Promise<boolean>;
  handleRefereeAssignment: (matchId: string, refereeNumber: number | null) => void;
  handleResetRefereeAssignments: () => void;
  handleFieldChange: (matchId: string, fieldNumber: number) => void;
  /** A-08f3e2: Rückfrage (Grund bzw. abgesetzt) der Schnelleingabe -- ScheduleTab zeigt sie an. */
  resultEntry: Pick<ScheduleResultEntry, 'prompt' | 'answerPrompt' | 'changeAuthor'>;
}

export function useScheduleTabActions({
  tournament,
  onTournamentUpdate,
  isEditing,
  saveToHistory,
  showSuccess,
  showWarning,
  setPendingReferee,
  setPendingField,
  lockFinishedResults,
}: UseScheduleTabActionsProps): UseScheduleTabActionsResult {
  const { t } = useTranslation('tournament');

  // W11: `handleRedistributeSR`/`handleRedistributeFields` teilen sich dieselbe Form (Aenderungen
  // berechnen, Matches damit patchen, Turnier speichern) -- ein gemeinsamer Helfer statt zweier
  // fast identischer Bloecke.
  const applyRedistribution = useCallback(
    (
      compute: () => { changes: { matchId: string; newValue: unknown }[]; message: string },
      field: 'referee' | 'field',
      alreadyOptimalKey: 'actions.refereesAlreadyOptimal' | 'actions.fieldsAlreadyOptimal',
    ) => {
      if (!isEditing) { return; }
      saveToHistory();
      const result = compute();
      if (result.changes.length === 0) {
        showSuccess(t(alreadyOptimalKey));
        return;
      }
      const updatedMatches = tournament.matches.map((m) => {
        const change = result.changes.find((c) => c.matchId === m.id);
        return change ? { ...m, [field]: change.newValue as number } : m;
      });
      onTournamentUpdate({ ...tournament, matches: updatedMatches, updatedAt: new Date().toISOString() }, false);
      showSuccess(result.message);
    },
    [isEditing, tournament, onTournamentUpdate, saveToHistory, showSuccess, t],
  );

  // Handle redistribution of SR (keeps times fixed)
  const handleRedistributeSR = useCallback(
    () => applyRedistribution(
      () => autoReassignReferees(tournament.matches, tournament.refereeConfig, { target: 'all', optimizeForFairness: true }),
      'referee',
      'actions.refereesAlreadyOptimal',
    ),
    [applyRedistribution, tournament],
  );

  // Handle redistribution of fields (keeps times fixed)
  const handleRedistributeFields = useCallback(
    () => applyRedistribution(
      () => redistributeFields(tournament.matches, tournament.numberOfFields),
      'field',
      'actions.fieldsAlreadyOptimal',
    ),
    [applyRedistribution, tournament],
  );

  // Handle match swap via DnD (apply immediately for view sync)
  // Swaps scheduledTime AND field between two matches for complete slot swap
  const handleMatchSwap = useCallback((matchId1: string, matchId2: string) => {
    const match1 = tournament.matches.find(m => m.id === matchId1);
    const match2 = tournament.matches.find(m => m.id === matchId2);

    if (!match1 || !match2 || !match1.scheduledTime || !match2.scheduledTime) {
      console.warn('Could not swap matches:', matchId1, matchId2);
      return;
    }

    saveToHistory();

    // Swap both time and field for complete slot exchange
    const time1 = match1.scheduledTime;
    const time2 = match2.scheduledTime;
    const field1 = match1.field;
    const field2 = match2.field;

    const updatedMatches = tournament.matches.map(m => {
      if (m.id === matchId1) {
        return { ...m, scheduledTime: time2, field: field2 };
      }
      if (m.id === matchId2) {
        return { ...m, scheduledTime: time1, field: field1 };
      }
      return m;
    });

    onTournamentUpdate({
      ...tournament,
      matches: updatedMatches,
      updatedAt: new Date().toISOString(),
    }, false);

    showSuccess(t('actions.matchesSwapped', { match1: match1.round, match2: match2.round }));
  }, [tournament, onTournamentUpdate, showSuccess, saveToHistory, t]);

  // A-08f3e2: die Schnelleingabe schreibt nur noch Server-Einträge (useScheduleResultEntry), nie den Spielstand selbst.
  const resultEntry = useScheduleResultEntry({ tournament, showWarning, lockFinishedResults });
  const { enterScore } = resultEntry;
  const handleScoreChange = useCallback((matchId: string, scoreA: number, scoreB: number) => {
    return enterScore(matchId, scoreA, scoreB);
  }, [enterScore]);

  // Handle referee assignment (pending in edit mode, direct otherwise)
  const handleRefereeAssignment = useCallback((matchId: string, refereeNumber: number | null) => {
    if (isEditing) {
      setPendingReferee(matchId, refereeNumber);
    } else {
      // Direct update (legacy behavior)
      const updatedTournament = { ...tournament };

      if (!updatedTournament.refereeConfig) {
        console.warn('[ScheduleTab] No refereeConfig found');
        return;
      }

      const manualAssignments = { ...(updatedTournament.refereeConfig.manualAssignments ?? {}) };

      if (refereeNumber === null) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Intentional cleanup
        delete manualAssignments[matchId];
      } else {
        manualAssignments[matchId] = refereeNumber;
      }

      updatedTournament.refereeConfig = {
        ...updatedTournament.refereeConfig,
        manualAssignments,
      };

      updatedTournament.matches = updatedTournament.matches.map(match =>
        match.id === matchId ? { ...match, referee: refereeNumber ?? undefined } : match
      );

      onTournamentUpdate(updatedTournament, false);
    }
  }, [isEditing, setPendingReferee, tournament, onTournamentUpdate]);

  // Handle reset referee assignments
  const handleResetRefereeAssignments = useCallback(() => {
    const updatedTournament = { ...tournament };

    if (updatedTournament.refereeConfig) {
      updatedTournament.refereeConfig = {
        ...updatedTournament.refereeConfig,
        manualAssignments: {},
      };

      onTournamentUpdate(updatedTournament, true);
    }
  }, [tournament, onTournamentUpdate]);

  // Handle field change (pending in edit mode, direct otherwise)
  const handleFieldChange = useCallback((matchId: string, fieldNumber: number) => {
    if (isEditing) {
      setPendingField(matchId, fieldNumber);
    } else {
      // Direct update (legacy behavior)
      const updatedTournament = { ...tournament };

      updatedTournament.fieldAssignments ??= {};
      updatedTournament.fieldAssignments[matchId] = fieldNumber;

      onTournamentUpdate(updatedTournament, true);
    }
  }, [isEditing, setPendingField, tournament, onTournamentUpdate]);

  return {
    handleRedistributeSR,
    handleRedistributeFields,
    handleMatchSwap,
    handleScoreChange,
    handleRefereeAssignment,
    handleResetRefereeAssignments,
    handleFieldChange,
    resultEntry: { prompt: resultEntry.prompt, answerPrompt: resultEntry.answerPrompt, changeAuthor: resultEntry.changeAuthor },
  };
}
