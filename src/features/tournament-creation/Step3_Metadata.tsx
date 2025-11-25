import { Card, Select, Input } from '../../components/ui';
import { Tournament } from '../../types/tournament';
import { theme } from '../../styles/theme';
import { getAgeClassOptions, DEFAULT_VALUES } from '../../constants/tournamentOptions';

interface Step3Props {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
}

export const Step3_Metadata: React.FC<Step3Props> = ({ formData, onUpdate }) => {
  return (
    <Card>
      <h2 style={{ color: theme.colors.text.primary, fontSize: theme.fontSizes.xl, margin: '0 0 24px 0' }}>
        📋 Stammdaten
      </h2>

      <Input
        label="Turniername"
        value={formData.title || ''}
        onChange={(v) => onUpdate('title', v)}
        placeholder="z.B. TSV Waging Hallencup 2025"
        required
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
        <Select
          label="Altersklasse"
          value={formData.ageClass || DEFAULT_VALUES.ageClass}
          onChange={(v) => onUpdate('ageClass', v)}
          options={getAgeClassOptions(formData.sport || 'football')}
        />
        <Input
          label="Datum"
          type="date"
          value={formData.date || ''}
          onChange={(v) => onUpdate('date', v)}
          required
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
        <Input
          label="Zeitfenster"
          value={formData.timeSlot || ''}
          onChange={(v) => onUpdate('timeSlot', v)}
          placeholder="z.B. 09:00 - 16:00"
        />
        <Input
          label="Halle/Ort"
          value={formData.location || ''}
          onChange={(v) => onUpdate('location', v)}
          placeholder="z.B. Sporthalle Waging"
          required
        />
      </div>
    </Card>
  );
};
