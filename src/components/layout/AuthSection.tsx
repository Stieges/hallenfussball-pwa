/**
 * AuthSection - Auth-Status und Navigation im Header
 *
 * Zeigt je nach Auth-Zustand:
 * - Loading (mit cached user): Avatar-Skeleton
 * - Loading (ohne cached user): Sofort Login/Register Buttons (Optimistic UI)
 * - Gast: Gast-Badge + Registrieren
 * - Nicht eingeloggt: Anmelden + Registrieren
 * - Eingeloggt: Name + Avatar Dropdown
 *
 * Features:
 * - Optimistic UI: Login-Buttons erscheinen sofort, nicht erst nach Auth-Timeout
 * - Aria-Live Region für Screenreader-Ankündigungen bei Auth-Wechsel
 *
 * @see docs/concepts/HEADER-AUTH-NAVIGATION-KONZEPT.md
 */

import React, { useState, useRef, useEffect, useMemo, CSSProperties } from 'react';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useIsMobile } from '../../hooks/useIsMobile';
import { MobileAuthBottomSheet } from '../../features/auth/components/MobileAuthBottomSheet';
import { Button } from '../ui/Button';
import { cssVars } from '../../design-tokens';
import { Icons } from '../ui/Icons';

interface AuthSectionProps {
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
  onNavigateToProfile: () => void;
  onNavigateToSettings?: () => void;
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

/**
 * HeaderOfflineBadge - Compact offline indicator for header placement
 * Shows when connectionState is 'offline' with a reconnect button
 */
const HeaderOfflineBadge: React.FC<{
  onReconnect: () => void;
}> = ({ onReconnect }) => (
  <Button
    variant="secondary"
    size="sm"
    onClick={onReconnect}
    aria-label="Offline - Klicken zum erneut verbinden"
    data-testid="auth-offline-badge"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: cssVars.spacing.xs,
      backgroundColor: cssVars.colors.correctionBg,
      borderColor: cssVars.colors.correctionBorder,
      color: cssVars.colors.correctionText,
    }}
  >
    <span role="img" aria-hidden="true">📡</span>
    <span>Offline</span>
  </Button>
);

