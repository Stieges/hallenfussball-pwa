/**
 * A-15c Hinweis im Abschluss ohne Netz (Mockup A-13c Zustand {#offdlg}; @W2A-062, @TM-146, @TM-147): Warn-Kasten mit
 * Symbol „ohne Netz“, Titel „Keine Verbindung“ und dem Satz, dass der Abschluss sofort auf diesem Gerät gilt und gesendet
 * wird, sobald die Verbindung steht. Steht im Abschluss-Dialog und im Gleichstands-Dialog „mit Abschluss“.
 */
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';

const title: CSSProperties = { fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md };
const text: CSSProperties = { margin: 0 };

export const OfflineQueuedNotice = ({ 'data-testid': testId }: { 'data-testid': string }) => {
  const { t } = useTranslation('tournament');
  return (
    <InlineNotice tone="warn" icon={<Icons.WifiOff size={iconSizeValues.sm} />} data-testid={testId}>
      <span style={title}>{t('groupCompletion.offline.title')}</span>
      <p style={text}>{t('groupCompletion.offline.body')}</p>
    </InlineNotice>
  );
};
