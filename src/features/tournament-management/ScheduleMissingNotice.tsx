/**
 * Hinweis „Spielplan noch nicht erstellt“ (@W5-042): hat das geladene Turnier keine Spiele, erzeugt die Verwaltung keinen Plan
 * (Laden schreibt nie). Sie zeigt diesen Hinweis mit einer Taste in den Wizard, der das Turnier frisch lädt und fertigstellt.
 * Nur Darstellung; ob Spiele fehlen, entscheidet der Aufrufer.
 */
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import { Button } from '../../components/ui/Button';
import { InlineNotice } from '../../components/ui/molecules/InlineNotice';

export interface ScheduleMissingNoticeProps {
  /** Öffnet den Wizard für dieses Turnier (Adresse `/tournament/:id/edit`). */
  onOpenWizard: () => void;
}

export const ScheduleMissingNotice = ({ onOpenWizard }: ScheduleMissingNoticeProps) => {
  const { t } = useTranslation('tournament');
  return (
    <div style={{ padding: cssVars.spacing.md }}>
      <InlineNotice
        tone="info"
        data-testid="schedule-missing-notice"
        footer={(
          <Button variant="primary" onClick={onOpenWizard} data-testid="schedule-missing-open-wizard">
            {t('scheduleMissing.action')}
          </Button>
        )}
      >
        <strong>{t('scheduleMissing.title')}</strong>
        <span>{t('scheduleMissing.text')}</span>
      </InlineNotice>
    </div>
  );
};
