/**
 * ScheduleErrorBanner
 *
 * Displays schedule generation or publish errors in the tournament wizard.
 * Used in Step 6 (Overview/Preview) when schedule generation fails.
 */

import React, { CSSProperties } from 'react';
import { borderRadius, colors, fontSizes, fontWeights, spacing } from '../../../design-tokens';

export interface ScheduleErrorBannerProps {
  /** Error message to display */
  error: string;
  /** Title for the error (e.g., "Spielplan konnte nicht erstellt werden") */
  title: string;
  /** Button text */
  buttonText: string;
  /** Callback when dismiss button is clicked */
  onDismiss: () => void;
}

export const ScheduleErrorBanner: React.FC<ScheduleErrorBannerProps> = ({
  error,
  title,
  buttonText,
  onDismiss,
}) => {
  const containerStyle: CSSProperties = {
    marginBottom: spacing.xl,
    padding: spacing.md,
    background: colors.errorLight,
    border: `2px solid ${colors.error}4d`, // 30% opacity
    borderRadius: borderRadius.md,
  };

  const contentStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: spacing.md,
  };

  const iconStyle: CSSProperties = {
    color: colors.error,
    fontSize: fontSizes.xl,
    flexShrink: 0,
  };

  const bodyStyle: CSSProperties = {
    flex: 1,
  };

  const titleStyle: CSSProperties = {
    margin: `0 0 ${spacing.sm} 0`,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.error,
  };

  const messageStyle: CSSProperties = {
    margin: `0 0 ${spacing.md} 0`,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    lineHeight: '1.5',
  };

  const buttonStyle: CSSProperties = {
    padding: `${spacing.xs} ${spacing.sm}`,
    background: `${colors.error}33`, // 20% opacity
    border: `1px solid ${colors.error}66`, // 40% opacity
    borderRadius: borderRadius.sm,
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    cursor: 'pointer',
  };

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        <div style={iconStyle} aria-hidden="true">
          ⚠️
        </div>
        <div style={bodyStyle}>
          <h3 style={titleStyle}>{title}</h3>
          <p style={messageStyle}>{error}</p>
          <button onClick={onDismiss} style={buttonStyle} type="button">
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};
