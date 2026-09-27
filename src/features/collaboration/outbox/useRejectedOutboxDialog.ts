/**
 * useRejectedOutboxDialog (C3a-2a Fixrunde 3, P8/W11): buendelt die Ablehnungs-Verdrahtung, die
 * bisher Wort fuer Wort doppelt in `LiveCockpit.tsx` UND `AdminHeader.tsx` stand --
 * `useEngineOutboxSummary` + Dialog-Open/Close-State + `dismiss` mit Fehler-Toast. Beide
 * Aufrufer schrumpfen dadurch; die Anzeige selbst (`RejectedOutboxDialog.tsx`, eigene Datei)
 * bleibt getrennt, weil sie JSX braucht und dieser Hook keins.
 *
 * `showError` kommt als Parameter (Dependency Injection), weil beide Aufrufer UNTERSCHIEDLICHE
 * Toast-Systeme haben: `LiveCockpit` die cockpit-eigene `useToast` (`./hooks`, kein Provider
 * noetig), `AdminHeader` den App-weiten `ToastContext`.
 */
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EngineRejectedEntry } from '../../match-engine/useEngineOutboxSummary';
import { useEngineOutboxSummary } from '../../match-engine/useEngineOutboxSummary';

export interface UseRejectedOutboxDialogResult {
  rejectedCount: number;
  reviewCount: number;
  pendingCount: number;
  entries: EngineRejectedEntry[];
  isOpen: boolean;
  show: () => void;
  close: () => void;
  /** Fixrunde 2 (Re-Review-Befund C4): `.catch` statt nacktem `void` -- ein IDB-/Sender-Fehler
   * darf keine unbehandelte Ablehnung werden, der Aufrufer sieht stattdessen einen Toast. */
  handleDismiss: (ids: string[]) => void;
}

export function useRejectedOutboxDialog(
  tournamentId: string | undefined,
  showError: (message: string) => void,
): UseRejectedOutboxDialogResult {
  const { t } = useTranslation('common');
  const outboxSummary = useEngineOutboxSummary(tournamentId ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const show = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const handleDismiss = useCallback(
    (ids: string[]) => {
      // P6 (Fixrunde 3): ueber i18n statt hartkodiertem Deutsch -- derselbe Text wie bisher (de),
      // folgt jetzt aber der Sprache (`common:outbox.rejected.dismissFailed`).
      outboxSummary.dismiss(ids).catch(() => showError(t('outbox.rejected.dismissFailed')));
    },
    [outboxSummary, showError, t],
  );

  return {
    rejectedCount: outboxSummary.rejectedCount,
    reviewCount: outboxSummary.reviewCount,
    pendingCount: outboxSummary.pendingCount,
    entries: outboxSummary.entries,
    isOpen,
    show,
    close,
    handleDismiss,
  };
}
