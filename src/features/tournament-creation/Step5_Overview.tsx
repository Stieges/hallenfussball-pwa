import { useTranslation } from 'react-i18next';
import { Card, Button, Icons } from '../../components/ui';
import { Tournament } from '../../types/tournament';
import { cssVars } from '../../design-tokens'
import { getFullLocationAddress } from '../../utils/locationHelpers';
import { getGroupDisplayName } from '../../utils/displayNames';
import styles from './Step5_Overview.module.css';

interface Step5Props {
  formData: Partial<Tournament>;
  onSave: () => void;
}

export const Step5_Overview: React.FC<Step5Props> = ({ formData, onSave }) => {
  const { t } = useTranslation('wizard');

  return (
    <Card>
      <h2 style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.xl, margin: '0 0 24px 0' }}>
        {t('step5.title')}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Turniername */}
        <div className={styles.infoBox}>
          <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, marginBottom: '4px' }}>
            {t('step5.tournamentName')}
          </div>
          <div style={{ fontSize: cssVars.fontSizes.xl, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary }}>
            {formData.title ?? t('step5.notSpecified')}
          </div>
        </div>

        {/* Veranstalter (if provided) */}
        {formData.organizer && (
          <div className={styles.infoBox}>
            <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, marginBottom: '4px' }}>
              {t('step5.organizer')}
            </div>
            <div style={{ fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }}>
              {formData.organizer}
            </div>
          </div>
        )}

        {/* Sportart & Typ */}
        <div className={styles.infoGrid}>
          <div className={styles.infoBox}>
            <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, marginBottom: '4px' }}>
              {t('step5.sport')}
            </div>
            <div style={{ fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.primary }}>
              {formData.sport === 'football' ? t('step5.football') : t('step5.otherSport')}
            </div>
          </div>
          <div className={styles.infoBox}>
            <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, marginBottom: '4px' }}>
              {t('step5.tournamentType')}
            </div>
            <div style={{ fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.semibold, color: formData.tournamentType === 'bambini' ? cssVars.colors.warning : cssVars.colors.primary }}>
              {formData.tournamentType === 'bambini' ? t('step5.bambiniType') : t('step5.classicType')}
            </div>
          </div>
        </div>

        {/* Modus & System */}
        <div className={styles.infoGrid}>
          <div className={styles.infoBox}>
            <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, marginBottom: '4px' }}>
              {t('step5.ageClass')}
            </div>
            <div style={{ fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.primary }}>
              {formData.ageClass}
            </div>
          </div>
          <div className={styles.infoBox}>
            <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, marginBottom: '4px' }}>
              {t('step5.mode')}
            </div>
            <div style={{ fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.secondary }}>
              {formData.mode === 'classic' ? t('step5.classicMode') : t('step5.miniFussballMode')}
            </div>
          </div>
        </div>

        {/* Datum & Ort */}
        <div className={styles.infoGrid}>
          <div className={styles.infoBox}>
            <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, marginBottom: '4px' }}>
              {t('step5.date')}
            </div>
            <div style={{ fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }}>
              {formData.date ?? '-'}
            </div>
          </div>
          <div className={styles.infoBox}>
            <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, marginBottom: '4px' }}>
              {t('step5.locationLabel')}
            </div>
            <div style={{ fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }}>
              {formData.location ? getFullLocationAddress(formData as Tournament) : '-'}
            </div>
          </div>
        </div>

        {/* Teams */}
        <div className={styles.infoBox}>
          <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, marginBottom: '8px' }}>
            {t('step5.teamsLabel')}
          </div>
          <div style={{ fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }}>
            {t('step5.teamsCount', { count: formData.teams?.length ?? 0 })}
          </div>
          {formData.teams && formData.teams.length > 0 && (
            <div className={styles.teamsContainer}>
              {formData.teams.map((team) => (
                <div key={team.id} className={styles.teamBadge}>
                  {team.name}
                  {team.group && ` (${getGroupDisplayName(team.group, formData as Tournament)})`}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview Button */}
        <div style={{ marginTop: '24px' }}>
          <Button onClick={onSave} icon={<Icons.ChevronRight />} size="lg" fullWidth iconPosition="right" data-testid="wizard-show-preview">
            {t('step5.showPreview')}
          </Button>
        </div>
      </div>
    </Card>
  );
};
