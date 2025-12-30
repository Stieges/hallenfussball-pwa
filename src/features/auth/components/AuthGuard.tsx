/**
 * AuthGuard - Wrapper-Komponente für Auth-Schutz
 *
 * Schützt Inhalte vor nicht authentifizierten Zugriffen.
 * Ruft onUnauthenticated Callback auf statt zu redirecten.
 *
 * @example
 * ```tsx
 * <AuthGuard
 *   onUnauthenticated={() => setScreen('login')}
 * >
 *   <ProtectedContent />
 * </AuthGuard>
 * ```
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md
 */

import React, { CSSProperties } from 'react';
import { colors, spacing, fontSizes } from '../../../design-tokens';
import { useAuth } from '../hooks/useAuth';

interface AuthGuardProps {
  /** Child components to render if authenticated */
  children: React.ReactNode;
  /**
   * Allow guests to access. Default: false
   * If true, guests can access but will see content
   */
  allowGuest?: boolean;
  /**
   * Required global role. Default: none (any authenticated user)
   */
  requireRole?: 'user' | 'admin';
  /**
   * Callback when user is not authenticated
   */
  onUnauthenticated?: () => void;
  /**
   * Fallback component shown while loading
   */
  fallback?: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  allowGuest = false,
  requireRole,
  onUnauthenticated,
  fallback,
}) => {
  const { user, isGuest, isLoading } = useAuth();

  // Show loading state
  if (isLoading) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Laden...</p>
      </div>
    );
  }

  // Not authenticated at all
  if (!user) {
    onUnauthenticated?.();
    return (
      <div style={styles.unauthenticated}>
        <p style={styles.unauthText}>Bitte melde dich an, um fortzufahren.</p>
      </div>
    );
  }

  // Is guest but guests not allowed
  if (isGuest && !allowGuest) {
    onUnauthenticated?.();
    return (
      <div style={styles.unauthenticated}>
        <p style={styles.unauthText}>Bitte registriere dich, um auf diesen Bereich zuzugreifen.</p>
      </div>
    );
  }

  // Check required role
  if (requireRole) {
    const hasRequiredRole =
      requireRole === 'admin'
        ? user.globalRole === 'admin'
        : user.globalRole === 'user' || user.globalRole === 'admin';

    if (!hasRequiredRole) {
      return (
        <div style={styles.forbidden}>
          <div style={styles.forbiddenIcon}>🔒</div>
          <h2 style={styles.forbiddenTitle}>Zugriff verweigert</h2>
          <p style={styles.forbiddenText}>
            Du hast nicht die erforderlichen Berechtigungen für diese Seite.
          </p>
        </div>
      );
    }
  }

  // All checks passed
  return <>{children}</>;
};

// Styles using design tokens
const styles: Record<string, CSSProperties> = {
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    gap: spacing.md,
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: `3px solid ${colors.border}`,
    borderTopColor: colors.primary,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    margin: 0,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  unauthenticated: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    padding: spacing.xl,
  },
  unauthText: {
    margin: 0,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  forbidden: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '300px',
    padding: spacing.xl,
    textAlign: 'center',
  },
  forbiddenIcon: {
    fontSize: '48px',
    marginBottom: spacing.md,
  },
  forbiddenTitle: {
    margin: 0,
    marginBottom: spacing.sm,
    fontSize: fontSizes.xl,
    color: colors.textPrimary,
  },
  forbiddenText: {
    margin: 0,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    maxWidth: '400px',
  },
};

export default AuthGuard;
