/**
 * ProfileHeader - User identity section with avatar
 *
 * Displays user avatar, name, email and role badge.
 *
 * @see UserProfileScreen.tsx
 */

import React, { CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';
import type { User } from '../../types/auth.types';

interface ProfileHeaderProps {
  /** User to display */
  user: User;
  /** Whether user is a guest */
  isGuest: boolean;
}

/**
 * Avatar sub-component
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

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  user,
  isGuest,
}) => {
  return (
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
  );
};

const styles: Record<string, CSSProperties> = {
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
};

export default ProfileHeader;
