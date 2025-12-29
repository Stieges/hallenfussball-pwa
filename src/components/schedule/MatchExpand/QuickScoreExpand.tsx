/**
 * QuickScoreExpand - Quick score editing with steppers
 *
 * Inline expand panel for quick score adjustment:
 * - Two ScoreSteppers (Home/Away)
 * - Optional disclosure for goal scorers (Mobile)
 * - Cancel/Save action buttons
 *
 * @example
 * ```tsx
 * <QuickScoreExpand
 *   homeTeam={{ id: '1', name: 'Team A' }}
 *   awayTeam={{ id: '2', name: 'Team B' }}
 *   homeScore={2}
 *   awayScore={1}
 *   goalCount={3}
 *   onSave={(home, away) => updateMatch(home, away)}
 *   onCancel={() => setExpanded(false)}
 *   onShowGoals={() => setShowGoals(true)}
 * />
 * ```
 */

import { type CSSProperties, useState } from 'react';
import {
  colors,
  spacing,
  fontSizes,
  fontWeights,
  borderRadius,
} from '../../../design-tokens';
import { ScoreStepper } from '../../ui/ScoreStepper';
import { Button } from '../../ui/Button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Team {
  id: string;
  name: string;
}

export interface QuickScoreExpandProps {
  /** Home team info */
  homeTeam: Team;
  /** Away team info */
  awayTeam: Team;
  /** Initial home score */
  homeScore: number;
  /** Initial away score */
  awayScore: number;
  /** Number of recorded goals (for disclosure badge) */
  goalCount?: number;
  /** Callback when save is clicked */
  onSave: (homeScore: number, awayScore: number) => void;
  /** Callback when cancel is clicked */
  onCancel: () => void;
  /** Callback to show goal details (Mobile) */
  onShowGoals?: () => void;
  /** Disable save (e.g., during save operation) */
  isSaving?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const QuickScoreExpand: React.FC<QuickScoreExpandProps> = ({
  homeTeam,
  awayTeam,
  homeScore: initialHomeScore,
  awayScore: initialAwayScore,
  goalCount = 0,
  onSave,
  onCancel,
  onShowGoals,
  isSaving = false,
}) => {
  const [homeScore, setHomeScore] = useState(initialHomeScore);
  const [awayScore, setAwayScore] = useState(initialAwayScore);

  const hasChanges = homeScore !== initialHomeScore || awayScore !== initialAwayScore;

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
  };

  const steppersContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  };

  const disclosureStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.sm} 0`,
    cursor: 'pointer',
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    transition: 'color 0.15s ease',
  };

  const badgeStyle: CSSProperties = {
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

  const actionsStyle: CSSProperties = {
    display: 'flex',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    paddingTop: spacing.sm,
    borderTop: `1px solid ${colors.border}`,
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSave = () => {
    onSave(homeScore, awayScore);
  };

  const handleDisclosureClick = () => {
    if (onShowGoals) {
      onShowGoals();
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      {/* Score Steppers */}
      <div style={steppersContainerStyle}>
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

      {/* Goals Disclosure (Mobile only - shown when onShowGoals is provided) */}
      {onShowGoals && (
        <div
          style={disclosureStyle}
          onClick={handleDisclosureClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleDisclosureClick();
            }
          }}
          role="button"
          tabIndex={0}
          aria-expanded={false}
        >
          <span>▼ Torschützen</span>
          {goalCount > 0 && (
            <span style={badgeStyle}>{goalCount}</span>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div style={actionsStyle}>
        <Button
          variant="secondary"
          size="md"
          onClick={onCancel}
          disabled={isSaving}
        >
          Abbrechen
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
        >
          {isSaving ? 'Speichern...' : 'Speichern'}
        </Button>
      </div>
    </div>
  );
};

export default QuickScoreExpand;
