/**
 * GoalList - List of goals with management capabilities
 *
 * Displays all goals for a match with:
 * - Sortable list (by time)
 * - Edit capability for incomplete goals
 * - Delete capability
 * - Add new goal button
 *
 * @example
 * ```tsx
 * <GoalList
 *   goals={matchGoals}
 *   homeTeam={{ id: '1', name: 'Team A' }}
 *   awayTeam={{ id: '2', name: 'Team B' }}
 *   onEdit={(goalId) => openEditDialog(goalId)}
 *   onDelete={(goalId) => deleteGoal(goalId)}
 *   onAdd={() => openAddDialog()}
 * />
 * ```
 */

import { type CSSProperties } from 'react';
import {
  colors,
  spacing,
  fontSizes,
  fontWeights,
  borderRadius,
} from '../../../design-tokens';
import { GoalListItem } from './GoalListItem';
import { Button } from '../../ui/Button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Team {
  id: string;
  name: string;
}

export interface GoalEvent {
  id: string;
  teamId: string;
  teamName?: string;
  playerNumber?: number;
  timestampSeconds: number;
  assists?: number[];
  incomplete?: boolean;
}

export interface GoalListProps {
  /** List of goal events */
  goals: GoalEvent[];
  /** Home team info */
  homeTeam: Team;
  /** Away team info */
  awayTeam: Team;
  /** Callback when a goal is edited */
  onEdit?: (goalId: string) => void;
  /** Callback when a goal is deleted */
  onDelete?: (goalId: string) => void;
  /** Callback to add a new goal */
  onAdd?: () => void;
  /** Maximum height before scrolling */
  maxHeight?: number;
  /** Whether the list is disabled */
  disabled?: boolean;
  /** Show header with count */
  showHeader?: boolean;
  /** Compact mode (less padding) */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const GoalList: React.FC<GoalListProps> = ({
  goals,
  homeTeam,
  awayTeam,
  onEdit,
  onDelete,
  onAdd,
  maxHeight = 300,
  disabled = false,
  showHeader = true,
  compact = false,
}) => {
  // Sort goals by timestamp
  const sortedGoals = [...goals].sort((a, b) => a.timestampSeconds - b.timestampSeconds);

  // Count incomplete goals
  const incompleteCount = goals.filter(g =>
    g.incomplete || !g.playerNumber || g.playerNumber <= 0
  ).length;

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: compact ? spacing.xs : spacing.sm,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: compact ? spacing.xs : spacing.sm,
    borderBottom: `1px solid ${colors.border}`,
  };

  const headerTextStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.textSecondary,
  };

  const countBadgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '20px',
    height: '20px',
    padding: `0 ${spacing.xs}`,
    backgroundColor: colors.primaryLight,
    color: colors.primary,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    borderRadius: borderRadius.full,
  };

  const incompleteBadgeStyle: CSSProperties = {
    ...countBadgeStyle,
    backgroundColor: colors.warningLight,
    color: colors.warning,
  };

  const listStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
    maxHeight: `${maxHeight}px`,
    overflowY: 'auto',
    paddingRight: spacing.xs,
  };

  const emptyStyle: CSSProperties = {
    textAlign: 'center',
    padding: compact ? spacing.sm : spacing.md,
    color: colors.textMuted,
    fontSize: fontSizes.sm,
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getTeamName = (goal: GoalEvent): string => {
    if (goal.teamName) {
      return goal.teamName;
    }
    return goal.teamId === homeTeam.id ? homeTeam.name : awayTeam.name;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      {/* Header */}
      {showHeader && (
        <div style={headerStyle}>
          <div style={headerTextStyle}>
            <span>Torschützen</span>
            <span style={countBadgeStyle}>{goals.length}</span>
            {incompleteCount > 0 && (
              <span style={incompleteBadgeStyle} title="Fehlende Nummern">
                {incompleteCount} offen
              </span>
            )}
          </div>
          {onAdd && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAdd}
              disabled={disabled}
            >
              + Tor
            </Button>
          )}
        </div>
      )}

      {/* Goals List */}
      {sortedGoals.length > 0 ? (
        <div style={listStyle}>
          {sortedGoals.map((goal) => (
            <GoalListItem
              key={goal.id}
              teamName={getTeamName(goal)}
              playerNumber={goal.playerNumber}
              timestampSeconds={goal.timestampSeconds}
              assists={goal.assists}
              isIncomplete={goal.incomplete}
              onEdit={onEdit ? () => onEdit(goal.id) : undefined}
              onDelete={onDelete ? () => onDelete(goal.id) : undefined}
              disabled={disabled}
            />
          ))}
        </div>
      ) : (
        <div style={emptyStyle}>
          Keine Tore erfasst
        </div>
      )}
    </div>
  );
};

export default GoalList;
