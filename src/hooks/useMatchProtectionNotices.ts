/**
 * Wires A6's match-protection notices (see `core/services/matchProtectionNotices.ts`) into the
 * React tree as a translated toast -- same "core emits a plain event, this hook translates and
 * renders" split as `useSwAutoReload.ts` uses for the service-worker update toast.
 *
 * @see .superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A6-review.md (I2, Ruling AN)
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '../components/ui/Toast';
import { subscribeToMatchProtectionNotices } from '../core/services/matchProtectionNotices';

export function useMatchProtectionNotices(): void {
  const { t } = useTranslation('common');
  const { showInfo } = useToast();

  useEffect(() => {
    return subscribeToMatchProtectionNotices((notice) => {
      const matchLabel = notice.matches
        .map((m) => m.matchNumber ?? m.id)
        .join(', ');
      showInfo(
        t('syncStatus.matchProtectedHint', {
          defaultValue: 'Spiel {{matchLabel}} hat Einträge und wurde nicht gelöscht.',
          matchLabel,
          count: notice.matches.length,
        }),
        { duration: 8000 }
      );
    });
  }, [showInfo, t]);
}
