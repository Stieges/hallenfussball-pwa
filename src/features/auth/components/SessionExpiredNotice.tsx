/**
 * Globaler Hinweis „Deine Anmeldung ist abgelaufen – bitte melde dich neu an“ (Ü1.2, @AN-021).
 *
 * Erscheint auf der Route, auf der das Gerät gerade steht, ohne Navigation. Auf /login zeigt die
 * Anmeldeseite den Hinweis selbst. Schließen löscht den Merker.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { AUTH_ERRORS } from '../constants/errorMessages';
import {
  clearSessionExpired,
  hasSessionExpired,
  SESSION_EXPIRED_CHANGED,
} from '../context/sessionExpired';
import { signedOutNoticeStyles as styles } from './SignedOutElsewhereNotice.styles';

const LOGIN_PATH = '/login';

export function SessionExpiredNotice() {
  const { t } = useTranslation('common');
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(hasSessionExpired);

  useEffect(() => {
    const sync = (): void => setVisible(hasSessionExpired());
    window.addEventListener(SESSION_EXPIRED_CHANGED, sync);
    return () => window.removeEventListener(SESSION_EXPIRED_CHANGED, sync);
  }, []);

  if (!visible || pathname === LOGIN_PATH) {
    return null;
  }

  return (
    <div role="status" data-testid="session-expired" style={styles.container}>
      <p style={styles.message}>{AUTH_ERRORS.SESSION_EXPIRED}</p>
      <Button
        variant="secondary"
        size="sm"
        data-testid="session-expired-dismiss"
        onClick={() => clearSessionExpired()}
      >
        {t('actions.understood')}
      </Button>
    </div>
  );
}
