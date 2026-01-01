/**
 * ScheduleConflictContent - Displays schedule conflict information
 *
 * Used inside ConfirmDialog to show critical errors and warnings
 * when saving a schedule with conflicts.
 */

import { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens'
import { ScheduleConflict } from '../../schedule-editor';

export interface ScheduleConflictContentProps {
  /** Critical conflicts (time overlaps, double bookings) */
  criticalConflicts: ScheduleConflict[];
  /** Warning conflicts (break violations) */
  warningConflicts: ScheduleConflict[];
}

export const ScheduleConflictContent: React.FC<ScheduleConflictContentProps> = ({
  criticalConflicts,
  warningConflicts,
}) => {
  const criticalSectionStyle: CSSProperties = {
    marginBottom: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    backgroundColor: cssVars.colors.editorErrorRowBg,
    border: `1px solid ${cssVars.colors.error}`,
    borderRadius: cssVars.borderRadius.md,
  };

  const criticalHeaderStyle: CSSProperties = {
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.error,
    marginBottom: cssVars.spacing.sm,
  };

  const warningSectionStyle: CSSProperties = {
    padding: cssVars.spacing.md,
    backgroundColor: cssVars.colors.editorSwapBg,
    border: `1px solid ${cssVars.colors.warning}`,
    borderRadius: cssVars.borderRadius.md,
  };

  const warningHeaderStyle: CSSProperties = {
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.warning,
    marginBottom: cssVars.spacing.sm,
  };

  const listStyle: CSSProperties = {
    margin: 0,
    paddingLeft: '20px',
  };

  const listItemStyle: CSSProperties = {
    color: cssVars.colors.textPrimary,
    marginBottom: cssVars.spacing.xs,
  };

  return (
    <div style={{ textAlign: 'left' }}>
      {criticalConflicts.length > 0 && (
        <div style={criticalSectionStyle}>
          <div style={criticalHeaderStyle}>
            ⛔ Kritische Fehler ({criticalConflicts.length})
          </div>
          <ul style={listStyle}>
            {criticalConflicts.map((c, i) => (
              <li key={i} style={listItemStyle}>
                {c.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warningConflicts.length > 0 && (
        <div style={warningSectionStyle}>
          <div style={warningHeaderStyle}>
            ⚠️ Warnungen ({warningConflicts.length})
          </div>
          <ul style={listStyle}>
            {warningConflicts.map((c, i) => (
              <li key={i} style={listItemStyle}>
                {c.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
