/**
 * HallentonAnmeldeHinweis – steht im Unterpunkt „Hallenton“ statt des Inhalts, wenn niemand angemeldet ist (H4-9, @HT-026): ein zweiter Rechner
 * öffnet die feste Adresse des Unterpunkts, meldet sich an („Anmelden“ merkt die Adresse für den Rückweg und öffnet die Anmeldung) und
 * landet danach im selben Unterpunkt (`holeRueckkehr` in `App.tsx`).
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { iconSizeValues } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { merkeRueckkehr } from '../../auth/utils/loginRueckkehr';

export function HallentonAnmeldeHinweis(): ReactElement {
  const { t } = useTranslation('hallenton');
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const anmelden = (): void => {
    merkeRueckkehr(pathname);
    void navigate('/login');
  };
  return (
    <InlineNotice
      tone="info"
      data-testid="hallenton-anmelden-hinweis"
      footer={<div><Button variant="primary" icon={<Icons.User size={iconSizeValues.sm} />} onClick={anmelden} data-testid="hallenton-anmelden">{t('anmelden.taste')}</Button></div>}
    >
      <strong>{t('anmelden.titel')}</strong>
      <span>{t('anmelden.text')}</span>
    </InlineNotice>
  );
}
