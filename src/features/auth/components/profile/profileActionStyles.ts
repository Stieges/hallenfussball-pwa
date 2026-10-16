import type { CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';

/** Gemeinsamer Stil der Profil-Aktionen (Abmelden, Passwort, Auf anderen Geräten abmelden). */
export const profileActionStyles: Record<string, CSSProperties> = {
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
  actionButtonDisabled: {
    color: cssVars.colors.textMuted,
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  divider: {
    height: '1px',
    background: cssVars.colors.border,
    margin: `${cssVars.spacing.xs} 0`,
  },
};
