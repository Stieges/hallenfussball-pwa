import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LocationDetails } from '../types/tournament';
import { Input } from './ui';
import { cssVars } from '../design-tokens'
import { getUniqueLocations } from '../utils/locationHelpers';
import { useTournaments } from '../hooks/useTournaments';

interface LocationFormProps {
  value: LocationDetails;
  onChange: (location: LocationDetails) => void;
  required?: boolean;
}

export const LocationForm: React.FC<LocationFormProps> = ({
  value,
  onChange,
  required = false,
}) => {
  const { t } = useTranslation('wizard');
  const { tournaments } = useTournaments();

  // Initialize showExtended based on whether extended data exists
  /* eslint-disable @typescript-eslint/prefer-nullish-coalescing -- Intentional: empty strings should be treated as "no extended data" */
  const [showExtended, setShowExtended] = useState(
    () => !!(value.street || value.postalCode || value.city || value.country)
  );
  /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */

  // Derive suggestions from tournaments (no state needed)
  const suggestions = useMemo(
    () => getUniqueLocations(tournaments),
    [tournaments]
  );

  const locationDetails: LocationDetails = value;

  const handleNameChange = (name: string) => {
    // Suche nach existierender Location
    const existing = suggestions.find(
      loc => loc.name.toLowerCase() === name.toLowerCase()
    );

    if (existing) {
      // Übernehme alle Daten
      onChange(existing);
    } else {
      // Neue Location
      onChange({ ...locationDetails, name });
    }
  };

  const handleFieldChange = (field: keyof LocationDetails, value: string) => {
    onChange({
      ...locationDetails,
      [field]: value,
    });
  };

  return (
    <div style={{ marginTop: '16px' }}>
      {/* Hauptfeld: Name/Bezeichnung */}
      <div style={{ position: 'relative' }}>
        <Input
          label={t('location.label')}
          value={locationDetails.name}
          onChange={handleNameChange}
          placeholder={t('location.placeholder')}
          required={required}
          list="location-suggestions"
        />

        {/* Datalist für Autocomplete */}
        <datalist id="location-suggestions">
          {suggestions.map((loc, idx) => (
            <option key={idx} value={loc.name}>
              {loc.city && ` (${loc.city})`}
            </option>
          ))}
        </datalist>
      </div>

      {/* Toggle für erweiterte Felder */}
      <button
        type="button"
        onClick={() => setShowExtended(!showExtended)}
        style={{
          background: 'none',
          border: 'none',
          color: cssVars.colors.primary,
          cursor: 'pointer',
          fontSize: cssVars.fontSizes.sm,
          padding: '8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginTop: '8px',
        }}
      >
        <span>{showExtended ? '▼' : '▶'}</span>
        <span>{t('location.extendedToggle')}</span>
      </button>

      {/* Erweiterte Felder (collapsible) */}
      {showExtended && (
        <div
          style={{
            marginTop: '12px',
            padding: '16px',
            background: 'rgba(37, 99, 235, 0.05)',
            borderRadius: cssVars.borderRadius.md,
            border: `1px solid ${cssVars.colors.border}`,
          }}
        >
          <Input
            label={t('location.street')}
            value={locationDetails.street ?? ''}
            onChange={(v) => handleFieldChange('street', v)}
            placeholder={t('location.streetPlaceholder')}
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 2fr',
              gap: '16px',
              marginTop: '16px',
            }}
          >
            <Input
              label={t('location.postalCode')}
              value={locationDetails.postalCode ?? ''}
              onChange={(v) => handleFieldChange('postalCode', v)}
              placeholder={t('location.postalCodePlaceholder')}
            />
            <Input
              label={t('location.city')}
              value={locationDetails.city ?? ''}
              onChange={(v) => handleFieldChange('city', v)}
              placeholder={t('location.cityPlaceholder')}
            />
          </div>

          <Input
            label={t('location.country')}
            value={locationDetails.country ?? ''}
            onChange={(v) => handleFieldChange('country', v)}
            placeholder={t('location.countryPlaceholder')}
            style={{ marginTop: '16px' }}
          />

          <p
            style={{
              fontSize: cssVars.fontSizes.xs,
              color: cssVars.colors.textSecondary,
              marginTop: '12px',
              marginBottom: 0,
            }}
          >
            {t('location.hint')}
          </p>
        </div>
      )}
    </div>
  );
};
