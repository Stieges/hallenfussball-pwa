/**
 * AudioActivationBanner
 *
 * Shows a banner when audio needs to be activated by user interaction.
 * Required by browsers to comply with autoplay policies.
 *
 * @see docs/concepts/MATCH-COCKPIT-PRO-KONZEPT.md Section 3.3
 */

import { type CSSProperties, useCallback, useState } from 'react';
import { cssVars } from '../../design-tokens';

export interface AudioActivationBannerProps {
  /** Whether to show the banner */
  show: boolean;
  /** Callback when user activates audio */
  onActivate: () => Promise<void>;
}

export function AudioActivationBanner({
  show,
  onActivate,
}: AudioActivationBannerProps): JSX.Element | null {
  const [isActivating, setIsActivating] = useState(false);

  const handleActivate = useCallback(() => {
    setIsActivating(true);
    void onActivate()
      .finally(() => {
        setIsActivating(false);
      });
  }, [onActivate]);

  if (!show) {
    return null;
  }

  const bannerStyle: CSSProperties = {
    position: 'fixed',
    bottom: cssVars.spacing.xl,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    backgroundColor: cssVars.colors.surfaceElevated,
    borderRadius: cssVars.borderRadius.lg,
    boxShadow: cssVars.shadows.lg,
    border: `1px solid ${cssVars.colors.border}`,
    zIndex: 1000,
    maxWidth: '90vw',
  };

  const textStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  };

  const buttonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    backgroundColor: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    cursor: isActivating ? 'wait' : 'pointer',
    opacity: isActivating ? 0.7 : 1,
    minHeight: '44px', // Touch target
    whiteSpace: 'nowrap',
  };

  return (
    <div style={bannerStyle} role="alert" aria-live="polite">
      <span style={textStyle}>
        Sound für Spielende aktivieren?
      </span>
      <button
        type="button"
        style={buttonStyle}
        onClick={handleActivate}
        disabled={isActivating}
        aria-label="Audio aktivieren"
      >
        <span role="img" aria-hidden="true">🔊</span>
        {isActivating ? 'Wird aktiviert...' : 'Aktivieren'}
      </button>
    </div>
  );
}

export default AudioActivationBanner;
