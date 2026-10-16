/**
 * Hinweis innerhalb einer Ansicht (kein Toast). Nur Darstellung, keine Logik. Ton `warn` (Vorgabe), `info`, `error`, `ok`;
 * Text bleibt `textPrimary`, nur Rand und Fläche tragen den Ton. `role="status"`, bei `error` `role="alert"`: Bildschirmleser
 * lesen den Inhalt beim Erscheinen vor.
 */
import type { CSSProperties, ReactNode } from 'react';
import { cssVars } from '../../../design-tokens';

export type InlineNoticeTone = 'warn' | 'info' | 'error' | 'ok';

export interface InlineNoticeProps {
  children: ReactNode;
  tone?: InlineNoticeTone;
  /** Test-ID für End-to-End- und Komponententests */
  'data-testid'?: string;
}

const TONES: Record<InlineNoticeTone, { background: string; border: string }> = {
  warn: { background: cssVars.colors.warningLight, border: cssVars.colors.warningBorder },
  info: { background: cssVars.colors.infoLight, border: cssVars.colors.infoBorder },
  error: { background: cssVars.colors.errorLight, border: cssVars.colors.errorBorder },
  ok: { background: cssVars.colors.primaryLight, border: cssVars.colors.primary },
};

export const InlineNotice = ({ children, tone = 'warn', 'data-testid': testId }: InlineNoticeProps) => {
  const style: CSSProperties = {
    background: TONES[tone].background,
    border: `${cssVars.borderWidth.thin} solid ${TONES[tone].border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    padding: cssVars.spacing.md,
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
    fontSize: cssVars.fontSizes.sm,
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} data-testid={testId} style={style}>
      {children}
    </div>
  );
};
