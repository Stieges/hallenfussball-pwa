/**
 * US-SCHEDULE-EDITOR: TimeSlot Component
 *
 * A drop zone for matches in the schedule grid.
 * Shows visual feedback when a match is being dragged over.
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { colors, spacing, borderRadius, fontSizes } from '../../../design-tokens';
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
    padding: hasMatch ? 0 : spacing.sm,
    backgroundColor: isSwapTarget
      ? 'rgba(245, 158, 11, 0.15)' // Orange for swap
      : isDropTarget
        ? 'rgba(0, 176, 255, 0.15)'
        : isHighlighted
          ? 'rgba(0, 176, 255, 0.05)'
          : hasMatch
            ? colors.surface
            : colors.background,
    border: isSwapTarget
      ? `2px solid ${colors.warning}` // Orange border for swap
      : isDropTarget
        ? `2px solid ${colors.primary}`
        : isHighlighted
          ? `2px dashed rgba(0, 176, 255, 0.4)`
          : hasMatch
            ? `1px solid ${colors.border}`
            : `2px dashed ${colors.border}`,
    borderRadius: borderRadius.md,
    transition: 'all 150ms ease',
    display: 'flex',
    alignItems: 'stretch', // Match cards fill full height
    justifyContent: 'stretch', // Match cards fill full width
    boxShadow: isSwapTarget
      ? `0 0 0 3px rgba(245, 158, 11, 0.25), inset 0 0 20px rgba(245, 158, 11, 0.1)`
      : isDropTarget
        ? `0 0 0 3px rgba(0, 176, 255, 0.2), inset 0 0 20px rgba(0, 176, 255, 0.1)`
        : 'none',
  };

  const placeholderStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    color: isDropTarget ? colors.primary : colors.textSecondary,
    fontSize: fontSizes.sm,
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
    backgroundColor: isOver ? 'rgba(0, 176, 255, 0.1)' : 'transparent',
    border: hasMatch ? 'none' : `1px dashed ${isOver ? colors.primary : colors.border}`,
    borderRadius: borderRadius.sm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div ref={setNodeRef} style={style}>
      {hasMatch ? children : <span style={{ fontSize: fontSizes.xs, color: colors.textMuted }}>—</span>}
    </div>
  );
};

export default TimeSlot;
