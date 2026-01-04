/**
 * ScoreHeader - Score display for MatchSummary
 *
 * Shows the final score prominently with edit capability.
 */

import { type CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoreHeaderProps {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  onEditScore?: () => void;
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScoreHeader({
  homeTeamName,
  awayTeamName,
  homeScore,
  awayScore,
  onEditScore,
  compact = false,
}: ScoreHeaderProps) {
  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: compact ? cssVars.spacing.sm : cssVars.spacing.md,
    padding: compact ? cssVars.spacing.md : cssVars.spacing.lg,
    backgroundColor: cssVars.colors.surfaceElevated,
    borderRadius: cssVars.borderRadius.lg,
    border: `1px solid ${cssVars.colors.border}`,
  };

  const teamsRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: compact ? cssVars.spacing.md : cssVars.spacing.xl,
    width: '100%',
  };

  const teamStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    flex: 1,
    maxWidth: compact ? 120 : 160,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: compact ? cssVars.fontSizes.sm : cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    textAlign: 'center',
    // MOBILE-UX: No truncation - team names must be fully visible
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    maxWidth: '100%',
  };

  const scoreContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: compact ? cssVars.spacing.sm : cssVars.spacing.md,
  };

  const scoreStyle: CSSProperties = {
    fontSize: compact ? '2rem' : '2.5rem',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
  };

  const separatorStyle: CSSProperties = {
    fontSize: compact ? cssVars.fontSizes.xl : '2rem',
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textSecondary,
  };

  const editButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    backgroundColor: 'transparent',
    color: cssVars.colors.primary,
    border: `1px solid ${cssVars.colors.primary}`,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
    minHeight: 40,
  };

  return (
    <div style={containerStyle}>
      <div style={teamsRowStyle}>
        <div style={teamStyle}>
          <span style={teamNameStyle}>{homeTeamName}</span>
        </div>
        <div style={scoreContainerStyle}>
          <span style={scoreStyle}>{homeScore}</span>
          <span style={separatorStyle}>:</span>
          <span style={scoreStyle}>{awayScore}</span>
        </div>
        <div style={teamStyle}>
          <span style={teamNameStyle}>{awayTeamName}</span>
        </div>
      </div>
      {onEditScore && (
        <button
          style={editButtonStyle}
          onClick={onEditScore}
          aria-label="Ergebnis bearbeiten"
        >
          ✏️ Ergebnis bearbeiten
        </button>
      )}
    </div>
  );
}

export default ScoreHeader;
