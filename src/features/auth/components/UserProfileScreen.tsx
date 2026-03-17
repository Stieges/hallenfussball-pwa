/**
 * UserProfileScreen - "Meine Turniere" Ansicht
 *
 * Zeigt User-Profil und alle Turniere mit Mitgliedschaft in modernem Card-Layout.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 4.3
 */

import React, { CSSProperties, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { safeLocalStorage } from '../../../core/utils/safeStorage';
import { useAuth } from '../hooks/useAuth';
import { useUserTournaments } from '../hooks/useUserTournaments';
import { useTheme } from '../../../hooks/useTheme';
import { GuestBanner } from './GuestBanner';
import { useToast } from '../../../components/ui/Toast';
import type { TournamentSortOption } from '../hooks/useUserTournaments';
import { styles } from './UserProfileScreen.styles';
import { ProfileHeader, ProfileStats, ProfileActions } from './profile';
import { ProfileSettings } from './profile/ProfileSettings';
import { ProfileTournaments } from './profile/ProfileTournaments';

interface UserProfileScreenProps {
  /** Zurück-Handler */
  onBack?: () => void;
  /** Handler für Einstellungen öffnen */
  onOpenSettings?: () => void;
  /** Handler für Turnier öffnen */
  onOpenTournament?: (tournamentId: string) => void;
  /** Handler für neues Turnier erstellen */
  onCreateTournament?: () => void;
  /** Handler für Registrierung (nur für Gäste) */
  onRegister?: () => void;
}

// =============================================================================
// SUB-COMPONENTS (Cards)
// =============================================================================

const Card: React.FC<{ children: React.ReactNode; style?: CSSProperties; title?: string }> = ({ children, style, title }) => (
  <div style={{ ...styles.card, ...style }}>
    {title && <h3 style={styles.cardTitle}>{title}</h3>}
    {children}
  </div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

// =============================================================================
// CONSTANTS
// =============================================================================

/** Cooldown period for password reset requests (in seconds) */
const PASSWORD_RESET_COOLDOWN_SECONDS = 60;
/** localStorage key for tracking last password reset request */
const PASSWORD_RESET_TIMESTAMP_KEY = 'hallenfussball_password_reset_last';

export const UserProfileScreen: React.FC<UserProfileScreenProps> = ({
  onBack,
  onOpenSettings,
  onOpenTournament,
  onCreateTournament,
  onRegister,
}) => {
  const { t } = useTranslation('auth');
  const { user, isGuest, logout, resetPassword } = useAuth();
  const { showInfo, showSuccess, showError } = useToast();
  const { theme, toggleTheme } = useTheme(); // Use Theme Hook
  const [sortBy, setSortBy] = useState<TournamentSortOption>('status');
  const { tournaments, isLoading, counts } = useUserTournaments(sortBy);

  // Password reset rate limiting state
  const [passwordResetCooldown, setPasswordResetCooldown] = useState(0);

  // Check for existing cooldown on mount and handle countdown
  useEffect(() => {
    const checkCooldown = () => {
      const lastReset = safeLocalStorage.getItem(PASSWORD_RESET_TIMESTAMP_KEY);
      if (lastReset) {
        const elapsed = Math.floor((Date.now() - parseInt(lastReset, 10)) / 1000);
        const remaining = PASSWORD_RESET_COOLDOWN_SECONDS - elapsed;
        if (remaining > 0) {
          setPasswordResetCooldown(remaining);
        } else {
          safeLocalStorage.removeItem(PASSWORD_RESET_TIMESTAMP_KEY);
          setPasswordResetCooldown(0);
        }
      }
    };

    // Initial check
    checkCooldown();

    // Countdown timer
    const interval = setInterval(() => {
      setPasswordResetCooldown((prev) => {
        if (prev <= 1) {
          safeLocalStorage.removeItem(PASSWORD_RESET_TIMESTAMP_KEY);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Password change handler - defined before early return to satisfy connection rules
  const handleChangePassword = useCallback(async () => {
    // Rate limiting check
    if (passwordResetCooldown > 0) {
      showInfo(t('profile.cooldownMessage', { seconds: passwordResetCooldown }));
      return;
    }

    if (!user?.email) {
      showError(t('errors.noEmailAddress'));
      return;
    }

    try {
      const result = await resetPassword(user.email);
      if (result.success) {
        // Set cooldown timestamp
        safeLocalStorage.setItem(PASSWORD_RESET_TIMESTAMP_KEY, Date.now().toString());
        setPasswordResetCooldown(PASSWORD_RESET_COOLDOWN_SECONDS);
        showSuccess(t('profile.resetEmailSent', { email: user.email }));
      } else {
        showError(result.error ?? t('errors.emailSendFailed'));
      }
    } catch (err) {
      showError(t('errors.genericError'));
    }
  }, [user, passwordResetCooldown, resetPassword, showInfo, showSuccess, showError, t]);

  // AuthGuard in App.tsx handles guest redirect
  if (!user) {
    return null;
  }

  const handleLogout = () => {
    void logout();
    onBack?.();
  };

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div style={styles.container}>
      {/* Top Header Navigation */}
      <div style={styles.navigationHeader}>
        <button
          type="button"
          onClick={onBack}
          style={styles.backButton}
          aria-label={t('profile.back')}
        >
          {t('profile.backWithArrow')}
        </button>
        <h1 style={styles.pageTitle}>{t('profile.title')}</h1>
        <div style={{ width: 40 }} /> {/* Spacer for balance */}
      </div>

      <div style={styles.contentGrid}>
        {/* LEFT COLUMN: Identity & Stats */}
        <div style={styles.leftColumn}>
          {/* Identity Card */}
          <Card style={styles.identityCard}>
            <ProfileHeader user={user} isGuest={isGuest} />
          </Card>

          {/* Stats Card */}
          <Card title={t('profile.stats')}>
            <ProfileStats
              totalTournaments={counts.total}
              liveTournaments={counts.live}
              createdTournaments={tournaments.filter(m => m.membership.role === 'owner').length}
            />
          </Card>

          {/* Preferences Card */}
          <Card title={t('profile.settings')}>
            <ProfileSettings
              isDark={isDark}
              onToggleTheme={toggleTheme}
              onOpenSettings={onOpenSettings ?? (() => undefined)}
              onShowInfo={showInfo}
            />
          </Card>

          {/* Security Card */}
          <Card title={t('profile.security')}>
            <ProfileActions
              is2FAEnabled={false}
              on2FAToggle={() => alert('2FA Einrichtung startet...')}
              onChangePassword={() => void handleChangePassword()}
              passwordResetCooldown={passwordResetCooldown}
              onLogout={handleLogout}
            />
          </Card>

          {isGuest && (
            <div style={styles.bannerContainer}>
              <GuestBanner onRegisterClick={onRegister} dismissible={false} />
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Tournaments */}
        <div style={styles.rightColumn}>
          <ProfileTournaments
            tournaments={tournaments}
            isLoading={isLoading}
            totalCount={counts.total}
            sortBy={sortBy}
            setSortBy={setSortBy}
            onCreateTournament={onCreateTournament}
            onOpenTournament={onOpenTournament}
          />
        </div>
      </div>
    </div>
  );
};

export default UserProfileScreen;
