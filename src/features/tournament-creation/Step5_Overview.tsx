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
  return (
    <Card>
      <h2 style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.xl, margin: '0 0 24px 0' }}>
        Zusammenfassung
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Turniername */}
        <div className={styles.infoBox}>
          <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, marginBottom: '4px' }}>
            Turniername
          </div>
          <div style={{ fontSize: cssVars.fontSizes.xl, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary }}>
            {formData.title ?? '(nicht angegeben)'}
          </div>
        </div>

        {/* Veranstalter (if provided) */}
        {formData.organizer && (
          <div className={styles.infoBox}>
            <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, marginBottom: '4px' }}>
              Veranstalter
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
              Sportart
            </div>
            <div style={{ fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.primary }}>
              {formData.sport === 'football' ? 'Fußball' : 'Sonstiges'}
            </div>
          </div>
          <div className={styles.infoBox}>
            <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, marginBottom: '4px' }}>
              Turniertyp
            </div>
            <div style={{ fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.semibold, color: formData.tournamentType === 'bambini' ? cssVars.colors.warning : cssVars.colors.primary }}>
              {formData.tournamentType === 'bambini' ? 'Bambini' : 'Klassisch'}
            </div>
          </div>
        </div>

        {/* Modus & System */}
        <div className={styles.infoGrid}>
          <div className={styles.infoBox}>
            <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, marginBottom: '4px' }}>
              Altersklasse
            </div>
            <div style={{ fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.primary }}>
              {formData.ageClass}
            </div>
          </div>
          <div className={styles.infoBox}>
            <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, marginBottom: '4px' }}>
              Modus
            </div>
            <div style={{ fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.secondary }}>
              {formData.mode === 'classic' ? 'Klassisch' : 'Mini-Fußball'}
            </div>
          </div>
        </div>

        {/* Datum & Ort */}
        <div className={styles.infoGrid}>
          <div className={styles.infoBox}>
            <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, marginBottom: '4px' }}>
              Datum
            </div>
            <div style={{ fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }}>
              {formData.date ?? '-'}
            </div>
          </div>
          <div className={styles.infoBox}>
            <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, marginBottom: '4px' }}>
              Ort
            </div>
            <div style={{ fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }}>
              {formData.location ? getFullLocationAddress(formData as Tournament) : '-'}
            </div>
          </div>
        </div>

        {/* Teams */}
        <div className={styles.infoBox}>
          <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, marginBottom: '8px' }}>
            Teams
          </div>
          <div style={{ fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }}>
            {formData.teams?.length ?? 0} Teams
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
            Vorschau anzeigen
          </Button>
        </div>
      </div>
    </Card>
  );
};
