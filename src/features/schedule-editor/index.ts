/**
 * US-SCHEDULE-EDITOR: Schedule Editor Feature
 *
 * Interactive schedule editor for modifying tournament schedules.
 * Features:
 * - Drag & drop match reordering
 * - Inline SR/field editing
 * - Conflict detection
 * - Skip/unskip matches
 * - Auto-reassignment
 */

// Main Component
export { ScheduleEditor } from './ScheduleEditor';

// Types
export * from './types';

// Hooks
export { useScheduleEditor } from './hooks/useScheduleEditor';
export type { UseScheduleEditorOptions, UseScheduleEditorReturn } from './hooks/useScheduleEditor';

export { useMatchConflicts, useMatchConflictsFromTournament } from './hooks/useMatchConflicts';
export type { UseMatchConflictsOptions, UseMatchConflictsReturn } from './hooks/useMatchConflicts';

export { useDragDrop, createSlotId, parseSlotId } from './hooks/useDragDrop';
export type { UseDragDropOptions, UseDragDropReturn } from './hooks/useDragDrop';

// Components
export { EditorToolbar, EditorToolbarCompact } from './components/EditorToolbar';
export { DraggableMatch } from './components/DraggableMatch';
export { TimeSlot, TimeSlotCompact } from './components/TimeSlot';
export { ConflictIndicator, ConflictBadge } from './components/ConflictIndicator';
export { SkippedMatchOverlay, SkippedBadge } from './components/SkippedMatchOverlay';
export { InlineMatchEditor, CompactInlineEditor } from './components/InlineMatchEditor';
export { ConflictDialog, ConflictList } from './components/ConflictDialog';

// Utilities
export {
  detectTeamConflicts,
  detectRefereeConflicts,
  detectFieldOverlaps,
  detectBreakViolations,
  detectAllConflicts,
  validateMatchChange,
  getConflictsForMatch,
  hasBlockingConflicts,
  groupConflictsByType,
  getConflictTypeLabel,
} from './utils/scheduleConflicts';

export {
  autoReassignReferees,
  redistributeAfterSkip,
  balanceRefereeWorkloads,
  getRefereeStats,
  redistributeFields,
  redistributeAll,
} from './utils/autoReassign';
