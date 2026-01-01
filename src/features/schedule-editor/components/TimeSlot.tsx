/**
 * US-SCHEDULE-EDITOR: TimeSlot Component
 *
 * A drop zone for matches in the schedule grid.
 * Shows visual feedback when a match is being dragged over.
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cssVars } from '../../../design-tokens'
import { createSlotId } from '../hooks/useDragDrop';

// ============================================================================
// Types
// ============================================================================

interface TimeSlotProps {
  /** Time of this slot (ISO string or formatted) */
  time: string;
  /** Field ID */
  fieldId: number;
  /** Whether this slot has a match */
  hasMatch?: boolean;
  /** Whether a drag is currently in progress */
  isDragActive?: boolean;
  /** Whether this slot is a valid drop target for the current drag */
  isValidDropTarget?: boolean;
  /** Children (usually a DraggableMatch) */
  children?: React.ReactNode;
  /** Optional label for the time slot */
  timeLabel?: string;
  /** Optional label for the field */
  fieldLabel?: string;
}

// ============================================================================
// Component
// ============================================================================

export const TimeSlot: React.FC<TimeSlotProps> = ({
  time,
  fieldId,
  hasMatch = false,
  isDragActive = false,
  isValidDropTarget = true,
  children,
  timeLabel,
  fieldLabel,
}) => {
  const slotId = createSlotId(time, fieldId);

  // Setup droppable
  // IMPORTANT: Allow drops on slots with matches to enable swapping!
  const { setNodeRef, isOver } = useDroppable({
    id: slotId,
    disabled: !isValidDropTarget,
  });

  // Determine visual state
  // Slots with matches can still be drop targets for swapping
  const isHighlighted = isDragActive && isValidDropTarget;
  const isDropTarget = isOver && isValidDropTarget;

  // =========================================================================
  // Styles
  // =========================================================================

  // Swap indicator: when dropping on a slot that has a match
  const isSwapTarget = isDropTarget && hasMatch;

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    flex: 1, // KEY: Fill available width
    minHeight: hasMatch ? 'auto' : '80px',
    minWidth: 0, // Allow shrinking below content size
    padding: hasMatch ? 0 : cssVars.spacing.sm,
    backgroundColor: isSwapTarget
      ? cssVars.colors.editorSwapBg // Orange for swap
      : isDropTarget
        ? cssVars.colors.secondaryLight
        : isHighlighted
          ? cssVars.colors.editorDropTargetBg
          : hasMatch
            ? cssVars.colors.surface
            : cssVars.colors.background,
    border: isSwapTarget
      ? `2px solid ${cssVars.colors.warning}` // Orange border for swap
      : isDropTarget
        ? `2px solid ${cssVars.colors.primary}`
        : isHighlighted
          ? `2px dashed ${cssVars.colors.secondary}`
          : hasMatch
            ? `1px solid ${cssVars.colors.border}`
            : `2px dashed ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    transition: 'all 150ms ease',
    display: 'flex',
    alignItems: 'stretch', // Match cards fill full height
    justifyContent: 'stretch', // Match cards fill full width
    boxShadow: isSwapTarget
      ? `0 0 0 3px ${cssVars.colors.editorSwapActive}, inset 0 0 20px ${cssVars.colors.editorSwapBg}`
      : isDropTarget
        ? `0 0 0 3px ${cssVars.colors.secondaryLight}, inset 0 0 20px ${cssVars.colors.editorDropTargetBg}`
        : 'none',
  };

  const placeholderStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.xs,
    color: isDropTarget ? cssVars.colors.primary : cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.sm,
    textAlign: 'center',
    opacity: isDragActive ? 1 : 0.5,
  };

  const iconStyle: React.CSSProperties = {
    fontSize: '20px',
    opacity: isDragActive ? 1 : 0.3,
  };

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div ref={setNodeRef} style={containerStyle}>
      {hasMatch ? (
        children
      ) : (
        <div style={placeholderStyle}>
          <span style={iconStyle}>{isDropTarget ? '⬇️' : '+'}</span>
          {isDropTarget ? (
            <span>Hier ablegen</span>
          ) : isDragActive ? (
            <span>Hierher ziehen</span>
          ) : (
            <>
              {timeLabel && <span>{timeLabel}</span>}
              {fieldLabel && <span>{fieldLabel}</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Compact time slot for grid layouts
 */
interface TimeSlotCompactProps {
  time: string;
  fieldId: number;
  hasMatch?: boolean;
  children?: React.ReactNode;
}

export const TimeSlotCompact: React.FC<TimeSlotCompactProps> = ({
  time,
  fieldId,
  hasMatch = false,
  children,
}) => {
  const slotId = createSlotId(time, fieldId);

  const { setNodeRef, isOver } = useDroppable({
    id: slotId,
    disabled: hasMatch,
  });

  const style: React.CSSProperties = {
    minHeight: hasMatch ? 'auto' : '40px',
    backgroundColor: isOver ? cssVars.colors.editorDragActiveBg : 'transparent',
    border: hasMatch ? 'none' : `1px dashed ${isOver ? cssVars.colors.primary : cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.sm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div ref={setNodeRef} style={style}>
      {hasMatch ? children : <span style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textMuted }}>—</span>}
    </div>
  );
};

export default TimeSlot;
