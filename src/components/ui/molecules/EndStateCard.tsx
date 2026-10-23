/**
 * Endzustand-Karte (A-17b, Mockup M2 `.endc`): zentrierte Karte mit Symbolkreis, Titel, Text und höchstens einer Taste.
 * Eine ganze Seite mit nur einer Aussage; ein Hinweis in einer leeren Seite wirkt verloren. Töne: `error` rot
 * (ungültig, abgelehnt), `warn` orange, `info` blau, `neutral` grau (abgelaufen, abgeschlossen). Das Symbol steht immer dabei:
 * Farbe allein trägt keine Bedeutung. Fachfrei – Texte, Symbol und Taste bestimmt der Aufrufer.
 */
import type { CSSProperties, ReactNode } from 'react';
import { cssVars } from '../../../design-tokens';

export type EndStateTone = 'neutral' | 'error' | 'warn' | 'info';

export interface EndStateCardProps {
  tone?: EndStateTone;
  icon: ReactNode;
  title: string;
  text?: string;
  /** Zusatz unter dem Text (z. B. ein Satz in `textSecondary`). */
  extra?: ReactNode;
  /** Die eine Taste der Karte (Haupttaste, volle Breite). */
  action?: ReactNode;
  'data-testid'?: string;
}

const TONE: Record<EndStateTone, { border: string; color: string; wash: string | null }> = {
  neutral: { border: cssVars.colors.borderControl, color: cssVars.colors.textSecondary, wash: null },
  error: { border: cssVars.colors.error, color: cssVars.colors.error, wash: cssVars.colors.errorLight },
  warn: { border: cssVars.colors.warning, color: cssVars.colors.warning, wash: cssVars.colors.warningLight },
  info: { border: cssVars.colors.info, color: cssVars.colors.info, wash: cssVars.colors.infoLight },
};

const card: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  textAlign: 'center',
  gap: cssVars.spacing.sm,
  padding: `${cssVars.spacing.lg} ${cssVars.spacing.md}`,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  borderRadius: cssVars.borderRadius.md,
  background: cssVars.colors.surface,
  color: cssVars.colors.textPrimary,
};
const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: cssVars.fontSizes.xl,
  lineHeight: cssVars.lineHeights.title,
  fontWeight: cssVars.fontWeights.bold,
  overflowWrap: 'break-word',
  maxWidth: '100%',
};
const textStyle: CSSProperties = { margin: 0, maxWidth: '100%', overflowWrap: 'break-word', fontSize: cssVars.fontSizes.md };
const actionStyle: CSSProperties = { width: '100%', marginTop: cssVars.spacing.sm, display: 'flex', flexDirection: 'column' };

export const EndStateCard = ({ tone = 'neutral', icon, title, text, extra, action, 'data-testid': testId = 'end-state-card' }: EndStateCardProps) => {
  const t = TONE[tone];
  const circle: CSSProperties = {
    width: cssVars.touchTargets.primary,
    height: cssVars.touchTargets.primary,
    borderRadius: cssVars.borderRadius.full,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `${cssVars.borderWidth.thin} solid ${t.border}`,
    color: t.color,
    backgroundColor: cssVars.colors.background,
    backgroundImage: t.wash ? `linear-gradient(${t.wash}, ${t.wash})` : undefined,
  };
  return (
    <section style={card} data-testid={testId} data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
      <span style={circle} aria-hidden="true">{icon}</span>
      <h2 style={titleStyle}>{title}</h2>
      {text ? <p style={textStyle}>{text}</p> : null}
      {extra}
      {action ? <div style={actionStyle}>{action}</div> : null}
    </section>
  );
};
