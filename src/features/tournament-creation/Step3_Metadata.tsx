import { useTranslation } from 'react-i18next';
import { Card, Input } from '../../components/ui';
import { AgeClassPicker } from '../../components/AgeClassPicker';
import { RulebookField } from '../../components/ui/molecules/RulebookField';
import { Tournament } from '../../types/tournament';
import { cssVars } from '../../design-tokens'
import { localDateIso } from '../../core/view';
import { LocationForm } from '../../components/LocationForm';
import { ContactForm } from '../../components/ContactForm';

interface Step3Props {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
}

export const Step3_Metadata: React.FC<Step3Props> = ({ formData, onUpdate }) => {
  const { t } = useTranslation('wizard');

  // F-113: prevent past start dates. min= today (local ISO).
  const todayIso = localDateIso();
  const currentStartDate = formData.startDate ?? formData.date ?? '';
  // @W5-003 (C-META-NOVALID): nur ein Entwurf darf nicht in der Vergangenheit liegen; ein festgelegtes Turnier bleibt korrigierbar.
  const pastDateChecked = formData.status !== 'published';
  const startDateInPast =
    pastDateChecked && !!currentStartDate && /^\d{4}-\d{2}-\d{2}$/.test(currentStartDate) && currentStartDate < todayIso;

  return (
    <Card>
      <h2 style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.xl, margin: '0 0 24px 0' }}>
        {t('step3.title')}
      </h2>

      <Input
        label={t('step3.tournamentName')}
        value={formData.title ?? ''}
        onChange={(v) => onUpdate('title', v)}
        placeholder={t('step3.tournamentNamePlaceholder')}
        required
      />

      <Input
        label={t('step3.organizer')}
        value={formData.organizer ?? ''}
        onChange={(v) => onUpdate('organizer', v)}
        placeholder={t('step3.organizerPlaceholder')}
        style={{ marginTop: '16px' }}
      />

      <RulebookField
        label={t('step3.rulebook')}
        placeholder={t('step3.rulebookPlaceholder')}
        limitHint={t('step3.rulebookLimit')}
        truncatedHint={t('step3.rulebookTruncated')}
        value={formData.rulebook}
        onChange={(v) => onUpdate('rulebook', v)}
        testId="wizard-rulebook"
        style={{ marginTop: cssVars.spacing.md }}
      />

      <div style={{ marginTop: cssVars.spacing.md }}>
        <AgeClassPicker
          value={formData.ageClass ?? ''}
          onChange={(v) => onUpdate('ageClass', v)}
          sport={formData.sport ?? 'football'}
          testId="wizard-age-class"
        />
      </div>

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
          label={t('step3.startDate')}
          type="date"
          value={currentStartDate}
          min={pastDateChecked ? todayIso : undefined}
          onChange={(v) => {
            onUpdate('startDate', v);
            // Keep legacy field in sync
            onUpdate('date', v);
          }}
          required
          errorMessage={startDateInPast ? t('step3.startDatePastError') : undefined}
          data-testid="wizard-start-date"
        />
        <Input
          label={t('step3.startTime')}
          type="time"
          value={formData.startTime ?? ''}
          onChange={(v) => {
            onUpdate('startTime', v);
            // Keep legacy field in sync (simple format)
            onUpdate('timeSlot', v);
          }}
          placeholder={t('step3.startTimePlaceholder')}
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
