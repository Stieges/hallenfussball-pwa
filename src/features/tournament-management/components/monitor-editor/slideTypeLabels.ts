/**
 * Namen der Folienarten für die Oberfläche (i18n statt fester Texte in `types/monitor.ts`).
 * Eine Quelle für Editor, Folienzeile, Typwahl, Vorschau und Monitor-Karte.
 */

import type { TFunction } from 'i18next';

const TYPE_KEYS: Readonly<Record<string, string>> = {
  'live': 'live',
  'standings': 'standings',
  'schedule-field': 'scheduleField',
  'sponsor': 'sponsor',
  'custom-text': 'customText',
  'qr-code': 'qrCode',
  'all-standings': 'allStandings',
  'schedule-group': 'scheduleGroup',
  'next-matches': 'nextMatches',
  'top-scorers': 'topScorers',
};

/** i18n-Schlüsselteil der Folienart (`slidePreview.types.<teil>`), `null` bei unbekannter Art */
export function slideTypeKey(type: string): string | null {
  return Object.prototype.hasOwnProperty.call(TYPE_KEYS, type) ? TYPE_KEYS[type] : null;
}

/** Name der Folienart; unbekannte Art: der Rohwert (nur als letzter Ausweg) */
export function slideTypeLabel(t: TFunction<'tournament'>, type: string): string {
  const key = slideTypeKey(type);
  return key ? t(`slidePreview.types.${key}` as never) : type;
}
