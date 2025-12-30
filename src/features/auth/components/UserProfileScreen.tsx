/**
 * UserProfileScreen - "Meine Turniere" Ansicht
 *
 * Zeigt User-Profil und alle Turniere mit Mitgliedschaft.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 4.3
 */

import React, { CSSProperties, useState } from 'react';
import {
  colors,
  spacing,
  fontSizes,
  fontWeights,
  borderRadius,
} from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useUserTournaments } from '../hooks/useUserTournaments';
import { TournamentCard } from './TournamentCard';
import { GuestBanner } from './GuestBanner';
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

/**
 * UserProfileScreen - Zeigt User-Profil und Turniere
 *
 * @example
 * ```tsx
 * <UserProfileScreen
 *   onBack={() => setScreen('dashboard')}
 *   onOpenTournament={(id) => setScreen('tournament', { id })}
 *   onCreateTournament={() => setScreen('create')}
 * />
 * ```
 */
export const UserProfileScreen: React.FC<UserProfileScreenProps> = ({
  onBack,
  onOpenSettings,
  onOpenTournament,
  onCreateTournament,
  onRegister,
}) => {
  const { user, isGuest, logout } = useAuth();
  const [sortBy, setSortBy] = useState<TournamentSortOption>('status');
  const { tournaments, isLoading, counts } = useUserTournaments(sortBy);

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout();
    onBack?.();
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button
          type="button"
          onClick={onBack}
          style={styles.backButton}
          aria-label="Zurück"
        >
          ← Zurück
        </button>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            style={styles.settingsButton}
            aria-label="Einstellungen"
          >
            ⚙️
          </button>
        )}
      </div>

      {/* Gast-Banner */}
      {isGuest && (
        <div style={styles.bannerSection}>
          <GuestBanner onRegisterClick={onRegister} dismissible={false} />
        </div>
      )}

      {/* Profil-Header */}
      <div style={styles.profileHeader}>
        <Avatar name={user.name} avatarUrl={user.avatarUrl} />
        <div style={styles.profileInfo}>
          <h1 style={styles.userName}>{user.name}</h1>
          <p style={styles.userEmail}>{user.email}</p>
        </div>
      </div>

      <div style={styles.divider} />

      {/* Meine Turniere */}
      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>📋 Meine Turniere</h2>
          {counts.total > 0 && (
            <div style={styles.statusCounts}>
              {counts.live > 0 && (
                <span style={styles.liveCount}>🔴 {counts.live} Live</span>
              )}
              <span style={styles.totalCount}>{counts.total} gesamt</span>
            </div>
          )}
        </div>

        {/* Sort Options */}
        {counts.total > 1 && (
          <div style={styles.sortRow}>
            <label style={styles.sortLabel}>Sortieren:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as TournamentSortOption)}
              style={styles.sortSelect}
            >
              <option value="status">Nach Status</option>
              <option value="recent">Zuletzt bearbeitet</option>
              <option value="name">Alphabetisch</option>
              <option value="date">Nach Datum</option>
            </select>
          </div>
        )}

        {/* Tournament List */}
        {isLoading ? (
          <div style={styles.loadingState}>
            <span style={styles.loadingText}>Lade Turniere...</span>
          </div>
        ) : tournaments.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>Du hast noch keine Turniere.</p>
            <p style={styles.emptySubtext}>
              Erstelle dein erstes Turnier oder nimm eine Einladung an.
            </p>
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

        {/* Neues Turnier Button */}
        <Button
          variant="primary"
          fullWidth
          onClick={onCreateTournament}
          style={styles.createButton}
        >
          ＋ Neues Turnier erstellen
        </Button>
      </section>

      <div style={styles.divider} />

      {/* Menu Items */}
      <section style={styles.menuSection}>
        <button type="button" style={styles.menuItem} disabled>
          <span style={styles.menuIcon}>🔔</span>
          <span style={styles.menuText}>Benachrichtigungen</span>
          <span style={styles.menuArrow}>→</span>
          <span style={styles.comingSoon}>Bald</span>
        </button>

        <button type="button" style={styles.menuItem} onClick={onOpenSettings}>
          <span style={styles.menuIcon}>⚙️</span>
          <span style={styles.menuText}>Einstellungen</span>
          <span style={styles.menuArrow}>→</span>
        </button>

        <button
          type="button"
          style={{ ...styles.menuItem, ...styles.logoutItem }}
          onClick={handleLogout}
        >
          <span style={styles.menuIcon}>🚪</span>
          <span style={styles.menuText}>Abmelden</span>
        </button>
      </section>
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  container: {
    minHeight: '100vh',
    padding: spacing.lg,
    background: colors.background,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  backButton: {
    padding: `${spacing.sm} ${spacing.md}`,
    background: 'transparent',
    border: 'none',
    color: colors.textSecondary,
    fontSize: fontSizes.md,
    cursor: 'pointer',
    font: 'inherit',
  },
  settingsButton: {
    padding: spacing.sm,
    background: 'transparent',
    border: 'none',
    fontSize: fontSizes.xl,
    cursor: 'pointer',
  },
  bannerSection: {
    marginBottom: spacing.lg,
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: '64px',
    height: '64px',
    borderRadius: borderRadius.full,
    background: colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '64px',
    height: '64px',
    borderRadius: borderRadius.full,
    objectFit: 'cover' as const,
  },
  avatarInitials: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.onPrimary,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    margin: 0,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  userEmail: {
    margin: 0,
    marginTop: '2px',
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  divider: {
    height: '1px',
    background: colors.border,
    margin: `${spacing.lg} 0`,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    margin: 0,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  statusCounts: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liveCount: {
    fontSize: fontSizes.sm,
    color: colors.statusLive,
    fontWeight: fontWeights.medium,
  },
  totalCount: {
    fontSize: fontSizes.sm,
    color: colors.textTertiary,
  },
  sortRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sortLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  sortSelect: {
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    background: colors.surfaceSolid,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.md,
    cursor: 'pointer',
  },
  loadingState: {
    padding: spacing.xl,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
  },
  emptyState: {
    padding: spacing.xl,
    textAlign: 'center',
    background: colors.surface,
    borderRadius: borderRadius.lg,
    border: `1px dashed ${colors.border}`,
  },
  emptyText: {
    margin: 0,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    margin: 0,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  tournamentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  createButton: {
    minHeight: '56px',
  },
  menuSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    background: 'transparent',
    border: 'none',
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    font: 'inherit',
    textAlign: 'left',
    color: colors.textPrimary,
    transition: 'background 0.2s ease',
    width: '100%',
  },
  menuIcon: {
    fontSize: fontSizes.lg,
  },
  menuText: {
    flex: 1,
    fontSize: fontSizes.md,
  },
  menuArrow: {
    color: colors.textTertiary,
    fontSize: fontSizes.md,
  },
  comingSoon: {
    fontSize: fontSizes.xs,
    color: colors.textTertiary,
    background: colors.surface,
    padding: `2px ${spacing.xs}`,
    borderRadius: borderRadius.sm,
  },
  logoutItem: {
    color: colors.error,
    marginTop: spacing.md,
  },
};

export default UserProfileScreen;
