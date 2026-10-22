/** Platz-Wörter der Gleichstands-Oberfläche aus `tournament.json` (`standingsTie.places`). */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlaceTexts } from './tieFormat';

export function useTiePlaceTexts(): PlaceTexts {
  const { t } = useTranslation('tournament');
  return useMemo(() => ({
    one: (from: number) => t('standingsTie.places.one', { from }),
    two: (from: number, to: number) => t('standingsTie.places.two', { from, to }),
    range: (from: number, to: number) => t('standingsTie.places.range', { from, to }),
  }), [t]);
}
