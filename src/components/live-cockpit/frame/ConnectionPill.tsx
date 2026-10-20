/**
 * ConnectionPill – Verbindungsanzeige im schmalen Kopf (Plan LT-2, @SL-140 „Verbindungsstatus“, K2).
 * Im Vollbild entfallen die festen Hinweisleisten der App (Offline, Speicher); der Kopf sagt, ob das Gerät Netz hat.
 * Text und Punkt, nie Farbe allein (WCAG 1.4.1). Am Handy steht bei Netz nur der Punkt (Name über aria-label, Mockup handy-b), damit der
 * Kopf einzeilig bleibt; ohne Netz steht auch am Handy der Text.
 */
import { useTranslation } from 'react-i18next';
import type { CSSProperties, ReactElement } from 'react';
import { cssVars } from '../../../design-tokens';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { useBreakpoint } from '../../../hooks/useBreakpoint';

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
  const nurPunkt = useBreakpoint().isMobile && isOnline;
  const text = isOnline ? t('rahmen.online') : t('rahmen.offline');
  return (
    <span style={pillStil(isOnline)} role="status" aria-label={nurPunkt ? text : undefined} data-testid="cockpit-verbindung" data-online={isOnline ? 'true' : 'false'}>
      <span style={punktStil(isOnline)} aria-hidden="true" />
      {!nurPunkt && text}
    </span>
  );
}
