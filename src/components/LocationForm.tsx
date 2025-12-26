import { useState, useEffect } from 'react';
import { LocationDetails } from '../types/tournament';
import { Input } from './ui';
import { borderRadius, colors } from '../design-tokens';
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
  const { tournaments } = useTournaments();
  const [showExtended, setShowExtended] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationDetails[]>([]);

  const locationDetails: LocationDetails = value;

  // Lade Suggestions aus vorherigen Turnieren
  useEffect(() => {
    const uniqueLocations = getUniqueLocations(tournaments);
    setSuggestions(uniqueLocations);
  }, [tournaments]);

  // Auto-open extended fields wenn Daten vorhanden
  useEffect(() => {
    if (
      locationDetails.street ||
      locationDetails.postalCode ||
      locationDetails.city ||
      locationDetails.country
    ) {
      setShowExtended(true);
    }
  }, [locationDetails]);

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
          label="Veranstaltungsort"
          value={locationDetails.name || ''}
          onChange={handleNameChange}
          placeholder="z.B. Sporthalle Waging"
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
          color: colors.primary,
          cursor: 'pointer',
          fontSize: '13px',
          padding: '8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginTop: '8px',
        }}
      >
        <span>{showExtended ? '▼' : '▶'}</span>
        <span>Erweiterte Adressdaten (optional)</span>
      </button>

      {/* Erweiterte Felder (collapsible) */}
      {showExtended && (
        <div
          style={{
            marginTop: '12px',
            padding: '16px',
            background: 'rgba(37, 99, 235, 0.05)',
            borderRadius: borderRadius.md,
            border: `1px solid ${colors.border}`,
          }}
        >
          <Input
            label="Straße & Hausnummer"
            value={locationDetails.street || ''}
            onChange={(v) => handleFieldChange('street', v)}
            placeholder="z.B. Mozartstraße 9"
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
              label="PLZ"
              value={locationDetails.postalCode || ''}
              onChange={(v) => handleFieldChange('postalCode', v)}
              placeholder="z.B. 83329"
            />
            <Input
              label="Stadt/Ort"
              value={locationDetails.city || ''}
              onChange={(v) => handleFieldChange('city', v)}
              placeholder="z.B. Waging am See"
            />
          </div>

          <Input
            label="Land"
            value={locationDetails.country || ''}
            onChange={(v) => handleFieldChange('country', v)}
            placeholder="z.B. Deutschland"
            style={{ marginTop: '16px' }}
          />

          <p
            style={{
              fontSize: '11px',
              color: colors.textSecondary,
              marginTop: '12px',
              marginBottom: 0,
            }}
          >
            Diese Angaben sind optional und werden für PDF-Export und Detailansicht verwendet.
          </p>
        </div>
      )}
    </div>
  );
};
