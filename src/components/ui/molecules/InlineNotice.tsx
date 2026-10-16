/**
 * Hinweis innerhalb einer Ansicht (kein Toast). Nur Darstellung, keine Logik. Ton `warn` (Vorgabe), `info`, `error`, `ok`;
 * Text bleibt `textPrimary`, Rand, Fläche und Symbol tragen den Ton, das Symbol steht immer dabei: Farbe allein trägt keine
 * Bedeutung (VISUAL-DESIGN § 7). `icon` ersetzt das Symbol des Tons (z. B. „ohne Netz“). `role="status"`, bei `error`
 * `role="alert"`: Bildschirmleser lesen den Inhalt beim Erscheinen vor.
 */
import type { CSSProperties, ReactNode } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../Icons';

export type InlineNoticeTone = 'warn' | 'info' | 'error' | 'ok';

export interface InlineNoticeProps {
  children: ReactNode;
  tone?: InlineNoticeTone;
  /** Eigenes Symbol statt dem des Tons. */
  icon?: ReactNode;
  /** Test-ID für End-to-End- und Komponententests */
  'data-testid'?: string;
}

const TONES: Record<InlineNoticeTone, { background: string; border: string; symbol: string }> = {
  warn: { background: cssVars.colors.warningLight, border: cssVars.colors.warningBorder, symbol: cssVars.colors.warning },
  info: { background: cssVars.colors.infoLight, border: cssVars.colors.infoBorder, symbol: cssVars.colors.info },
  error: { background: cssVars.colors.errorLight, border: cssVars.colors.errorBorder, symbol: cssVars.colors.error },
  ok: { background: cssVars.colors.primaryLight, border: cssVars.colors.primary, symbol: cssVars.colors.primary },
};

const TONE_ICON: Record<InlineNoticeTone, ReactNode> = {
  warn: <Icons.AlertTriangle size={iconSizeValues.sm} />,
  info: <Icons.Info size={iconSizeValues.sm} />,
  error: <Icons.AlertTriangle size={iconSizeValues.sm} />,
  ok: <Icons.Check size={iconSizeValues.sm} />,
};

export const InlineNotice = ({ children, tone = 'warn', icon, 'data-testid': testId }: InlineNoticeProps) => {
  const style: CSSProperties = {
    background: TONES[tone].background,
    border: `${cssVars.borderWidth.thin} solid ${TONES[tone].border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    padding: cssVars.spacing.md,
    display: 'grid',
    gridTemplateColumns: `${cssVars.iconSizes.sm} minmax(0, 1fr)`,
    gap: cssVars.spacing.sm,
    alignItems: 'start',
    fontSize: cssVars.fontSizes.sm,
  };
  const symbol: CSSProperties = { color: TONES[tone].symbol, display: 'flex' };
  const body: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, minWidth: 0, overflowWrap: 'anywhere' };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} data-testid={testId} data-tone={tone} style={style}>
      <span style={symbol} aria-hidden="true">{icon ?? TONE_ICON[tone]}</span>
      <div style={body}>{children}</div>
    </div>
  );
};
