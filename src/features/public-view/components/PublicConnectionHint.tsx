/**
 * Hinweis „Stand von 14:32 – keine Verbindung“ über dem letzten Stand (B-15, @ZM-032, @ZM-109).
 * Reine Anzeige: der Hinweis kommt fertig aus `useConnectionHint`; das Symbol steht dabei, Farbe allein trägt nichts.
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { Icons } from '../../../components/ui/Icons';
import { iconSizeValues } from '../../../design-tokens';
import type { ConnectionHint } from '../useConnectionHint';

export function PublicConnectionHint({ hint }: { hint: ConnectionHint }): ReactElement {
  const { t } = useTranslation('publicView');
  return (
    <InlineNotice tone="warn" icon={<Icons.WifiOff size={iconSizeValues.sm} />} data-testid="public-connection-hint">
      {t('connection.stale', { time: hint.time })}
    </InlineNotice>
  );
}
