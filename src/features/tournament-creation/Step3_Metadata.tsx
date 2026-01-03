import { Card, Combobox, Input } from '../../components/ui';
import { Tournament } from '../../types/tournament';
import { cssVars } from '../../design-tokens'
import { getAgeClassOptions, DEFAULT_VALUES } from '../../constants/tournamentOptions';
import { LocationForm } from '../../components/LocationForm';
import { ContactForm } from '../../components/ContactForm';

interface Step3Props {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
}

export const Step3_Metadata: React.FC<Step3Props> = ({ formData, onUpdate }) => {
  return (
    <Card>
      <h2 style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.xl, margin: '0 0 24px 0' }}>
        Stammdaten
      </h2>

      <Input
        label="Turniername"
        value={formData.title ?? ''}
        onChange={(v) => onUpdate('title', v)}
        placeholder="Vereinsname Hallencup 2025"
        required
      />

      <Input
        label="Veranstalter (optional)"
        value={formData.organizer ?? ''}
        onChange={(v) => onUpdate('organizer', v)}
        placeholder="Mein Verein e.V."
        style={{ marginTop: '16px' }}
      />

      <Combobox
        label="Altersklasse"
        value={formData.ageClass || DEFAULT_VALUES.ageClass}
        onChange={(v) => onUpdate('ageClass', v)}
        options={getAgeClassOptions(formData.sport ?? 'football')}
        placeholder="Suchen oder auswählen..."
        style={{ marginTop: '16px' }}
      />

      <LocationForm
        value={formData.location ?? { name: '' }}
        onChange={(location) => onUpdate('location', location)}
        required
      />

      <ContactForm
        value={formData.contactInfo ?? {}}
        onChange={(contactInfo) => onUpdate('contactInfo', contactInfo)}
      />

      <div className="date-time-grid" style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
        <Input
          label="Startdatum"
          type="date"
          value={(formData.startDate ?? formData.date) ?? ''}
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
          value={formData.startTime ?? ''}
          onChange={(v) => {
            onUpdate('startTime', v);
            // Keep legacy field in sync (simple format)
            onUpdate('timeSlot', v);
          }}
          placeholder="09:00"
          required
        />
      </div>

      {/* Responsive Styles */}
      <style>{`
        .date-time-grid {
          grid-template-columns: 1fr 1fr;
        }

        @media (max-width: 480px) {
          .date-time-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Card>
  );
};
