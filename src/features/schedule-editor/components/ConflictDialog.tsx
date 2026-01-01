/**
 * US-SCHEDULE-EDITOR: ConflictDialog Component
 *
 * Modal dialog for displaying and managing schedule conflicts.
 * Features:
 * - Grouped conflict display
 * - Severity indicators
 * - Resolution suggestions
 * - "Save anyway" option for warnings
 */

import React, { useMemo } from 'react';
import { ScheduleConflict, ConflictType } from '../types';
import { Match } from '../../../types/tournament';
import { cssVars } from '../../../design-tokens'
import { Button } from '../../../components/ui';
import { getConflictTypeLabel, groupConflictsByType } from '../utils/scheduleConflicts';

// ============================================================================
// Types
// ============================================================================

interface ConflictDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** All detected conflicts */
  conflicts: ScheduleConflict[];
  /** All matches (for context) */
  matches: Match[];
  /** Callback to save despite warnings (if no errors) */
  onSaveAnyway?: () => void;
  /** Callback to auto-resolve conflicts */
  onAutoResolve?: () => void;
  /** Whether auto-resolve is available */
  canAutoResolve?: boolean;
  /** Title override */
  title?: string;
}

// ============================================================================
// Styles
// ============================================================================

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: cssVars.colors.overlayStrong,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: cssVars.spacing.lg,
  zIndex: 1000,
};

const dialogStyle: React.CSSProperties = {
  backgroundColor: cssVars.colors.surface,
  borderRadius: cssVars.borderRadius.lg,
  boxShadow: cssVars.shadows.lg,
  maxWidth: '600px',
  width: '100%',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: cssVars.spacing.lg,
  borderBottom: `1px solid ${cssVars.colors.border}`,
};

const titleStyle: React.CSSProperties = {
  fontSize: cssVars.fontSizes.lg,
  fontWeight: cssVars.fontWeights.semibold,
  color: cssVars.colors.textPrimary,
  display: 'flex',
  alignItems: 'center',
  gap: cssVars.spacing.sm,
};

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: cssVars.fontSizes.xl,
  color: cssVars.colors.textSecondary,
  cursor: 'pointer',
  padding: cssVars.spacing.xs,
  lineHeight: 1,
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: cssVars.spacing.lg,
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: cssVars.spacing.sm,
  padding: cssVars.spacing.lg,
  borderTop: `1px solid ${cssVars.colors.border}`,
  backgroundColor: cssVars.colors.background,
};

const summaryStyle: React.CSSProperties = {
  display: 'flex',
  gap: cssVars.spacing.md,
  marginBottom: cssVars.spacing.lg,
  padding: cssVars.spacing.md,
  backgroundColor: cssVars.colors.background,
  borderRadius: cssVars.borderRadius.md,
};

const summaryItemStyle = (isError: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: cssVars.spacing.xs,
  fontSize: cssVars.fontSizes.sm,
  color: isError ? cssVars.colors.error : cssVars.colors.warning,
  fontWeight: cssVars.fontWeights.medium,
});

const groupStyle: React.CSSProperties = {
  marginBottom: cssVars.spacing.lg,
};

const groupHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: cssVars.spacing.sm,
  marginBottom: cssVars.spacing.sm,
  fontSize: cssVars.fontSizes.md,
  fontWeight: cssVars.fontWeights.semibold,
  color: cssVars.colors.textPrimary,
};

const conflictListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.sm,
};

const conflictItemStyle = (severity: 'error' | 'warning'): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.xs,
  padding: cssVars.spacing.md,
  backgroundColor: severity === 'error'
    ? cssVars.colors.editorErrorRowBg
    : cssVars.colors.editorDirtyRowBg,
  border: `1px solid ${severity === 'error' ? cssVars.colors.error : cssVars.colors.warning}`,
  borderRadius: cssVars.borderRadius.md,
});

const conflictMessageStyle: React.CSSProperties = {
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textPrimary,
};

const conflictSuggestionStyle: React.CSSProperties = {
  fontSize: cssVars.fontSizes.xs,
  color: cssVars.colors.textSecondary,
  fontStyle: 'italic',
};

const conflictMatchesStyle: React.CSSProperties = {
  display: 'flex',
  gap: cssVars.spacing.xs,
  flexWrap: 'wrap',
  marginTop: cssVars.spacing.xs,
};

