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
import { MatchUpdate } from '../../../core/models/types';
import { diffMatchResultStatusUpdates } from '../../../core/services';
import { autoReassignReferees, redistributeFields } from '../../schedule-editor';
import { isMatchFinished, isMatchRunning } from '../utils';
import { autoResolvePlayoffsIfReady, resolveBracketAfterPlayoffMatch } from '../../../core/generators';

interface UseScheduleTabActionsProps {
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
  /**
   * A2 (.superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-brief.md): applies the given
   * tournament to LOCAL state only, WITHOUT persisting it. handleScoreChange uses this for the
   * optimistic UI update, so entering a result never triggers a full `save()` (which would
   * overwrite a helper's live match with the owner's possibly-stale local state -- see A1's
   * `applyRemote` for the same reasoning on the cockpit side).
   */
  onLocalTournamentUpdate: (tournament: Tournament) => void;
  /**
   * A2: persists ONLY the given matches via a targeted update (`tournamentRepo.updateMatch(es)`),
   * never a full tournament save. Used by handleScoreChange for the result itself and for any
   * playoff/bracket matches that got auto-resolved as a consequence.
   */
  onMatchesUpdate: (updates: MatchUpdate[]) => void;
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
  handleScoreChange: (matchId: string, scoreA: number, scoreB: number) => void;
  handleRefereeAssignment: (matchId: string, refereeNumber: number | null) => void;
  handleResetRefereeAssignments: () => void;
  handleFieldChange: (matchId: string, fieldNumber: number) => void;
}

export function useScheduleTabActions({
  tournament,
  onTournamentUpdate,
  onLocalTournamentUpdate,
  onMatchesUpdate,
  isEditing,
  saveToHistory,
  showSuccess,
  showWarning,
  setPendingReferee,
  setPendingField,
  lockFinishedResults,
}: UseScheduleTabActionsProps): UseScheduleTabActionsResult {
  const { t } = useTranslation('tournament');

  // Handle redistribution of SR (keeps times fixed)
  const handleRedistributeSR = useCallback(() => {
    if (!isEditing) { return; }

    saveToHistory();

    const result = autoReassignReferees(
      tournament.matches,
      tournament.refereeConfig,
      { target: 'all', optimizeForFairness: true }
    );

    if (result.changes.length === 0) {
      showSuccess(t('actions.refereesAlreadyOptimal'));
      return;
    }

    const updatedMatches = tournament.matches.map(m => {
      const change = result.changes.find(c => c.matchId === m.id);
      if (change) {
        return { ...m, referee: change.newValue as number };
      }
      return m;
    });

    onTournamentUpdate({
      ...tournament,
      matches: updatedMatches,
      updatedAt: new Date().toISOString(),
    }, false);

    showSuccess(result.message);
  }, [isEditing, tournament, onTournamentUpdate, saveToHistory, showSuccess, t]);

  // Handle redistribution of fields (keeps times fixed)
  const handleRedistributeFields = useCallback(() => {
    if (!isEditing) { return; }

    saveToHistory();

    const result = redistributeFields(
      tournament.matches,
      tournament.numberOfFields
    );

    if (result.changes.length === 0) {
      showSuccess(t('actions.fieldsAlreadyOptimal'));
      return;
    }

    const updatedMatches = tournament.matches.map(m => {
      const change = result.changes.find(c => c.matchId === m.id);
      if (change) {
        return { ...m, field: change.newValue as number };
      }
      return m;
    });

    onTournamentUpdate({
      ...tournament,
      matches: updatedMatches,
      updatedAt: new Date().toISOString(),
    }, false);

    showSuccess(result.message);
  }, [isEditing, tournament, onTournamentUpdate, saveToHistory, showSuccess, t]);

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

  // Handle score change with live match warning
  const handleScoreChange = useCallback((matchId: string, scoreA: number, scoreB: number) => {
    // Block editing finished matches (if lock is enabled)
    if (lockFinishedResults && isMatchFinished(matchId, tournament.matches, tournament.id)) {
      showWarning(t('actions.matchAlreadyFinished'));
      return;
    }

    // Check if match is currently live
    if (isMatchRunning(matchId, tournament.id)) {
      const confirmEdit = window.confirm(t('actions.liveMatchWarning'));

      if (!confirmEdit) { return; }
    }

    // Save to history BEFORE making changes (for Undo)
    saveToHistory();

    // Update tournament matches
    const updatedMatches = tournament.matches.map((match) =>
      match.id === matchId ? { ...match, scoreA, scoreB } : match
    );

    const updatedTournament = {
      ...tournament,
      matches: updatedMatches,
      updatedAt: new Date().toISOString(),
    };

    // A2 Fixrunde 1 (Ruling AJ, "nur einen Weg"): track ONLY the matches touched by this result
    // entry (the match itself, plus whatever playoff/bracket resolution changes as a
    // consequence), so we can persist them via a targeted `updateMatch(es)` instead of a full
    // tournament save. The scored match itself goes through the SAME shared helper every other
    // result/status-changing action now uses (`diffMatchResultStatusUpdates`).
    const pendingUpdates = new Map<string, MatchUpdate>();
    const [scoreUpdate] = diffMatchResultStatusUpdates(
      tournament.matches,
      updatedTournament.matches
    );
    if (scoreUpdate) {
      pendingUpdates.set(matchId, scoreUpdate);
    }

    // Auto-resolve playoff pairings after group match completion. This can also clear a
    // (regenerated) playoff match's score if its teams changed -- a RESULT field -- alongside the
    // teamA/teamB SCHEDULE fields, so the result diff of THAT match is folded into the same
    // targeted update object (mapMatchUpdateToSupabase writes both kinds of columns in one call).
    const playoffResolution = autoResolvePlayoffsIfReady(updatedTournament);
    if (playoffResolution?.wasResolved) {
      for (const id of playoffResolution.updatedMatchIds) {
        const before = tournament.matches.find((m) => m.id === id);
        const resolved = updatedTournament.matches.find((m) => m.id === id);
        if (before && resolved) {
          const [resultUpdate] = diffMatchResultStatusUpdates([before], [resolved]);
          pendingUpdates.set(id, {
            ...(resultUpdate ?? { id }),
            teamA: resolved.teamA,
            teamB: resolved.teamB,
          });
        }
      }
    }

    // Also resolve bracket placeholders after playoff matches
    const bracketResolution = resolveBracketAfterPlayoffMatch(updatedTournament);
    if (bracketResolution?.wasResolved) {
      for (const id of bracketResolution.updatedMatchIds) {
        const resolved = updatedTournament.matches.find((m) => m.id === id);
        if (resolved) {
          pendingUpdates.set(id, {
            ...pendingUpdates.get(id),
            id,
            teamA: resolved.teamA,
            teamB: resolved.teamB,
          });
        }
      }
    }

    // Sync local UI state once, without saving the whole tournament ...
    onLocalTournamentUpdate(updatedTournament);
    // ... then persist only the touched matches.
    onMatchesUpdate(Array.from(pendingUpdates.values()));
  }, [
    tournament,
    onLocalTournamentUpdate,
    onMatchesUpdate,
    lockFinishedResults,
    showWarning,
    saveToHistory,
    t,
  ]);

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
  };
}
