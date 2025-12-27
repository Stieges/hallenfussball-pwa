/**
 * ScheduleTab - Spielplan-Ansicht mit Ergebniseingabe
 *
 * Features:
 * - Spielplan wie in der Vorschau (ohne grünen Header)
 * - Bearbeiten-Modus für SR und Feld-Änderungen
 * - Ergebniseingabe immer aktiv
 * - Konfliktprüfung beim Speichern
 * - Live-Tabellen-Berechnung
 */

import { useState, useEffect, useCallback, CSSProperties } from 'react';
import { Card } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { colors } from '../../design-tokens';
import { Tournament, Standing, CorrectionEntry, CorrectionReasonType, Match } from '../../types/tournament';
import { useScheduleHistory } from './hooks';
import { ScheduleToolbar, ScheduleViewMode, ScheduleConflictContent } from './components';
import { GeneratedSchedule } from '../../lib/scheduleGenerator';
import { ScheduleDisplay } from '../../components/ScheduleDisplay';
import { ScheduleEditor, autoReassignReferees, redistributeFields } from '../schedule-editor';
import { RefereeAssignmentEditor } from '../../components/RefereeAssignmentEditor';
import { CorrectionDialog, ConfirmDialog } from '../../components/dialogs';
import { useAppSettings, useUserProfile } from '../../hooks/useUserProfile';
import { usePermissions } from '../../hooks/usePermissions';
import { CorrectionReason } from '../../types/userProfile';
import { autoResolvePlayoffsIfReady, resolveBracketAfterPlayoffMatch } from '../../utils/playoffResolver';
import { STORAGE_KEYS } from '../../constants/storage';
import { detectAllConflicts, ScheduleConflict, ConflictDetectionConfig } from '../schedule-editor';
import { LiveMatch } from '../../components/match-cockpit/MatchCockpit';

// Type for stored live matches in localStorage
type StoredLiveMatches = Record<string, LiveMatch>;

interface ScheduleTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  currentStandings: Standing[];
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
}

// Correction state interface
interface CorrectionState {
  matchId: string;
  originalScoreA: number;
  originalScoreB: number;
}

// Pending changes during edit mode (SR and field changes only)
// Note: Match time swaps are applied immediately to tournament.matches for view sync
interface PendingChanges {
  refereeAssignments: Record<string, number | null>;
  fieldAssignments: Record<string, number>;
}


