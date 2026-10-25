/**
 * Wizard-Bearbeiten eines abgeschlossenen Turniers (R3-3, @LZ-036, @ZP-087): die Neuplanung ist nach dem Abschluss nicht
 * mehr möglich -- der Wizard (alle fünf Schritte) öffnet gar nicht erst, statt beim Speichern zu scheitern. Ein Link
 * `/tournament/:id/edit` bleibt so ehrlich: Hinweis und Weg zurück.
 */
import type { CSSProperties } from 'react';
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

export function ClosedTournamentEditNotice({ onBack }: ClosedTournamentEditNoticeProps) {
  const { t } = useTranslation('tournament');
  return (
    <div style={wrap} data-testid="wizard-closed-notice">
      <TournamentClosedHint />
      <Button variant="secondary" size="lg" onClick={onBack} data-testid="wizard-closed-back" data-primary>{t('rights.closedBack')}</Button>
    </div>
  );
}
