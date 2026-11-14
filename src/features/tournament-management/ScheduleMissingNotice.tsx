/**
 * Hinweis bei einem Turnier ohne Spiele (@W5-042): die Verwaltung erzeugt keinen Plan (Laden schreibt nie).
 * - Entwurf: „Spielplan noch nicht erstellt“ mit Taste in den Wizard, der das Turnier fertigstellt (nur mit dem Recht `restructure`;
 *   `useCan` verneint es nach dem Abschluss von selbst). Ohne Recht nur ein Text, keine Taste.
 * - Festgelegtes Turnier (kein Entwurf) ohne Spiele: die lokale Kopie ist vermutlich veraltet -> „Erneut laden“ statt Wizard.
 * Ob Spiele fehlen, entscheidet der Aufrufer.
 */
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import { Button } from '../../components/ui/Button';
import { InlineNotice } from '../../components/ui/molecules/InlineNotice';
import { useCan } from '../auth/hooks/useCan';

export interface ScheduleMissingNoticeProps {
  tournamentId: string;
  /** `true`, solange das Turnier ein Entwurf ist (`status === 'draft'`). */
  isDraft: boolean;
  /** Öffnet den Wizard für dieses Turnier (Adresse `/tournament/:id/edit`). */
  onOpenWizard: () => void;
  /** Liest das Turnier frisch vom Server. */
  onReload: () => void;
}

export const ScheduleMissingNotice = ({ tournamentId, isDraft, onOpenWizard, onReload }: ScheduleMissingNoticeProps) => {
  const { t } = useTranslation('tournament');
  const canRestructure = useCan('restructure', tournamentId);

  let footer: React.ReactNode = null;
  let title = t('scheduleMissing.title');
  let text = t('scheduleMissing.text');
  if (!isDraft) {
    title = t('scheduleMissing.notLoadedTitle');
    text = t('scheduleMissing.notLoadedText');
    footer = (
      <Button variant="primary" onClick={onReload} data-testid="schedule-missing-reload">
        {t('scheduleMissing.reloadAction')}
      </Button>
    );
  } else if (canRestructure) {
    footer = (
      <Button variant="primary" onClick={onOpenWizard} data-testid="schedule-missing-open-wizard">
        {t('scheduleMissing.action')}
      </Button>
    );
  } else {
    text = t('scheduleMissing.noRight');
  }

  return (
    <div style={{ padding: cssVars.spacing.md }}>
      <InlineNotice tone="info" data-testid="schedule-missing-notice" footer={footer}>
        <strong>{title}</strong>
        <span>{text}</span>
      </InlineNotice>
    </div>
  );
};
