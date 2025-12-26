/**
 * US-SCHEDULE-EDITOR: Schedule Editor Types
 *
 * Types for the interactive schedule editor feature including:
 * - Conflict detection
 * - Editor state management
 * - Drag & drop operations
 * - Match changes tracking
 */

import { Match } from '../../types/tournament';

// ============================================================================
// Conflict Types
// ============================================================================

/**
 * Types of scheduling conflicts that can occur
 */
export type ConflictType =
  | 'team_double_booking'     // Same team plays in two matches at the same time
  | 'referee_double_booking'  // Same referee assigned to two matches at the same time
  | 'field_overlap'           // Same field has two matches at overlapping times
  | 'break_violation'         // Team doesn't have minimum break between matches
  | 'dependency_violation';   // Match depends on unfinished match result

/**
 * A detected scheduling conflict
 */
export interface ScheduleConflict {
  /** Unique identifier for this conflict */
  id: string;
  /** Type of conflict */
  type: ConflictType;
  /** How severe is this conflict */
  severity: 'error' | 'warning';
  /** IDs of matches involved in this conflict */
  matchIds: string[];
  /** Human-readable description of the conflict */
  message: string;
  /** Optional suggestion for resolving the conflict */
  suggestion?: string;
  /** Additional context data */
  context?: {
    teamId?: string;
    teamName?: string;
    fieldId?: number;
    refereeId?: number;
    requiredBreakMinutes?: number;
    actualBreakMinutes?: number;
  };
}

// ============================================================================
// Editor State Types
// ============================================================================

/**
 * Current mode of the schedule editor
 */
export type EditorMode = 'view' | 'edit';

/**
 * A single change to a match field
 */
export interface MatchChange {
  /** ID of the changed match */
  matchId: string;
  /** Which field was changed */
  field: keyof Match;
  /** Previous value */
  oldValue: unknown;
  /** New value */
  newValue: unknown;
  /** When the change was made */
  timestamp: number;
}

/**
 * Complete state of the schedule editor
 */
export interface EditorState {
  /** Current editor mode */
  mode: EditorMode;
  /** Currently selected match (for inline editing) */
  selectedMatchId: string | null;
  /** Match currently being dragged */
  draggedMatchId: string | null;
  /** All detected conflicts in current schedule */
  conflicts: ScheduleConflict[];
  /** Pending changes not yet saved */
  pendingChanges: MatchChange[];
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** History for undo functionality */
  undoStack: MatchChange[][];
  /** History for redo functionality */
  redoStack: MatchChange[][];
}

/**
 * Initial state for the editor
 */
export const initialEditorState: EditorState = {
  mode: 'view',
  selectedMatchId: null,
  draggedMatchId: null,
  conflicts: [],
  pendingChanges: [],
  isDirty: false,
  undoStack: [],
  redoStack: [],
};

// ============================================================================
// Drag & Drop Types
// ============================================================================

/**
 * Represents a time slot in the schedule grid
 */
export interface TimeSlot {
  /** Unique identifier for this slot */
  id: string;
  /** Start time of the slot (ISO string) */
  startTime: string;
  /** Field ID this slot belongs to */
  fieldId: number;
  /** Match currently in this slot (null if empty) */
  matchId: string | null;
  /** Whether this slot is a valid drop target */
  isDropTarget: boolean;
}

/**
 * Data passed during drag operations
 */
export interface DragData {
  matchId: string;
  originalSlot: TimeSlot;
}

/**
 * Result of a drop operation
 */
export interface DropResult {
  matchId: string;
  sourceSlot: TimeSlot;
  targetSlot: TimeSlot;
  success: boolean;
  conflicts?: ScheduleConflict[];
}

// ============================================================================
// Editor Actions
// ============================================================================

/**
 * Actions that can be dispatched to the editor
 */
export type EditorAction =
  | { type: 'ENTER_EDIT_MODE' }
  | { type: 'EXIT_EDIT_MODE' }
  | { type: 'SELECT_MATCH'; payload: string | null }
  | { type: 'SET_DRAGGING'; payload: string | null }
  | { type: 'UPDATE_MATCH'; payload: { matchId: string; updates: Partial<Match> } }
  | { type: 'MOVE_MATCH'; payload: { matchId: string; newTime: string; newField: number } }
  | { type: 'SKIP_MATCH'; payload: { matchId: string; reason: string } }
  | { type: 'UNSKIP_MATCH'; payload: { matchId: string } }
  | { type: 'SET_CONFLICTS'; payload: ScheduleConflict[] }
  | { type: 'ADD_CHANGE'; payload: MatchChange }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SAVE_CHANGES' }
  | { type: 'DISCARD_CHANGES' };

// ============================================================================
// Conflict Detection Options
// ============================================================================

/**
 * Configuration for conflict detection
 */
export interface ConflictDetectionConfig {
  /** Minimum break between matches for a team (in minutes) */
  minBreakMinutes: number;
  /** Match duration (in minutes) */
  matchDurationMinutes: number;
  /** Whether to check referee conflicts */
  checkRefereeConflicts: boolean;
  /** Whether to check field conflicts */
  checkFieldConflicts: boolean;
}

// ============================================================================
// Auto-Reassignment Types
// ============================================================================

/**
 * Result of an auto-reassignment operation
 */
export interface ReassignmentResult {
  /** Whether the reassignment was successful */
  success: boolean;
  /** Changes that were made */
  changes: MatchChange[];
  /** Conflicts that couldn't be resolved */
  unresolvedConflicts: ScheduleConflict[];
  /** Summary message */
  message: string;
}

/**
 * Options for auto-reassignment
 */
export interface ReassignmentOptions {
  /** Which aspect to reassign */
  target: 'referee' | 'field' | 'time' | 'all';
  /** Whether to use fairness optimization */
  optimizeForFairness: boolean;
  /** Match IDs to exclude from reassignment */
  excludeMatchIds?: string[];
}
