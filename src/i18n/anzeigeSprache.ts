/**
 * Feste Anzeigesprache für Zuschauer-Seite und Monitor (B-41, Ruling des Controllers).
 *
 * Bis @ZM-106 (Zuschauer) bzw. @ZM-126 (Monitor) bleiben beide Bereiche deutsch, unabhängig von
 * Browser- und Geräte-Sprache. Die globale Sprache (`i18n.language`) wird dafür NIE umgestellt
 * (kein `changeLanguage`): Der Bereich bekommt eine eigene, geklonte Instanz für React
 * (`I18nextProvider`), und Nicht-React-Stellen nutzen `anzeigeT`.
 */
import i18n from 'i18next';

export const ANZEIGE_SPRACHE = 'de';

let anzeigeInstanz: typeof i18n | null = null;

/** Eigene Instanz mit fester Sprache; die globale Instanz bleibt unberührt. Lazy, einmal je Sitzung. */
export function anzeigeI18n(): typeof i18n {
  anzeigeInstanz ??= i18n.cloneInstance({ lng: ANZEIGE_SPRACHE });
  return anzeigeInstanz;
}

/**
 * Feste Übersetzungsfunktion für Code außerhalb von React (Fehlertexte, Hilfsfunktionen).
 * Typ wie `i18n.t`, damit die Schlüssel typgeprüft bleiben.
 */
// Typ wie `i18n.t` (Schlüssel bleiben an der Aufrufstelle typgeprüft); die Umwandlung
// hier ist nötig, weil TFunction-Overloads nicht über Rest-Parameter weitergereicht werden.
export const anzeigeT = ((key: string, opts?: Record<string, unknown>): string =>
  (anzeigeI18n().getFixedT(ANZEIGE_SPRACHE) as unknown as (k: string, o?: Record<string, unknown>) => string)(key, opts)
) as unknown as typeof i18n.t;
