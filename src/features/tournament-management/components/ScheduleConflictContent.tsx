/**
 * ScheduleConflictContent - Displays schedule conflict information
 *
 * Used inside ConfirmDialog to show critical errors and warnings
 * when saving a schedule with conflicts.
 */

import { CSSProperties } from 'react';
import { colors, spacing, fontWeights, borderRadius } from '../../../design-tokens';
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
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.editorErrorRowBg,
    border: `1px solid ${colors.error}`,
    borderRadius: borderRadius.md,
  };

  const criticalHeaderStyle: CSSProperties = {
    fontWeight: fontWeights.semibold,
    color: colors.error,
    marginBottom: spacing.sm,
  };

  const warningSectionStyle: CSSProperties = {
    padding: spacing.md,
    backgroundColor: colors.editorSwapBg,
    border: `1px solid ${colors.warning}`,
    borderRadius: borderRadius.md,
  };

  const warningHeaderStyle: CSSProperties = {
    fontWeight: fontWeights.semibold,
    color: colors.warning,
    marginBottom: spacing.sm,
  };

  const listStyle: CSSProperties = {
    margin: 0,
    paddingLeft: '20px',
  };

  const listItemStyle: CSSProperties = {
    color: colors.textPrimary,
    marginBottom: spacing.xs,
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
