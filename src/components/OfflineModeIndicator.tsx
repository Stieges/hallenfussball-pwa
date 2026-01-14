/**
 * OfflineModeIndicator - Shows when auth connection to Supabase is offline
 *
 * Different from OfflineBanner which uses navigator.onLine:
 * - This uses connectionState from AuthContext (Supabase-specific)
 * - Shows in app content area (not fixed bottom)
 * - Provides reconnect button
 *
 * @example
 * ```tsx
 * <OfflineModeIndicator />
 * ```
 */

import { CSSProperties } from 'react';
import { useAuth } from '../features/auth/hooks/useAuth';
import { Button } from './ui/Button';
import { cssVars } from '../design-tokens';

interface OfflineModeIndicatorProps {
  /** Optional: Compact mode for smaller spaces */
  compact?: boolean;
}

export const OfflineModeIndicator: React.FC<OfflineModeIndicatorProps> = ({
  compact = false,
}) => {
  const { connectionState, reconnect } = useAuth();

  // Only show when offline
  if (connectionState !== 'offline') {
    return null;
  }

  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: cssVars.spacing.md,
    padding: compact ? `${cssVars.spacing.sm} ${cssVars.spacing.md}` : cssVars.spacing.md,
    backgroundColor: cssVars.colors.correctionBg, // Use token instead of hardcoded rgba
    border: `1px solid ${cssVars.colors.correctionBorder}`,
    borderRadius: cssVars.borderRadius.md,
    marginBottom: cssVars.spacing.md,
  };

  const contentStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    flex: 1,
  };

  const iconStyle: CSSProperties = {
    fontSize: compact ? cssVars.fontSizes.md : cssVars.fontSizes.lg,
    color: cssVars.colors.correctionIcon, // Explicit icon color
  };

  const textContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  };

  const titleStyle: CSSProperties = {
    fontSize: compact ? cssVars.fontSizes.sm : cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.correctionText,
    margin: 0,
  };

  const subtitleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    // Change from textSecondary to correctionText (or primary) for better contrast on warning bg
    // Using correctionText ensures it matches the theme of the alert
    color: cssVars.colors.correctionText,
    margin: 0,
  };

  const handleReconnect = () => {
    void reconnect();
  };

  return (
    <div style={containerStyle} role="alert" aria-live="polite">
      <div style={contentStyle}>
        <span style={iconStyle} role="img" aria-label="Offline">
          📡
        </span>
        <div style={textContainerStyle}>
          <p style={titleStyle}>Offline-Modus</p>
          {!compact && (
            <p style={subtitleStyle}>
              Daten werden lokal gespeichert und später synchronisiert
            </p>
          )}
        </div>
      </div>
      <Button
        variant="secondary"
        size={compact ? 'sm' : 'md'}
        onClick={handleReconnect}
        aria-label="Erneut verbinden"
      >
        Verbinden
      </Button>
    </div>
  );
};

export default OfflineModeIndicator;
