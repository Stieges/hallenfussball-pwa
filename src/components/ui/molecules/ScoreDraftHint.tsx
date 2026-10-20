/** ScoreDraftHint – kurzer Hinweis unter den Tor-Feldern, wenn die Eingabe keine ganze Zahl ab 0 ist (@FU-101). */
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';

export const ScoreDraftHint: React.FC<{ testId: string; id?: string }> = ({ testId, id }) => {
  const { t } = useTranslation('tournament');
  return (
    <span
      id={id}
      role="alert"
      data-testid={testId}
      style={{ color: cssVars.colors.error, fontSize: cssVars.fontSizes.md, textAlign: 'center', flexBasis: '100%' }}
    >
      {t('scoreCell.invalidScore')}
    </span>
  );
};
