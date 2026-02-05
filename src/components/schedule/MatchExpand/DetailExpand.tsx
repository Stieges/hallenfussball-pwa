/**
 * DetailExpand - Detailed score editing with goal list
 *
 * Extended expand panel for finished matches:
 * - Score steppers for both teams
 * - Goal list with edit/delete capability
 * - Add goal button
 * - Cancel/Save actions
 *
 * @example
 * ```tsx
 * <DetailExpand
 *   homeTeam={{ id: '1', name: 'Team A' }}
 *   awayTeam={{ id: '2', name: 'Team B' }}
 *   homeScore={2}
 *   awayScore={1}
 *   goals={matchEvents.filter(e => e.type === 'GOAL')}
 *   onSave={(home, away, events) => updateMatch(home, away, events)}
 *   onCancel={() => setExpanded(false)}
 *   onAddGoal={() => openAddGoalDialog()}
 * />
 * ```
 */

import { type CSSProperties, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens'
import { ScoreStepper } from '../../ui/ScoreStepper';
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
}

export interface DetailExpandProps {
  /** Home team info */
  homeTeam: Team;
  /** Away team info */
  awayTeam: Team;
  /** Initial home score */
  homeScore: number;
  /** Initial away score */
  awayScore: number;
  /** Goal events for the match */
  goals?: GoalEvent[];
  /** Callback when save is clicked */
  onSave: (homeScore: number, awayScore: number, goals?: GoalEvent[]) => void;
  /** Callback when cancel is clicked */
  onCancel: () => void;
  /** Callback to add a new goal */
  onAddGoal?: () => void;
  /** Callback when a goal is edited */
  onEditGoal?: (goalId: string) => void;
  /** Callback when a goal is deleted */
  onDeleteGoal?: (goalId: string) => void;
  /** Disable save (e.g., during save operation) */
  isSaving?: boolean;
  /** Layout variant */
  variant?: 'mobile' | 'desktop';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatGoalTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DetailExpand: React.FC<DetailExpandProps> = ({
  homeTeam,
  awayTeam,
  homeScore: initialHomeScore,
  awayScore: initialAwayScore,
  goals = [],
  onSave,
  onCancel,
  onAddGoal,
  onEditGoal,
  onDeleteGoal,
  isSaving = false,
  variant = 'mobile',
}) => {
  const { t } = useTranslation('tournament');
  const [homeScore, setHomeScore] = useState(initialHomeScore);
  const [awayScore, setAwayScore] = useState(initialAwayScore);

  const hasChanges = homeScore !== initialHomeScore || awayScore !== initialAwayScore;
  const isDesktop = variant === 'desktop';

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isDesktop ? 'row' : 'column',
    gap: cssVars.spacing.md,
  };

