/**
 * ScoreSaveButton – „Ergebnis speichern“ unter den Tor-Feldern (@FU-101). Gespeichert wird nur über diese Taste, nie beim
 * Tippen oder Verlassen eines Feldes. Beim laufenden Spiel heißt sie „Spiel beenden und Ergebnis eintragen“ (@FU-112).
 */
import { useTranslation } from 'react-i18next';
import { Button } from '../Button';

interface ScoreSaveButtonProps {
  testId: string;
  disabled: boolean;
  /** Laufendes Spiel: Beschriftung „Spiel beenden und Ergebnis eintragen“ */
  ending?: boolean;
  onSave: () => void;
}

export const ScoreSaveButton: React.FC<ScoreSaveButtonProps> = ({ testId, disabled, ending = false, onSave }) => {
  const { t } = useTranslation('tournament');
  return (
    <Button variant="primary" size="md" disabled={disabled} onClick={onSave} data-testid={testId}>
      {ending ? t('matchExpand.liveInfo.endAndEnter') : t('scoreCell.save')}
    </Button>
  );
};
