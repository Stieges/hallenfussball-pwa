/**
 * ConnectionPill – Verbindungsanzeige im schmalen Kopf (Plan LT-2, @SL-140 „Verbindungsstatus“, K2).
 * Im Vollbild entfallen die festen Hinweisleisten der App (Offline, Speicher); der Kopf sagt, ob das Gerät Netz hat.
 * Text und Punkt, nie Farbe allein (WCAG 1.4.1).
 */
import { useTranslation } from 'react-i18next';
import type { CSSProperties, ReactElement } from 'react';
import { cssVars } from '../../../design-tokens';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';

const pillStil = (online: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: cssVars.spacing.xs, flex: 'none',
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`, borderRadius: cssVars.borderRadius.full,
  fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.medium,
  background: online ? cssVars.colors.successLight : cssVars.colors.warningBannerBg,
  border: `${cssVars.borderWidth.thin} solid ${online ? cssVars.colors.success : cssVars.colors.warningBannerBorder}`,
  color: cssVars.colors.textPrimary,
});
const punktStil = (online: boolean): CSSProperties => ({
  width: cssVars.spacing.sm, height: cssVars.spacing.sm, borderRadius: cssVars.borderRadius.full,
  background: online ? cssVars.colors.success : cssVars.colors.warning,
});

export function ConnectionPill(): ReactElement {
  const { t } = useTranslation('cockpit');
  const { isOnline } = useOnlineStatus();
  return (
    <span style={pillStil(isOnline)} role="status" data-testid="cockpit-verbindung" data-online={isOnline ? 'true' : 'false'}>
      <span style={punktStil(isOnline)} aria-hidden="true" />
      {isOnline ? t('rahmen.online') : t('rahmen.offline')}
    </span>
  );
}
