/**
 * useScheduleHistory - Unified Undo/Redo History for Schedule Editor
 *
 * Manages undo/redo stacks for match changes in both table and grid views.
 * Includes keyboard shortcuts (Ctrl+Z/Cmd+Z for undo, Ctrl+Y/Cmd+Shift+Z for redo).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Match } from '../../../types/tournament';

/**
 * State snapshot for history tracking
 */
interface HistoryState {
  matches: Match[];
  timestamp: number;
}

/**
 * Return type for useScheduleHistory hook
 */
export interface ScheduleHistoryControls {
  /** Save current state before making changes */
  saveToHistory: () => void;
  /** Undo last change */
  handleUndo: () => void;
  /** Redo previously undone change */
  handleRedo: () => void;
  /** Clear all history (e.g., when exiting edit mode) */
  clearHistory: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
}

interface UseScheduleHistoryParams {
  /** Current matches array */
  matches: Match[];
  /** Callback to update matches */
  onMatchesUpdate: (matches: Match[]) => void;
  /** Whether edit mode is active (for keyboard shortcuts) */
  isEditing: boolean;
}

/**
 * Hook for managing undo/redo history in schedule editing
 *
 * @example
 * ```tsx
 * const { saveToHistory, handleUndo, handleRedo, canUndo, canRedo, clearHistory } =
 *   useScheduleHistory({
 *     matches: tournament.matches,
 *     onMatchesUpdate: (matches) => onTournamentUpdate({ ...tournament, matches }),
 *     isEditing,
 *   });
 *
 * // Before making changes:
 * saveToHistory();
 * // ... make changes ...
 *
 * // Clear when exiting edit mode:
 * clearHistory();
 * ```
 */
export function useScheduleHistory({
  matches,
  onMatchesUpdate,
  isEditing,
}: UseScheduleHistoryParams): ScheduleHistoryControls {
  // History stacks using refs to avoid re-renders on every push
  const undoStackRef = useRef<HistoryState[]>([]);
  const redoStackRef = useRef<HistoryState[]>([]);

  // Version counter to force re-render for button state updates
  const [historyVersion, setHistoryVersion] = useState(0);

  /**
   * Save current state to undo stack before making changes
   */
  const saveToHistory = useCallback(() => {
    undoStackRef.current.push({
      matches: matches.map(m => ({ ...m })), // Deep copy
      timestamp: Date.now(),
    });
    // Clear redo stack when new change is made
    redoStackRef.current = [];
    setHistoryVersion(v => v + 1);
  }, [matches]);

  /**
   * Undo: Restore previous state
   */
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) {return;}

    // Save current state to redo stack
    redoStackRef.current.push({
      matches: matches.map(m => ({ ...m })),
      timestamp: Date.now(),
    });

    // Pop and apply previous state
    const previousState = undoStackRef.current.pop();
    if (!previousState) {return;} // Should never happen due to length check

    onMatchesUpdate(previousState.matches);
    setHistoryVersion(v => v + 1);
  }, [matches, onMatchesUpdate]);

  /**
   * Redo: Restore next state
   */
  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) {return;}

    // Save current state to undo stack
    undoStackRef.current.push({
      matches: matches.map(m => ({ ...m })),
      timestamp: Date.now(),
    });

    // Pop and apply next state
    const nextState = redoStackRef.current.pop();
    if (!nextState) {return;} // Should never happen due to length check

    onMatchesUpdate(nextState.matches);
    setHistoryVersion(v => v + 1);
  }, [matches, onMatchesUpdate]);

  /**
   * Clear history when exiting edit mode
   */
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

  return {
    saveToHistory,
    handleUndo,
    handleRedo,
    clearHistory,
    canUndo,
    canRedo,
  };
}
