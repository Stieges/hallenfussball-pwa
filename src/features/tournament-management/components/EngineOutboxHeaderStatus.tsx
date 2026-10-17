/**
 * EngineOutboxHeaderStatus (A-08f3e3, M-1): wartende und nicht übernommene Einträge im Kopf der
 * Turnierverwaltung -- auch im Spielplan. Datenquelle wie `AdminHeader.tsx` (useRejectedOutboxDialog +
 * RejectedOutboxDialog); bewusst OHNE den Realtime-Hinweis von SyncStatusIndicator: der Spielplan zeigt bei
 * geschlossenem Kanal keinen Hinweis (@FU-087), er liest über die Abfrage. Im Live-Tab zeigt das Cockpit
 * denselben Status selbst. Szenarien: @FU-002 („1 Eintrag wartet“), @FU-004 (Ablehnung sichtbar mit Grund).
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../components/ui/Toast';
import { cssVars } from '../../../design-tokens';
import { SyncRejectedHint } from '../../collaboration/components/SyncRejectedHint';
import { RejectedOutboxDialog } from '../../collaboration/outbox/RejectedOutboxDialog';
import { useRejectedOutboxDialog } from '../../collaboration/outbox/useRejectedOutboxDialog';

const wrapStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: cssVars.spacing.xs,
  marginRight: cssVars.spacing.sm,
  flexShrink: 0,
};

const waitingStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textPrimary,
  background: cssVars.colors.warningBannerBg,
  border: `1px solid ${cssVars.colors.warningBannerBorder}`,
  borderRadius: cssVars.borderRadius.sm,
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
};

const rejectedStyle: CSSProperties = {
  ...waitingStyle,
  minHeight: cssVars.touchTargets.minimum,
  background: cssVars.colors.errorLight,
  border: `1px solid ${cssVars.colors.error}`,
  fontWeight: cssVars.fontWeights.semibold,
  cursor: 'pointer',
};

export function EngineOutboxHeaderStatus({ tournamentId }: { tournamentId: string }) {
  const { t } = useTranslation('common');
  const { showError } = useToast();
  const outbox = useRejectedOutboxDialog(tournamentId, showError);
  return (
    <span style={wrapStyle} data-testid="engine-outbox-status">
      {outbox.pendingCount > 0 && (
        <span role="status" data-testid="engine-outbox-waiting" style={waitingStyle}>
          {t('syncStatus.waiting', { count: outbox.pendingCount })}
        </span>
      )}
      {outbox.rejectedCount > 0 && (
        <SyncRejectedHint count={outbox.rejectedCount} style={rejectedStyle} onShowRejected={outbox.show} />
      )}
      <RejectedOutboxDialog isOpen={outbox.isOpen} onClose={outbox.close} entries={outbox.entries} onDismiss={outbox.handleDismiss} />
    </span>
  );
}
