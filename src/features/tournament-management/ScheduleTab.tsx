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

import { useState, useEffect, useCallback, CSSProperties, useRef } from 'react';
import { Card, Button } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '../../design-tokens';
import { Tournament, Standing, CorrectionEntry, CorrectionReasonType, Match } from '../../types/tournament';
import { GeneratedSchedule } from '../../lib/scheduleGenerator';
import { ScheduleDisplay } from '../../components/ScheduleDisplay';
import { ScheduleEditor, autoReassignReferees, redistributeFields } from '../schedule-editor';
import { RefereeAssignmentEditor } from '../../components/RefereeAssignmentEditor';
import { ScheduleActionButtons } from '../../components/ScheduleActionButtons';
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

// View mode for schedule display
type ScheduleViewMode = 'table' | 'grid';

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

// History state for unified undo/redo across both views
interface HistoryState {
  matches: Match[];
  timestamp: number;
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

  // =========================================================================
  // UNIFIED UNDO/REDO HISTORY (shared across both views)
  // =========================================================================
  const undoStackRef = useRef<HistoryState[]>([]);
  const redoStackRef = useRef<HistoryState[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0); // Force re-render for button states

  // Save current state to undo stack before making changes
  const saveToHistory = useCallback(() => {
    undoStackRef.current.push({
      matches: tournament.matches.map(m => ({ ...m })), // Deep copy
      timestamp: Date.now(),
    });
    // Clear redo stack when new change is made
    redoStackRef.current = [];
    setHistoryVersion(v => v + 1);
  }, [tournament.matches]);

