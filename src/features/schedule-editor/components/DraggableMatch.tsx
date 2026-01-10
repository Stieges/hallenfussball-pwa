/**
 * US-SCHEDULE-EDITOR: DraggableMatch Component
 *
 * A match card that can be dragged to different time slots.
 * Shows match info, conflict indicators, and drag handles.
 */

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Match, Team } from '../../../types/tournament';
import { ScheduleConflict } from '../types';
import { cssVars } from '../../../design-tokens'
import { SkippedMatchOverlay, SkippedBadge } from './SkippedMatchOverlay';

// ============================================================================
// Types
// ============================================================================

interface DraggableMatchProps {
  /** The match to display */
  match: Match;
  /** All teams for name lookup */
  teams: Team[];
  /** Whether the editor is in edit mode */
  isEditing: boolean;
  /** Whether this match is currently selected */
  isSelected?: boolean;
  /** Conflicts involving this match */
  conflicts?: ScheduleConflict[];
  /** Click handler for selection */
  onSelect?: () => void;
  /** Callback to unskip */
  onUnskip?: () => void;
  /** Whether the match can be dragged */
  draggable?: boolean;
  /** Compact display mode */
  compact?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getTeamName(teamId: string, teams: Team[]): string {
  const team = teams.find(t => t.id === teamId);
  return team?.name || teamId;
}

function formatTime(date: Date | string | undefined): string {
  if (!date) { return '--:--'; }
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// ============================================================================
// Component
// ============================================================================

export const DraggableMatch: React.FC<DraggableMatchProps> = ({
  match,
  teams,
  isEditing,
  isSelected = false,
  conflicts = [],
  onSelect,
  onUnskip,
  draggable = true,
  compact = false,
}) => {
  // Determine if match can be dragged
  const canDrag =
    isEditing &&
    draggable &&
    match.matchStatus !== 'running' &&
    match.matchStatus !== 'finished' &&
    match.matchStatus !== 'skipped';

  // Setup draggable
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: match.id,
    disabled: !canDrag,
  });

  // Is this match skipped?
  const isSkipped = match.matchStatus === 'skipped';
  const isFinished = match.matchStatus === 'finished';
  const isRunning = match.matchStatus === 'running';

  // Has conflicts?
  const hasErrors = conflicts.some(c => c.severity === 'error');
  const hasWarnings = conflicts.some(c => c.severity === 'warning');

