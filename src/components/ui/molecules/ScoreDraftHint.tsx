/** ScoreDraftHint – kurzer Hinweis unter den Tor-Feldern, wenn die Eingabe keine ganze Zahl ab 0 ist (@FU-101). */
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';

export const ScoreDraftHint: React.FC<{ testId: string }> = ({ testId }) => {
  const { t } = useTranslation('tournament');
  return (
    <span
      role="alert"
      data-testid={testId}
      style={{ color: cssVars.colors.error, fontSize: cssVars.fontSizes.xs, textAlign: 'center', flexBasis: '100%' }}
    >
      {t('scoreCell.invalidScore')}
    </span>
  );
};
