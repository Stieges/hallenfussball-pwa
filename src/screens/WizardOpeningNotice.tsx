/**
 * @W5-039: Anzeige, solange der Assistent sein Turnier noch nicht vollständig hat (Laden) oder es nicht laden konnte
 * (Meldung mit Weg zurück). In beiden Fällen läuft der Assistent nicht und speichert nichts.
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../design-tokens';
import { Button } from '../components/ui/Button';

export interface WizardOpeningNoticeProps {
  status: 'loading' | 'failed';
  onBack: () => void;
}

const wrap: CSSProperties = {
  minHeight: 'var(--min-h-screen)',
  background: cssVars.colors.background,
  padding: cssVars.spacing.lg,
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.lg,
  alignItems: 'flex-start',
};
const heading: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.xl, color: cssVars.colors.textPrimary, outline: 'none' };
const body: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, color: cssVars.colors.textSecondary };

export function WizardOpeningNotice({ status, onBack }: WizardOpeningNoticeProps) {
  const { t } = useTranslation('wizard');
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (status === 'failed') { headingRef.current?.focus(); } }, [status]);
  if (status === 'loading') {
    return (
      <div style={wrap} role="status" data-testid="wizard-opening-loading">
        <p style={body}>{t('opening.loading')}</p>
      </div>
    );
  }
  return (
    <div style={wrap} data-testid="wizard-opening-failed">
      <h1 ref={headingRef} tabIndex={-1} style={heading}>{t('opening.failedTitle')}</h1>
      <p style={body}>{t('opening.failedBody')}</p>
      <Button variant="secondary" size="lg" onClick={onBack} data-testid="wizard-opening-back" data-primary>{t('opening.back')}</Button>
    </div>
  );
}
