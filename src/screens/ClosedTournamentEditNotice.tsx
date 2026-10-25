/**
 * Wizard-Bearbeiten eines abgeschlossenen Turniers (R3-3, @LZ-036, @ZP-087): die Neuplanung ist nach dem Abschluss nicht
 * mehr möglich -- der Wizard (alle fünf Schritte) öffnet gar nicht erst, statt beim Speichern zu scheitern. Ein Link
 * `/tournament/:id/edit` bleibt so ehrlich: Überschrift, Hinweis und Weg zurück (Fokus auf der Überschrift).
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../design-tokens';
import { Button } from '../components/ui/Button';
import { TournamentClosedHint } from '../components/ui/molecules/TournamentClosedHint';

export interface ClosedTournamentEditNoticeProps {
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

export function ClosedTournamentEditNotice({ onBack }: ClosedTournamentEditNoticeProps) {
  const { t } = useTranslation('tournament');
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  return (
    <div style={wrap} data-testid="wizard-closed-notice">
      <h1 ref={headingRef} tabIndex={-1} style={heading} data-testid="wizard-closed-heading">{t('rights.closedTitle')}</h1>
      <TournamentClosedHint live />
      <Button variant="secondary" size="lg" onClick={onBack} data-testid="wizard-closed-back" data-primary>{t('rights.closedBack')}</Button>
    </div>
  );
}
