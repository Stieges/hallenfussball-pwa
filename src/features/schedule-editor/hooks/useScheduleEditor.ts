/**
 * US-SCHEDULE-EDITOR: useScheduleEditor Hook
 *
 * Core state management hook for the schedule editor.
 * Provides:
 * - Editor mode management (view/edit)
 * - Match selection and updates
 * - Undo/Redo functionality
 * - Change tracking and persistence
 */

import { useReducer, useCallback, useMemo, useEffect } from 'react';
import { Match, Tournament } from '../../../types/tournament';
import type { MatchUpdate } from '../../../core/models/types';
import { diffMatchResultStatusUpdates } from '../../../core/services';
import {
  EditorState,
  EditorAction,
  MatchChange,
  initialEditorState,
} from '../types';

// ============================================================================
// Reducer
// ============================================================================

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'ENTER_EDIT_MODE':
      return {
        ...state,
        mode: 'edit',
      };

    case 'EXIT_EDIT_MODE':
      return {
        ...state,
        mode: 'view',
        selectedMatchId: null,
      };

    case 'SELECT_MATCH':
      return {
        ...state,
        selectedMatchId: action.payload,
      };

    case 'SET_DRAGGING':
      return {
        ...state,
        draggedMatchId: action.payload,
      };

    case 'SET_CONFLICTS':
      return {
        ...state,
        conflicts: action.payload,
      };

    case 'ADD_CHANGE':
      return {
        ...state,
        pendingChanges: [...state.pendingChanges, action.payload],
        isDirty: true,
        // Clear redo stack when new change is made
        redoStack: [],
      };

    case 'UNDO': {
      if (state.undoStack.length === 0) {return state;}
      const undoChanges = state.undoStack[state.undoStack.length - 1];
      return {
        ...state,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, undoChanges],
        pendingChanges: state.pendingChanges.filter(
          c => !undoChanges.some(uc => uc.matchId === c.matchId && uc.field === c.field)
        ),
        isDirty: state.undoStack.length > 1,
      };
    }

    case 'REDO': {
      if (state.redoStack.length === 0) {return state;}
      const redoChanges = state.redoStack[state.redoStack.length - 1];
      return {
        ...state,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, redoChanges],
        pendingChanges: [...state.pendingChanges, ...redoChanges],
        isDirty: true,
      };
    }

    case 'SAVE_CHANGES':
      return {
        ...state,
        pendingChanges: [],
        isDirty: false,
        undoStack: [],
        redoStack: [],
      };

    case 'DISCARD_CHANGES':
      return {
        ...initialEditorState,
        mode: state.mode,
      };

    default:
      return state;
  }
}

// ============================================================================
// Types
// ============================================================================

export interface UseScheduleEditorOptions {
  /** Tournament to edit */
  tournament: Tournament;
  /** Callback when tournament is updated */
  onTournamentUpdate: (tournament: Tournament) => void;
  /**
   * A2 Fixrunde 1 (Ruling AJ, I1: `.superpowers/sdd/2026-09-25-oktober-fundament-helfer/
   * task-A2-review.md`): local-state-only sync for `skipMatch`/`unskipMatch` -- the actual
   * persistence for those goes through `onMatchesUpdate` (targeted update), a full `save()`
   * skips STATUS columns for existing matches (A2).
   */
  onLocalTournamentUpdate: (tournament: Tournament) => void;
  onMatchesUpdate: (updates: MatchUpdate[]) => void;
  /** Optional initial mode */
  initialMode?: 'view' | 'edit';
}

export interface UseScheduleEditorReturn {
  /** Current editor state */
  state: EditorState;
  /** Whether in edit mode */
  isEditing: boolean;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Currently selected match */
  selectedMatch: Match | null;
  /** Can undo */
  canUndo: boolean;
  /** Can redo */
  canRedo: boolean;

  // Mode actions
  /** Enter edit mode */
  enterEditMode: () => void;
  /** Exit edit mode */
  exitEditMode: () => void;
  /** Toggle edit mode */
  toggleEditMode: () => void;

  // Selection actions
  /** Select a match */
  selectMatch: (matchId: string | null) => void;

