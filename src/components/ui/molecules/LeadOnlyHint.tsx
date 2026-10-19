/**
 * Hinweis „Ändern nur durch die Turnierleitung“ (A-11, L6, @HE-042): steht über Inhalten, die eine Person ohne das
 * passende Recht nur lesen darf (Teams, Turniereinstellungen). Nur Darstellung -- welches Recht fehlt, entscheidet
 * der Aufrufer über `useCan`.
 */
import { useTranslation } from 'react-i18next';
import { InlineNotice } from './InlineNotice';

export interface LeadOnlyHintProps {
  /** Test-ID; Vorgabe `lead-only-hint`. */
  'data-testid'?: string;
}

export const LeadOnlyHint = ({ 'data-testid': testId = 'lead-only-hint' }: LeadOnlyHintProps) => {
  const { t } = useTranslation('tournament');
  return (
    <InlineNotice tone="info" data-testid={testId}>
      {t('rights.leadOnlyHint')}
    </InlineNotice>
  );
};
