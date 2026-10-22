/**
 * Turnierkarte der Helfer-Seite (A-17b, @HE-033, @HE-004): nur Turniername und Datum, sonst nichts. Zustände ohne Beziehung
 * zum Turnier (ungültig, abgelaufen …) zeigen sie nicht – dort gibt es nur `{ state }` vom Server.
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { formatJoinDate } from '../joinPaths';

export interface JoinInfoCardProps {
  title: string;
  date: string;
}

const card: CSSProperties = {
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  background: cssVars.colors.surface,
  borderRadius: cssVars.borderRadius.md,
  padding: cssVars.spacing.md,
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.sm,
};
const meta: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs };
const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: cssVars.fontSizes.xl,
  lineHeight: cssVars.lineHeights.title,
  fontWeight: cssVars.fontWeights.bold,
  overflowWrap: 'break-word',
};

export const JoinInfoCard = ({ title, date }: JoinInfoCardProps) => {
  const { t, i18n } = useTranslation('helpers');
  return (
    <section style={card} data-testid="join-info-card">
      <p style={meta}>{t('join.forTournament')}</p>
      <h2 style={titleStyle}>{title}</h2>
      <p style={meta}>{formatJoinDate(date, i18n.language)}</p>
    </section>
  );
};
