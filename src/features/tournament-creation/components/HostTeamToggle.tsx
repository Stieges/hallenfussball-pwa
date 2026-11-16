/**
 * Ankreuzfeld „Mannschaft des Veranstalters“ je Team im Schritt „Teams“ (@W4-034). Setzt nur die Markierung;
 * die Eröffnung und die Wahl erscheinen darunter (`HostOpeningChoice`).
 */
import { useTranslation } from 'react-i18next';
import { CheckboxField } from '../../../components/ui/molecules/CheckboxField';

export interface HostTeamToggleProps {
  teamId: string;
  marked: boolean;
  onToggle: (teamId: string, marked: boolean) => void;
}

export const HostTeamToggle: React.FC<HostTeamToggleProps> = ({ teamId, marked, onToggle }) => {
  const { t } = useTranslation('wizard');
  return (
    <CheckboxField
      checked={marked}
      onChange={(checked) => onToggle(teamId, checked)}
      label={t('step4.host.label')}
      data-testid={`wizard-host-team-${teamId}`}
    />
  );
};
