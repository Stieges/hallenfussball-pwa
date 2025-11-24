import { Card, Select, Input } from '../../components/ui';
import { Tournament } from '../../types/tournament';
import { theme } from '../../styles/theme';

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
          value={formData.ageClass || 'U11'}
          onChange={(v) => onUpdate('ageClass', v)}
          options={[
            { value: 'G-Jugend', label: 'G-Jugend (U7)' },
            { value: 'F-Jugend', label: 'F-Jugend (U9)' },
            { value: 'E-Jugend', label: 'E-Jugend (U10/U11)' },
            { value: 'U11', label: 'U11' },
            { value: 'D-Jugend', label: 'D-Jugend (U12/U13)' },
          ]}
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
