import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContactInfo } from '../types/tournament';
import { Input } from './ui';
import { cssVars } from '../design-tokens'
interface ContactFormProps {
  value: ContactInfo;
  onChange: (contactInfo: ContactInfo) => void;
}

export const ContactForm: React.FC<ContactFormProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation('wizard');

  // Initialize showExtended based on whether contact info exists
  /* eslint-disable @typescript-eslint/prefer-nullish-coalescing -- Intentional: empty strings should be treated as "no contact info" */
  const [showExtended, setShowExtended] = useState(
    () => !!(value.name || value.email || value.phone || value.website)
  );
  /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */

  const contactInfo: ContactInfo = value;

  const handleFieldChange = (field: keyof ContactInfo, fieldValue: string) => {
    onChange({
      ...contactInfo,
      [field]: fieldValue || undefined, // Remove empty strings
    });
  };

  // Check if any contact info is set
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Intentional: empty strings should be treated as "no contact info"
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
          color: cssVars.colors.primary,
          cursor: 'pointer',
          fontSize: cssVars.fontSizes.sm,
          padding: '8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>{showExtended ? '▼' : '▶'}</span>
        <span>
          {t('contact.toggle')}
          {hasContactInfo && !showExtended && (
            <span style={{ color: cssVars.colors.success, marginLeft: '8px' }}>✓</span>
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
            borderRadius: cssVars.borderRadius.md,
            border: `1px solid ${cssVars.colors.border}`,
          }}
        >
          <Input
            label={t('contact.name')}
            value={contactInfo.name ?? ''}
            onChange={(v) => handleFieldChange('name', v)}
            placeholder={t('contact.namePlaceholder')}
          />

          <Input
            label={t('contact.email')}
            type="email"
            value={contactInfo.email ?? ''}
            onChange={(v) => handleFieldChange('email', v)}
            placeholder={t('contact.emailPlaceholder')}
            style={{ marginTop: '16px' }}
          />

          <Input
            label={t('contact.phone')}
            type="tel"
            value={contactInfo.phone ?? ''}
            onChange={(v) => handleFieldChange('phone', v)}
            placeholder={t('contact.phonePlaceholder')}
            style={{ marginTop: '16px' }}
          />

          <Input
            label={t('contact.website')}
            value={contactInfo.website ?? ''}
            onChange={(v) => handleFieldChange('website', v)}
            placeholder={t('contact.websitePlaceholder')}
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
            {t('contact.hint')}
          </p>
        </div>
      )}
    </div>
  );
};
