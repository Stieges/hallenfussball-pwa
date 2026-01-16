/**
 * GuestBanner - Banner für Gast-User mit CTA zur Registrierung
 *
 * Zeigt einen Banner wenn der User als Gast angemeldet ist.
 * Bietet Optionen zur Registrierung oder zum Schließen.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md
 */

import React, { useState, CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens'
import { useAuth } from '../hooks/useAuth';

interface GuestBannerProps {
  /** Whether to show a dismiss button */
  dismissible?: boolean;
  /** Callback when banner is dismissed */
  onDismiss?: () => void;
  /** Compact mode for smaller spaces */
  compact?: boolean;
  /** Called when user clicks register */
  onRegisterClick?: () => void;
}

export const GuestBanner: React.FC<GuestBannerProps> = ({
  dismissible = true,
  onDismiss,
  compact = false,
  onRegisterClick,
}) => {
  const { isGuest } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't render if not a guest or dismissed
  if (!isGuest || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  if (compact) {
    return (
      <div style={styles.compactBanner}>
        <span style={styles.compactText}>Als Gast angemeldet</span>
        <button
          type="button"
          onClick={onRegisterClick}
          style={styles.compactLink}
        >
          Registrieren
        </button>
      </div>
    );
  }

  return (
    <div style={styles.banner}>
      <div style={styles.content}>
        <div style={styles.iconContainer}>
          <span style={styles.icon}>👤</span>
        </div>
        <div style={styles.textContainer}>
          <p style={styles.title}>Du bist als Gast angemeldet</p>
          <p style={styles.description}>
            Erstelle ein Konto, um deine Turniere zu speichern und zu
            synchronisieren.
          </p>
        </div>
      </div>

      <div style={styles.actions}>
        <button
          type="button"
          onClick={onRegisterClick}
          style={styles.registerButton}
        >
          Jetzt registrieren
        </button>
        {dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            style={styles.dismissButton}
            aria-label="Banner schließen"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

// Styles using design tokens
const styles: Record<string, CSSProperties> = {
  banner: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    background: cssVars.colors.warning + '15', // 15% opacity
    border: `1px solid ${cssVars.colors.warning}30`, // 30% opacity
    borderRadius: cssVars.borderRadius.md,
    margin: cssVars.spacing.md,
  },
  content: {
    display: 'flex',
    gap: cssVars.spacing.md,
    alignItems: 'flex-start',
  },
  iconContainer: {
    flexShrink: 0,
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: cssVars.colors.warning + '20',
    borderRadius: cssVars.borderRadius.full,
  },
  icon: {
    fontSize: cssVars.fontSizes.xl,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    margin: 0,
    marginBottom: cssVars.spacing.xs,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
  },
  description: {
    margin: 0,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    lineHeight: '1.5',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: cssVars.spacing.sm,
  },
  registerButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '40px',
    padding: `0 ${cssVars.spacing.md}`,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.background,
    background: cssVars.colors.warning,
    borderRadius: cssVars.borderRadius.md,
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.2s ease',
  },
  dismissButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    minWidth: '44px',
    minHeight: '44px',
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.md,
    cursor: 'pointer',
    borderRadius: cssVars.borderRadius.sm,
    transition: 'background 0.2s ease',
  },
  // Compact variant
  compactBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.sm,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    background: cssVars.colors.warning + '15',
    borderBottom: `1px solid ${cssVars.colors.warning}30`,
  },
  compactText: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  },
  compactLink: {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.warning,
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
  },
};

export default GuestBanner;
