/**
 * AuthSection - Auth-Status und Navigation im Header
 *
 * Zeigt je nach Auth-Zustand:
 * - Loading: Skeleton
 * - Gast: Gast-Badge + Registrieren
 * - Nicht eingeloggt: Anmelden + Registrieren
 * - Eingeloggt: Name + Avatar Dropdown
 *
 * Features:
 * - Aria-Live Region für Screenreader-Ankündigungen bei Auth-Wechsel
 *
 * @see docs/concepts/HEADER-AUTH-NAVIGATION-KONZEPT.md
 */

import React, { useState, useRef, useEffect, useMemo, CSSProperties } from 'react';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useIsMobile } from '../../hooks/useIsMobile';
import { MobileAuthBottomSheet } from '../../features/auth/components/MobileAuthBottomSheet';
import {
  colors,
  spacing,
  fontSizes,
  fontWeights,
  borderRadius,
  shadows,
} from '../../design-tokens';

interface AuthSectionProps {
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
  onNavigateToProfile: () => void;
}

/**
 * Generiert Initialen aus einem Namen
 */
const getInitials = (name: string): string => {
  const cleaned = name
    .replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s*/i, '')
    .trim();

  const parts = cleaned.split(/[\s-]+/);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  return cleaned.substring(0, 2).toUpperCase();
};

/**
 * VisuallyHidden - Content nur für Screenreader sichtbar
 * aria-live="polite" auf diesem Element statt Container für präzise Ankündigungen
 * @see WCAG 2.1 - Technik C7
 */
const VisuallyHidden: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    aria-live="polite"
    aria-atomic="true"
    style={{
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: 0,
    }}
  >
    {children}
  </span>
);

export const AuthSection: React.FC<AuthSectionProps> = ({
  onNavigateToLogin,
  onNavigateToRegister,
  onNavigateToProfile,
}) => {
  const { user, isAuthenticated, isGuest, isLoading, logout } = useAuth();
  const isMobile = useIsMobile();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuItemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Keyboard navigation for dropdown
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!dropdownOpen) {
        return;
      }

      const items = menuItemsRef.current.filter(Boolean) as HTMLButtonElement[];
      const currentIndex = items.findIndex((item) => item === document.activeElement);

      switch (event.key) {
        case 'Escape':
          setDropdownOpen(false);
          break;
        case 'ArrowDown':
          event.preventDefault();
          if (currentIndex < items.length - 1) {
            items[currentIndex + 1]?.focus();
          } else {
            items[0]?.focus(); // Wrap to first
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (currentIndex > 0) {
            items[currentIndex - 1]?.focus();
          } else {
            items[items.length - 1]?.focus(); // Wrap to last
          }
          break;
        case 'Home':
          event.preventDefault();
          items[0]?.focus();
          break;
        case 'End':
          event.preventDefault();
          items[items.length - 1]?.focus();
          break;
      }
    };

    if (dropdownOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Focus first menu item when opening
      setTimeout(() => {
        menuItemsRef.current[0]?.focus();
      }, 0);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  // Aria-Live Status Text für Screenreader
  // Wird bei Auth-Zustandsänderungen angekündigt
  const statusText = useMemo(() => {
    if (isLoading) {
      return 'Anmeldestatus wird geladen';
    }
    if (isAuthenticated && user) {
      return `Angemeldet als ${user.name}`;
    }
    if (isGuest) {
      return 'Als Gast angemeldet. Registrierung empfohlen für volle Funktionen.';
    }
    return 'Nicht angemeldet. Anmelden oder Registrieren möglich.';
  }, [isLoading, isAuthenticated, isGuest, user]);

  // Loading State
  if (isLoading) {
    return (
      <div style={styles.container}>
        <VisuallyHidden>{statusText}</VisuallyHidden>
        <div style={styles.skeleton} aria-hidden="true" />
        <div style={{ ...styles.skeleton, width: isMobile ? 36 : 100 }} aria-hidden="true" />
      </div>
    );
  }

  // Eingeloggt
  if (isAuthenticated && user) {
    const initials = getInitials(user.name);

    return (
      <div style={styles.container} ref={dropdownRef}>
        <VisuallyHidden>{statusText}</VisuallyHidden>
        {/* Name (nur Desktop) */}
        {!isMobile && (
          <span style={styles.userName}>{user.name}</span>
        )}

        {/* Avatar Button */}
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={styles.avatarButton}
          aria-label={`Profil von ${user.name} öffnen`}
          aria-expanded={dropdownOpen}
          aria-haspopup="menu"
          data-testid="auth-avatar-button"
        >
          <span style={styles.avatarText}>{initials}</span>
        </button>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div style={styles.dropdown} role="menu" data-testid="auth-dropdown-menu">
            {/* User Info im Dropdown */}
            <div style={styles.dropdownHeader}>
              <div style={styles.dropdownAvatar}>
                <span style={styles.avatarText}>{initials}</span>
              </div>
              <div style={styles.dropdownUserInfo}>
                <span style={styles.dropdownUserName}>{user.name}</span>
                <span style={styles.dropdownUserEmail}>{user.email}</span>
              </div>
            </div>

            <div style={styles.dropdownDivider} />

            {/* Menu Items */}
            <button
              ref={(el) => { menuItemsRef.current[0] = el; }}
              type="button"
              role="menuitem"
              onClick={() => {
                setDropdownOpen(false);
                onNavigateToProfile();
              }}
              style={styles.dropdownItem}
              data-testid="auth-profile-button"
            >
              <span style={styles.dropdownIcon}>👤</span>
              Mein Profil
            </button>

            <div style={styles.dropdownDivider} />

            <button
              ref={(el) => { menuItemsRef.current[1] = el; }}
              type="button"
              role="menuitem"
              onClick={() => {
                setDropdownOpen(false);
                logout();
              }}
              style={{ ...styles.dropdownItem, ...styles.dropdownItemDanger }}
              data-testid="auth-logout-button"
            >
              <span style={styles.dropdownIcon}>🚪</span>
              Abmelden
            </button>
          </div>
        )}
      </div>
    );
  }

  // Gast
  if (isGuest) {
    return (
      <>
        <div style={styles.container}>
          <VisuallyHidden>{statusText}</VisuallyHidden>
          {/* Gast-Badge (nur Desktop) */}
          {!isMobile && (
            <div style={styles.guestBadge} data-testid="auth-guest-badge">
              <span style={styles.guestIcon}>👤</span>
              Gast
              <span style={styles.guestInfoIcon}>ℹ</span>
            </div>
          )}

          {/* Mobile: Icon mit Dot - öffnet BottomSheet */}
          {isMobile && (
            <button
              type="button"
              onClick={() => setBottomSheetOpen(true)}
              style={styles.mobileIconButton}
              aria-label="Konto-Optionen öffnen (aktuell als Gast)"
              data-testid="auth-mobile-guest-button"
            >
              <span style={styles.mobileIcon}>👤</span>
              <span style={styles.guestDot} />
            </button>
          )}

          {/* Registrieren Button */}
          {!isMobile && (
            <button
              type="button"
              onClick={onNavigateToRegister}
              style={styles.primaryButton}
              data-testid="auth-guest-register-button"
            >
              Registrieren
            </button>
          )}
        </div>

        {/* Mobile Bottom Sheet */}
        {isMobile && (
          <MobileAuthBottomSheet
            isOpen={bottomSheetOpen}
            onClose={() => setBottomSheetOpen(false)}
            onNavigateToLogin={onNavigateToLogin}
            onNavigateToRegister={onNavigateToRegister}
          />
        )}
      </>
    );
  }

  // Nicht eingeloggt
  return (
    <>
      <div style={styles.container}>
        <VisuallyHidden>{statusText}</VisuallyHidden>
        {/* Mobile: Single Icon - öffnet BottomSheet */}
        {isMobile ? (
          <button
            type="button"
            onClick={() => setBottomSheetOpen(true)}
            style={styles.mobileIconButton}
            aria-label="Konto-Optionen öffnen"
            data-testid="auth-mobile-button"
          >
            <span style={styles.mobileIcon}>👤</span>
          </button>
        ) : (
          <>
            {/* Anmelden (Ghost) */}
            <button
              type="button"
              onClick={onNavigateToLogin}
              style={styles.ghostButton}
              data-testid="auth-login-button"
            >
              Anmelden
            </button>

            {/* Registrieren (Primary) */}
            <button
              type="button"
              onClick={onNavigateToRegister}
              style={styles.primaryButton}
              data-testid="auth-register-button"
            >
              Registrieren
            </button>
          </>
        )}
      </div>

      {/* Mobile Bottom Sheet */}
      {isMobile && (
        <MobileAuthBottomSheet
          isOpen={bottomSheetOpen}
          onClose={() => setBottomSheetOpen(false)}
          onNavigateToLogin={onNavigateToLogin}
          onNavigateToRegister={onNavigateToRegister}
        />
      )}
    </>
  );
};

