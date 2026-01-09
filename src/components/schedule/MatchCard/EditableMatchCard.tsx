/**
 * EditableMatchCard - Wrapper for MatchCard in edit mode
 *
 * Enhances the standard MatchCard with editing capabilities:
 * - Drag handle for reordering (left side)
 * - SR badge with quick-edit popover
 * - Conflict indicator overlay
 * - Visual feedback for drag states
 *
 * Used in GroupStageSchedule when isEditing=true.
 */

import { type CSSProperties, useState, useRef, useCallback } from 'react';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { cssVars } from '../../../design-tokens'
import { MatchCard, type MatchCardProps } from './MatchCard';
import { ConflictBadge } from './ConflictBadge';
import { SRQuickEditPopover, type RefereeOption } from './SRQuickEditPopover';
import { formatReferee } from './utils';
import type { ScheduleConflict } from '../../../features/schedule-editor/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EditableMatchCardProps extends Omit<MatchCardProps, 'disabled' | 'referee'> {
  // ---------------------------------------------------------------------------
  // Drag & Drop
  // ---------------------------------------------------------------------------
  /** Whether this card can be dragged */
  canDrag?: boolean;
  /** Whether this card is currently being dragged */
  isDragging?: boolean;
  /** Whether another card is being dragged over this one */
  isDropTarget?: boolean;
  /** Drag handle attributes from @dnd-kit */
  dragHandleAttributes?: DraggableAttributes;
  /** Drag handle listeners from @dnd-kit */
  dragHandleListeners?: SyntheticListenerMap;

  // ---------------------------------------------------------------------------
  // Referee
  // ---------------------------------------------------------------------------
  /** Current referee assignment (number for organizer mode, string for teams mode) */
  referee?: number | string;
  /** Available referee options */
  refereeOptions?: RefereeOption[];
  /** Called when referee is changed */
  onRefereeChange?: (matchId: string, referee: number | string | null) => void;
  /** Referee display name (for custom names) */
  refereeName?: string;

  // ---------------------------------------------------------------------------
  // Conflicts
  // ---------------------------------------------------------------------------
  /** Conflicts affecting this match */
  conflicts?: ScheduleConflict[];

  // ---------------------------------------------------------------------------
  // Edit State
  // ---------------------------------------------------------------------------
  /** Whether this card has unsaved changes */
  hasUnsavedChanges?: boolean;
  /** Whether the match is locked (running/finished) */
  isLocked?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const EditableMatchCard: React.FC<EditableMatchCardProps> = ({
  // Drag & Drop
  canDrag = true,
  isDragging = false,
  isDropTarget = false,
  dragHandleAttributes,
  dragHandleListeners,

  // Referee
  referee,
  refereeOptions = [],
  onRefereeChange,
  refereeName,

  // Conflicts
  conflicts = [],

  // Edit State
  hasUnsavedChanges = false,
  isLocked = false,

  // Match card props
  matchId,
  ...matchCardProps
}) => {
  const [showSRPopover, setShowSRPopover] = useState(false);
  const srBadgeRef = useRef<HTMLButtonElement>(null);

  const hasConflicts = conflicts.length > 0;
  const hasReferee = referee !== undefined;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSRClick = useCallback(() => {
    if (refereeOptions.length > 0 && onRefereeChange) {
      setShowSRPopover(true);
    }
  }, [refereeOptions.length, onRefereeChange]);

  const handleSRSelect = useCallback(
    (value: number | string | null) => {
      if (onRefereeChange) {
        onRefereeChange(matchId, value);
      }
    },
    [matchId, onRefereeChange]
  );

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'stretch',
    gap: 0,
    opacity: isDragging ? 0.5 : 1,
    transition: 'opacity 0.15s ease, transform 0.15s ease',
    transform: isDragging ? 'scale(1.02)' : 'scale(1)',
  };

  const dragHandleStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    backgroundColor: isDropTarget
      ? cssVars.colors.editorSwapActive
      : hasUnsavedChanges
        ? cssVars.colors.editorDirtyRowBg
        : cssVars.colors.editorEditModeRowBg,
    borderRadius: `${cssVars.borderRadius.md} 0 0 ${cssVars.borderRadius.md}`,
    border: `1px solid ${
      isDropTarget
        ? cssVars.colors.primary
        : hasUnsavedChanges
          ? cssVars.colors.editorDirtyBorder
          : cssVars.colors.editorEditModeBorder
    }`,
    borderRight: 'none',
    cursor: canDrag && !isLocked ? 'grab' : 'not-allowed',
    color: isLocked ? cssVars.colors.textDisabled : cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.lg,
    transition: 'background-color 0.15s ease, border-color 0.15s ease',
  };

  const cardWrapperStyle: CSSProperties = {
    flex: 1,
    position: 'relative',
    borderRadius: canDrag ? `0 ${cssVars.borderRadius.md} ${cssVars.borderRadius.md} 0` : cssVars.borderRadius.md,
    overflow: 'hidden',
    border: isDropTarget
      ? `2px solid ${cssVars.colors.primary}`
      : hasUnsavedChanges
        ? `1px solid ${cssVars.colors.editorDirtyBorder}`
        : undefined,
    boxShadow: isDropTarget
      ? `0 0 12px ${cssVars.colors.primaryGlowLight}`
      : undefined,
  };

  const srBadgeStyle: CSSProperties = {
    position: 'absolute',
    top: cssVars.spacing.sm,
    right: cssVars.spacing.sm,
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `2px ${cssVars.spacing.sm}`,
    backgroundColor: hasReferee ? cssVars.colors.surfaceSolid : cssVars.colors.surfaceDark,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.medium,
    color: hasReferee ? cssVars.colors.textPrimary : cssVars.colors.textMuted,
    cursor: refereeOptions.length > 0 ? 'pointer' : 'default',
    transition: 'background-color 0.15s ease',
    zIndex: 5,
  };

  const lockedBadgeStyle: CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: cssVars.colors.overlayStrong,
    color: cssVars.colors.textMuted,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.medium,
    zIndex: 10,
    pointerEvents: 'none',
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      {/* Drag Handle */}
      {canDrag && (
        <div
          style={dragHandleStyle}
          {...(isLocked ? {} : dragHandleAttributes)}
          {...(isLocked ? {} : dragHandleListeners)}
          aria-label={isLocked ? 'Spiel kann nicht verschoben werden' : 'Ziehen zum Verschieben'}
        >
          {isLocked ? '🔒' : '⋮⋮'}
        </div>
      )}

      {/* Card Wrapper */}
      <div style={cardWrapperStyle}>
        {/* Match Card */}
        <MatchCard
          matchId={matchId}
          {...matchCardProps}
          disabled={true} // Disable normal interactions in edit mode
        />

        {/* SR Badge */}
        {refereeOptions.length > 0 && (
          <button
            ref={srBadgeRef}
            style={srBadgeStyle}
            onClick={handleSRClick}
            onMouseEnter={(e) => {
              if (refereeOptions.length > 0) {
                (e.currentTarget as HTMLElement).style.backgroundColor = cssVars.colors.surfaceHover;
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = hasReferee
                ? cssVars.colors.surfaceSolid
                : cssVars.colors.surfaceDark;
            }}
            aria-label="Schiedsrichter ändern"
            aria-haspopup="listbox"
            aria-expanded={showSRPopover}
          >
            <span>🎯</span>
            <span>{formatReferee(typeof referee === 'number' ? referee : undefined, refereeName) ?? 'Kein SR'}</span>
          </button>
        )}

        {/* Conflict Badge */}
        {hasConflicts && (
          <ConflictBadge
            conflicts={conflicts}
            position="top-left"
            size="md"
          />
        )}

        {/* Locked Overlay */}
        {isLocked && (
          <div style={lockedBadgeStyle}>
            Gesperrt (läuft/beendet)
          </div>
        )}
      </div>

      {/* SR Popover */}
      {showSRPopover && (
        <SRQuickEditPopover
          currentReferee={referee}
          options={refereeOptions}
          onSelect={handleSRSelect}
          onClose={() => setShowSRPopover(false)}
          anchorRef={srBadgeRef}
        />
      )}
    </div>
  );
};

export default EditableMatchCard;
