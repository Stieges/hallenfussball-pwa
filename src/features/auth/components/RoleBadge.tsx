/**
 * RoleBadge - Zeigt die Turnier-Rolle als farbiges Badge an
 *
 * Farben nach Rolle:
 * - owner: Grün (Primary)
 * - co-admin: Orange (Warning)
 * - trainer: Blau (Info)
 * - collaborator: Grau (Elevated)
 * - viewer: Grau (Subtle)
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 7.1
 */

import React, { CSSProperties } from 'react';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '../../../design-tokens';
import type { TournamentRole } from '../types/auth.types';
import { ROLE_LABELS } from '../types/auth.types';

/**
 * Rollen-Farben nach Konzept
 */
const roleColors: Record<
  TournamentRole,
  { background: string; text: string; border?: string }
> = {
  owner: {
    background: colors.primary,
    text: colors.onPrimary,
  },
  'co-admin': {
    background: colors.warning,
    text: colors.onWarning,
  },
  trainer: {
    background: colors.info,
    text: colors.onPrimary,
  },
  collaborator: {
    background: colors.surfaceLight,
    text: colors.textSecondary,
    border: colors.border,
  },
  viewer: {
    background: colors.surface,
    text: colors.textTertiary,
    border: colors.border,
  },
};

interface RoleBadgeProps {
  /** Die anzuzeigende Rolle */
  role: TournamentRole;
  /** Kompakte Variante (nur Icon/Kürzel) */
  compact?: boolean;
  /** Zeigt die Beschreibung statt des Labels */
  showDescription?: boolean;
  /** Größenvariante */
  size?: 'sm' | 'md' | 'lg';
  /** Zusätzliche CSS-Klassen */
  className?: string;
  /** Zusätzliche Inline-Styles */
  style?: CSSProperties;
}

/**
 * RoleBadge - Zeigt die Turnier-Rolle als farbiges Badge an
 *
 * @example
 * ```tsx
 * <RoleBadge role="owner" />
 * <RoleBadge role="trainer" size="sm" />
 * <RoleBadge role="co-admin" showDescription />
 * ```
 */
export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  compact = false,
  showDescription = false,
  size = 'md',
  className,
  style,
}) => {
  const roleColor = roleColors[role];
  const roleLabel = ROLE_LABELS[role];

  const sizeStyles: Record<'sm' | 'md' | 'lg', CSSProperties> = {
    sm: {
      padding: `2px ${spacing.xs}`,
      fontSize: fontSizes.xs,
    },
    md: {
      padding: `${spacing.xs} ${spacing.sm}`,
      fontSize: fontSizes.sm,
    },
    lg: {
      padding: `${spacing.sm} ${spacing.md}`,
      fontSize: fontSizes.md,
    },
  };

  const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    backgroundColor: roleColor.background,
    color: roleColor.text,
    border: roleColor.border ? `1px solid ${roleColor.border}` : 'none',
    borderRadius: borderRadius.full,
    fontWeight: fontWeights.medium,
    whiteSpace: 'nowrap',
    ...sizeStyles[size],
    ...style,
  };

  const text = showDescription ? roleLabel.description : roleLabel.label;

  // Kompakt-Variante: nur erster Buchstabe oder Kürzel
  if (compact) {
    const shortLabel = role === 'co-admin' ? 'CA' : roleLabel.label.charAt(0);
    return (
      <span style={badgeStyle} className={className} title={roleLabel.label}>
        {shortLabel}
      </span>
    );
  }

  return (
    <span style={badgeStyle} className={className}>
      {text}
    </span>
  );
};

export default RoleBadge;
