/**
 * StartMatchExpand - Confirmation to start a match
 *
 * Expand panel for starting a scheduled match:
 * - Match info display (teams)
 * - Confirmation message
 * - Cancel / Go to Cockpit buttons
 *
 * @example
 * ```tsx
 * <StartMatchExpand
 *   homeTeam={{ id: '1', name: 'Team A' }}
 *   awayTeam={{ id: '2', name: 'Team B' }}
 *   matchNumber={5}
 *   scheduledTime="09:00"
 *   field={1}
 *   onConfirm={() => navigate(`/cockpit/${matchId}`)}
 *   onCancel={() => setExpanded(false)}
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
import { Button } from '../../ui/Button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Team {
  id: string;
  name: string;
}

export interface StartMatchExpandProps {
  /** Home team info */
  homeTeam: Team;
  /** Away team info */
  awayTeam: Team;
  /** Match number for display */
  matchNumber?: number;
  /** Scheduled time */
  scheduledTime?: string;
  /** Field number */
  field?: number;
  /** Callback when user confirms (navigate to cockpit) */
  onConfirm: () => void;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Whether the action is in progress */
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTeamInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const StartMatchExpand: React.FC<StartMatchExpandProps> = ({
  homeTeam,
  awayTeam,
  matchNumber,
  scheduledTime,
  field,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
    textAlign: 'center',
  };

  const matchInfoStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  };

  const teamContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.xs,
  };

  const avatarStyle: CSSProperties = {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.onPrimary,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    maxWidth: '100px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const vsStyle: CSSProperties = {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.textSecondary,
  };

  const metaStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    gap: spacing.md,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  };

  const questionStyle: CSSProperties = {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    color: colors.textPrimary,
    padding: `${spacing.sm} 0`,
  };

  const hintStyle: CSSProperties = {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: `-${spacing.xs}`,
  };

  const actionsStyle: CSSProperties = {
    display: 'flex',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingTop: spacing.sm,
    borderTop: `1px solid ${colors.border}`,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      {/* Match Info */}
      <div style={matchInfoStyle}>
        <div style={teamContainerStyle}>
          <div style={avatarStyle}>{getTeamInitials(homeTeam.name)}</div>
          <span style={teamNameStyle}>{homeTeam.name}</span>
        </div>
        <span style={vsStyle}>VS</span>
        <div style={teamContainerStyle}>
          <div style={avatarStyle}>{getTeamInitials(awayTeam.name)}</div>
          <span style={teamNameStyle}>{awayTeam.name}</span>
        </div>
      </div>

      {/* Meta Info */}
      {(matchNumber || scheduledTime || field) && (
        <div style={metaStyle}>
          {matchNumber && <span>Spiel {matchNumber}</span>}
          {scheduledTime && <span>{scheduledTime} Uhr</span>}
          {field !== undefined && <span>Feld {field}</span>}
        </div>
      )}

      {/* Confirmation Question */}
      <div style={questionStyle}>
        Dieses Spiel jetzt starten?
      </div>
      <div style={hintStyle}>
        Das Spiel wird im Live-Cockpit geöffnet
      </div>

      {/* Action Buttons */}
      <div style={actionsStyle}>
        <Button
          variant="secondary"
          size="md"
          onClick={onCancel}
          disabled={isLoading}
        >
          Abbrechen
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading ? 'Wird gestartet...' : '→ Zum Cockpit'}
        </Button>
      </div>
    </div>
  );
};

export default StartMatchExpand;
