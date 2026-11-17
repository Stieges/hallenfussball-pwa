/**
 * Karte „Stammdaten“ im Reiter „Einstellungen“ → „Metadaten bearbeiten“: Name, Veranstalter, Regelwerk (@DR-057),
 * Altersklasse. Aus SettingsTab.tsx herausgelöst, damit die Datei nicht wächst; Verhalten der übrigen Felder unverändert.
 */
import { useTranslation } from 'react-i18next';
import { Card, Input } from '../../components/ui';
import { AgeClassPicker } from '../../components/AgeClassPicker';
import { RulebookField } from '../../components/ui/molecules/RulebookField';
import { cssVars } from '../../design-tokens';
import { DEFAULT_VALUES } from '../../constants/tournamentOptions';
import type { Tournament } from '../../types/tournament';
import type { TournamentMetaErrors } from '../../core/services/tournamentMetaValidation';

interface SettingsMasterDataCardProps {
  formData: Partial<Tournament>;
  metaErrors: TournamentMetaErrors;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
}

export const SettingsMasterDataCard: React.FC<SettingsMasterDataCardProps> = ({ formData, metaErrors, onUpdate }) => {
  const { t } = useTranslation('tournament');
  return (
    <Card>
      <h3 style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.lg, margin: `0 0 ${cssVars.spacing.lg} 0` }}>
        {t('settings.masterData')}
      </h3>

      <Input
        label={t('settings.tournamentName')}
        value={formData.title ?? ''}
        onChange={(v) => onUpdate('title', v)}
        placeholder={t('settings.tournamentNamePlaceholder')}
        errorMessage={metaErrors.title ? t('settings.tournamentNameRequired') : undefined}
        required
      />

      <Input
        label={t('settings.organizer')}
        value={formData.organizer ?? ''}
        onChange={(v) => onUpdate('organizer', v)}
        placeholder={t('settings.organizerPlaceholder')}
        style={{ marginTop: cssVars.spacing.md }}
      />

      <RulebookField
        label={t('settings.rulebook')}
        placeholder={t('settings.rulebookPlaceholder')}
        limitHint={t('settings.rulebookLimit')}
        truncatedHint={t('settings.rulebookTruncated')}
        value={formData.rulebook}
        onChange={(v) => onUpdate('rulebook', v)}
        testId="settings-rulebook"
        style={{ marginTop: cssVars.spacing.md }}
      />

      <div style={{ marginTop: cssVars.spacing.md }}>
        <AgeClassPicker
          value={formData.ageClass ?? DEFAULT_VALUES.ageClass}
          onChange={(v) => onUpdate('ageClass', v)}
          testId="settings-age-class"
        />
      </div>
    </Card>
  );
};
