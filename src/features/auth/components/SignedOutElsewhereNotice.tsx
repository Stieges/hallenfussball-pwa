/**
 * Globaler Hinweis „Du wurdest von einem anderen Gerät aus abgemeldet“ (A-07d2, B2, @AN-024).
 *
 * Erscheint auf der Route, auf der das Gerät gerade steht (z. B. Dashboard), ohne Navigation.
 * Auf /login zeigt die Anmeldeseite den Hinweis selbst; hier wird er dann nicht doppelt gezeigt.
 * Schließen erledigt den Hinweis für diese Sitzung (Merker wird gelöscht).
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import {
  clearSignedOutElsewhere,
  hasSignedOutElsewhere,
  SIGNED_OUT_ELSEWHERE_CHANGED,
} from '../context/remoteSignOut';
import { signedOutNoticeStyles as styles } from './SignedOutElsewhereNotice.styles';

const LOGIN_PATH = '/login';

export function SignedOutElsewhereNotice() {
  const { t } = useTranslation(['auth', 'common']);
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(hasSignedOutElsewhere);

  // Setzt sich der Hinweis nach dem Mount (Prüfung oder SIGNED_OUT), erscheint er sofort.
  useEffect(() => {
    const sync = (): void => setVisible(hasSignedOutElsewhere());
    window.addEventListener(SIGNED_OUT_ELSEWHERE_CHANGED, sync);
    return () => window.removeEventListener(SIGNED_OUT_ELSEWHERE_CHANGED, sync);
  }, []);

  if (!visible || pathname === LOGIN_PATH) {
    return null;
  }

  return (
    <div role="status" data-testid="signed-out-elsewhere" style={styles.container}>
      <p style={styles.message}>{t('login.signedOutElsewhere')}</p>
      <Button
        variant="secondary"
        size="sm"
        data-testid="signed-out-elsewhere-dismiss"
        onClick={() => clearSignedOutElsewhere()}
      >
        {t('common:actions.understood')}
      </Button>
    </div>
  );
}
