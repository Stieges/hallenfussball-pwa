/**
 * GuestBanner - Banner für Gast-User mit CTA zur Registrierung
 *
 * Zeigt einen Banner wenn der User als Gast angemeldet ist.
 * Bietet Optionen zur Registrierung oder zum Schließen.
 * Zeigt zusätzlich Turnier-Limit-Warnung wenn das Limit fast erreicht ist.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md
 * @see docs/concepts/AUTH-KONZEPT-ERWEITERT.md - Section on anonymous user limits
 */

import React, { useState, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { useAuth } from '../hooks/useAuth';
import { useTournamentLimit, ANONYMOUS_TOURNAMENT_LIMIT } from '../hooks/useTournamentLimit';

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
  const { t } = useTranslation('auth');
  const { isGuest } = useAuth();
  const { isLimited, used, remaining, isNearLimit, isAtLimit, isLoading } = useTournamentLimit();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't render if not a guest or dismissed
  if (!isGuest || isDismissed) {
    return null;
  }

  // Determine urgency level for styling
  const urgencyLevel: 'normal' | 'warning' | 'critical' =
    isAtLimit ? 'critical' : isNearLimit ? 'warning' : 'normal';

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  if (compact) {
    const compactBannerStyle = {
      ...styles.compactBanner,
      ...(urgencyLevel === 'critical' ? styles.compactBannerCritical : {}),
      ...(urgencyLevel === 'warning' ? styles.compactBannerWarning : {}),
    };

    return (
      <div style={compactBannerStyle} data-testid="guest-banner-compact">
        <span style={styles.compactText}>
          {isAtLimit
            ? t('guestBanner.compact.limitReached', { used, limit: ANONYMOUS_TOURNAMENT_LIMIT })
            : isNearLimit
              ? t('guestBanner.compact.remaining', { count: remaining })
              : t('guestBanner.compact.loggedInAsGuest')}
        </span>
        <button
          type="button"
          onClick={onRegisterClick}
          style={urgencyLevel !== 'normal' ? styles.compactLinkUrgent : styles.compactLink}
          data-testid="guest-banner-register-button"
        >
          {isAtLimit ? t('guestBanner.upgradeNow') : t('guestBanner.register')}
        </button>
      </div>
    );
  }

  // Determine banner and icon styles based on urgency
  const bannerStyle = {
    ...styles.banner,
    ...(urgencyLevel === 'critical' ? styles.bannerCritical : {}),
    ...(urgencyLevel === 'warning' ? styles.bannerWarning : {}),
  };

  const iconContainerStyle = {
    ...styles.iconContainer,
    ...(urgencyLevel === 'critical' ? styles.iconContainerCritical : {}),
    ...(urgencyLevel === 'warning' ? styles.iconContainerWarning : {}),
  };

  // Determine title and description based on limit state
  const getTitle = () => {
    if (isAtLimit) {
      return t('guestBanner.title.limitReached');
    }
    if (isNearLimit) {
      return t('guestBanner.title.remaining', { count: remaining });
    }
    return t('guestBanner.title.default');
  };

  const getDescription = () => {
    if (isAtLimit) {
      return t('guestBanner.description.limitReached', { limit: ANONYMOUS_TOURNAMENT_LIMIT });
    }
    if (isNearLimit) {
      return t('guestBanner.description.nearLimit', { limit: ANONYMOUS_TOURNAMENT_LIMIT, used });
    }
    return t('guestBanner.description.default');
  };

  const getIcon = () => {
    if (urgencyLevel === 'critical') {
      return '⚠️';
    }
    if (urgencyLevel === 'warning') {
      return '⏳';
    }
    return '👤';
  };

  const registerButtonStyle = {
    ...styles.registerButton,
    ...(urgencyLevel === 'critical' ? styles.registerButtonCritical : {}),
  };

  return (
    <div style={bannerStyle} data-testid="guest-banner">
      <div style={styles.content}>
        <div style={iconContainerStyle}>
          <span style={styles.icon}>{getIcon()}</span>
        </div>
        <div style={styles.textContainer}>
          <p style={styles.title}>{getTitle()}</p>
          <p style={styles.description}>
            {getDescription()}
          </p>
          {/* Progress indicator for limit */}
          {isLimited && !isLoading && (
            <div style={styles.progressContainer}>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${(used / ANONYMOUS_TOURNAMENT_LIMIT) * 100}%`,
                    backgroundColor:
                      urgencyLevel === 'critical'
                        ? cssVars.colors.error
                        : urgencyLevel === 'warning'
                          ? cssVars.colors.warning
                          : cssVars.colors.primary,
                  }}
                />
              </div>
              <span style={styles.progressText}>
                {t('guestBanner.tournamentsProgress', { used, limit: ANONYMOUS_TOURNAMENT_LIMIT })}
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={styles.actions}>
        <button
          type="button"
          onClick={onRegisterClick}
          style={registerButtonStyle}
          data-testid="guest-banner-register-button"
        >
          {isAtLimit ? t('guestBanner.upgradeNow') : t('guestBanner.registerNow')}
        </button>
        {dismissible && !isAtLimit && (
          <button
            type="button"
            onClick={handleDismiss}
            style={styles.dismissButton}
            aria-label={t('guestBanner.dismissAriaLabel')}
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
    background: cssVars.colors.warningSubtle,
    border: `1px solid ${cssVars.colors.warningBorder}`,
    borderRadius: cssVars.borderRadius.md,
    margin: cssVars.spacing.md,
  },
  // Urgency variants
  bannerWarning: {
    background: cssVars.colors.warningLight,
    border: `1px solid ${cssVars.colors.warningBorder}`,
  },
  bannerCritical: {
    background: cssVars.colors.errorSubtle,
    border: `1px solid ${cssVars.colors.errorBorder}`,
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
    background: cssVars.colors.warningLight,
    borderRadius: cssVars.borderRadius.full,
  },
  iconContainerWarning: {
    background: cssVars.colors.warningSelected,
  },
  iconContainerCritical: {
    background: cssVars.colors.errorLight,
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
  // Progress indicator for tournament limit
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    marginTop: cssVars.spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: '6px',
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: cssVars.borderRadius.full,
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textTertiary,
    whiteSpace: 'nowrap',
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
    minHeight: '44px',
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
  registerButtonCritical: {
    background: cssVars.colors.error,
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
    background: cssVars.colors.warningSubtle,
    borderBottom: `1px solid ${cssVars.colors.warningBorder}`,
  },
  compactBannerWarning: {
    background: cssVars.colors.warningLight,
    borderBottom: `1px solid ${cssVars.colors.warningBorder}`,
  },
  compactBannerCritical: {
    background: cssVars.colors.errorSubtle,
    borderBottom: `1px solid ${cssVars.colors.errorBorder}`,
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
    padding: `0 ${cssVars.spacing.xs}`,
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
  compactLinkUrgent: {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.error,
    background: 'none',
    border: 'none',
    padding: `0 ${cssVars.spacing.xs}`,
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
};

export default GuestBanner;
