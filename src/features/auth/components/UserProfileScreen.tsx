/**
 * UserProfileScreen - "Meine Turniere" Ansicht
 *
 * Zeigt User-Profil und alle Turniere mit Mitgliedschaft in modernem Card-Layout.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 4.3
 */

import React, { CSSProperties, useState, useEffect, useCallback } from 'react';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useUserTournaments } from '../hooks/useUserTournaments';
import { useTheme } from '../../../hooks/useTheme';
import { TournamentCard } from './TournamentCard';
import { GuestBanner } from './GuestBanner';
import { useToast } from '../../../components/ui/Toast';
import type { TournamentSortOption } from '../hooks/useUserTournaments';
import { styles } from './UserProfileScreen.styles';
import { ProfileHeader, ProfileStats, ProfileActions } from './profile';

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

const ToggleRow: React.FC<{ label: string; checked: boolean; onChange: () => void; icon?: string }> = ({ label, checked, onChange, icon }) => (
  <div style={styles.toggleRow} onClick={onChange}>
    <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm }}>
      {icon && <span style={{ fontSize: cssVars.fontSizes.lg }}>{icon}</span>}
      <span style={styles.toggleLabel}>{label}</span>
    </div>
    <div style={{
      ...styles.toggleSwitch,
      background: checked ? cssVars.colors.primary : cssVars.colors.surfaceSolid,
      justifyContent: checked ? 'flex-end' : 'flex-start'
    }}>
      <div style={styles.toggleKnob} />
    </div>
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
      const lastReset = localStorage.getItem(PASSWORD_RESET_TIMESTAMP_KEY);
      if (lastReset) {
        const elapsed = Math.floor((Date.now() - parseInt(lastReset, 10)) / 1000);
        const remaining = PASSWORD_RESET_COOLDOWN_SECONDS - elapsed;
        if (remaining > 0) {
          setPasswordResetCooldown(remaining);
        } else {
          localStorage.removeItem(PASSWORD_RESET_TIMESTAMP_KEY);
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
          localStorage.removeItem(PASSWORD_RESET_TIMESTAMP_KEY);
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
      showInfo(`Bitte warte noch ${passwordResetCooldown} Sekunden.`);
      return;
    }

    if (!user?.email) {
      showError('Keine E-Mail-Adresse hinterlegt.');
      return;
    }

    try {
      const result = await resetPassword(user.email);
      if (result.success) {
        // Set cooldown timestamp
        localStorage.setItem(PASSWORD_RESET_TIMESTAMP_KEY, Date.now().toString());
        setPasswordResetCooldown(PASSWORD_RESET_COOLDOWN_SECONDS);
        showSuccess(`E-Mail zum Zurücksetzen wurde an ${user.email} gesendet.`);
      } else {
        showError(result.error ?? 'E-Mail konnte nicht gesendet werden.');
      }
    } catch (err) {
      showError('Ein Fehler ist aufgetreten.');
    }
  }, [user, passwordResetCooldown, resetPassword, showInfo, showSuccess, showError]);

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
          aria-label="Zurück"
        >
          ← Zurück
        </button>
        <h1 style={styles.pageTitle}>Mein Profil</h1>
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
          <Card title="Meine Statistik">
            <ProfileStats
              totalTournaments={counts.total}
              liveTournaments={counts.live}
              createdTournaments={tournaments.filter(m => m.membership.role === 'owner').length}
            />
          </Card>

          {/* Preferences Card */}
          <Card title="Einstellungen">
            <ToggleRow
              label="Dark Mode"
              icon="🌙"
              checked={isDark}
              onChange={toggleTheme}
            />
            <ToggleRow
              label="Benachrichtigungen"
              icon="🔔"
              checked={true /* Mocked */}
              onChange={() => showInfo('Benachrichtigungen werden in Kürze verfügbar sein.')}
            />
            <div style={styles.listRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm }}>
                <span style={{ fontSize: cssVars.fontSizes.lg }}>🌐</span>
                <span style={styles.listLabel}>Sprache</span>
              </div>
              <select
                style={styles.selectInput}
                value="de"
                onChange={() => alert('Sprache ist aktuell auf Deutsch festgelegt.')}
              >
                <option value="de">Deutsch</option>
                <option value="en">English (BETA)</option>
              </select>
            </div>
            <div style={styles.divider} />
            <button style={styles.actionButton} onClick={onOpenSettings}>
              ⚙️ Weitere Einstellungen
            </button>
          </Card>

          {/* Security Card */}
          <Card title="Sicherheit">
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
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Meine Turniere</h2>
            {counts.total > 1 && (
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as TournamentSortOption)}
                style={styles.sortSelect}
              >
                <option value="status">Status</option>
                <option value="recent">Zuletzt</option>
                <option value="name">A-Z</option>
                <option value="date">Datum</option>
              </select>
            )}
          </div>

          {/* List */}
          {isLoading ? (
            <div style={styles.loadingState}>Lade Turniere...</div>
          ) : tournaments.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyText}>Noch keine Turniere vorhanden.</p>
              <Button variant="primary" onClick={onCreateTournament}>
                Jetzt erstes Turnier erstellen
              </Button>
            </div>
          ) : (
            <div style={styles.tournamentList}>
              {tournaments.map((item) => (
                <TournamentCard
                  key={item.tournament.id}
                  tournament={item.tournament}
                  membership={item.membership}
                  teamNames={item.teamNames}
                  onClick={() => onOpenTournament?.(item.tournament.id)}
                />
              ))}
            </div>
          )}
          {/* Create Button (sticky or bottom) */}
          {tournaments.length > 0 && (
            <Button variant="secondary" fullWidth onClick={onCreateTournament} style={{ marginTop: cssVars.spacing.md }}>
              ＋ Neues Turnier
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileScreen;
