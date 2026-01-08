/**
 * UserProfileScreen - "Meine Turniere" Ansicht
 *
 * Zeigt User-Profil und alle Turniere mit Mitgliedschaft in modernem Card-Layout.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 4.3
 */

import React, { CSSProperties, useState } from 'react';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useUserTournaments } from '../hooks/useUserTournaments';
import { useTheme } from '../../../hooks/useTheme';
import { TournamentCard } from './TournamentCard';
import { GuestBanner } from './GuestBanner';
import { useToast } from '../../../components/ui/Toast';
import type { TournamentSortOption } from '../hooks/useUserTournaments';

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

/**
 * Avatar-Komponente
 */
const Avatar: React.FC<{ name: string; avatarUrl?: string }> = ({
  name,
  avatarUrl,
}) => {
  const initials = name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={styles.avatarImage}
      />
    );
  }

  return (
    <div style={styles.avatar}>
      <span style={styles.avatarInitials}>{initials}</span>
    </div>
  );
};

// =============================================================================
// SUB-COMPONENTS (Cards)
// =============================================================================

const Card: React.FC<{ children: React.ReactNode; style?: CSSProperties; title?: string }> = ({ children, style, title }) => (
  <div style={{ ...styles.card, ...style }}>
    {title && <h3 style={styles.cardTitle}>{title}</h3>}
    {children}
  </div>
);