  const scoresSectionStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
    flex: isDesktop ? '0 0 50%' : undefined,
  };

  const goalsSectionStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
    flex: isDesktop ? '1' : undefined,
  };

  const goalsHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: cssVars.spacing.xs,
    borderBottom: `1px solid ${cssVars.colors.border}`,
  };

  const goalsHeaderTextStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textSecondary,
  };

  const goalsListStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
    maxHeight: '200px',
    overflowY: 'auto',
  };

  const goalItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: cssVars.spacing.sm,
    backgroundColor: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.sm,
  };

  const goalInfoStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  };

  const goalTeamStyle: CSSProperties = {
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  };

  const goalNumberStyle = (hasNumber: boolean): CSSProperties => ({
    fontWeight: cssVars.fontWeights.bold,
    color: hasNumber ? cssVars.colors.textPrimary : cssVars.colors.warning,
    minWidth: '36px',
  });

  const goalTimeStyle: CSSProperties = {
    color: cssVars.colors.textSecondary,
    fontVariantNumeric: 'tabular-nums',
  };

  const goalActionsStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.xs,
  };

  const iconButtonStyle: CSSProperties = {
    padding: cssVars.spacing.xs,
    borderRadius: cssVars.borderRadius.sm,
    border: 'none',
    backgroundColor: 'transparent',
    color: cssVars.colors.textSecondary,
    cursor: 'pointer',
    fontSize: cssVars.fontSizes.md,
    lineHeight: 1,
    transition: 'color 0.15s ease, background-color 0.15s ease',
    minWidth: '32px',
    minHeight: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const emptyGoalsStyle: CSSProperties = {
    textAlign: 'center',
    padding: cssVars.spacing.md,
    color: cssVars.colors.textMuted,
    fontSize: cssVars.fontSizes.sm,
  };

  const actionsStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.sm,
    justifyContent: 'flex-end',
    paddingTop: cssVars.spacing.sm,
    borderTop: `1px solid ${cssVars.colors.border}`,
    marginTop: isDesktop ? 'auto' : undefined,
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSave = () => {
    onSave(homeScore, awayScore, goals);
  };

  const handleEditGoal = (goalId: string) => {
    if (onEditGoal) {
      onEditGoal(goalId);
    }
  };

  const handleDeleteGoal = (goalId: string) => {
    if (onDeleteGoal) {
      onDeleteGoal(goalId);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const sortedGoals = [...goals].sort((a, b) => a.timestampSeconds - b.timestampSeconds);

  return (
    <div style={containerStyle}>
      {/* Score Steppers Section */}
      <div style={scoresSectionStyle}>
        <ScoreStepper
          value={homeScore}
          onChange={setHomeScore}
          teamName={homeTeam.name}
          min={0}
          max={99}
        />
        <ScoreStepper
          value={awayScore}
          onChange={setAwayScore}
          teamName={awayTeam.name}
          min={0}
          max={99}
        />
      </div>

      {/* Goals Section */}
      <div style={goalsSectionStyle}>
        <div style={goalsHeaderStyle}>
          <span style={goalsHeaderTextStyle}>
            {t('matchExpand.details.goalScorers', { count: goals.length })}
          </span>
          {onAddGoal && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddGoal}
            >
              {t('matchExpand.details.addGoal')}
            </Button>
          )}
        </div>

        {/* Goals List */}
        {sortedGoals.length > 0 ? (
          <div style={goalsListStyle}>
            {sortedGoals.map((goal) => {
              const isHome = goal.teamId === homeTeam.id;
              // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty teamName should use fallback
              const teamName = goal.teamName || (isHome ? homeTeam.name : awayTeam.name);
              const hasNumber = goal.playerNumber !== undefined && goal.playerNumber > 0;

              return (
                <div key={goal.id} style={goalItemStyle}>
                  <div style={goalInfoStyle}>
                    <span>⚽</span>
                    <span style={goalTeamStyle}>{teamName}</span>
                    <span style={goalNumberStyle(hasNumber)}>
                      #{hasNumber ? goal.playerNumber : '__'}
                    </span>
                    <span style={goalTimeStyle}>
                      {formatGoalTime(goal.timestampSeconds)}
                    </span>
                  </div>
                  <div style={goalActionsStyle}>
                    {!hasNumber && onEditGoal && (
                      <button
                        style={iconButtonStyle}
                        onClick={() => handleEditGoal(goal.id)}
                        aria-label={t('matchExpand.details.addScorerAria')}
                        title={t('matchExpand.details.addNumberTitle')}
                      >
                        ✏️
                      </button>
                    )}
                    {onDeleteGoal && (
                      <button
                        style={iconButtonStyle}
                        onClick={() => handleDeleteGoal(goal.id)}
                        aria-label={t('matchExpand.details.deleteGoalAria')}
                        title={t('matchExpand.details.deleteTitle')}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={emptyGoalsStyle}>
            {t('matchExpand.details.noGoals')}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={actionsStyle}>
        <Button
          variant="secondary"
          size="md"
          onClick={onCancel}
          disabled={isSaving}
        >
          {t('matchExpand.details.cancel')}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
        >
          {isSaving ? t('matchExpand.details.saving') : t('matchExpand.details.save')}
        </Button>
      </div>
    </div>
  );
};

export default DetailExpand;
