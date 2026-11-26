/**
 * Rückmeldung nach dem Umbenennen eines Teams (@OB-091): Meldung „Name gespeichert“ über den vorhandenen Toast-Baustein
 * und eine kurze Sperre für „Umbenennen“, damit ein zweiter Tipp gleich nach „Speichern“ (der dann auf der Taste „Umbenennen“
 * landet, weil die Zeile nach dem Schließen tiefer rückt) die Bearbeitung nicht erneut öffnet. Die Sperre vergleicht Zeitstempel
 * (`Date.now()`), keine Wartezeit.
 */
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useOptionalToast } from '../../../components/ui/Toast';

/** So lange nach dem Speichern öffnet „Umbenennen“ nicht (Doppeltipp, Geistertipp nach Layoutsprung). */
export const RENAME_REOPEN_LOCK_MS = 800;

export function useRenameFeedback(): { notifySaved: () => void; isReopenLocked: () => boolean } {
  const { t } = useTranslation('tournament');
  const toast = useOptionalToast();
  const savedAt = useRef<number | null>(null);

  const notifySaved = useCallback(() => {
    savedAt.current = Date.now();
    toast?.showSuccess(t('teams.renameSaved'), { id: 'team-rename-saved' });
  }, [toast, t]);

  // Eine zurückgestellte Uhr (negative Differenz) sperrt nie dauerhaft.
  const isReopenLocked = useCallback(() => {
    if (savedAt.current === null) { return false; }
    const vergangen = Date.now() - savedAt.current;
    return vergangen >= 0 && vergangen < RENAME_REOPEN_LOCK_MS;
  }, []);

  return { notifySaved, isReopenLocked };
}
