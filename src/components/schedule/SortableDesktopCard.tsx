/**
 * SortableDesktopCard - Desktop card with DnD support for edit mode
 *
 * Extracted from GroupStageSchedule.tsx for better maintainability.
 * Uses horizontal layout with drag handle, conflict badge, and inline SR/Field controls.
 */

import { type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cssVars, spacingSemantics } from '../../design-tokens'
import { ScheduledMatch } from '../../lib/scheduleGenerator';
import { Tournament } from '../../types/tournament';
import { getGroupShortCode } from '../../utils/displayNames';
import type { MatchCardStatus } from './MatchCard';
import type { ScheduleConflict } from '../../features/schedule-editor/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RefereeSelectOption {
  value: number;
  label: string;
}

export interface FieldSelectOption {
  value: number;
  label: string;
}

export interface SortableDesktopCardProps {
  /** Match data */
  match: ScheduledMatch;
  /** Current match status */
  status: MatchCardStatus;
  /** Displayed referee (from pending or actual) */
  displayedRef: number | null | undefined;
  /** Displayed field (from pending or actual) */
  displayedField: number | undefined;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Whether referee has pending changes */
  hasPendingRef: boolean;
  /** Whether field has pending changes */
  hasPendingField: boolean;
  /** Conflicts for this match */
  conflicts: ScheduleConflict[];
  /** Whether in edit mode */
  editingSchedule: boolean;
  /** Whether match swapping is enabled */
  canSwap: boolean;
  /** Tournament data for group name resolution */
  tournament?: Tournament;
  /** Whether to show group label (hide for single-group tournaments) */
  showGroupLabel?: boolean;
  /** Show referee selector */
  showReferees: boolean;
  /** Referee options for dropdown */
  refereeOptions: RefereeSelectOption[];
  /** Show field selector */
  showFields: boolean;
  /** Field options for dropdown */
  fieldOptions: FieldSelectOption[];
  /** Callback when referee changes */
  onRefereeChange?: (matchId: string, refereeNumber: number | null) => void;
  /** Callback when field changes */
  onFieldChange?: (matchId: string, fieldNumber: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SortableDesktopCard: React.FC<SortableDesktopCardProps> = ({
  match,
  status,
  displayedRef,
  displayedField,
  hasUnsavedChanges,
  hasPendingRef,
  hasPendingField,
  conflicts,
  editingSchedule,
  canSwap,
  tournament,
  showReferees,
  refereeOptions,
  showFields,
  fieldOptions,
  onRefereeChange,
  onFieldChange,
  showGroupLabel = true,
}) => {
  const isLocked = status === 'running' || status === 'finished';
  const canDrag = editingSchedule && canSwap && !isLocked;
  const hasConflicts = conflicts.length > 0;
  const hasErrors = conflicts.some((c) => c.severity === 'error');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: match.id,
    disabled: !canDrag,
  });

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    marginBottom: cssVars.spacing.sm,
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { opacity: 0.5, zIndex: 0 } : {}),
  };

  const rowWrapperStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'stretch',
    borderRadius: cssVars.borderRadius.md,
    overflow: 'hidden',
    border: `1px solid ${
      isOver && !isDragging
        ? cssVars.colors.primary
        : hasErrors
          ? cssVars.colors.error
          : hasConflicts
            ? cssVars.colors.warning
            : hasUnsavedChanges
              ? cssVars.colors.editorDirtyBorder
              : cssVars.colors.border
    }`,
    boxShadow: isOver && !isDragging ? `0 0 12px ${cssVars.colors.primaryGlowLight}` : undefined,
  };

  // Drag handle - touch target of 44px for accessibility
  const dragHandleStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: spacingSemantics.touchTarget, // 44px - accessible touch target
    minWidth: spacingSemantics.touchTarget,
    backgroundColor:
      isOver && !isDragging
        ? cssVars.colors.editorSwapActive
        : hasUnsavedChanges
          ? cssVars.colors.editorDirtyRowBg
          : cssVars.colors.editorEditModeRowBg,
    cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'not-allowed',
    color: isLocked ? cssVars.colors.textDisabled : cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.lg,
    touchAction: 'none',
    flexShrink: 0,
  };

  const contentStyle: CSSProperties = {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: showReferees
      ? 'auto auto auto 1fr auto 1fr auto auto'
      : 'auto auto 1fr auto 1fr auto auto',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    backgroundColor:
      isOver && !isDragging
        ? cssVars.colors.editorSwapActive
        : hasUnsavedChanges
          ? cssVars.colors.editorDirtyRowBg
          : status === 'running'
            ? cssVars.colors.statusLiveRowBg
            : cssVars.colors.surface,
  };

  // Conflict indicator - touch target of 44px
  const conflictIndicatorStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: cssVars.spacing.lg, // 24px visual indicator
    height: cssVars.spacing.lg,
    borderRadius: '50%',
    backgroundColor: hasErrors ? cssVars.colors.error : cssVars.colors.warning,
    color: cssVars.colors.onError,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.bold,
    cursor: 'help',
    flexShrink: 0,
  };

  const srSelectStyle: CSSProperties = {
    height: spacingSemantics.touchTarget, // 44px touch target
    padding: `0 ${cssVars.spacing.lg} 0 ${cssVars.spacing.sm}`,
    border: `1px solid ${hasPendingRef ? cssVars.colors.primary : cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    backgroundColor: cssVars.colors.background,
    color: cssVars.colors.textPrimary,
    cursor: 'pointer',
    minWidth: 60,
    // Fix: Prevent all options from rendering at once
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: spacingSemantics.touchTarget,
  };

  const fieldSelectStyle: CSSProperties = {
    height: spacingSemantics.touchTarget, // 44px touch target
    padding: `0 ${cssVars.spacing.lg} 0 ${cssVars.spacing.sm}`,
    border: `1px solid ${hasPendingField ? cssVars.colors.primary : cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    backgroundColor: cssVars.colors.background,
    color: cssVars.colors.textPrimary,
    cursor: 'pointer',
    minWidth: 60,
    // Fix: Prevent all options from rendering at once
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: spacingSemantics.touchTarget,
  };

  const timeStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: status === 'running' ? cssVars.colors.primary : cssVars.colors.textSecondary,
    fontVariantNumeric: 'tabular-nums',
    minWidth: 50,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    // MOBILE-UX: No truncation - team names must be fully visible
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
  };

  const vsStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textMuted,
    padding: `0 ${cssVars.spacing.sm}`,
  };

  const groupStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
    textAlign: 'right',
    minWidth: 45,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div ref={setNodeRef} style={containerStyle} data-match-card>
      <div style={rowWrapperStyle}>
        {/* Drag Handle */}
        <div
          style={dragHandleStyle}
          {...(canDrag ? { ...attributes, ...listeners } : {})}
          aria-label={isLocked ? 'Spiel kann nicht verschoben werden' : 'Ziehen zum Verschieben'}
        >
          {isLocked ? '🔒' : '⋮⋮'}
        </div>

        {/* Content */}
        <div style={contentStyle}>
          {/* Conflict Indicator */}
          {hasConflicts && (
            <div style={conflictIndicatorStyle} title={conflicts.map((c) => c.message).join('\n')}>
              {conflicts.length}
            </div>
          )}
          {!hasConflicts && <div style={{ width: cssVars.spacing.lg }} />}

          {/* SR Selector */}
          {showReferees && onRefereeChange && (
            <select
              value={displayedRef ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                onRefereeChange(match.id, value ? parseInt(value) : null);
              }}
              style={srSelectStyle}
              aria-label="Schiedsrichter"
            >
              <option value="">SR -</option>
              {refereeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  SR {opt.label}
                </option>
              ))}
            </select>
          )}

          {/* Time */}
          <div style={timeStyle}>{isDragging ? '↕️' : match.time}</div>

          {/* Home Team */}
          <div style={{ ...teamNameStyle, textAlign: 'right' }}>{match.homeTeam}</div>

          {/* VS */}
          <div style={vsStyle}>vs</div>

          {/* Away Team */}
          <div style={teamNameStyle}>{match.awayTeam}</div>

          {/* Field Selector */}
          {showFields && onFieldChange && (
            <select
              value={displayedField || 1}
              onChange={(e) => onFieldChange(match.id, parseInt(e.target.value))}
              style={fieldSelectStyle}
              aria-label="Feld"
            >
              {fieldOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  F{opt.label}
                </option>
              ))}
            </select>
          )}

          {/* Group */}
          <div style={groupStyle}>
            {showGroupLabel && match.group && match.group !== 'all' ? `Gr. ${getGroupShortCode(match.group, tournament)}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SortableDesktopCard;