export const ScheduleTab: React.FC<ScheduleTabProps> = ({
  tournament,
  schedule,
  currentStandings,
  onTournamentUpdate,
}) => {
  // App settings for result lock behavior
  const appSettings = useAppSettings();
  // User profile for correction logging
  const { profile } = useUserProfile();
  // Permission check for corrections
  const { canCorrectResults } = usePermissions(tournament.id);
  // Toast notifications
  const { showWarning, showSuccess } = useToast();

  // Edit mode state - single button approach
  const [isEditing, setIsEditing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({
    refereeAssignments: {},
    fieldAssignments: {},
  });

  // View mode: 'table' (classic) or 'grid' (new schedule editor)
  const [viewMode, setViewMode] = useState<ScheduleViewMode>('table');

  // Unified Undo/Redo History (shared across both views)
  const { saveToHistory, handleUndo, handleRedo, clearHistory, canUndo, canRedo } =
    useScheduleHistory({
      matches: tournament.matches,
      onMatchesUpdate: useCallback((matches: Match[]) => {
        onTournamentUpdate({
          ...tournament,
          matches,
          updatedAt: new Date().toISOString(),
        }, false);
      }, [tournament, onTournamentUpdate]),
      isEditing,
    });

  // Handle redistribution of SR (keeps times fixed)
  const handleRedistributeSR = useCallback(() => {
    if (!isEditing) {return;}

    // Save to history first
    saveToHistory();

    const result = autoReassignReferees(
      tournament.matches,
      tournament.refereeConfig,
      { target: 'all', optimizeForFairness: true }
    );

    if (result.changes.length === 0) {
      showSuccess('Schiedsrichter bereits optimal verteilt');
      return;
    }

    // Apply changes
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
  }, [isEditing, tournament, onTournamentUpdate, saveToHistory, showSuccess]);

  // Handle redistribution of fields (keeps times fixed)
  const handleRedistributeFields = useCallback(() => {
    if (!isEditing) {return;}

    // Save to history first
    saveToHistory();

    const result = redistributeFields(
      tournament.matches,
      tournament.numberOfFields
    );

    if (result.changes.length === 0) {
      showSuccess('Felder bereits optimal verteilt');
      return;
    }

    // Apply changes
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
  }, [isEditing, tournament, onTournamentUpdate, saveToHistory, showSuccess]);

  // Conflict dialog state
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [detectedConflicts, setDetectedConflicts] = useState<ScheduleConflict[]>([]);

  // Correction mode state
  const [correctionState, setCorrectionState] = useState<CorrectionState | null>(null);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);

  // Helper: Check if match is finished
  const isMatchFinished = (matchId: string): boolean => {
    // 1. Check if scores exist
    const match = tournament.matches.find(m => m.id === matchId);
    if (match?.scoreA === undefined || match.scoreB === undefined) {
      return false;
    }

    // 2. Check liveMatches status if available
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.liveMatches(tournament.id));
      if (stored) {
        const liveMatches = JSON.parse(stored) as StoredLiveMatches;
        if (liveMatches[matchId].status === 'FINISHED') {
          return true;
        }
      }
    } catch {
      // Ignore parse errors
    }

    // 3. Fallback: implicit detection
    return true;
  };

  // Helper: Resolve team ID to team name
  const getTeamName = (teamId: string): string => {
    const team = tournament.teams.find(t => t.id === teamId);
    return team?.name || teamId; // || is intentional: empty name should also fallback
  };

  // MON-LIVE-INDICATOR-01: Get running match IDs from localStorage
  const getRunningMatchIds = (): Set<string> => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.liveMatches(tournament.id));
      if (stored) {
        const liveMatches = JSON.parse(stored) as StoredLiveMatches;
        const runningIds = Object.keys(liveMatches).filter(
          id => liveMatches[id].status === 'RUNNING'
        );
        return new Set(runningIds);
      }
    } catch {
      // Ignore parse errors
    }
    return new Set();
  };

  // State for running match IDs with polling for live updates
  const [runningMatchIds, setRunningMatchIds] = useState<Set<string>>(() => getRunningMatchIds());

  // Poll localStorage every 2 seconds to detect changes from ManagementTab
  useEffect(() => {
    const updateRunningMatches = () => {
      const newIds = getRunningMatchIds();
      setRunningMatchIds(prev => {
        // Only update if the sets are different
        const prevArray = Array.from(prev).sort();
        const newArray = Array.from(newIds).sort();
        if (JSON.stringify(prevArray) !== JSON.stringify(newArray)) {
          return newIds;
        }
        return prev;
      });
    };

    // Initial update
    updateRunningMatches();

    // Poll every 2 seconds
    const interval = setInterval(updateRunningMatches, 2000);

    // Also listen for storage events (when changed in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.liveMatches(tournament.id)) {
        updateRunningMatches();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getRunningMatchIds uses tournament.id which is already in deps
  }, [tournament.id]);

  // Reset pending changes and history when exiting edit mode
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setPendingChanges({
      refereeAssignments: {},
      fieldAssignments: {},
    });
    clearHistory();
  }, [clearHistory]);

  // US-SCHEDULE-EDITOR: Handle match swap via DnD
  // IMPORTANT: Apply changes immediately (not in pendingChanges) so both views stay in sync
  const handleMatchSwap = useCallback((matchId1: string, matchId2: string) => {
    // Find the matches
    const match1 = tournament.matches.find(m => m.id === matchId1);
    const match2 = tournament.matches.find(m => m.id === matchId2);

    if (!match1 || !match2) {
      console.warn('Could not find matches for swap:', matchId1, matchId2);
      return;
    }

    if (!match1.scheduledTime || !match2.scheduledTime) {
      console.warn('Matches missing scheduled time:', matchId1, matchId2);
      return;
    }

    // Save to history for undo
    saveToHistory();

    // IMMEDIATELY apply the time swap to tournament.matches
    // This keeps both table and grid views in sync
    const time1 = match1.scheduledTime;
    const time2 = match2.scheduledTime;

    const updatedMatches = tournament.matches.map(m => {
      if (m.id === matchId1) {
        return { ...m, scheduledTime: time2 };
      }
      if (m.id === matchId2) {
        return { ...m, scheduledTime: time1 };
      }
      return m;
    });

    onTournamentUpdate({
      ...tournament,
      matches: updatedMatches,
      updatedAt: new Date().toISOString(),
    }, false);

    showSuccess(`Spiele ${match1.round} und ${match2.round} getauscht`);
  }, [tournament, onTournamentUpdate, showSuccess, saveToHistory]);

  // ===========================================================================
  // PENDING CHANGES → TOURNAMENT BUILDER
  // ===========================================================================
  // Applies SR and field changes from pendingChanges to tournament.
  // Used by both handleSaveChanges and handleSaveWithConflicts.
  // Match time swaps are applied immediately and not stored in pendingChanges.
  // ===========================================================================

  const buildTournamentWithPendingChanges = useCallback((): Tournament => {
    const updated = { ...tournament };

    // Apply pending SR assignments to both config and matches
    if (Object.keys(pendingChanges.refereeAssignments).length > 0) {
      if (!updated.refereeConfig) {
        updated.refereeConfig = { mode: 'teams', manualAssignments: {} };
      }
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
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Can be null
        if (newRef !== undefined) {
          return { ...match, referee: newRef ?? undefined };
        }
        return match;
      });
    }

    // Apply pending field assignments to both config and matches
    if (Object.keys(pendingChanges.fieldAssignments).length > 0) {
      if (!updated.fieldAssignments) {
        updated.fieldAssignments = {};
      }
      for (const [id, fieldNumber] of Object.entries(pendingChanges.fieldAssignments)) {
        updated.fieldAssignments[id] = fieldNumber;
      }

      updated.matches = updated.matches.map(match => {
        const newField = pendingChanges.fieldAssignments[match.id];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime check
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
    setPendingChanges({ refereeAssignments: {}, fieldAssignments: {} });
    setShowConflictDialog(false);
    setDetectedConflicts([]);
    showSuccess('Spielplan-Änderungen gespeichert');
  }, [onTournamentUpdate, showSuccess]);

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

  // Correction handlers
  const handleStartCorrection = (matchId: string) => {
    // Check permission first - if not allowed, show warning
    if (!canCorrectResults) {
      showWarning('Sie haben keine Berechtigung, Ergebnisse nachträglich zu korrigieren.');
      return;
    }

    const match = tournament.matches.find(m => m.id === matchId);
    if (match?.scoreA === undefined || match.scoreB === undefined) {return;}

    setCorrectionState({
      matchId,
      originalScoreA: match.scoreA,
      originalScoreB: match.scoreB,
    });
    setShowCorrectionDialog(true);
  };

  const handleCancelCorrection = () => {
    setShowCorrectionDialog(false);
    setCorrectionState(null);
  };

  const handleConfirmCorrection = (
    newScoreA: number,
    newScoreB: number,
    reason: CorrectionReason,
    note?: string
  ) => {
    if (!correctionState) {return;}

    // Create correction entry for match history
    const correctionEntry: CorrectionEntry = {
      timestamp: new Date().toISOString(),
      previousScoreA: correctionState.originalScoreA,
      previousScoreB: correctionState.originalScoreB,
      newScoreA,
      newScoreB,
      reasonType: reason as CorrectionReasonType,
      note,
      userName: profile.name,
    };

    // Log correction to console

    // Update tournament matches with correction history
    const updatedMatches = tournament.matches.map(m => {
      if (m.id !== correctionState.matchId) {return m;}

      // Add correction to history
      const existingHistory = m.correctionHistory ?? [];
      return {
        ...m,
        scoreA: newScoreA,
        scoreB: newScoreB,
        correctionHistory: [...existingHistory, correctionEntry],
      };
    });

    onTournamentUpdate(
      { ...tournament, matches: updatedMatches, updatedAt: new Date().toISOString() },
      false // Triggers standings recalculation in parent
    );

    setShowCorrectionDialog(false);
    setCorrectionState(null);
  };

  const handleScoreChange = (matchId: string, scoreA: number, scoreB: number) => {
    // Block editing finished matches (if lock is enabled)
    // Corrections are handled via the CorrectionDialog, not inline editing
    if (appSettings.lockFinishedResults && isMatchFinished(matchId)) {
      showWarning('Dieses Spiel ist bereits beendet. Verwenden Sie "Ergebnis korrigieren".');
      return;
    }

    // Prüfe, ob das Spiel gerade live läuft
    const liveMatchesData = localStorage.getItem(STORAGE_KEYS.liveMatches(tournament.id));
    if (liveMatchesData) {
      try {
        const liveMatches = JSON.parse(liveMatchesData) as StoredLiveMatches;
        const liveMatch = liveMatches[matchId];

        if (liveMatch.status === 'RUNNING') {
          const confirmEdit = window.confirm(
            '⚠️ WARNUNG: Dieses Spiel läuft gerade LIVE in der Turnierleitung!\n\n' +
            'Wenn Sie hier das Ergebnis ändern, wird es die Live-Verwaltung überschreiben.\n\n' +
            'Möchten Sie trotzdem fortfahren?'
          );

          if (!confirmEdit) {
            return; // Abbrechen
          }
        }
      } catch (e) {
        console.error('Error checking live matches:', e);
      }
    }

    // Update tournament matches
    const updatedMatches = tournament.matches.map((match) =>
      match.id === matchId ? { ...match, scoreA, scoreB } : match
    );

    const updatedTournament = {
      ...tournament,
      matches: updatedMatches,
      updatedAt: new Date().toISOString(),
    };

    // Score changes don't need schedule regeneration
    onTournamentUpdate(updatedTournament, false);

    // FIX: Auto-resolve playoff pairings after group match completion
    const playoffResolution = autoResolvePlayoffsIfReady(updatedTournament);
    if (playoffResolution?.wasResolved) {
      onTournamentUpdate(updatedTournament, false);
    }

    // FIX: Also resolve bracket placeholders after playoff matches (e.g., semi → final)
    const bracketResolution = resolveBracketAfterPlayoffMatch(updatedTournament);
    if (bracketResolution?.wasResolved) {
      onTournamentUpdate(updatedTournament, false);
    }
  };

  // In edit mode: store changes locally, apply on save
  const handleRefereeAssignment = (matchId: string, refereeNumber: number | null) => {
    if (isEditing) {
      // Store in pending changes
      setPendingChanges(prev => ({
        ...prev,
        refereeAssignments: {
          ...prev.refereeAssignments,
          [matchId]: refereeNumber,
        },
      }));
    } else {
      // Direct update (legacy behavior)
      const updatedTournament = { ...tournament };

      if (!updatedTournament.refereeConfig) {
        console.warn('[ScheduleTab] No refereeConfig found');
        return;
      }

      const manualAssignments = { ...(updatedTournament.refereeConfig.manualAssignments ?? {}) };

      if (refereeNumber === null) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Intentional cleanup of manual assignment
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
  };

  const handleResetRefereeAssignments = () => {
    const updatedTournament = { ...tournament };

    if (updatedTournament.refereeConfig) {
      updatedTournament.refereeConfig = {
        ...updatedTournament.refereeConfig,
        manualAssignments: {},
      };

      // Referee reset needs schedule regeneration
      onTournamentUpdate(updatedTournament, true);
    }
  };

  // In edit mode: store changes locally, apply on save
  const handleFieldChange = (matchId: string, fieldNumber: number) => {
    if (isEditing) {
      // Store in pending changes
      setPendingChanges(prev => ({
        ...prev,
        fieldAssignments: {
          ...prev.fieldAssignments,
          [matchId]: fieldNumber,
        },
      }));
    } else {
      // Direct update (legacy behavior)
      const updatedTournament = { ...tournament };

      if (!updatedTournament.fieldAssignments) {
        updatedTournament.fieldAssignments = {};
      }

      updatedTournament.fieldAssignments[matchId] = fieldNumber;

      onTournamentUpdate(updatedTournament, true);
    }
  };

  // Check if there are unsaved changes (SR/field pending + any undo history)
  const hasUnsavedChanges =
    Object.keys(pendingChanges.refereeAssignments).length > 0 ||
    Object.keys(pendingChanges.fieldAssignments).length > 0;

  const containerStyle: CSSProperties = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '24px',
  };

  // Edit mode visual indicator
  const editModeCardStyle: CSSProperties = isEditing ? {
    border: `3px solid ${colors.primary}`,
    boxShadow: `0 0 0 4px ${colors.secondaryLight}`,
  } : {};

  // Count conflicts by severity
  const criticalConflicts = detectedConflicts.filter(c =>
    c.type === 'team_double_booking' ||
    c.type === 'referee_double_booking' ||
    c.type === 'field_overlap'
  );
  const warningConflicts = detectedConflicts.filter(c =>
    c.type === 'break_violation'
  );

  return (
    <>
      <div style={containerStyle} className="schedule-tab-container">
      <Card style={editModeCardStyle}>
        {/* Action Buttons Header */}
        <ScheduleToolbar
          isEditing={isEditing}
          onStartEditing={() => setIsEditing(true)}
          onSave={handleSaveChanges}
          onCancel={handleCancelEdit}
          hasUnsavedChanges={hasUnsavedChanges}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          onRedistributeSR={handleRedistributeSR}
          onRedistributeFields={handleRedistributeFields}
          showSRButton={tournament.refereeConfig?.mode !== 'none'}
          showFieldsButton={tournament.numberOfFields > 1}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          tournament={tournament}
          schedule={schedule}
          standings={currentStandings}
        />

        {/* Conditional rendering based on view mode */}
        {viewMode === 'table' ? (
          <ScheduleDisplay
            schedule={schedule}
            currentStandings={currentStandings}
            currentMatches={tournament.matches}
            editable={true}
            editingSchedule={isEditing}
            pendingChanges={isEditing ? pendingChanges : undefined}
            onScoreChange={handleScoreChange}
            onRefereeChange={handleRefereeAssignment}
            onFieldChange={handleFieldChange}
            onMatchSwap={isEditing ? handleMatchSwap : undefined}
            finishedMatches={appSettings.lockFinishedResults
              ? new Set(
                  tournament.matches
                    .filter(m => isMatchFinished(m.id))
                    .map(m => m.id)
                )
              : new Set() // Lock disabled: all matches stay editable
            }
            correctionMatchId={correctionState?.matchId ?? null}
            onStartCorrection={handleStartCorrection}
            runningMatchIds={runningMatchIds}
          />
        ) : (
          <ScheduleEditor
            tournament={tournament}
            onTournamentUpdate={(updatedTournament) => onTournamentUpdate(updatedTournament, false)}
            externalEditMode={isEditing}
            onBeforeChange={saveToHistory}
            hideToolbar={true}
          />
        )}

        {/* Manuelle SR-Zuweisung (wenn SR aktiv) */}
        {tournament.refereeConfig && tournament.refereeConfig.mode !== 'none' && (
          <RefereeAssignmentEditor
            matches={schedule.allMatches}
            refereeConfig={tournament.refereeConfig}
            onAssignmentChange={handleRefereeAssignment}
            onResetAssignments={handleResetRefereeAssignments}
          />
        )}
      </Card>
    </div>

    {/* Conflict Warning Dialog */}
    <ConfirmDialog
      isOpen={showConflictDialog}
      onClose={() => setShowConflictDialog(false)}
      onConfirm={handleSaveWithConflicts}
      title="Konflikte im Spielplan"
      confirmText="Trotzdem speichern"
      cancelText="Zurück zur Bearbeitung"
      variant={criticalConflicts.length > 0 ? 'danger' : 'warning'}
      message={
        <ScheduleConflictContent
          criticalConflicts={criticalConflicts}
          warningConflicts={warningConflicts}
        />
      }
    />

    {/* Correction Dialog */}
    {correctionState && (() => {
      const match = tournament.matches.find(m => m.id === correctionState.matchId);
      if (!match) {return null;}

      return (
        <CorrectionDialog
          isOpen={showCorrectionDialog}
          onClose={handleCancelCorrection}
          onConfirm={handleConfirmCorrection}
          matchLabel={`Spiel #${match.round}`}
          teamA={getTeamName(match.teamA)}
          teamB={getTeamName(match.teamB)}
          originalScoreA={correctionState.originalScoreA}
          originalScoreB={correctionState.originalScoreB}
        />
      );
    })()}

    {/* Responsive Styles */}
    <style>{`
      /* Mobile adjustments */
      @media (max-width: 767px) {
        .schedule-tab-container {
          padding: 16px 12px !important;
        }
      }

      /* Tablet adjustments */
      @media (min-width: 768px) and (max-width: 1024px) {
        .schedule-tab-container {
          padding: 20px 16px !important;
        }
      }

      /* Ensure cards are responsive on mobile */
      @media (max-width: 767px) {
        .schedule-tab-container .card {
          border-radius: 8px;
          padding: 12px;
        }
      }
    `}</style>
    </>
  );
};
