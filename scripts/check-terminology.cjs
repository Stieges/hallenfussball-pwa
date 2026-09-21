#!/usr/bin/env node

/**
 * Terminology Check
 *
 * Prüft die zentrale Fachterminologie (src/i18n/locales/**, src/i18n/glossary.json):
 *
 * 1. Schlüssel-Parität zwischen allen Sprachverzeichnissen über alle Namespaces.
 *    Existiert heute nirgends — die 100% Übereinstimmung zwischen de/en ist Zufall,
 *    keine Prüfung. Bei einer dritten Sprache wird das zur Pflicht.
 * 2. Kein verbotenes Synonym (glossary.json terms.<id>.forbidden_de) in einem
 *    Locale-Wert. Verschachtelungen der Form $t(sport:events.penaltyShootout)
 *    werden vor der Prüfung entfernt — das sind Referenzen, keine Fließtexte.
 * 3. Jeder Glossar-Eintrag hat seinen Schlüssel in sport.json, in jeder Sprache,
 *    und der Wert an diesem Pfad entspricht (für de/en) dem jeweiligen Glossar-Feld.
 *
 * Sprachverzeichnisse und Namespaces werden zur Laufzeit aus src/i18n/locales/
 * gelesen (dynamische Erfassung), damit eine neue Sprache automatisch mitgeprüft
 * wird, ohne das Skript anzufassen — genau wie scripts/check-design-token-sync.cjs
 * es mit den Themes macht. Dieses Skript ist dessen Aufbau bewusst nachgebildet.
 *
 * Usage:
 *   npm run terms:check
 */

'use strict';

const fs = require('fs');
const path = require('path');

// =============================================================================
// CONFIGURATION
// =============================================================================

const PATHS = {
  localesDir: path.join(__dirname, '..', 'src', 'i18n', 'locales'),
  glossaryPath: path.join(__dirname, '..', 'src', 'i18n', 'glossary.json'),
};

// =============================================================================
// HELPERS
// =============================================================================

// JS' \b definiert "Wortzeichen" nur als [A-Za-z0-9_] (ASCII) — Umlaute und ß
// zählen NICHT dazu. Damit würde z.B. \bStrafstoß\b fälschlich INNERHALB von
// "Strafstoßschießen" matchen, weil \b die Lücke zwischen dem (als "kein
// Wortzeichen" behandelten) ß und dem folgenden "s" als Wortgrenze liest.
// Eigene Grenzen per Lookaround mit einer Zeichenklasse, die deutsche Buchstaben
// einschließt, vermeiden das. Identischer Ansatz wie in
// eslint-rules/no-hardcoded-sport-terms.cjs — dieselbe Falle, dieselbe Lösung.
const GERMAN_WORD_CHAR = 'A-Za-zÀ-ÖØ-öø-ÿ0-9_';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordBoundaryRegex(phrase) {
  return new RegExp(
    `(?<![${GERMAN_WORD_CHAR}])${escapeRegExp(phrase)}(?![${GERMAN_WORD_CHAR}])`,
    'iu'
  );
}

/**
 * i18next-Verschachtelungen wie "$t(sport:events.penaltyShootout)" sind
 * Referenzen auf andere Schlüssel, keine Fließtexte. Sie können den i18nKey
 * eines Begriffs enthalten, dürfen aber nicht als Verstoß gegen ein
 * verbotenes Synonym gewertet werden. Vor der Prüfung entfernen.
 */
function stripInterpolationRefs(value) {
  return value.replace(/\$t\([^)]*\)/g, '');
}

/**
 * Findet alle Sprachverzeichnisse unter src/i18n/locales/
 * @returns {string[]}
 */
function discoverLocales(localesDir) {
  return fs
    .readdirSync(localesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Findet alle Namespaces (Dateinamen ohne .json) über alle Sprachverzeichnisse
 * hinweg (Vereinigung, damit ein Namespace, der in nur einer Sprache existiert,
 * auch als fehlend in den anderen erkannt wird).
 * @returns {string[]}
 */
function discoverNamespaces(localesDir, locales) {
  const namespaces = new Set();
  for (const locale of locales) {
    const dir = path.join(localesDir, locale);
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.json')) {
        namespaces.add(file.slice(0, -'.json'.length));
      }
    }
  }
  return [...namespaces].sort();
}

/**
 * Lädt einen Namespace für eine Sprache, oder null wenn die Datei fehlt.
 * @returns {Record<string, unknown> | null}
 */
