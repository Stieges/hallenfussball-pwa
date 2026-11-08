/**
 * Kopf der Zuschauer-Seite: Titel, Altersklasse • Datum, Abzeichen mit dem Teilen-Code, nach dem Ende der Hinweis „abgeschlossen“
 * (aus `LiveViewScreen` ausgelagert, Texte und Stile unverändert).
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { joinMeta } from '../../../core/view';
import { formatDateGerman } from '../../../utils/locationHelpers';
import type { Tournament } from '../../../types/tournament';
import { PublicEndedBadge } from './PublicFinalStandings';

export interface PublicPageHeaderProps {
  tournament: Pick<Tournament, 'title' | 'ageClass' | 'date'>;
  shareCode: string;
  ended: boolean;
}

const headerStyle: CSSProperties = { marginBottom: cssVars.spacing.lg, textAlign: 'center' };

const titleStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.xxl,
  fontWeight: cssVars.fontWeights.bold,
  color: cssVars.colors.textPrimary,
  marginBottom: cssVars.spacing.xs,
};

const subtitleStyle: CSSProperties = { fontSize: cssVars.fontSizes.md, color: cssVars.colors.textSecondary };

const shareCodeBadgeStyle: CSSProperties = {
  display: 'inline-block',
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
  background: cssVars.colors.primary,
  color: cssVars.colors.background,
  borderRadius: cssVars.borderRadius.full,
  fontSize: cssVars.fontSizes.sm,
  fontWeight: cssVars.fontWeights.semibold,
  letterSpacing: '0.1em',
  marginTop: cssVars.spacing.sm,
};

export function PublicPageHeader({ tournament, shareCode, ended }: PublicPageHeaderProps): ReactElement {
  const { t } = useTranslation('publicView');
  return (
    <div style={headerStyle}>
      <h1 style={titleStyle}>{tournament.title}</h1>
      <p style={subtitleStyle}>{joinMeta([tournament.ageClass, formatDateGerman(tournament.date)], ' • ')}</p>
      <div style={shareCodeBadgeStyle}>{t('liveView.badge', { code: shareCode })}</div>
      {ended && <div style={{ marginTop: cssVars.spacing.sm }}><PublicEndedBadge /></div>}
    </div>
  );
}
