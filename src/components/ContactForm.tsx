import { useState, useEffect, useMemo } from 'react';
import { ContactInfo } from '../types/tournament';
import { Input } from './ui';
import { borderRadius, colors } from '../design-tokens';
interface ContactFormProps {
  value: ContactInfo;
  onChange: (contactInfo: ContactInfo) => void;
}

export const ContactForm: React.FC<ContactFormProps> = ({
  value,
  onChange,
}) => {
  const [showExtended, setShowExtended] = useState(false);

  // Memoize to prevent useEffect from re-running on every render
  const contactInfo: ContactInfo = useMemo(() => value ?? {}, [value]);

  // Auto-open wenn Daten vorhanden
  useEffect(() => {
    if (
      contactInfo.name ||
      contactInfo.email ||
      contactInfo.phone ||
      contactInfo.website
    ) {
      setShowExtended(true);
    }
  }, [contactInfo.name, contactInfo.email, contactInfo.phone, contactInfo.website]);

  const handleFieldChange = (field: keyof ContactInfo, fieldValue: string) => {
    onChange({
      ...contactInfo,
      [field]: fieldValue ?? undefined, // Remove empty strings
    });
  };

  // Check if any contact info is set
  const hasContactInfo = contactInfo.name || contactInfo.email || contactInfo.phone || contactInfo.website;

  return (
    <div style={{ marginTop: '16px' }}>
      {/* Toggle für Kontaktdaten */}
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
        }}
      >
        <span>{showExtended ? '▼' : '▶'}</span>
        <span>
          Kontaktdaten (optional)
          {hasContactInfo && !showExtended && (
            <span style={{ color: colors.success, marginLeft: '8px' }}>✓</span>
          )}
        </span>
      </button>

      {/* Kontaktdaten Felder (collapsible) */}
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
            label="Ansprechpartner"
            value={contactInfo.name ?? ''}
            onChange={(v) => handleFieldChange('name', v)}
            placeholder="z.B. Max Mustermann"
          />

          <Input
            label="E-Mail"
            type="email"
            value={contactInfo.email ?? ''}
            onChange={(v) => handleFieldChange('email', v)}
            placeholder="z.B. turnier@tsv-waging.de"
            style={{ marginTop: '16px' }}
          />

          <Input
            label="Telefon"
            type="tel"
            value={contactInfo.phone ?? ''}
            onChange={(v) => handleFieldChange('phone', v)}
            placeholder="z.B. +49 8681 12345"
            style={{ marginTop: '16px' }}
          />

          <Input
            label="Website"
            value={contactInfo.website ?? ''}
            onChange={(v) => handleFieldChange('website', v)}
            placeholder="z.B. www.tsv-waging.de"
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
            Diese Angaben erscheinen in der Fußzeile des Spielplans und im PDF-Export.
          </p>
        </div>
      )}
    </div>
  );
};