const matchBadgeStyle: React.CSSProperties = {
  fontSize: cssVars.fontSizes.xs,
  color: cssVars.colors.textSecondary,
  backgroundColor: cssVars.colors.surface,
  padding: `2px ${cssVars.spacing.sm}`,
  borderRadius: cssVars.borderRadius.sm,
  border: `1px solid ${cssVars.colors.border}`,
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: cssVars.spacing.xl,
  textAlign: 'center',
  color: cssVars.colors.textSecondary,
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatTime(date: Date | string | undefined): string {
  if (!date) {return '--:--';}
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function getConflictTypeIcon(type: ConflictType): string {
  switch (type) {
    case 'team_double_booking':
      return '👥';
    case 'referee_double_booking':
      return '🎗️';
    case 'field_overlap':
      return '🏟️';
    case 'break_violation':
      return '⏱️';
    case 'dependency_violation':
      return '🔗';
    default:
      return '⚠️';
  }
}

// ============================================================================
// Component
// ============================================================================

export const ConflictDialog: React.FC<ConflictDialogProps> = ({
  isOpen,
  onClose,
  conflicts,
  matches,
  onSaveAnyway,
  onAutoResolve,
  canAutoResolve = false,
  title = 'Konflikte im Spielplan',
}) => {
  // Group conflicts by type
  const groupedConflicts = useMemo(() => groupConflictsByType(conflicts), [conflicts]);

  // Count by severity
  const { errorCount, warningCount } = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    for (const conflict of conflicts) {
      if (conflict.severity === 'error') {errors++;}
      else {warnings++;}
    }
    return { errorCount: errors, warningCount: warnings };
  }, [conflicts]);

  const hasErrors = errorCount > 0;

  if (!isOpen) {return null;}

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={titleStyle}>
            <span>{hasErrors ? '⚠️' : '⚡'}</span>
            <span>{title}</span>
          </div>
          <button style={closeButtonStyle} onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>

        {/* Content */}
        <div style={contentStyle}>
          {conflicts.length === 0 ? (
            <div style={emptyStateStyle}>
              <span style={{ fontSize: '48px', marginBottom: cssVars.spacing.md }}>✅</span>
              <p style={{ fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.medium }}>
                Keine Konflikte gefunden
              </p>
              <p style={{ fontSize: cssVars.fontSizes.sm }}>
                Der Spielplan ist konfliktfrei.
              </p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div style={summaryStyle}>
                {errorCount > 0 && (
                  <div style={summaryItemStyle(true)}>
                    <span>⚠️</span>
                    <span>{errorCount} Fehler</span>
                  </div>
                )}
                {warningCount > 0 && (
                  <div style={summaryItemStyle(false)}>
                    <span>⚡</span>
                    <span>{warningCount} Warnungen</span>
                  </div>
                )}
              </div>

              {/* Grouped Conflicts */}
              {Array.from(groupedConflicts.entries()).map(([type, typeConflicts]) => (
                <div key={type} style={groupStyle}>
                  <div style={groupHeaderStyle}>
                    <span>{getConflictTypeIcon(type)}</span>
                    <span>{getConflictTypeLabel(type)}</span>
                    <span style={{
                      fontSize: cssVars.fontSizes.sm,
                      color: cssVars.colors.textSecondary,
                      fontWeight: cssVars.fontWeights.normal
                    }}>
                      ({typeConflicts.length})
                    </span>
                  </div>

                  <div style={conflictListStyle}>
                    {typeConflicts.map(conflict => (
                      <div key={conflict.id} style={conflictItemStyle(conflict.severity)}>
                        <div style={conflictMessageStyle}>{conflict.message}</div>

                        {conflict.suggestion && (
                          <div style={conflictSuggestionStyle}>
                            💡 {conflict.suggestion}
                          </div>
                        )}

                        {/* Affected matches */}
                        <div style={conflictMatchesStyle}>
                          {conflict.matchIds.map(matchId => {
                            const match = matches.find(m => m.id === matchId);
                            if (!match) {return null;}
                            return (
                              <span key={matchId} style={matchBadgeStyle}>
                                {formatTime(match.scheduledTime)} - Feld {match.field}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          {canAutoResolve && onAutoResolve && conflicts.length > 0 && (
            <Button variant="secondary" onClick={onAutoResolve}>
              Automatisch beheben
            </Button>
          )}

          {!hasErrors && onSaveAnyway && warningCount > 0 && (
            <Button variant="secondary" onClick={onSaveAnyway}>
              Trotzdem speichern
            </Button>
          )}

          <Button variant="primary" onClick={onClose}>
            {conflicts.length === 0 ? 'Schließen' : 'Verstanden'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Compact Conflict List (for inline display)
// ============================================================================

interface ConflictListProps {
  conflicts: ScheduleConflict[];
  maxItems?: number;
  onViewAll?: () => void;
}

export const ConflictList: React.FC<ConflictListProps> = ({
  conflicts,
  maxItems = 5,
  onViewAll,
}) => {
  const displayedConflicts = conflicts.slice(0, maxItems);
  const remainingCount = conflicts.length - maxItems;

  const listStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
  };

  const itemStyle = (severity: 'error' | 'warning'): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.xs,
    fontSize: cssVars.fontSizes.sm,
    color: severity === 'error' ? cssVars.colors.error : cssVars.colors.warning,
    padding: cssVars.spacing.xs,
    backgroundColor: severity === 'error'
      ? cssVars.colors.editorErrorRowBgLight
      : cssVars.colors.editorDirtyRowBgLight,
    borderRadius: cssVars.borderRadius.sm,
  });

  const moreButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: cssVars.colors.primary,
    fontSize: cssVars.fontSizes.sm,
    cursor: 'pointer',
    padding: cssVars.spacing.xs,
    textAlign: 'left',
  };

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <div style={listStyle}>
      {displayedConflicts.map(conflict => (
        <div key={conflict.id} style={itemStyle(conflict.severity)}>
          <span>{conflict.severity === 'error' ? '⚠️' : '⚡'}</span>
          <span>{conflict.message}</span>
        </div>
      ))}

      {remainingCount > 0 && onViewAll && (
        <button style={moreButtonStyle} onClick={onViewAll}>
          + {remainingCount} weitere Konflikte anzeigen
        </button>
      )}
    </div>
  );
};

export default ConflictDialog;
