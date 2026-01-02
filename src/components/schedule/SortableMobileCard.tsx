/**
 * SortableMobileCard - Mobile card with DnD support for edit mode
 *
 * Extracted from GroupStageSchedule.tsx for better maintainability.
 * Uses useSortable from @dnd-kit for drag and drop functionality.
 */

import { type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cssVars, spacingSemantics } from '../../design-tokens'
import { ScheduledMatch } from '../../lib/scheduleGenerator';
import { Tournament } from '../../types/tournament';
import { getGroupShortCode } from '../../utils/displayNames';
import { EditableMatchCard, type MatchCardStatus, type RefereeOption } from './MatchCard';
import type { ScheduleConflict } from '../../features/schedule-editor/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FieldOption {
  value: number;
  label: string;
}

export interface SortableMobileCardProps {
  /** Match data */
  match: ScheduledMatch;
  /** Current match status */
  status: MatchCardStatus;
  /** Whether card is expanded */
  isExpanded: boolean;
  /** Displayed referee (from pending or actual) */
  displayedRef: number | null | undefined;
  /** Displayed field (from pending or actual) */
  displayedField: number | undefined;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
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
  refereeOptions: RefereeOption[];
  /** Show field selector */
  showFields: boolean;
  /** Field options for dropdown */
  fieldOptions: FieldOption[];
  /** Callback when referee changes */
  onRefereeChange?: (matchId: string, refereeNumber: number | null) => void;
  /** Callback when field changes */
  onFieldChange?: (matchId: string, fieldNumber: number) => void;
  /** Callback when card body is clicked */
  onCardClick: (matchId: string) => void;
  /** Callback when score circle is clicked */
  onCircleClick: (matchId: string) => void;
  /** Render function for expand content */
  renderExpandContent: (match: ScheduledMatch) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SortableMobileCard: React.FC<SortableMobileCardProps> = ({
  match,
  status,
  isExpanded,
  displayedRef,
  displayedField,
  hasUnsavedChanges,
  hasPendingField,
  conflicts,
  editingSchedule,
  canSwap,
  tournament,
  showGroupLabel = true,
  showReferees,
  refereeOptions,
  showFields,
  fieldOptions,
  onRefereeChange,
  onFieldChange,
  onCardClick,
  onCircleClick,
  renderExpandContent,
}) => {
  const isLocked = status === 'running' || status === 'finished';
  const canDrag = editingSchedule && canSwap && !isLocked;

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

  const wrapperStyle: CSSProperties = {
    marginBottom: cssVars.spacing.sm,
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { opacity: 0.5, zIndex: 0 } : {}),
    ...(isOver && !isDragging ? { transform: CSS.Transform.toString(transform) } : {}),
  };

  const mobileSelectStyle: CSSProperties = {
    height: spacingSemantics.touchTarget, // 44px accessible touch target
    padding: `0 ${cssVars.spacing.lg} 0 ${cssVars.spacing.sm}`,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.semibold,
    cursor: 'pointer',
    backgroundColor: cssVars.colors.background,
    color: cssVars.colors.textPrimary,
    // Fix: Prevent all options from rendering at once
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: spacingSemantics.touchTarget,
  };

  // ---------------------------------------------------------------------------
  // Card Props
  // ---------------------------------------------------------------------------

  const cardProps = {
    matchId: match.id,
    matchNumber: match.matchNumber,
    scheduledTime: match.time,
    field: match.field,
    group: match.group ? getGroupShortCode(match.group, tournament) : undefined,
    showGroupLabel,
    homeTeam: { id: `${match.id}-home`, name: match.homeTeam },
    awayTeam: { id: `${match.id}-away`, name: match.awayTeam },
    homeScore: match.scoreA ?? 0,
    awayScore: match.scoreB ?? 0,
    status,
    progress: 0,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div ref={setNodeRef} style={wrapperStyle} data-match-card>
      <EditableMatchCard
        {...cardProps}
        canDrag={canDrag}
        isDragging={isDragging}
        isDropTarget={isOver && !isDragging}
        dragHandleAttributes={attributes}
        dragHandleListeners={listeners}
        isLocked={isLocked}
        hasUnsavedChanges={hasUnsavedChanges}
        referee={displayedRef ?? undefined}
        refereeOptions={showReferees ? refereeOptions : []}
        onRefereeChange={
          onRefereeChange
            ? (matchId, value) => {
                const numValue =
                  value === null ? null : typeof value === 'string' ? parseInt(value) : value;
                onRefereeChange(matchId, numValue);
              }
            : undefined
        }
        conflicts={conflicts}
        onCardClick={() => onCardClick(match.id)}
        onCircleClick={() => onCircleClick(match.id)}
        isExpanded={isExpanded}
        expandContent={renderExpandContent(match)}
      />

      {/* Edit mode: Field selector (shown below card) */}
      {editingSchedule && showFields && onFieldChange && (
        <div
          style={{
            display: 'flex',
            gap: cssVars.spacing.sm,
            marginTop: cssVars.spacing.xs,
            padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
            backgroundColor: cssVars.colors.surfaceLight,
            borderRadius: cssVars.borderRadius.sm,
          }}
        >
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textMuted }}>Feld</label>
            <select
              value={displayedField || 1}
              onChange={(e) => onFieldChange(match.id, parseInt(e.target.value))}
              style={{
                ...mobileSelectStyle,
                width: '100%',
                border: `1px solid ${hasPendingField ? cssVars.colors.primary : cssVars.colors.border}`,
              }}
            >
              {fieldOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default SortableMobileCard;