function loadNamespace(localesDir, locale, namespace) {
  const filePath = path.join(localesDir, locale, `${namespace}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Flacht ein verschachteltes Objekt zu { "a.b.c": value } ab. Nur Blätter
 * (nicht-Objekt-Werte) werden als Schlüssel geführt; Arrays gelten als Blatt.
 * @param {Record<string, unknown>} obj
 * @param {string} prefix
 * @returns {Record<string, unknown>}
 */
function flatten(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flatten(value, fullPath));
    } else {
      result[fullPath] = value;
    }
  }
  return result;
}

function loadGlossary(glossaryPath) {
  return JSON.parse(fs.readFileSync(glossaryPath, 'utf-8'));
}

// =============================================================================
// CHECK 1: KEY PARITY
// =============================================================================

/**
 * Prüft, dass jeder Namespace in jeder Sprache existiert und dieselben
 * Schlüssel enthält.
 * @returns {string[]} Fehlermeldungen
 */
function checkKeyParity(localesDir, locales, namespaces) {
  const errors = [];

  for (const namespace of namespaces) {
    /** @type {Record<string, Record<string, unknown>>} */
    const flattenedByLocale = {};

    for (const locale of locales) {
      const data = loadNamespace(localesDir, locale, namespace);
      if (data === null) {
        errors.push(
          `Namespace "${namespace}" fehlt komplett in Sprache "${locale}" ` +
            `(Datei src/i18n/locales/${locale}/${namespace}.json nicht gefunden).`
        );
        continue;
      }
      flattenedByLocale[locale] = flatten(data);
    }

    const presentLocales = Object.keys(flattenedByLocale);
    const allKeys = new Set();
    for (const locale of presentLocales) {
      for (const key of Object.keys(flattenedByLocale[locale])) allKeys.add(key);
    }

    for (const key of allKeys) {
      for (const locale of presentLocales) {
        if (!(key in flattenedByLocale[locale])) {
          errors.push(
            `Schlüssel "${key}" fehlt in Sprache "${locale}", Namespace "${namespace}" ` +
              `(src/i18n/locales/${locale}/${namespace}.json).`
          );
        }
      }
    }
  }

  return errors;
}

// =============================================================================
// CHECK 2: FORBIDDEN SYNONYMS
// =============================================================================

/**
 * @param {{terms: Record<string, {de: string, en: string, forbidden_de: string[], reason: string, i18nKey: string}>}} glossary
 * @returns {Array<{term: string, forbidden: string, reason: string, regex: RegExp}>}
 */
function buildForbiddenPatterns(glossary) {
  const patterns = [];
  for (const [term, entry] of Object.entries(glossary.terms)) {
    for (const forbidden of entry.forbidden_de) {
      patterns.push({
        term,
        forbidden,
        reason: entry.reason,
        regex: wordBoundaryRegex(forbidden),
      });
    }
  }
  return patterns;
}

/**
 * Prüft alle Locale-Werte auf verbotene Synonyme aus dem Glossar.
 * @returns {string[]} Fehlermeldungen
 */
function checkForbiddenSynonyms(localesDir, locales, namespaces, patterns) {
  const errors = [];

  for (const locale of locales) {
    for (const namespace of namespaces) {
      const data = loadNamespace(localesDir, locale, namespace);
      if (data === null) continue;

      const flattened = flatten(data);
      for (const [key, value] of Object.entries(flattened)) {
        if (typeof value !== 'string') continue;
        const cleaned = stripInterpolationRefs(value);

        for (const pattern of patterns) {
          if (pattern.regex.test(cleaned)) {
            errors.push(
              `Verbotenes Synonym "${pattern.forbidden}" (Begriff "${pattern.term}") in ` +
                `src/i18n/locales/${locale}/${namespace}.json, Schlüssel "${key}": "${value}". ` +
                `${pattern.reason}`
            );
          }
        }
      }
    }
  }

  return errors;
}

// =============================================================================
// CHECK 3: GLOSSARY ENTRIES HAVE THEIR KEY
// =============================================================================

/**
 * Prüft, dass jeder Glossar-Eintrag seinen i18nKey in sport.json hat (in jeder
 * Sprache) und dass der Wert dort dem Glossar-Feld (de/en) entspricht.
 * @returns {string[]} Fehlermeldungen
 */
function checkGlossaryKeys(localesDir, locales, glossary) {
  const errors = [];

  for (const [term, entry] of Object.entries(glossary.terms)) {
    for (const locale of locales) {
      const data = loadNamespace(localesDir, locale, 'sport');
      if (data === null) {
        errors.push(
          `Glossar-Begriff "${term}": Namespace "sport" fehlt in Sprache "${locale}" ` +
            `(src/i18n/locales/${locale}/sport.json) — Pfad "${entry.i18nKey}" kann nicht geprüft werden.`
        );
        continue;
      }

      const flattened = flatten(data);
      if (!(entry.i18nKey in flattened)) {
        errors.push(
          `Glossar-Begriff "${term}": Pfad "${entry.i18nKey}" existiert nicht in ` +
            `src/i18n/locales/${locale}/sport.json (glossary.json terms.${term}.i18nKey).`
        );
        continue;
      }

      // glossary.json führt nur "de" und "en" als normative Felder. "de" ist
      // laut Schema-Kommentar "Verbindlich für UI-Text" — exakter Vergleich.
      // "en" ist explizit als "Referenz, keine UI-Vorgabe" dokumentiert (z.B.
      // für Code-Bezeichner in Kleinschreibung), während sport.json/en die
      // tatsächliche UI-Anzeige in Title Case führt ("penalty" vs. "Penalty").
      // Groß-/Kleinschreibung ist dadurch bewusst kein Verstoß — nur eine
      // inhaltlich andere Übersetzung ist einer.
      if (locale === 'de') {
        const expected = entry.de;
        const actual = flattened[entry.i18nKey];
        if (expected !== undefined && actual !== expected) {
          errors.push(
            `Glossar-Begriff "${term}": Wert an "${entry.i18nKey}" in ` +
              `src/i18n/locales/de/sport.json ist "${actual}", erwartet "${expected}" ` +
              `(glossary.json terms.${term}.de).`
          );
        }
      } else if (locale === 'en') {
        const expected = entry.en;
        const actual = flattened[entry.i18nKey];
        if (
          expected !== undefined &&
          typeof actual === 'string' &&
          actual.toLowerCase() !== expected.toLowerCase()
        ) {
          errors.push(
            `Glossar-Begriff "${term}": Wert an "${entry.i18nKey}" in ` +
              `src/i18n/locales/en/sport.json ist "${actual}", erwartet (case-insensitiv) "${expected}" ` +
              `(glossary.json terms.${term}.en).`
          );
        }
      }
    }
  }

  return errors;
}

// =============================================================================
// MAIN
// =============================================================================

function runAllChecks(localesDir = PATHS.localesDir, glossaryPath = PATHS.glossaryPath) {
  const locales = discoverLocales(localesDir);
  const namespaces = discoverNamespaces(localesDir, locales);
  const glossary = loadGlossary(glossaryPath);
  const forbiddenPatterns = buildForbiddenPatterns(glossary);

  const results = [
    { check: 'Schlüssel-Parität', errors: checkKeyParity(localesDir, locales, namespaces) },
    {
      check: 'Verbotene Synonyme',
      errors: checkForbiddenSynonyms(localesDir, locales, namespaces, forbiddenPatterns),
    },
    { check: 'Glossar-Schlüssel', errors: checkGlossaryKeys(localesDir, locales, glossary) },
  ];

  return { locales, namespaces, results };
}

function main() {
  console.log('');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('║           TERMINOLOGY CHECK                                  ║');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');

  console.log('🔍 Discovering locales and namespaces...\n');

  const { locales, namespaces, results } = runAllChecks();

  console.log(`   Found ${locales.length} locales: ${locales.join(', ')}`);
  console.log(`   Found ${namespaces.length} namespaces: ${namespaces.join(', ')}`);
  console.log('');

  console.log('─'.repeat(60));
  console.log('RESULTS');
  console.log('─'.repeat(60));

  let allPassed = true;

  for (const result of results) {
    const pass = result.errors.length === 0;
    const icon = pass ? '✓' : '✗';
    console.log(`\n${icon} ${result.check}`);

    if (!pass) {
      allPassed = false;
      result.errors.slice(0, 30).forEach((msg) => console.log(`   - ${msg}`));
      if (result.errors.length > 30) {
        console.log(`   ... und ${result.errors.length - 30} weitere`);
      }
    }
  }

  console.log('\n' + '─'.repeat(60));

  if (allPassed) {
    console.log('✅ Terminologie ist konsistent!');
    console.log(`   ${locales.length} Sprachen, ${namespaces.length} Namespaces geprüft.`);
    process.exit(0);
  } else {
    console.log('❌ Terminology Check FAILED\n');
    console.log('Prüfe:');
    console.log('  1. Schlüssel-Parität: fehlt ein Schlüssel in einer Sprache?');
    console.log('  2. Verbotene Synonyme: siehe src/i18n/glossary.json terms.<id>.forbidden_de');
    console.log('  3. Glossar-Schlüssel: stimmt src/i18n/locales/{de,en}/sport.json mit glossary.json überein?');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  discoverLocales,
  discoverNamespaces,
  loadNamespace,
  flatten,
  loadGlossary,
  wordBoundaryRegex,
  stripInterpolationRefs,
  buildForbiddenPatterns,
  checkKeyParity,
  checkForbiddenSynonyms,
  checkGlossaryKeys,
  runAllChecks,
};
