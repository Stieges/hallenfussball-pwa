/**
 * usePendingChanges - Manages edit mode state and pending SR/field changes
 *
 * Handles:
 * - Edit mode toggle
 * - Pending referee assignments
 * - Pending field assignments
 * - Building tournament with pending changes
 * - Save with conflict detection
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../components/ui/Toast';
import { Tournament } from '../../../types/tournament';
import { detectAllConflicts, ScheduleConflict, ConflictDetectionConfig } from '../../schedule-editor';

// Pending changes during edit mode (SR and field changes only)
// Note: Match time swaps are applied immediately to tournament.matches for view sync
export interface PendingChanges {
  refereeAssignments: Record<string, number | null>;
  fieldAssignments: Record<string, number>;
}

interface UsePendingChangesOptions {
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
  clearHistory: () => void;
}

export interface PendingChangesControls {
  isEditing: boolean;
  pendingChanges: PendingChanges;
  hasUnsavedChanges: boolean;
  setIsEditing: (editing: boolean) => void;
  setPendingReferee: (matchId: string, refereeNumber: number | null) => void;
  setPendingField: (matchId: string, fieldNumber: number) => void;
  handleCancelEdit: () => void;
  handleSaveChanges: () => void;
  handleSaveWithConflicts: () => void;
  showConflictDialog: boolean;
  setShowConflictDialog: (show: boolean) => void;
  detectedConflicts: ScheduleConflict[];
}

const emptyPendingChanges: PendingChanges = {
  refereeAssignments: {},
  fieldAssignments: {},
};

/**
 * Hook to manage edit mode and pending changes
 *
 * @param options - Tournament data and callbacks
 * @returns Edit state and handlers
 */
export function usePendingChanges({
  tournament,
  onTournamentUpdate,
  clearHistory,
}: UsePendingChangesOptions): PendingChangesControls {
  const { t } = useTranslation('tournament');
  const { showSuccess } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>(emptyPendingChanges);

  // Conflict dialog state
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [detectedConflicts, setDetectedConflicts] = useState<ScheduleConflict[]>([]);

  // Check if there are unsaved changes
  const hasUnsavedChanges =
    Object.keys(pendingChanges.refereeAssignments).length > 0 ||
    Object.keys(pendingChanges.fieldAssignments).length > 0;

  const setPendingReferee = useCallback((matchId: string, refereeNumber: number | null) => {
    setPendingChanges(prev => ({
      ...prev,
      refereeAssignments: {
        ...prev.refereeAssignments,
        [matchId]: refereeNumber,
      },
    }));
  }, []);

  const setPendingField = useCallback((matchId: string, fieldNumber: number) => {
    setPendingChanges(prev => ({
      ...prev,
      fieldAssignments: {
        ...prev.fieldAssignments,
        [matchId]: fieldNumber,
      },
    }));
  }, []);

  // Reset pending changes and history when exiting edit mode
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setPendingChanges(emptyPendingChanges);
    clearHistory();
  }, [clearHistory]);

  // Build tournament with pending changes applied
  const buildTournamentWithPendingChanges = useCallback((): Tournament => {
    const updated = { ...tournament };

    // Apply pending SR assignments to both config and matches
    if (Object.keys(pendingChanges.refereeAssignments).length > 0) {
      updated.refereeConfig ??= { mode: 'teams', manualAssignments: {} };
      const manualAssignments = { ...updated.refereeConfig.manualAssignments };

      for (const [id, refereeNumber] of Object.entries(pendingChanges.refereeAssignments)) {
        if (refereeNumber === null) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Intentional cleanup
          delete manualAssignments[id];
        } else {
          manualAssignments[id] = refereeNumber;
        }
      }

      updated.refereeConfig = { ...updated.refereeConfig, manualAssignments };
      updated.matches = updated.matches.map(match => {
        const newRef = pendingChanges.refereeAssignments[match.id];
         
        if (newRef !== undefined) {
          return { ...match, referee: newRef ?? undefined };
        }
        return match;
      });
    }

    // Apply pending field assignments to both config and matches
    if (Object.keys(pendingChanges.fieldAssignments).length > 0) {
      updated.fieldAssignments ??= {};
      for (const [id, fieldNumber] of Object.entries(pendingChanges.fieldAssignments)) {
        updated.fieldAssignments[id] = fieldNumber;
      }

      updated.matches = updated.matches.map(match => {
        const newField = pendingChanges.fieldAssignments[match.id];
         
        if (newField !== undefined) {
          return { ...match, field: newField };
        }
        return match;
      });
    }

    return updated;
  }, [tournament, pendingChanges]);

  // Finalize save: update tournament, reset edit state, show success
  const applyChanges = useCallback((updatedTournament: Tournament) => {
    updatedTournament.updatedAt = new Date().toISOString();

    // Manual edits should NEVER regenerate schedule - would overwrite user's changes
    onTournamentUpdate(updatedTournament, false);

    setIsEditing(false);
    setPendingChanges(emptyPendingChanges);
    setShowConflictDialog(false);
    setDetectedConflicts([]);
    showSuccess(t('actions.changesSaved'));
  }, [onTournamentUpdate, showSuccess, t]);

  // Save with conflict check - shows dialog if conflicts detected
  const handleSaveChanges = useCallback(() => {
    const updatedTournament = buildTournamentWithPendingChanges();

    // Detect conflicts before saving
    const conflictConfig: ConflictDetectionConfig = {
      matchDurationMinutes: tournament.groupPhaseGameDuration,
      minBreakMinutes: tournament.groupPhaseBreakDuration ?? 0,
      checkRefereeConflicts: tournament.refereeConfig?.mode !== 'none',
      checkFieldConflicts: tournament.numberOfFields > 1,
    };

    const conflicts = detectAllConflicts(
      updatedTournament.matches,
      tournament.teams,
      conflictConfig
    );

    if (conflicts.length > 0) {
      setDetectedConflicts(conflicts);
      setShowConflictDialog(true);
      return;
    }

    applyChanges(updatedTournament);
  }, [tournament, buildTournamentWithPendingChanges, applyChanges]);

  // Save despite conflicts - called from conflict dialog "save anyway"
  const handleSaveWithConflicts = useCallback(() => {
    applyChanges(buildTournamentWithPendingChanges());
  }, [buildTournamentWithPendingChanges, applyChanges]);

  return {
    isEditing,
    pendingChanges,
    hasUnsavedChanges,
    setIsEditing,
    setPendingReferee,
    setPendingField,
    handleCancelEdit,
    handleSaveChanges,
    handleSaveWithConflicts,
    showConflictDialog,
    setShowConflictDialog,
    detectedConflicts,
  };
}
