/**
 * Styles des globalen Hinweises „Du wurdest von einem anderen Gerät aus abgemeldet“ (A-07d2, B2).
 * Ausschließlich Design-Tokens. Hinweise liegen im Fluss und schieben den Inhalt nach unten (C-HINWEIS-LANGSAM-VERDECKT).
 */

import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';

export const signedOutNoticeStyles: Record<'container' | 'message', CSSProperties> = {
  container: {
    // Im Fluss oberhalb der Seite (nicht darüber gelegt): der Inhalt rückt nach unten und bleibt bedienbar.
    position: 'relative',
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
