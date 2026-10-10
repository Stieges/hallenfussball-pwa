import type { FinalsPreset } from '../../../types/tournament';

/** i18n-Schlüssel der Finalrunde in Worten für die Zeit-Empfehlung (@W4-021). */
export const FINALS_LABEL_KEYS = {
  none: 'smartConfig.result.finalsNone',
  'final-only': 'smartConfig.result.finalsFinalOnly',
  'top-4': 'smartConfig.result.finalsTop4',
  'top-8': 'smartConfig.result.finalsTop8',
  'top-16': 'smartConfig.result.finalsTop16',
  'all-places': 'smartConfig.result.finalsAllPlaces',
} as const satisfies Record<FinalsPreset, string>;
