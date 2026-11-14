/**
 * Hinweis bei einem Turnier ohne Spiele (@W5-042): die Verwaltung erzeugt keinen Plan (Laden schreibt nie).
 * - Entwurf: „Spielplan noch nicht erstellt“ mit Taste in den Wizard, der das Turnier fertigstellt (nur mit dem Recht `restructure`;
 *   `useCan` verneint es nach dem Abschluss von selbst). Ohne Recht nur ein Text, keine Taste.
 * - Festgelegtes Turnier (kein Entwurf) ohne Spiele: die lokale Kopie ist vermutlich veraltet -> „Erneut laden“ statt Wizard.
 * Ob Spiele fehlen, entscheidet der Aufrufer.
 */
import { useEffect, useRef, useState } from 'react';
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
  /** Liest das Turnier frisch vom Server; löst auf, wenn das Lesen fertig ist (auch bei Fehler). */
  onReload: () => Promise<void>;
}

export const ScheduleMissingNotice = ({ tournamentId, isDraft, onOpenWizard, onReload }: ScheduleMissingNoticeProps) => {
  const { t } = useTranslation('tournament');
  const canRestructure = useCan('restructure', tournamentId);
  // „Erneut laden“: Rückmeldung während des Lesens und danach, wenn der Server weiter keinen Plan liefert (kein setState nach Unmount)
  const [reloading, setReloading] = useState(false);
  const [reloadedEmpty, setReloadedEmpty] = useState(false);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const handleReload = async () => {
    if (runningRef.current) { return; }
    runningRef.current = true;
    setReloading(true);
    try { await onReload(); } catch { /* der Hinweis bleibt stehen */ }
    runningRef.current = false;
    if (mountedRef.current) { setReloading(false); setReloadedEmpty(true); }
  };

  let footer: React.ReactNode = null;
  let title = t('scheduleMissing.title');
  let text = t('scheduleMissing.text');
  if (!isDraft) {
    title = t('scheduleMissing.notLoadedTitle');
    text = t('scheduleMissing.notLoadedText');
    footer = (
      <Button variant="primary" busy={reloading} onClick={() => { void handleReload(); }} data-testid="schedule-missing-reload">
        {reloading ? t('scheduleMissing.reloading') : t('scheduleMissing.reloadAction')}
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
        {!isDraft && reloadedEmpty && !reloading && (
          <span role="status" data-testid="schedule-missing-still-empty" style={{ color: cssVars.colors.textSecondary }}>
            {t('scheduleMissing.stillEmpty')}
          </span>
        )}
      </InlineNotice>
    </div>
  );
};
