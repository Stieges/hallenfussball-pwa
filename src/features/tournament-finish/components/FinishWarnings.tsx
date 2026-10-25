/**
 * Warnungen vor dem Abschluss (@LZ-018, @FU-068, Review #392 M1/H2): „Feld 2: 3 Einträge noch nicht übertragen“ mit dem Stand der
 * letzten Meldung des Geräts („Stand 13:05“); meldet sich ein Gerät nicht mehr (auch ein gesperrter Bildschirm drosselt die
 * Meldung), steht „Gerät meldet sich nicht“ mit dem Grund in Klartext. Eine Warnung sperrt nie – der Abschluss bleibt möglich.
 */
import { useTranslation } from 'react-i18next';
import type { FinishWarning } from '../../../core/repositories/lifecycleRpc';
import { iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { formatClock } from '../model/finishFormat';
import { small, strong } from './finishStyles';

export function FinishWarnings({ warnings }: { warnings: readonly FinishWarning[] }) {
  const { t, i18n } = useTranslation('tournament');
  if (warnings.length === 0) {
    return null;
  }
  return (
    <>
      {warnings.map((warning) => {
        if (warning.kind === 'outbox_pending') {
          const time = formatClock(warning.reportedAt, i18n.language);
          return (
            <InlineNotice key={`${warning.kind}:${warning.deviceId}`} tone="info" icon={<Icons.Upload size={iconSizeValues.sm} />} data-testid="finish-warning">
              <span style={strong}>
                {warning.field === undefined
                  ? t('finish.warning.outboxNoField', { count: warning.pending })
                  : t('finish.warning.outbox', { count: warning.pending, field: warning.field })}
              </span>
              <span style={small}>{time === null ? t('finish.warning.outboxDetailNoTime') : t('finish.warning.outboxDetail', { time })}</span>
            </InlineNotice>
          );
        }
        const time = formatClock(warning.since, i18n.language);
        return (
          <InlineNotice key={`${warning.kind}:${warning.deviceId}`} tone="info" icon={<Icons.Upload size={iconSizeValues.sm} />} data-testid="finish-warning">
            <span style={strong}>{t('finish.warning.silent', { field: warning.field })}</span>
            <span style={small}>{time === null ? t('finish.warning.silentDetailNoTime') : t('finish.warning.silentDetail', { time })}</span>
          </InlineNotice>
        );
      })}
    </>
  );
}
