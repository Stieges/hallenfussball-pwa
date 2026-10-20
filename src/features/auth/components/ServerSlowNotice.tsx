/**
 * Hinweis „Server antwortet langsam“ (Ü1.3, @AN-019, @AN-032).
 *
 * Kein „offline“ und keine Sperre: nur ein ruhiger Hinweis am oberen Rand, solange die Antwort des
 * Servers aussteht. Er verschwindet von selbst, sobald der Server antwortet (der Aufrufer steuert
 * `visible`).
 */

import { useTranslation } from 'react-i18next';
import { useKioskRoute } from '../../../hooks/useKioskRoute';
import { signedOutNoticeStyles as styles } from './SignedOutElsewhereNotice.styles';

interface ServerSlowNoticeProps {
  visible: boolean;
}

export function ServerSlowNotice({ visible }: ServerSlowNoticeProps) {
  const { t } = useTranslation('auth');
  // Kiosk-Routen (Hallenmonitor) zeigen keine Anmelde-Hinweise (@ME-003, @OB-028).
  const kiosk = useKioskRoute();
  if (!visible || kiosk) {
    return null;
  }
  return (
    <div role="status" data-testid="server-slow" style={styles.container}>
      <p style={styles.message}>{t('notices.serverSlow')}</p>
    </div>
  );
}
