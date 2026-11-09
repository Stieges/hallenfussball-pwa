/**
 * Kopf der Zuschauer-Seite: Titel, Altersklasse • Datum, nach dem Ende der Hinweis „abgeschlossen“ (aus `LiveViewScreen` ausgelagert).
 * Kein Abzeichen mit dem Freigabe-Code („LIVE: MESS26“, @ZM-196): der Code gehört nicht in den Seitenkopf.
 */
import type { CSSProperties, ReactElement } from 'react';
import { cssVars } from '../../../design-tokens';
import { joinMeta } from '../../../core/view';
import { formatDateGerman } from '../../../utils/locationHelpers';
import type { Tournament } from '../../../types/tournament';
import { PublicEndedBadge } from './PublicFinalStandings';

export interface PublicPageHeaderProps {
  tournament: Pick<Tournament, 'title' | 'ageClass' | 'date'>;
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

export function PublicPageHeader({ tournament, ended }: PublicPageHeaderProps): ReactElement {
  return (
    <div style={headerStyle}>
      <h1 style={titleStyle}>{tournament.title}</h1>
      <p style={subtitleStyle}>{joinMeta([tournament.ageClass, formatDateGerman(tournament.date)], ' • ')}</p>
      {ended && <div style={{ marginTop: cssVars.spacing.sm }}><PublicEndedBadge /></div>}
    </div>
  );
}
