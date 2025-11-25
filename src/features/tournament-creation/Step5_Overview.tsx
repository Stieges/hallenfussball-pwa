import { Card, Button, Icons } from '../../components/ui';
import { Tournament } from '../../types/tournament';
import { theme } from '../../styles/theme';

interface Step5Props {
  formData: Partial<Tournament>;
  onSave: () => void;
}

export const Step5_Overview: React.FC<Step5Props> = ({ formData, onSave }) => {
  return (
    <Card>
      <h2 style={{ color: theme.colors.text.primary, fontSize: theme.fontSizes.xl, margin: '0 0 24px 0' }}>
        ✅ Zusammenfassung
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Turniername */}
        <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: theme.borderRadius.md }}>
          <div style={{ fontSize: theme.fontSizes.sm, color: theme.colors.text.secondary, marginBottom: '4px' }}>
            Turniername
          </div>
          <div style={{ fontSize: theme.fontSizes.xl, fontWeight: theme.fontWeights.bold, color: theme.colors.text.primary }}>
            {formData.title || '(nicht angegeben)'}
          </div>
        </div>

        {/* Sportart & Typ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: theme.borderRadius.md }}>
            <div style={{ fontSize: theme.fontSizes.sm, color: theme.colors.text.secondary, marginBottom: '4px' }}>
              Sportart
            </div>
            <div style={{ fontSize: theme.fontSizes.lg, fontWeight: theme.fontWeights.semibold, color: theme.colors.primary }}>
              {formData.sport === 'football' ? '⚽ Fußball' : '🏀 Sonstiges'}
            </div>
          </div>
          <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: theme.borderRadius.md }}>
            <div style={{ fontSize: theme.fontSizes.sm, color: theme.colors.text.secondary, marginBottom: '4px' }}>
              Turniertyp
            </div>
            <div style={{ fontSize: theme.fontSizes.lg, fontWeight: theme.fontWeights.semibold, color: formData.tournamentType === 'bambini' ? theme.colors.warning : theme.colors.primary }}>
              {formData.tournamentType === 'bambini' ? '👶 Bambini' : '⚽ Klassisch'}
            </div>
          </div>
        </div>

        {/* Modus & System */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: theme.borderRadius.md }}>
            <div style={{ fontSize: theme.fontSizes.sm, color: theme.colors.text.secondary, marginBottom: '4px' }}>
              Altersklasse
            </div>
            <div style={{ fontSize: theme.fontSizes.lg, fontWeight: theme.fontWeights.semibold, color: theme.colors.primary }}>
              {formData.ageClass}
            </div>
          </div>
          <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: theme.borderRadius.md }}>
            <div style={{ fontSize: theme.fontSizes.sm, color: theme.colors.text.secondary, marginBottom: '4px' }}>
              Modus
            </div>
            <div style={{ fontSize: theme.fontSizes.lg, fontWeight: theme.fontWeights.semibold, color: theme.colors.secondary }}>
              {formData.mode === 'classic' ? '⚽ Klassisch' : '🎯 Mini-Fußball'}
            </div>
          </div>
        </div>

        {/* Datum & Ort */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: theme.borderRadius.md }}>
            <div style={{ fontSize: theme.fontSizes.sm, color: theme.colors.text.secondary, marginBottom: '4px' }}>
              Datum
            </div>
            <div style={{ fontSize: theme.fontSizes.lg, fontWeight: theme.fontWeights.semibold, color: theme.colors.text.primary }}>
              📅 {formData.date || '-'}
            </div>
          </div>
          <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: theme.borderRadius.md }}>
            <div style={{ fontSize: theme.fontSizes.sm, color: theme.colors.text.secondary, marginBottom: '4px' }}>
              Ort
            </div>
            <div style={{ fontSize: theme.fontSizes.lg, fontWeight: theme.fontWeights.semibold, color: theme.colors.text.primary }}>
              📍 {formData.location || '-'}
            </div>
          </div>
        </div>

        {/* Teams */}
        <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: theme.borderRadius.md }}>
          <div style={{ fontSize: theme.fontSizes.sm, color: theme.colors.text.secondary, marginBottom: '8px' }}>
            Teams
          </div>
          <div style={{ fontSize: theme.fontSizes.lg, fontWeight: theme.fontWeights.semibold, color: theme.colors.text.primary }}>
            👥 {formData.teams?.length || 0} Teams
          </div>
          {formData.teams && formData.teams.length > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {formData.teams.map((team) => (
                <div
                  key={team.id}
                  style={{
                    padding: '6px 12px',
                    background: 'rgba(0,230,118,0.1)',
                    border: '1px solid rgba(0,230,118,0.3)',
                    borderRadius: theme.borderRadius.sm,
                    fontSize: theme.fontSizes.sm,
                    color: theme.colors.text.primary,
                  }}
                >
                  {team.name}
                  {team.group && ` (Gruppe ${team.group})`}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview Button */}
        <div style={{ marginTop: '24px' }}>
          <Button onClick={onSave} icon={<Icons.ChevronRight />} size="lg" fullWidth iconPosition="right">
            Vorschau anzeigen
          </Button>
        </div>
      </div>
    </Card>
  );
};
