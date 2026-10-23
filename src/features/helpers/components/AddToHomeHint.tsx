/**
 * Hinweis „Zum Startbildschirm hinzufügen“ (A-17c, Mockup M3 n1, @HE-097): Info-Hinweis mit einer Taste „Hinweis schließen“.
 * Zeigt sich nur, wenn `shouldShowHomeHint` es erlaubt; das Wegklicken wird im Zugangs-Index gemerkt (auch ohne Speicher
 * verschwindet er für diese Sitzung der Seite).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { findHelperAccessEntry, setHomeHintDismissed } from '../helperAccessStore';
import { isStandaloneDisplay, shouldShowHomeHint } from '../homeHint';
import { JoinNotice } from './JoinNotice';

export interface AddToHomeHintProps {
  deviceUserId: string;
  tournamentId: string;
  field: number | null;
  /** Nur für Tests: Läuft die App vom Startbildschirm? */
  standalone?: boolean;
}

export const AddToHomeHint = ({ deviceUserId, tournamentId, field, standalone }: AddToHomeHintProps) => {
  const { t } = useTranslation('helpers');
  const [dismissed, setDismissed] = useState(false);
  const entry = findHelperAccessEntry(deviceUserId, tournamentId);
  if (dismissed || !shouldShowHomeHint(entry, standalone ?? isStandaloneDisplay())) {
    return null;
  }
  return (
    <JoinNotice
      tone="info"
      icon={<Icons.Share size={iconSizeValues.sm} />}
      title={t('join.homeHint.title')}
      text={field === null ? t('join.homeHint.textNoField') : t('join.homeHint.textField', { field })}
      footer={(
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            setHomeHintDismissed(deviceUserId, tournamentId);
            setDismissed(true);
          }}
          style={{ minHeight: cssVars.touchTargets.minimum }}
          data-testid="home-hint-dismiss"
        >
          {t('join.homeHint.dismiss')}
        </Button>
      )}
      data-testid="home-hint"
    />
  );
};