const StatItem: React.FC<{ label: string; value: number | string; color?: string }> = ({ label, value, color }) => (
  <div style={styles.statItem}>
    <div style={{ ...styles.statValue, color: color || cssVars.colors.textPrimary }}>{value}</div>
    <div style={styles.statLabel}>{label}</div>
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

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout();
    onBack?.();
  };

  const handleChangePassword = async () => {
    if (!user?.email) {
      showError('Keine E-Mail-Adresse hinterlegt.');
      return;
    }

    try {
      const result = await resetPassword(user.email);
      if (result.success) {
        showSuccess(`E-Mail zum Zurücksetzen wurde an ${user.email} gesendet.`);
      } else {
        showError(result.error ?? 'E-Mail konnte nicht gesendet werden.');
      }
    } catch (err) {
      console.error('Change password error:', err);
      showError('Ein Fehler ist aufgetreten.');
    }
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
            <div style={styles.identityHeader}>
              <Avatar name={user.name} avatarUrl={user.avatarUrl} />
              <div style={styles.profileInfo}>
                <h2 style={styles.userName}>{user.name}</h2>
                <p style={styles.userEmail}>{user.email}</p>
                {isGuest ? (
                  <span style={styles.badgeGuest}>Gast-Zugang</span>
                ) : (
                  <span style={styles.badgeVerify}>Turnierleitung</span>
                )}
              </div>
            </div>
          </Card>

          {/* Stats Card */}
          <Card title="Meine Statistik">
            <div style={styles.statsGrid}>
              <StatItem label="Turniere" value={counts.total} />
              <StatItem label="Live" value={counts.live} color={cssVars.colors.statusLive} />
              <StatItem label="Erstellt" value={tournaments.filter(m => m.membership.role === 'owner').length} />
            </div>
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
            <ToggleRow
              label="Zwei-Faktor-Authentifizierung (2FA)"
              icon="🛡️"
              checked={false}
              onChange={() => alert('2FA Einrichtung startet...')}
            />
            <button style={styles.actionButton} onClick={handleChangePassword}>
              🔑 Passwort ändern
            </button>
            <div style={styles.divider} />
            <button style={{ ...styles.actionButton, color: cssVars.colors.error }} onClick={handleLogout}>
              🚪 Abmelden
            </button>
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

const styles: Record<string, CSSProperties> = {
  container: {
    minHeight: 'var(--min-h-screen)',
    background: cssVars.colors.background,
    paddingBottom: '80px', // Space for bottom nav on mobile
  },
  navigationHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    background: cssVars.colors.surface, // Solid header
    borderBottom: `1px solid ${cssVars.colors.border}`,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  pageTitle: {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    margin: 0,
  },
  backButton: {
    background: 'none',
    border: 'none',
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.primary,
    cursor: 'pointer',
    padding: cssVars.spacing.sm,
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', // Responsive grid
    gap: cssVars.spacing.lg,
    padding: cssVars.spacing.lg,
    maxWidth: '1200px',
    margin: '0 auto',
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.lg,
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: '300px',
  },

  // CARDS
  card: {
    background: cssVars.colors.surfaceElevated,
    borderRadius: cssVars.borderRadius.lg,
    padding: cssVars.spacing.lg,
    border: `1px solid ${cssVars.colors.border}`,
    boxShadow: cssVars.shadows.sm,
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  },
  cardTitle: {
    margin: 0,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontSize: cssVars.fontSizes.xs,
  },
  identityCard: {
    borderTop: `4px solid ${cssVars.colors.primary}`,
  },
  identityHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.lg,
  },
  profileInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  userName: {
    margin: 0,
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
  },
  userEmail: {
    margin: 0,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  },
  badgeGuest: {
    display: 'inline-block',
    marginTop: cssVars.spacing.xs,
    padding: '2px 8px',
    borderRadius: cssVars.borderRadius.full,
    background: cssVars.colors.warningSubtle,
    color: cssVars.colors.warning,
    fontSize: cssVars.fontSizes.xs,
    alignSelf: 'flex-start',
  },
  badgeVerify: {
    display: 'inline-block',
    marginTop: cssVars.spacing.xs,
    padding: '2px 8px',
    borderRadius: cssVars.borderRadius.full,
    background: cssVars.colors.primarySubtle,
    color: cssVars.colors.primary,
    fontSize: cssVars.fontSizes.xs,
    alignSelf: 'flex-start',
  },

  // STATS
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: cssVars.spacing.md,
  },
  statItem: {
    textAlign: 'center',
    padding: cssVars.spacing.sm,
    background: cssVars.colors.background,
    borderRadius: cssVars.borderRadius.md,
  },
  statValue: {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
  },

  // PREFERENCES LIST
  listRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${cssVars.spacing.sm} 0`,
    cursor: 'pointer',
  },
  listLabel: {
    fontSize: cssVars.fontSizes.md,
  },
  listValue: {
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.sm,
  },
  divider: {
    height: '1px',
    background: cssVars.colors.border,
    margin: `${cssVars.spacing.xs} 0`,
  },
  actionButton: {
    width: '100%',
    textAlign: 'left',
    padding: `${cssVars.spacing.sm} 0`,
    background: 'none',
    border: 'none',
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textPrimary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },
  selectInput: {
    padding: '4px 8px',
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.border}`,
    background: cssVars.colors.background,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.sm,
    cursor: 'pointer',
  },

  // TOGGLES
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${cssVars.spacing.sm} 0`,
    cursor: 'pointer',
  },
  toggleLabel: {
    fontSize: cssVars.fontSizes.md,
  },
  toggleSwitch: {
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    transition: 'background 0.2s ease',
  },
  toggleKnob: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
  },

  // TOURNAMENTS LIST AREA
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: cssVars.spacing.md,
  },
  sectionTitle: {
    margin: 0,
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
  },
  sortSelect: {
    padding: cssVars.spacing.xs,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.border}`,
    background: cssVars.colors.surface,
    color: cssVars.colors.textPrimary,
  },
  tournamentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  },
  emptyState: {
    textAlign: 'center',
    padding: cssVars.spacing.xl,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.lg,
    border: `1px dashed ${cssVars.colors.border}`,
    color: cssVars.colors.textSecondary,
  },
  emptyText: {
    marginBottom: cssVars.spacing.md,
  },
  loadingState: {
    textAlign: 'center',
    padding: cssVars.spacing.xl,
    color: cssVars.colors.textSecondary,
  },

  // AVATAR (reused specific styles)
  avatar: {
    width: '64px',
    height: '64px',
    borderRadius: cssVars.borderRadius.full,
    background: cssVars.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarImage: {
    width: '64px',
    height: '64px',
    borderRadius: cssVars.borderRadius.full,
    objectFit: 'cover' as const,
    flexShrink: 0,
  },
  avatarInitials: {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.onPrimary,
  },
  bannerContainer: {
    marginTop: cssVars.spacing.md,
  },
};

export default UserProfileScreen;
