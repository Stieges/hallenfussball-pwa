/**
 * Hinweis im Warn-Stil innerhalb einer Ansicht (kein Toast). Nur Darstellung, keine Logik.
 * `role="status"`: Bildschirmleser lesen den Inhalt beim Erscheinen vor.
 */
import type { CSSProperties, ReactNode } from 'react';
import { cssVars } from '../../../design-tokens';

export interface InlineNoticeProps {
  children: ReactNode;
  /** Test-ID für End-to-End- und Komponententests */
  'data-testid'?: string;
}

const noticeStyle: CSSProperties = {
  background: cssVars.colors.warningLight,
  border: `1px solid ${cssVars.colors.warningBorder}`,
  borderRadius: cssVars.borderRadius.md,
  color: cssVars.colors.textPrimary,
  padding: cssVars.spacing.md,
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.sm,
  fontSize: cssVars.fontSizes.sm,
};

export const InlineNotice = ({ children, 'data-testid': testId }: InlineNoticeProps) => (
  <div role="status" data-testid={testId} style={noticeStyle}>
    {children}
  </div>
);