export const AuthSection: React.FC<AuthSectionProps> = ({
  onNavigateToLogin,
  onNavigateToRegister,
  onNavigateToProfile,
  onNavigateToSettings,
}) => {
  const { user, isAuthenticated, isGuest, isLoading, logout, connectionState, reconnect } = useAuth();
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

  // Check if we have a cached authenticated user (for optimistic UI during loading)
  // This allows us to show avatar skeleton only when we expect a logged-in user
  // We use state instead of memo so we can clear it after a timeout
  const [showSkeleton, setShowSkeleton] = useState(() => {
    try {
      return localStorage.getItem('auth:cachedUser') !== null;
    } catch {
      return false;
    }
  });

  // Skeleton timeout: If auth takes longer than 3s, show buttons instead of skeleton
  // This prevents users from being stuck on skeleton if session is stale
  useEffect(() => {
    if (isLoading && showSkeleton) {
      const timer = setTimeout(() => {
        setShowSkeleton(false);
        // Also clear the stale cache so next page load doesn't have this issue
        try {
          localStorage.removeItem('auth:cachedUser');
        } catch {
          // localStorage not available
        }
      }, 3000); // 3 seconds max skeleton time
      return () => clearTimeout(timer);
    }
  }, [isLoading, showSkeleton]);

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

  // Loading State - Optimistic UI:
  // Only show skeleton if we expect a logged-in user (cached user exists).
  // Skeleton auto-clears after 3s to prevent stuck UI on stale sessions.
  // Otherwise, show login/register buttons immediately for instant interactivity.
  if (isLoading && showSkeleton) {
    return (
      <div style={styles.container}>
        <VisuallyHidden>{statusText}</VisuallyHidden>
        {connectionState === 'offline' && (
          <HeaderOfflineBadge onReconnect={() => void reconnect()} />
        )}
        {/* Show avatar skeleton only - expecting authenticated user */}
        <div style={styles.avatarSkeleton} aria-hidden="true" />
      </div>
    );
  }
  // If isLoading && !hasCachedUser: fall through to "not logged in" buttons below

  // Eingeloggt
  if (isAuthenticated && user) {
    const initials = getInitials(user.name);

    return (
      <div style={styles.container} ref={dropdownRef}>
        <VisuallyHidden>{statusText}</VisuallyHidden>
        {/* Offline Badge */}
        {connectionState === 'offline' && (
          <HeaderOfflineBadge onReconnect={() => void reconnect()} />
        )}
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
              <span style={styles.dropdownIcon}><Icons.User size={18} color="currentColor" /></span>
              Mein Profil
            </button>

            <button
              ref={(el) => { menuItemsRef.current[1] = el; }}
              type="button"
              role="menuitem"
              onClick={() => {
                setDropdownOpen(false);
                onNavigateToSettings?.();
              }}
              style={styles.dropdownItem}
              data-testid="auth-settings-button"
            >
              <span style={styles.dropdownIcon}><Icons.Settings size={18} color="currentColor" /></span>
              Einstellungen
            </button>

            <div style={styles.dropdownDivider} />

            <button
              ref={(el) => { menuItemsRef.current[2] = el; }}
              type="button"
              role="menuitem"
              onClick={() => {
                setDropdownOpen(false);
                void logout();
              }}
              style={{ ...styles.dropdownItem, ...styles.dropdownItemDanger }}
              data-testid="auth-logout-button"
            >
              <span style={styles.dropdownIcon}><Icons.LogOut size={18} color="currentColor" /></span>
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
          {/* Offline Badge */}
          {connectionState === 'offline' && (
            <HeaderOfflineBadge onReconnect={() => void reconnect()} />
          )}
          {/* Gast-Badge (nur Desktop) */}
          {!isMobile && (
            <div style={styles.guestBadge} data-testid="auth-guest-badge">
              <Icons.User size={16} color={cssVars.colors.textTertiary} />
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
              <Icons.User size={24} color={cssVars.colors.textSecondary} />
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
        {/* Offline Badge */}
        {connectionState === 'offline' && (
          <HeaderOfflineBadge onReconnect={() => void reconnect()} />
        )}
        {/* Mobile: Single Icon - öffnet BottomSheet */}
        {isMobile ? (
          <button
            type="button"
            onClick={() => setBottomSheetOpen(true)}
            style={styles.mobileIconButton}
            aria-label="Konto-Optionen öffnen"
            data-testid="auth-mobile-button"
          >
            <Icons.User size={24} color={cssVars.colors.textSecondary} />
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
    gap: cssVars.spacing.sm,
    position: 'relative',
  },

  // Skeleton
  skeleton: {
    width: 80,
    height: 36,
    background: cssVars.colors.surfaceElevated,
    borderRadius: cssVars.borderRadius.md,
    animation: 'pulse 1.5s ease-in-out infinite',
  },

  // Avatar Skeleton (for cached user loading state)
  avatarSkeleton: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: cssVars.colors.surfaceElevated,
    animation: 'pulse 1.5s ease-in-out infinite',
  },

  // User Name
  userName: {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  },

  // Avatar
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: cssVars.colors.primary,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'box-shadow 0.2s ease',
  },

  avatarText: {
    color: cssVars.colors.onPrimary,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    textTransform: 'uppercase',
  },

  // Dropdown
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: cssVars.spacing.xs,
    minWidth: 240,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.md,
    boxShadow: cssVars.shadows.lg,
    border: `1px solid ${cssVars.colors.border}`,
    overflow: 'hidden',
    zIndex: 1100, // Higher than BottomNavigation (1000)
  },

  dropdownHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surfaceElevated,
  },

  dropdownAvatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: cssVars.colors.primary,
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
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  dropdownUserEmail: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  dropdownDivider: {
    height: 1,
    background: cssVars.colors.border,
  },

  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    width: '100%',
    padding: `${cssVars.spacing.sm}px ${cssVars.spacing.md}px`,
    background: 'transparent',
    border: 'none',
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textPrimary,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.2s ease',
  },

  dropdownItemDanger: {
    color: cssVars.colors.error,
  },

  dropdownIcon: {
    fontSize: cssVars.fontSizes.lg,
    width: 24,
    textAlign: 'center',
  },

  // Guest Badge
  guestBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    height: 36,
    padding: `0 ${cssVars.spacing.sm}px`,
    background: cssVars.colors.surfaceElevated,
    color: cssVars.colors.textTertiary,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    borderRadius: cssVars.borderRadius.full,
  },

  guestIcon: {
    fontSize: cssVars.fontSizes.md,
  },

  guestInfoIcon: {
    fontSize: cssVars.fontSizes.xs,
    opacity: 0.6,
  },

  guestDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    background: cssVars.colors.warning,
    borderRadius: '50%',
    border: `2px solid ${cssVars.colors.background}`,
  },

  // Buttons
  ghostButton: {
    height: 40,
    padding: `0 ${cssVars.spacing.md}px`,
    background: 'transparent',
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    borderRadius: cssVars.borderRadius.md,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  primaryButton: {
    height: 40,
    padding: `0 ${cssVars.spacing.lg}px`,
    background: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    borderRadius: cssVars.borderRadius.md,
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
    borderRadius: cssVars.borderRadius.md,
    position: 'relative',
  },

  mobileIcon: {
    fontSize: cssVars.fontSizes.xl,
  },
};

export default AuthSection;
