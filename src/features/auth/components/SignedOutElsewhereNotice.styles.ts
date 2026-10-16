/**
 * Styles des globalen Hinweises „Du wurdest von einem anderen Gerät aus abgemeldet“ (A-07d2, B2).
 * Ausschließlich Design-Tokens.
 */

import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';

export const signedOutNoticeStyles: Record<'container' | 'message', CSSProperties> = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: cssVars.zIndex.banner,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: cssVars.spacing.md,
    padding: `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    background: cssVars.colors.surfaceElevated,
    borderBottom: `1px solid ${cssVars.colors.infoBorder}`,
    boxShadow: cssVars.shadows.md,
  },
  message: {
    flex: 1,
    margin: 0,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textPrimary,
  },
};