// Styles
const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    position: 'relative',
  },

  // Skeleton
  skeleton: {
    width: 80,
    height: 36,
    background: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    animation: 'pulse 1.5s ease-in-out infinite',
  },

  // User Name
  userName: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    color: colors.textPrimary,
  },

  // Avatar
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: colors.primary,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'box-shadow 0.2s ease',
  },

  avatarText: {
    color: colors.onPrimary,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
  },

  // Dropdown
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: spacing.xs,
    minWidth: 240,
    background: colors.surface,
    borderRadius: borderRadius.md,
    boxShadow: shadows.lg,
    border: `1px solid ${colors.border}`,
    overflow: 'hidden',
    zIndex: 1000,
  },

  dropdownHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    background: colors.surfaceElevated,
  },

  dropdownAvatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  dropdownUserInfo: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },

  dropdownUserName: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  dropdownUserEmail: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  dropdownDivider: {
    height: 1,
    background: colors.border,
  },

  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
    padding: `${spacing.sm}px ${spacing.md}px`,
    background: 'transparent',
    border: 'none',
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.2s ease',
  },

  dropdownItemDanger: {
    color: colors.error,
  },

  dropdownIcon: {
    fontSize: fontSizes.lg,
    width: 24,
    textAlign: 'center',
  },

  // Guest Badge
  guestBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    height: 36,
    padding: `0 ${spacing.sm}px`,
    background: colors.surfaceElevated,
    color: colors.textTertiary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    borderRadius: borderRadius.full,
  },

  guestIcon: {
    fontSize: fontSizes.md,
  },

  guestInfoIcon: {
    fontSize: fontSizes.xs,
    opacity: 0.6,
  },

  guestDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    background: colors.warning,
    borderRadius: '50%',
    border: `2px solid ${colors.background}`,
  },

  // Buttons
  ghostButton: {
    height: 40,
    padding: `0 ${spacing.md}px`,
    background: 'transparent',
    color: colors.textSecondary,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    borderRadius: borderRadius.md,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  primaryButton: {
    height: 40,
    padding: `0 ${spacing.lg}px`,
    background: colors.primary,
    color: colors.onPrimary,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    borderRadius: borderRadius.md,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  // Mobile Icon Button
  mobileIconButton: {
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: borderRadius.md,
    position: 'relative',
  },

  mobileIcon: {
    fontSize: fontSizes.xl,
  },
};

export default AuthSection;
