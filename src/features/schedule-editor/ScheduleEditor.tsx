/**
 * US-SCHEDULE-EDITOR: ScheduleEditor Component
 *
 * Main container component for the interactive schedule editor.
 * Integrates:
 * - Drag & drop match reordering
 * - Inline SR/field editing
 * - Conflict detection & display
 * - Skip/unskip matches
 * - Auto-reassignment
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { Tournament, Match } from '../../types/tournament';

// ============================================================================
// History Types for Undo/Redo
// ============================================================================

interface HistoryState {
  matches: Match[];
  timestamp: number;
}
import { TimeSlot as TimeSlotType } from './types';
import { colors, spacing, borderRadius, fontSizes, fontWeights } from '../../design-tokens';
import { Button } from '../../components/ui';

// Hooks
import { useScheduleEditor } from './hooks/useScheduleEditor';
import { useMatchConflicts } from './hooks/useMatchConflicts';
import { useDragDrop, createSlotId } from './hooks/useDragDrop';

// Components
import { EditorToolbar } from './components/EditorToolbar';
import { DraggableMatch } from './components/DraggableMatch';
import { TimeSlot } from './components/TimeSlot';
import { ConflictDialog } from './components/ConflictDialog';

// Utils
import { autoReassignReferees, balanceRefereeWorkloads, getRefereeStats } from './utils/autoReassign';

// ============================================================================
// Types
// ============================================================================

interface ScheduleEditorProps {
  /** Tournament data */
  tournament: Tournament;
  /** Callback when tournament is updated */
  onTournamentUpdate: (tournament: Tournament) => void;
  /** Whether editing is allowed */
  readOnly?: boolean;
  /** Show only specific match phase */
  phase?: 'group' | 'finals' | 'all';
  /** Compact mode for mobile */
  compact?: boolean;

  // === EXTERNAL CONTROL MODE (optional) ===
  // When these are provided, ScheduleEditor uses external state management

  /** External edit mode (if managed by parent) */
  externalEditMode?: boolean;
  /** Called when a change is made (for external undo/redo tracking) */
  onBeforeChange?: () => void;
  /** Hide internal toolbar (when parent shows unified toolbar) */
  hideToolbar?: boolean;
}

// ============================================================================
// Styles
// ============================================================================

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.lg,
  width: '100%',
};

const gridContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.md,
  backgroundColor: colors.surface,
  borderRadius: borderRadius.lg,
  padding: spacing.lg,
  border: `1px solid ${colors.border}`,
};

const timeRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: spacing.md,
  alignItems: 'stretch',
  minHeight: '120px', // Ensure consistent row height
};

const timeHeaderStyle: React.CSSProperties = {
  minWidth: '70px',
  maxWidth: '70px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: fontSizes.md,
  fontWeight: fontWeights.bold,
  color: colors.primary,
  backgroundColor: colors.background,
  borderRadius: borderRadius.md,
  padding: spacing.md,
  border: `1px solid ${colors.border}`,
};

const fieldsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: spacing.md,
  flex: 1,
  minWidth: 0, // Allow flex items to shrink
};

const fieldHeaderContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: spacing.md,
  marginBottom: spacing.md,
  paddingLeft: '86px', // Offset for time header (70px + gap)
};

const fieldHeaderStyle: React.CSSProperties = {
  flex: 1,
  textAlign: 'center',
  fontSize: fontSizes.md,
  fontWeight: fontWeights.bold,
  color: colors.background,
  padding: spacing.md,
  backgroundColor: colors.primary,
  borderRadius: borderRadius.md,
  minWidth: 0,
};

const statsContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: spacing.md,
  flexWrap: 'wrap',
  padding: spacing.md,
  backgroundColor: colors.surface,
  borderRadius: borderRadius.md,
  marginTop: spacing.md,
};

const statItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.xs,
  fontSize: fontSizes.sm,
  color: colors.textSecondary,
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatTime(date: Date | string | undefined): string {
  if (!date) {return '--:--';}
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function groupMatchesByTimeSlot(
  matches: Match[],
  numberOfFields: number
): Map<string, Map<number, Match | null>> {
  const grid = new Map<string, Map<number, Match | null>>();

  // Get all unique times with their actual timestamps
  // This handles overnight tournaments correctly (23:50 before 00:02)
  const timeMap = new Map<string, number>(); // time string -> earliest timestamp
  for (const match of matches) {
    if (match.scheduledTime) {
      const timeStr = formatTime(match.scheduledTime);
      const timestamp = new Date(match.scheduledTime).getTime();
      // Keep the earliest timestamp for each time string
      if (!timeMap.has(timeStr) || timestamp < timeMap.get(timeStr)!) {
        timeMap.set(timeStr, timestamp);
      }
    }
  }

  // Sort by actual timestamp, not alphabetically
  const sortedTimes = Array.from(timeMap.entries())
    .sort((a, b) => a[1] - b[1])
    .map(entry => entry[0]);

  // Build grid
  for (const time of sortedTimes) {
    const fieldsMap = new Map<number, Match | null>();
    for (let f = 1; f <= numberOfFields; f++) {
      fieldsMap.set(f, null);
    }

    // Find matches for this time
    for (const match of matches) {
      if (formatTime(match.scheduledTime) === time) {
        const fieldId = match.field ?? 1;
        fieldsMap.set(fieldId, match);
      }
    }

    grid.set(time, fieldsMap);
  }

  return grid;
}

// ============================================================================
// Component
// ============================================================================

export const ScheduleEditor: React.FC<ScheduleEditorProps> = ({
  tournament,
  onTournamentUpdate,
  readOnly = false,
  phase = 'all',
  compact = false,
  // External control props
  externalEditMode,
  onBeforeChange,
  hideToolbar = false,
}) => {
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);

  // =========================================================================
  // LOCAL UNDO/REDO HISTORY
  // Using refs to avoid re-renders on history changes
  // =========================================================================
  const undoStackRef = useRef<HistoryState[]>([]);
  const redoStackRef = useRef<HistoryState[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0); // Force re-render for button states

  // Save current state to undo stack before making changes
  const saveToHistory = useCallback(() => {
    // If parent manages history, notify it instead of using local history
    if (onBeforeChange) {
      onBeforeChange();
      return;
    }

    undoStackRef.current.push({
      matches: tournament.matches.map(m => ({ ...m })), // Deep copy
      timestamp: Date.now(),
    });
    // Clear redo stack when new change is made
    redoStackRef.current = [];
    setHistoryVersion(v => v + 1);
  }, [tournament.matches, onBeforeChange]);

  // Undo: Restore previous state
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) {return;}

    // Save current state to redo stack
    redoStackRef.current.push({
      matches: tournament.matches.map(m => ({ ...m })),
      timestamp: Date.now(),
    });

    // Pop and apply previous state
    const previousState = undoStackRef.current.pop()!;
    onTournamentUpdate({
      ...tournament,
      matches: previousState.matches,
      updatedAt: new Date().toISOString(),
    });
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
    const nextState = redoStackRef.current.pop()!;
    onTournamentUpdate({
      ...tournament,
      matches: nextState.matches,
      updatedAt: new Date().toISOString(),
    });
    setHistoryVersion(v => v + 1);
  }, [tournament, onTournamentUpdate]);

  // Clear history when exiting edit mode
  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryVersion(v => v + 1);
  }, []);

  // Filter matches by phase
  const filteredMatches = useMemo(() => {
    if (phase === 'all') {return tournament.matches;}
    return tournament.matches.filter(m => {
      if (phase === 'group') {return !m.isFinal;}
      if (phase === 'finals') {return m.isFinal;}
      return true;
    });
  }, [tournament.matches, phase]);

  // Schedule editor state
  const {
    state,
    enterEditMode,
    exitEditMode,
    selectMatch,
    // Note: updateMatchTime, updateMatchField, undo, redo are NOT used here
    // because handleMoveMatch does atomic batch updates with local history
    updateMatchReferee,
    unskipMatch,
    saveChanges,
    discardChanges,
  } = useScheduleEditor({
    tournament,
    onTournamentUpdate,
  });

  // Determine if we're in edit mode (external takes precedence)
  const isEditing = externalEditMode !== undefined ? externalEditMode : state.mode === 'edit';

  // Conflict detection
  const conflictResult = useMatchConflicts({
    matches: tournament.matches,
    teams: tournament.teams,
    matchDurationMinutes: tournament.groupPhaseGameDuration ?? tournament.gameDuration ?? 10,
    minBreakMinutes: tournament.groupPhaseBreakDuration || 2,
    checkRefereeConflicts: tournament.refereeConfig?.mode !== 'none',
    checkFieldConflicts: true,
    enabled: isEditing,
  });

  // Drag and drop - now supports SWAPPING when dropping on occupied slot
  // Uses ATOMIC UPDATE to avoid race conditions
  const handleMoveMatch = useCallback(
    (matchId: string, targetSlot: TimeSlotType) => {
      // SAVE TO HISTORY BEFORE MAKING CHANGES (for undo)
      saveToHistory();

      // Find the source match to get its original position
      const sourceMatch = tournament.matches.find(m => m.id === matchId);
      if (!sourceMatch) {return;}

      const sourceTime = sourceMatch.scheduledTime;
      const sourceField = sourceMatch.field ?? 1;

      // Check if target slot already has a match (for swapping)
      const targetMatch = tournament.matches.find(
        m =>
          formatTime(m.scheduledTime) === targetSlot.startTime &&
          m.field === targetSlot.fieldId &&
          m.id !== matchId
      );

      // Parse target time - need to create a proper Date from the time string
      // The targetSlot.startTime is a formatted string like "14:00"
      // We need to combine it with the source match's date
      const targetTimeDate = (() => {
        const sourceDate = sourceMatch.scheduledTime instanceof Date
          ? sourceMatch.scheduledTime
          : new Date(sourceMatch.scheduledTime!);
        const [hours, minutes] = targetSlot.startTime.split(':').map(Number);
        const newDate = new Date(sourceDate);
        newDate.setHours(hours, minutes, 0, 0);
        return newDate;
      })();

      // ATOMIC UPDATE: Update all matches in a single operation to avoid race conditions
      const updatedMatches = tournament.matches.map(m => {
        if (m.id === matchId) {
          // Source match moves to target position
          return {
            ...m,
            scheduledTime: targetTimeDate,
            field: targetSlot.fieldId,
          };
        }
        if (targetMatch && m.id === targetMatch.id) {
          // Target match moves to source position (swap)
          return {
            ...m,
            scheduledTime: sourceTime,
            field: sourceField,
          };
        }
        return m;
      });

      // Single update call - no race condition!
      onTournamentUpdate({
        ...tournament,
        matches: updatedMatches,
        updatedAt: new Date().toISOString(),
      });
    },
    [tournament, onTournamentUpdate, saveToHistory]
  );

  // Always allow drop - we handle swapping in handleMoveMatch
  const validateDrop = useCallback(
    (_matchId: string, _targetSlot: TimeSlotType): boolean => {
      // Always allow - swapping is handled in handleMoveMatch
      return true;
    },
    []
  );

  const {
    sensors,
    activeId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useDragDrop({
    enabled: isEditing,
    onMoveMatch: handleMoveMatch,
    validateDrop,
  });

  // Build schedule grid
  const scheduleGrid = useMemo(
    () => groupMatchesByTimeSlot(filteredMatches, tournament.numberOfFields),
    [filteredMatches, tournament.numberOfFields]
  );

  // Handle save
  const handleSave = useCallback(async () => {
    if (conflictResult.hasErrors) {
      setIsConflictDialogOpen(true);
      return;
    }
    await saveChanges();
  }, [conflictResult.hasErrors, saveChanges]);

  // Handle save anyway (for warnings only)
  const handleSaveAnyway = useCallback(async () => {
    await saveChanges();
    setIsConflictDialogOpen(false);
  }, [saveChanges]);

  // Handle auto-reassign
  const handleAutoReassign = useCallback(() => {
    const result = autoReassignReferees(
      tournament.matches,
      tournament.refereeConfig,
      { target: 'referee', optimizeForFairness: true }
    );

    for (const change of result.changes) {
      updateMatchReferee(change.matchId, change.newValue as number);
    }
  }, [tournament.matches, tournament.refereeConfig, updateMatchReferee]);

  // Handle balance workloads
  const handleBalanceWorkloads = useCallback(() => {
    const result = balanceRefereeWorkloads(
      tournament.matches,
      tournament.refereeConfig
    );

    for (const change of result.changes) {
      updateMatchReferee(change.matchId, change.newValue as number);
    }
  }, [tournament.matches, tournament.refereeConfig, updateMatchReferee]);

  // Handle unskip match
  const handleUnskip = useCallback(
    (matchId: string) => {
      unskipMatch(matchId);
    },
    [unskipMatch]
  );

  // Get referee stats
  const refereeStats = useMemo(
    () => getRefereeStats(tournament.matches, tournament.refereeConfig),
    [tournament.matches, tournament.refereeConfig]
  );

  // Check if there are unsaved changes (using local history)
  // Note: historyVersion is read to ensure re-render when history changes
  const canUndoLocal = historyVersion >= 0 && undoStackRef.current.length > 0;
  const canRedoLocal = historyVersion >= 0 && redoStackRef.current.length > 0;
  const hasUnsavedChanges = canUndoLocal;

  // Toggle mode (only used when NOT in external control mode)
  const handleToggleMode = useCallback(() => {
    // Don't toggle if parent controls the mode
    if (externalEditMode !== undefined) {return;}

    if (state.mode === 'edit') {
      // Clear local history when exiting edit mode
      clearHistory();
      if (hasUnsavedChanges) {
        discardChanges();
      }
      exitEditMode();
    } else {
      // Clear history when entering edit mode (fresh start)
      clearHistory();
      enterEditMode();
    }
  }, [state.mode, hasUnsavedChanges, enterEditMode, exitEditMode, discardChanges, clearHistory, externalEditMode]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div style={containerStyle}>
        {/* Toolbar - hidden when parent provides unified toolbar */}
        {!hideToolbar && (
          <EditorToolbar
            mode={state.mode}
            onToggleMode={handleToggleMode}
            onSave={handleSave}
            onDiscard={discardChanges}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndoLocal}
            canRedo={canRedoLocal}
            isDirty={hasUnsavedChanges}
            conflicts={conflictResult.conflicts}
            readOnly={readOnly}
          />
        )}

        {/* Auto-reassign buttons (edit mode only) */}
        {isEditing && tournament.refereeConfig?.mode === 'organizer' && (
          <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Button variant="ghost" size="sm" onClick={handleAutoReassign}>
              SR automatisch zuweisen
            </Button>
            <Button variant="ghost" size="sm" onClick={handleBalanceWorkloads}>
              SR-Auslastung ausgleichen
            </Button>
            {conflictResult.conflicts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsConflictDialogOpen(true)}
              >
                {conflictResult.errorCount} Fehler / {conflictResult.warningCount} Warnungen
              </Button>
            )}
          </div>
        )}

        {/* Field Headers */}
        <div style={fieldHeaderContainerStyle}>
          {Array.from({ length: tournament.numberOfFields }, (_, i) => (
            <div key={i + 1} style={fieldHeaderStyle}>
              Feld {i + 1}
            </div>
          ))}
        </div>

        {/* Schedule Grid */}
        <div style={gridContainerStyle}>
          {Array.from(scheduleGrid.entries()).map(([time, fieldsMap]) => (
            <div key={time} style={timeRowStyle}>
              {/* Time header */}
              <div style={timeHeaderStyle}>{time}</div>

              {/* Fields */}
              <div style={fieldsRowStyle}>
                {Array.from({ length: tournament.numberOfFields }, (_, i) => {
                  const fieldId = i + 1;
                  const match = fieldsMap.get(fieldId);

                  return (
                    <TimeSlot
                      key={createSlotId(time, fieldId)}
                      time={time}
                      fieldId={fieldId}
                      hasMatch={!!match}
                      isDragActive={!!activeId}
                      isValidDropTarget={isEditing}
                    >
                      {match && (
                        <DraggableMatch
                          match={match}
                          teams={tournament.teams}
                          isEditing={isEditing}
                          isSelected={state.selectedMatchId === match.id}
                          conflicts={conflictResult.getMatchConflicts(match.id)}
                          onSelect={() => selectMatch(match.id)}
                          onUnskip={() => handleUnskip(match.id)}
                          draggable={isEditing}
                          compact={compact}
                        />
                      )}
                    </TimeSlot>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Referee Stats (edit mode only) */}
        {isEditing && refereeStats.length > 0 && (
          <div style={statsContainerStyle}>
            <span style={{ ...statItemStyle, fontWeight: fontWeights.semibold }}>
              SR-Auslastung:
            </span>
            {refereeStats.map(stat => (
              <div key={stat.refereeId} style={statItemStyle}>
                <span>{stat.name}:</span>
                <span style={{ fontWeight: fontWeights.medium }}>
                  {stat.count} Spiele ({stat.percentage}%)
                </span>
              </div>
            ))}
          </div>
        )}

        {/* NOTE: No DragOverlay - items transform in-place with visual feedback */}

        {/* Conflict Dialog */}
        <ConflictDialog
          isOpen={isConflictDialogOpen}
          onClose={() => setIsConflictDialogOpen(false)}
          conflicts={conflictResult.conflicts}
          matches={tournament.matches}
          onSaveAnyway={!conflictResult.hasErrors ? handleSaveAnyway : undefined}
          onAutoResolve={handleAutoReassign}
          canAutoResolve={tournament.refereeConfig?.mode === 'organizer'}
        />
      </div>
    </DndContext>
  );
};

export default ScheduleEditor;
