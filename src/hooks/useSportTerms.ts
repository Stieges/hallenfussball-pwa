/**
 * useSportTerms Hook
 *
 * Kapselt useTranslation('sport') und setzt den Sportart-Kontext automatisch.
 * Damit lösen sportartabhängige Terminologie-Varianten in `sport.json`
 * (z.B. `terminology.field_football-outdoor_one` = "Platz") transparent auf,
 * mit Rückfall auf die Basis-Terminologie (`terminology.field_one` = "Feld"),
 * wenn eine Sportart keine eigene Variante definiert.
 *
 * @example
 * ```tsx
 * const { term } = useSportTerms(sportId);
 * term('events.penaltyShootout');            // "Strafstoßschießen"
 * term('terminology.field', { count: 2 });   // "Felder" — bzw. "Plätze" bei football-outdoor
 * ```
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SportId } from '../config/sports';

export interface UseSportTermsReturn {
  /**
   * Übersetzt einen Key aus dem 'sport'-Namespace, mit dem übergebenen
   * `sportId` automatisch als i18next-Kontext gesetzt.
   */
  term: (key: string, options?: Record<string, unknown>) => string;
}

export function useSportTerms(sportId: SportId | undefined): UseSportTermsReturn {
  const { t } = useTranslation('sport');

  const term = useCallback(
    (key: string, options?: Record<string, unknown>): string => {
      // t() ist über die vorhandenen `_context`-Suffixe in sport.json streng
      // typisiert: pro Key nur die SportIds, die dort tatsächlich eine eigene
      // Variante haben. sportId deckt aber alle SportIds ab — auch die ohne
      // eigene Variante (i18next fällt für die dann sauber auf den
      // Basis-Key zurück). Deshalb hier bewusst eine locker typisierte
      // Referenz auf t(), statt den Rückfall wegzutypisieren.
      const translate = t as (k: string, o?: Record<string, unknown>) => string;
      return translate(key, { context: sportId, ...options });
    },
    [t, sportId]
  );

  return { term };
}