  // Undo: Restore previous state
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) {return;}

    // Save current state to redo stack
    redoStackRef.current.push({
      matches: tournament.matches.map(m => ({ ...m })),
      timestamp: Date.now(),
    });

    // Pop and apply previous state
    const previousState = undoStackRef.current.pop();
    if (!previousState) {return;} // Should never happen due to length check
    onTournamentUpdate({
      ...tournament,
      matches: previousState.matches,
      updatedAt: new Date().toISOString(),
    }, false);
    setHistoryVersion(v => v + 1);
  }, [tournament, onTournamentUpdate]);

  // Redo: Restore next state
  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) {return;}

    // Save current state to undo stack
    undoStackRef.current.push({
      matches: tournament.matches.map(m => ({ ...m })),
      timestamp: Date.now(),
    });

    // Pop and apply next state
    const nextState = redoStackRef.current.pop();
    if (!nextState) {return;} // Should never happen due to length check
    onTournamentUpdate({
      ...tournament,
      matches: nextState.matches,
      updatedAt: new Date().toISOString(),
    }, false);
    setHistoryVersion(v => v + 1);
  }, [tournament, onTournamentUpdate]);

  // Clear history when exiting edit mode
  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryVersion(v => v + 1);
  }, []);

  // Computed history state (historyVersion forces re-render)
  const canUndo = historyVersion >= 0 && undoStackRef.current.length > 0;
  const canRedo = historyVersion >= 0 && redoStackRef.current.length > 0;

  // Keyboard shortcuts for undo/redo (only in edit mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditing) {return;}

      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Y or Cmd+Shift+Z for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, handleUndo, handleRedo]);

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

  // Actually apply the changes (called after conflict resolution)
  const applyChanges = useCallback((updatedTournament: Tournament) => {
    updatedTournament.updatedAt = new Date().toISOString();

    // IMPORTANT: Manual edits should NEVER trigger schedule regeneration!
    // Regeneration would overwrite the user's intentional changes.
    // Regeneration is only needed for structural changes (add/remove teams, change settings).
    const needsRegeneration = false;

    onTournamentUpdate(updatedTournament, needsRegeneration);

    setIsEditing(false);
    setPendingChanges({
      refereeAssignments: {},
      fieldAssignments: {},
    });
    setShowConflictDialog(false);
    setDetectedConflicts([]);

    showSuccess('Spielplan-Änderungen gespeichert');
  }, [onTournamentUpdate, showSuccess]);

  // Apply pending changes and check for conflicts
  const handleSaveChanges = useCallback(() => {
    // Build updated tournament with pending changes
    const updatedTournament = { ...tournament };

    // Apply referee changes
    if (Object.keys(pendingChanges.refereeAssignments).length > 0) {
      if (!updatedTournament.refereeConfig) {
        updatedTournament.refereeConfig = { mode: 'teams', manualAssignments: {} };
      }
      const manualAssignments = { ...updatedTournament.refereeConfig.manualAssignments };

      for (const [id, refereeNumber] of Object.entries(pendingChanges.refereeAssignments)) {
        if (refereeNumber === null) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Intentional cleanup of manual assignment
          delete manualAssignments[id];
        } else {
          manualAssignments[id] = refereeNumber;
        }
      }

      updatedTournament.refereeConfig = {
        ...updatedTournament.refereeConfig,
        manualAssignments,
      };

      // Also update matches directly
      updatedTournament.matches = updatedTournament.matches.map(match => {
        const newRef = pendingChanges.refereeAssignments[match.id];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- newRef can be null (deletion marker)
        if (newRef !== undefined) {
          return { ...match, referee: newRef ?? undefined };
        }
        return match;
      });
    }

    // Apply field changes
    if (Object.keys(pendingChanges.fieldAssignments).length > 0) {
      if (!updatedTournament.fieldAssignments) {
        updatedTournament.fieldAssignments = {};
      }
      for (const [id, fieldNumber] of Object.entries(pendingChanges.fieldAssignments)) {
        updatedTournament.fieldAssignments[id] = fieldNumber;
      }

      // Also update matches directly
      updatedTournament.matches = updatedTournament.matches.map(match => {
        const newField = pendingChanges.fieldAssignments[match.id];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime check: object indexing can return undefined
        if (newField !== undefined) {
          return { ...match, field: newField };
        }
        return match;
      });
    }

    // Note: Match time swaps are already applied immediately (not stored in pendingChanges)

    // Check for conflicts BEFORE saving
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
      // Show conflict dialog
      setDetectedConflicts(conflicts);
      setShowConflictDialog(true);
      return;
    }

    // No conflicts - save directly
    applyChanges(updatedTournament);
  }, [tournament, pendingChanges, applyChanges]);

  // Handle conflict dialog - save anyway
  const handleSaveWithConflicts = useCallback(() => {
    // Build updated tournament again and save despite conflicts
    const updatedTournament = { ...tournament };

    // Apply referee changes
    if (Object.keys(pendingChanges.refereeAssignments).length > 0) {
      if (!updatedTournament.refereeConfig) {
        updatedTournament.refereeConfig = { mode: 'teams', manualAssignments: {} };
      }
      const manualAssignments = { ...updatedTournament.refereeConfig.manualAssignments };

      for (const [id, refereeNumber] of Object.entries(pendingChanges.refereeAssignments)) {
        if (refereeNumber === null) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Intentional cleanup of manual assignment
          delete manualAssignments[id];
        } else {
          manualAssignments[id] = refereeNumber;
        }
      }

      updatedTournament.refereeConfig = {
        ...updatedTournament.refereeConfig,
        manualAssignments,
      };

      updatedTournament.matches = updatedTournament.matches.map(match => {
        const newRef = pendingChanges.refereeAssignments[match.id];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- newRef can be null (deletion marker)
        if (newRef !== undefined) {
          return { ...match, referee: newRef ?? undefined };
        }
        return match;
      });
    }

    // Apply field changes
    if (Object.keys(pendingChanges.fieldAssignments).length > 0) {
      if (!updatedTournament.fieldAssignments) {
        updatedTournament.fieldAssignments = {};
      }
      for (const [id, fieldNumber] of Object.entries(pendingChanges.fieldAssignments)) {
        updatedTournament.fieldAssignments[id] = fieldNumber;
      }

      updatedTournament.matches = updatedTournament.matches.map(match => {
        const newField = pendingChanges.fieldAssignments[match.id];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- newField can be undefined at runtime
        if (newField !== undefined) {
          return { ...match, field: newField };
        }
        return match;
      });
    }

    // Note: Match time swaps are already applied immediately (not stored in pendingChanges)

    applyChanges(updatedTournament);
  }, [tournament, pendingChanges, applyChanges]);

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
    boxShadow: `0 0 0 4px rgba(0, 176, 255, 0.15)`,
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
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: spacing.lg,
          borderBottom: `1px solid ${colors.border}`,
          gap: spacing.md,
          flexWrap: 'wrap',
        }}>
          {/* Left side: Edit mode controls (SHARED across both views) + View toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}>
            {/* Edit Mode Controls - UNIFIED for both views */}
            {!isEditing ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                ✏️ Spielplan bearbeiten
              </Button>
            ) : (
              <>
                <span style={{
                  fontSize: fontSizes.sm,
                  fontWeight: fontWeights.semibold,
                  color: colors.primary,
                  padding: `${spacing.xs} ${spacing.sm}`,
                  backgroundColor: 'rgba(0, 176, 255, 0.1)',
                  borderRadius: borderRadius.sm,
                }}>
                  Bearbeitungsmodus
                </span>

                {/* Undo/Redo buttons */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUndo}
                  disabled={!canUndo}
                >
                  ↩️ Undo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRedo}
                  disabled={!canRedo}
                >
                  ↪️ Redo
                </Button>

                {/* Redistribution buttons - keep times, redistribute SR or fields */}
                {tournament.refereeConfig?.mode !== 'none' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRedistributeSR}
                  >
                    🔄 SR verteilen
                  </Button>
                )}
                {tournament.numberOfFields > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRedistributeFields}
                  >
                    🔄 Felder verteilen
                  </Button>
                )}

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveChanges}
                  disabled={!hasUnsavedChanges && !canUndo}
                >
                  💾 Speichern
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                >
                  Abbrechen
                </Button>
              </>
            )}

            {/* View Mode Toggle */}
            <div style={{
              display: 'flex',
              backgroundColor: colors.background,
              borderRadius: borderRadius.md,
              padding: '2px',
              border: `1px solid ${colors.border}`,
              marginLeft: isEditing ? spacing.md : 0,
            }}>
              <button
                onClick={() => setViewMode('table')}
                style={{
                  padding: `${spacing.xs} ${spacing.md}`,
                  border: 'none',
                  borderRadius: borderRadius.sm,
                  fontSize: fontSizes.sm,
                  fontWeight: viewMode === 'table' ? fontWeights.semibold : fontWeights.medium,
                  backgroundColor: viewMode === 'table' ? colors.primary : 'transparent',
                  color: viewMode === 'table' ? colors.background : colors.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                Tabelle
              </button>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  padding: `${spacing.xs} ${spacing.md}`,
                  border: 'none',
                  borderRadius: borderRadius.sm,
                  fontSize: fontSizes.sm,
                  fontWeight: viewMode === 'grid' ? fontWeights.semibold : fontWeights.medium,
                  backgroundColor: viewMode === 'grid' ? colors.primary : 'transparent',
                  color: viewMode === 'grid' ? colors.background : colors.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                Grid
              </button>
            </div>
          </div>

          {/* Right side: Export buttons */}
          <ScheduleActionButtons
            tournament={tournament}
            schedule={schedule}
            standings={currentStandings}
            variant="organizer"
          />
        </div>

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
        <div style={{ textAlign: 'left' }}>
          {criticalConflicts.length > 0 && (
            <div style={{
              marginBottom: spacing.md,
              padding: spacing.md,
              backgroundColor: 'rgba(220, 38, 38, 0.1)',
              border: `1px solid ${colors.error}`,
              borderRadius: borderRadius.md,
            }}>
              <div style={{
                fontWeight: fontWeights.semibold,
                color: colors.error,
                marginBottom: spacing.sm,
              }}>
                ⛔ Kritische Fehler ({criticalConflicts.length})
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {criticalConflicts.map((c, i) => (
                  <li key={i} style={{ color: colors.textPrimary, marginBottom: spacing.xs }}>
                    {c.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {warningConflicts.length > 0 && (
            <div style={{
              padding: spacing.md,
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: `1px solid ${colors.warning}`,
              borderRadius: borderRadius.md,
            }}>
              <div style={{
                fontWeight: fontWeights.semibold,
                color: colors.warning,
                marginBottom: spacing.sm,
              }}>
                ⚠️ Warnungen ({warningConflicts.length})
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {warningConflicts.map((c, i) => (
                  <li key={i} style={{ color: colors.textPrimary, marginBottom: spacing.xs }}>
                    {c.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
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
