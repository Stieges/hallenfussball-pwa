/**
 * Gemeinsame Muster-Bildung für src/i18n/glossary.json.
 *
 * Genutzt von scripts/check-terminology.cjs (Sprachdateien) und
 * eslint-rules/no-hardcoded-sport-terms.cjs (.ts/.tsx-Literale), damit beide
 * dieselbe Auslegung von forbidden_de / forbidden_en / kuerzel / tsLint haben
 * (@OB-075, @OB-076). Schema: Kopfkommentar von src/i18n/glossary.json.
 */

'use strict';

// JS' \b kennt nur ASCII-Wortzeichen: Umlaute und ß zählen nicht dazu. Deshalb
// eigene Grenzen per Lookaround (siehe .claude/conventions/TERMINOLOGY.md,
// „Die Umlaut/ß-Falle“). Wortzeichen für Synonyme: Buchstaben, Ziffern, Unterstrich.
const GERMAN_WORD_CHAR = 'A-Za-zÀ-ÖØ-öø-ÿ0-9_';
// Kürzel: gleiche Wortgrenzen wie Synonyme, damit Kennungen wie „HF001“, „SF1“ oder „QF2“ nicht als Kürzel gelten.
// Kleingeschriebene Kürzel („min“, „vs“) grenzt zusätzlich der Bindestrich ab, damit CSS wie „min-width“ nicht trifft.
const LETTER_CHAR = GERMAN_WORD_CHAR;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Synonym-Muster: ganzes Wort, Groß-/Kleinschreibung egal (wie bisher). */
function wordBoundaryRegex(phrase) {
  return new RegExp(`(?<![${GERMAN_WORD_CHAR}])${escapeRegExp(phrase)}(?![${GERMAN_WORD_CHAR}])`, 'iu');
}

/** Kürzel-Muster: ganzes „Wort“ im Sinne von LETTER_CHAR, Groß-/Kleinschreibung zählt. */
function kuerzelRegex(abbreviation) {
  const extra = /^[a-z]/.test(abbreviation) ? '-' : '';
  return new RegExp(`(?<![${LETTER_CHAR}${extra}])${escapeRegExp(abbreviation)}(?![${LETTER_CHAR}${extra}])`, 'u');
}

/**
 * i18next-Platzhalter ({{count}}) und Verschachtelungen ($t(sport:…)) sind
 * keine Fließtexte. Vor der Prüfung entfernen, sonst trifft {{min}} das Kürzel „min“.
 */
function stripInterpolation(value) {
  return value.replace(/\$t\([^)]*\)/g, '').replace(/\{\{[^}]*\}\}/g, '');
}

/**
 * @typedef {Object} GlossaryPattern
 * @property {string} term        Begriffs-ID
 * @property {string} forbidden   die verbotene Form
 * @property {'de'|'en'} lang     Sprache, in der sie verboten ist
 * @property {boolean} kuerzel    Kürzel (Groß-/Kleinschreibung zählt, keine „preferred“-Warnung)
 * @property {boolean} tsLint     auch in .ts/.tsx-Literalen prüfen?
 * @property {string} reason
 * @property {string} i18nKey
 * @property {string} de          bevorzugte deutsche Form
 * @property {string} en          bevorzugte englische Form
 * @property {RegExp} regex
 */

/**
 * @param {{terms: Record<string, any>}} glossary
 * @param {(forbidden: string) => boolean} [useAnchorOnly] Begriffe mit Kontextregel: nur Wortanfang zählt
 * @returns {GlossaryPattern[]}
 */
function buildPatterns(glossary, useAnchorOnly = () => false) {
  const patterns = [];
  for (const [term, entry] of Object.entries(glossary.terms)) {
    const kuerzel = entry.kuerzel === true;
    const tsLint = entry.tsLint !== false;
    for (const lang of /** @type {const} */ (['de', 'en'])) {
      const list = lang === 'de' ? entry.forbidden_de : entry.forbidden_en;
      for (const forbidden of list ?? []) {
        let regex;
        if (kuerzel) {
          regex = kuerzelRegex(forbidden);
        } else if (useAnchorOnly(forbidden)) {
          // Begriffe mit Kontextregel erfassen auch Beugungen („abgelehnter Eintrag“): nur der Wortanfang zählt.
          regex = new RegExp(`(?<![${GERMAN_WORD_CHAR}])${escapeRegExp(forbidden)}`, 'iu');
        } else {
          regex = wordBoundaryRegex(forbidden);
        }
        patterns.push({
          term,
          forbidden,
          lang,
          kuerzel,
          tsLint,
          reason: entry.reason,
          i18nKey: entry.i18nKey,
          de: entry.de,
          en: entry.en,
          regex,
        });
      }
    }
  }
  return patterns;
}

module.exports = {
  GERMAN_WORD_CHAR,
  LETTER_CHAR,
  escapeRegExp,
  wordBoundaryRegex,
  kuerzelRegex,
  stripInterpolation,
  buildPatterns,
};