  // =========================================================================
  // Styles
  // =========================================================================

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%', // Fill container width
    height: '100%', // Fill container height
    // BUG-FIX: If dragging, don't move the original element (it acts as placeholder)
    // The visual movement is handled by DragOverlay
    transform: isDragging ? 'none' : CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : 'transform 200ms ease',
    zIndex: isDragging ? 1000 : 1, // High z-index when dragging
    touchAction: canDrag ? 'none' : 'auto',
    // When dragging: semi-transparent to see drop targets underneath
    opacity: isDragging ? 0.3 : (isSkipped ? 0.5 : 1),
  };

  const cardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs, // Reduced gap for compact layout
    padding: cssVars.spacing.md,
    height: '100%', // Fill parent height
    boxSizing: 'border-box',
    backgroundColor: isDragging
      ? cssVars.colors.secondaryLight // Light blue tint when dragging
      : isSelected
        ? cssVars.colors.statusLiveRowBg
        : isFinished
          ? cssVars.colors.editorEditModeRowBg
          : isRunning
            ? cssVars.colors.editorDirtyRowBg
            : cssVars.colors.surface,
    border: isDragging
      ? `2px dashed ${cssVars.colors.primary}` // BUG-FIX: Keep 2px (was 3px) to prevent layout shift
      : `2px solid ${isSelected
        ? cssVars.colors.primary
        : hasErrors
          ? cssVars.colors.error
          : hasWarnings
            ? cssVars.colors.warning
            : cssVars.colors.border
      }`,
    borderRadius: cssVars.borderRadius.md,
    boxShadow: isDragging
      ? 'none' // No shadow when dragging - simpler look
      : isSelected
        ? cssVars.shadows.md
        : cssVars.shadows.sm,
    cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'default',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: cssVars.spacing.xs,
  };

  const matchNumberStyle: React.CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
    fontWeight: cssVars.fontWeights.medium,
  };

  const timeStyle: React.CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
  };

  // Horizontal layout: "Team A vs Team B" or "Team A 2:1 Team B"
  const teamsContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row', // HORIZONTAL layout
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.md,
    flex: 1,
    padding: `${cssVars.spacing.sm} 0`,
  };

  const teamStyle: React.CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    // MOBILE-UX: No truncation - team names must be fully visible
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    flex: 1,
    textAlign: 'center',
  };

  const homeTeamStyle: React.CSSProperties = {
    ...teamStyle,
    textAlign: 'right',
  };

  const awayTeamStyle: React.CSSProperties = {
    ...teamStyle,
    textAlign: 'left',
  };

  const vsStyle: React.CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textMuted,
    padding: `0 ${cssVars.spacing.sm}`,
    flexShrink: 0,
  };

  const scoreContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    backgroundColor: cssVars.colors.background,
    borderRadius: cssVars.borderRadius.sm,
    border: `1px solid ${cssVars.colors.border}`,
    flexShrink: 0,
  };

  const scoreStyle: React.CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    minWidth: '20px',
    textAlign: 'center',
  };

  const scoreSeparatorStyle: React.CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textMuted,
    fontWeight: cssVars.fontWeights.medium,
  };

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: cssVars.spacing.sm,
    marginTop: 'auto',
    paddingTop: cssVars.spacing.sm,
    borderTop: `1px solid ${cssVars.colors.border}`,
  };

  const fieldBadgeStyle: React.CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
    backgroundColor: cssVars.colors.background,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.sm,
  };

  const conflictIndicatorStyle: React.CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.xs,
  };

  const dragHandleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    color: cssVars.colors.primary,
    backgroundColor: cssVars.colors.editorDragActiveBg,
    borderRadius: cssVars.borderRadius.sm,
    cursor: 'grab',
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.bold,
  };

  // =========================================================================
  // Render
  // =========================================================================

  const homeTeamName = getTeamName(match.teamA, teams);
  const awayTeamName = getTeamName(match.teamB, teams);
  const hasScore = match.scoreA !== undefined && match.scoreB !== undefined;

  return (
    <div
      ref={setNodeRef}
      style={containerStyle}
      onClick={onSelect}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
    >
      <div style={cardStyle}>
        {/* Header */}
        <div style={headerStyle}>
          {canDrag && (
            <div style={dragHandleStyle}>
              <span>⋮⋮</span>
            </div>
          )}
          <span style={matchNumberStyle}>Spiel {match.round}</span>
          <span style={timeStyle}>{formatTime(match.scheduledTime)}</span>
        </div>

        {/* Teams & Score - Horizontal Layout */}
        <div style={teamsContainerStyle}>
          <span style={homeTeamStyle}>{homeTeamName}</span>
          {hasScore ? (
            <div style={scoreContainerStyle}>
              <span style={scoreStyle}>{match.scoreA}</span>
              <span style={scoreSeparatorStyle}>:</span>
              <span style={scoreStyle}>{match.scoreB}</span>
            </div>
          ) : (
            <span style={vsStyle}>vs</span>
          )}
          <span style={awayTeamStyle}>{awayTeamName}</span>
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <span style={fieldBadgeStyle}>Feld {match.field}</span>

          {/* Status indicators */}
          {isSkipped && <SkippedBadge reason={match.skippedReason} />}

          {/* Conflict indicators */}
          {(hasErrors || hasWarnings) && (
            <div style={conflictIndicatorStyle}>
              {hasErrors && <span title="Konflikt">⚠️</span>}
              {hasWarnings && !hasErrors && <span title="Warnung">⚡</span>}
            </div>
          )}

          {/* Referee */}
          {match.referee && (
            <span style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary }}>
              SR {match.referee}
            </span>
          )}
        </div>
      </div>

      {/* Skipped Overlay */}
      {isSkipped && onUnskip && (
        <SkippedMatchOverlay
          match={match}
          onUnskip={onUnskip}
          showRestoreButton={isEditing}
          compact={compact}
        />
      )}
    </div>
  );
};

export default DraggableMatch;