  // Update actions
  /** Update match time */
  updateMatchTime: (matchId: string, newTime: Date | string) => void;
  /** Update match field */
  updateMatchField: (matchId: string, fieldId: number) => void;
  /** Update match referee */
  updateMatchReferee: (matchId: string, refereeId: number | undefined) => void;
  /** Skip a match */
  skipMatch: (matchId: string, reason: string) => void;
  /** Unskip a match */
  unskipMatch: (matchId: string) => void;

  // History actions
  /** Undo last change */
  undo: () => void;
  /** Redo last undone change */
  redo: () => void;

  // Persistence actions
  /** Save all pending changes */
  saveChanges: () => Promise<void>;
  /** Discard all pending changes */
  discardChanges: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useScheduleEditor(
  options: UseScheduleEditorOptions
): UseScheduleEditorReturn {
  const { tournament, onTournamentUpdate, onLocalTournamentUpdate, onMatchesUpdate, initialMode = 'view' } = options;

  // Initialize state
  const [state, dispatch] = useReducer(editorReducer, {
    ...initialEditorState,
    mode: initialMode,
  });

  // Get selected match
  const selectedMatch = useMemo(() => {
    if (!state.selectedMatchId) {return null;}
    return tournament.matches.find(m => m.id === state.selectedMatchId) ?? null;
  }, [state.selectedMatchId, tournament.matches]);

  // =========================================================================
  // Mode Actions
  // =========================================================================

  const enterEditMode = useCallback(() => {
    dispatch({ type: 'ENTER_EDIT_MODE' });
  }, []);

  const exitEditMode = useCallback(() => {
    if (state.isDirty) {
      // Could show confirmation dialog here
      console.warn('Exiting edit mode with unsaved changes');
    }
    dispatch({ type: 'EXIT_EDIT_MODE' });
  }, [state.isDirty]);

  const toggleEditMode = useCallback(() => {
    if (state.mode === 'view') {
      enterEditMode();
    } else {
      exitEditMode();
    }
  }, [state.mode, enterEditMode, exitEditMode]);

  // =========================================================================
  // Selection Actions
  // =========================================================================

  const selectMatch = useCallback((matchId: string | null) => {
    dispatch({ type: 'SELECT_MATCH', payload: matchId });
  }, []);

  // =========================================================================
  // Update Actions
  // =========================================================================

  const createChange = useCallback((
    matchId: string,
    field: keyof Match,
    oldValue: unknown,
    newValue: unknown
  ): MatchChange => ({
    matchId,
    field,
    oldValue,
    newValue,
    timestamp: Date.now(),
  }), []);

  const updateMatchTime = useCallback((matchId: string, newTime: Date | string) => {
    const match = tournament.matches.find(m => m.id === matchId);
    if (!match) {return;}

    const change = createChange(matchId, 'scheduledTime', match.scheduledTime, newTime);
    dispatch({ type: 'ADD_CHANGE', payload: change });

    // Apply change immediately to tournament
    const updatedMatches = tournament.matches.map(m =>
      m.id === matchId
        ? { ...m, scheduledTime: newTime instanceof Date ? newTime : new Date(newTime) }
        : m
    );

    onTournamentUpdate({
      ...tournament,
      matches: updatedMatches,
      updatedAt: new Date().toISOString(),
    });
  }, [tournament, onTournamentUpdate, createChange]);

  const updateMatchField = useCallback((matchId: string, fieldId: number) => {
    const match = tournament.matches.find(m => m.id === matchId);
    if (!match) {return;}

    const change = createChange(matchId, 'field', match.field, fieldId);
    dispatch({ type: 'ADD_CHANGE', payload: change });

    // Apply change immediately
    const updatedMatches = tournament.matches.map(m =>
      m.id === matchId ? { ...m, field: fieldId } : m
    );

    onTournamentUpdate({
      ...tournament,
      matches: updatedMatches,
      updatedAt: new Date().toISOString(),
    });
  }, [tournament, onTournamentUpdate, createChange]);

  const updateMatchReferee = useCallback((matchId: string, refereeId: number | undefined) => {
    const match = tournament.matches.find(m => m.id === matchId);
    if (!match) {return;}

    const change = createChange(matchId, 'referee', match.referee, refereeId);
    dispatch({ type: 'ADD_CHANGE', payload: change });

    // Apply change immediately
    const updatedMatches = tournament.matches.map(m =>
      m.id === matchId ? { ...m, referee: refereeId } : m
    );

    onTournamentUpdate({
      ...tournament,
      matches: updatedMatches,
      updatedAt: new Date().toISOString(),
    });
  }, [tournament, onTournamentUpdate, createChange]);

  const skipMatch = useCallback((matchId: string, reason: string) => {
    const match = tournament.matches.find(m => m.id === matchId);
    if (!match) {return;}

    const change = createChange(matchId, 'matchStatus', match.matchStatus, 'skipped');
    dispatch({ type: 'ADD_CHANGE', payload: change });

    // Apply change
    const updatedMatches = tournament.matches.map(m =>
      m.id === matchId
        ? {
            ...m,
            matchStatus: 'skipped' as const,
            skippedReason: reason,
            skippedAt: new Date().toISOString(),
          }
        : m
    );

    // A2 Fixrunde 1 (I1): local sync + targeted STATUS update instead of a full save (which
    // skips STATUS columns for existing matches, see A2).
    onLocalTournamentUpdate({
      ...tournament,
      matches: updatedMatches,
      updatedAt: new Date().toISOString(),
    });
    onMatchesUpdate(diffMatchResultStatusUpdates(tournament.matches, updatedMatches));
  }, [tournament, onLocalTournamentUpdate, onMatchesUpdate, createChange]);

  const unskipMatch = useCallback((matchId: string) => {
    const match = tournament.matches.find(m => m.id === matchId);
    if (!match) {return;}

    const change = createChange(matchId, 'matchStatus', match.matchStatus, 'scheduled');
    dispatch({ type: 'ADD_CHANGE', payload: change });

    // Apply change - remove skipped fields
    const updatedMatches = tournament.matches.map(m => {
      if (m.id !== matchId) {return m;}
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { skippedReason, skippedAt, ...rest } = m;
      return { ...rest, matchStatus: 'scheduled' as const };
    });

    // A2 Fixrunde 1 (I1): same targeted-update pattern as skipMatch above -- this ALSO fixes a
    // pre-existing gap noted in the A1 review (M1): the old `onTournamentUpdate()`-only path
    // never cleared `skipped_reason`/`skipped_at` in the cloud even before A2, because
    // `mapMatchUpdateToSupabase` skipped fields that were simply absent from the object (see its
    // A2-Fixrunde-1 doc comment). `diffMatchResultStatusUpdates` always includes every
    // result/status field as an explicit key, so the clear now actually persists.
    onLocalTournamentUpdate({
      ...tournament,
      matches: updatedMatches,
      updatedAt: new Date().toISOString(),
    });
    onMatchesUpdate(diffMatchResultStatusUpdates(tournament.matches, updatedMatches));
  }, [tournament, onLocalTournamentUpdate, onMatchesUpdate, createChange]);

  // =========================================================================
  // History Actions
  // =========================================================================

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
    // TODO: Apply undo to tournament
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
    // TODO: Apply redo to tournament
  }, []);

  // =========================================================================
  // Persistence Actions
  // =========================================================================

  const saveChanges = useCallback(async () => {
    // Changes are already applied immediately, just clear pending state
    dispatch({ type: 'SAVE_CHANGES' });
  }, []);

  const discardChanges = useCallback(() => {
    // TODO: Reload tournament from storage
    dispatch({ type: 'DISCARD_CHANGES' });
  }, []);

  // =========================================================================
  // Unsaved Changes Warning
  // =========================================================================

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.isDirty) {
        e.preventDefault();
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- Required for cross-browser compatibility
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.isDirty]);

  return {
    state,
    isEditing: state.mode === 'edit',
    isDirty: state.isDirty,
    selectedMatch,
    canUndo: state.undoStack.length > 0,
    canRedo: state.redoStack.length > 0,

    // Mode
    enterEditMode,
    exitEditMode,
    toggleEditMode,

    // Selection
    selectMatch,

    // Updates
    updateMatchTime,
    updateMatchField,
    updateMatchReferee,
    skipMatch,
    unskipMatch,

    // History
    undo,
    redo,

    // Persistence
    saveChanges,
    discardChanges,
  };
}

export default useScheduleEditor;
