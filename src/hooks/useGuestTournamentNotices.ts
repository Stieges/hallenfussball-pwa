/**
 * useGuestTournamentNotices — C3b-2c (G7): zeigt den Hinweis-Kanal als Toast.
 *
 * G7 (task-C3b-plan.md, Zeile G7): „nur im Gastmodus nutzbar – kann ins Konto
 * übernommen werden" (Übernahme = C3b-4). Gleiche Aufteilung wie
 * `useMatchProtectionNotices.ts`: core/ emittiert, dieser Hook übersetzt und
 * zeigt den Toast über den bestehenden `useToast()`-Kanal.
 *
 * @see core/services/guestTournamentNotices.ts
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '../components/ui/Toast';
import { subscribeToGuestTournamentNotices } from '../core/services/guestTournamentNotices';

export function useGuestTournamentNotices(): void {
  const { t } = useTranslation('common');
  const { showInfo } = useToast();

  useEffect(() => {
    return subscribeToGuestTournamentNotices((notice) => {
      showInfo(
        t('guestHidden.hint', {
          defaultValue:
            '{{title}}: nur im Gastmodus nutzbar – kann ins Konto übernommen werden',
          title: notice.title,
        }),
        { duration: 8000 }
      );
    });
  }, [showInfo, t]);
}