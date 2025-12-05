import { Card, Select, Input } from '../../components/ui';
import { Tournament } from '../../types/tournament';
import { theme } from '../../styles/theme';
import { getAgeClassOptions, DEFAULT_VALUES } from '../../constants/tournamentOptions';
import { LocationForm } from '../../components/LocationForm';

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

      <Input
        label="Veranstalter (optional)"
        value={formData.organizer || ''}
        onChange={(v) => onUpdate('organizer', v)}
        placeholder="z.B. TSV Waging e.V."
        style={{ marginTop: '16px' }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
        <Select
          label="Altersklasse"
          value={formData.ageClass || DEFAULT_VALUES.ageClass}
          onChange={(v) => onUpdate('ageClass', v)}
          options={getAgeClassOptions(formData.sport || 'football')}
        />
      </div>

      <LocationForm
        value={formData.location || { name: '' }}
        onChange={(location) => onUpdate('location', location)}
        required
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
        <Input
          label="Startdatum"
          type="date"
          value={formData.startDate || formData.date || ''}
          onChange={(v) => {
            onUpdate('startDate', v);
            // Keep legacy field in sync
            onUpdate('date', v);
          }}
          required
        />
        <Input
          label="Startzeit"
          type="time"
          value={formData.startTime || ''}
          onChange={(v) => {
            onUpdate('startTime', v);
            // Keep legacy field in sync (simple format)
            onUpdate('timeSlot', v);
          }}
          placeholder="z.B. 09:00"
          required
        />
      </div>
    </Card>
  );
};
