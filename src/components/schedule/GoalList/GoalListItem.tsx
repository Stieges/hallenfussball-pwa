/**
 * GoalListItem - Single goal entry in the goal list
 *
 * Displays a goal with team, player number, and time:
 * - Complete: ⚽ Team A  #10   03:15   [🗑]
 * - Missing number: ⚽ Team A  #__   03:15   [✏️] [🗑]
 *
 * @example
 * ```tsx
 * <GoalListItem
 *   teamName="Team A"
 *   playerNumber={10}
 *   timestampSeconds={195}
 *   onEdit={() => openEditDialog(goalId)}
 *   onDelete={() => deleteGoal(goalId)}
 * />
 * ```
 */

import { type CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GoalListItemProps {
  /** Team name that scored */
  teamName: string;
  /** Player number (undefined = not recorded) */
  playerNumber?: number;
  /** Goal time in seconds */
  timestampSeconds: number;
  /** Assist player numbers */
  assists?: number[];
  /** Whether the goal needs completion (missing info) */
  isIncomplete?: boolean;
  /** Callback to edit the goal */
  onEdit?: () => void;
  /** Callback to delete the goal */
  onDelete?: () => void;
  /** Disable interactions */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const GoalListItem: React.FC<GoalListItemProps> = ({
  teamName,
  playerNumber,
  timestampSeconds,
  assists,
  isIncomplete = false,
  onEdit,
  onDelete,
  disabled = false,
}) => {
  const hasNumber = playerNumber !== undefined && playerNumber > 0;
  const needsEdit = !hasNumber || isIncomplete;

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: cssVars.spacing.sm,
    backgroundColor: needsEdit ? cssVars.colors.warningLight : cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.sm,
    border: needsEdit ? `1px solid ${cssVars.colors.warning}` : 'none',
    transition: 'background-color 0.15s ease',
  };

  const infoStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    flex: 1,
    minWidth: 0,
  };

  const iconStyle: CSSProperties = {
    fontSize: '16px',
    flexShrink: 0,
  };

  const teamStyle: CSSProperties = {
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.sm,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100px',
  };

  const numberStyle: CSSProperties = {
    fontWeight: cssVars.fontWeights.bold,
    color: hasNumber ? cssVars.colors.textPrimary : cssVars.colors.warning,
    fontSize: cssVars.fontSizes.sm,
    minWidth: '36px',
  };

  const assistsStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const timeStyle: CSSProperties = {
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.sm,
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  };

  const actionsStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.xs,
    marginLeft: cssVars.spacing.sm,
  };

  const iconButtonStyle: CSSProperties = {
    padding: cssVars.spacing.xs,
    borderRadius: cssVars.borderRadius.sm,
    border: 'none',
    backgroundColor: 'transparent',
    color: cssVars.colors.textSecondary,
    cursor: disabled ? 'default' : 'pointer',
    fontSize: '14px',
    lineHeight: 1,
    transition: 'color 0.15s ease, background-color 0.15s ease',
    minWidth: '32px',
    minHeight: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.5 : 1,
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleEdit = () => {
    if (!disabled && onEdit) {
      onEdit();
    }
  };

  const handleDelete = () => {
    if (!disabled && onDelete) {
      onDelete();
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      <div style={infoStyle}>
        <span style={iconStyle}>⚽</span>
        <span style={teamStyle}>{teamName}</span>
        <span style={numberStyle}>
          #{hasNumber ? playerNumber : '__'}
        </span>
        {assists && assists.length > 0 && (
          <span style={assistsStyle}>
            (Vorlage: {assists.map(n => `#${n}`).join(', ')})
          </span>
        )}
        <span style={timeStyle}>{formatTime(timestampSeconds)}</span>
      </div>

      <div style={actionsStyle}>
        {needsEdit && onEdit && (
          <button
            style={iconButtonStyle}
            onClick={handleEdit}
            disabled={disabled}
            aria-label="Torschütze nachtragen"
            title="Nummer nachtragen"
          >
            ✏️
          </button>
        )}
        {onDelete && (
          <button
            style={iconButtonStyle}
            onClick={handleDelete}
            disabled={disabled}
            aria-label="Tor löschen"
            title="Löschen"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
};

export default GoalListItem;
