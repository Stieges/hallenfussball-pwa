/**
 * Angaben des Betreibers (@RE-004) – die EINE Stelle für Name, Anschrift und E-Mail.
 *
 * Impressum und Datenschutzerklärung lesen nur diese Felder. Vor dem Turnier die Werte in `[…]` ersetzen.
 * Solange ein Pflichtfeld leer ist oder noch in eckigen Klammern steht, baut der Produktions-Build nicht
 * (Vite-Prüfung `scripts/vite/legalCheckPlugin.ts`, scharf mit `LEGAL_REQUIRE_COMPLETE=1`); im Dev-/Test-Build gibt es nur eine Warnung.
 */

export interface LegalConfig {
  /** Vor- und Nachname des Betreibers */
  name: string;
  /** Optional: Zeile „c/o …“ (leerer Text blendet die Zeile aus) */
  careOf: string;
  street: string;
  /** PLZ und Ort */
  city: string;
  email: string;
  /** Aufsichtsbehörde (Standard: Bayern; ändern, falls der Betreiber woanders wohnt) */
  supervisoryAuthority: {
    name: string;
    address: string;
    url: string;
  };
  /** Stand der Texte */
  lastUpdated: string;
}

export const LEGAL_CONFIG: LegalConfig = {
  name: '[VORNAME NACHNAME]',
  careOf: '', // optional, z. B. 'c/o Vorname Nachname'
  street: '[STRASSE NR]',
  city: '[PLZ ORT]',
  email: '[E-MAIL]',
  supervisoryAuthority: {
    name: 'Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)',
    address: 'Promenade 18, 91522 Ansbach (Postanschrift: Postfach 1349, 91504 Ansbach)',
    url: 'https://www.lda.bayern.de',
  },
  lastUpdated: 'November 2026',
};

/** Pflichtfelder, die der Betreiber ausfüllen muss (`careOf` ist optional). */
const REQUIRED_FIELDS = ['name', 'street', 'city', 'email'] as const;

/** Ein Wert gilt als Platzhalter, wenn er leer ist oder noch eine Angabe in eckigen Klammern enthält. */
export function isPlaceholder(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === '' || /\[[^\]]*\]/.test(trimmed);
}

/**
 * Namen der Felder, die noch leer oder Platzhalter sind. `careOf` zählt nur, wenn etwas drinsteht, das noch in Klammern steht.
 */
export function getUnfilledPlaceholders(config: LegalConfig = LEGAL_CONFIG): string[] {
  const unfilled: string[] = REQUIRED_FIELDS.filter((field) => isPlaceholder(config[field]));
  if (config.careOf.trim() !== '' && isPlaceholder(config.careOf)) {
    unfilled.push('careOf');
  }
  return unfilled;
}
