/**
 * ScheduleErrorBanner
 *
 * Displays schedule generation or publish errors in the tournament wizard.
 * Used in Step 6 (Overview/Preview) when schedule generation fails.
 */

import React, { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens'

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
    marginBottom: cssVars.spacing.xl,
    padding: cssVars.spacing.md,
    background: cssVars.colors.errorLight,
    border: `2px solid ${cssVars.colors.error}4d`, // 30% opacity
    borderRadius: cssVars.borderRadius.md,
  };

  const contentStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.md,
  };

  const iconStyle: CSSProperties = {
    color: cssVars.colors.error,
    fontSize: cssVars.fontSizes.xl,
    flexShrink: 0,
  };

  const bodyStyle: CSSProperties = {
    flex: 1,
  };

  const titleStyle: CSSProperties = {
    margin: `0 0 ${cssVars.spacing.sm} 0`,
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.error,
  };

  const messageStyle: CSSProperties = {
    margin: `0 0 ${cssVars.spacing.md} 0`,
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textPrimary,
    lineHeight: '1.5',
  };

  const buttonStyle: CSSProperties = {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    background: `${cssVars.colors.error}33`, // 20% opacity
    border: `1px solid ${cssVars.colors.error}66`, // 40% opacity
    borderRadius: cssVars.borderRadius.sm,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
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
