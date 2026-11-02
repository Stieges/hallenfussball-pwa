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
 * 4. Kurzformen (@OB-075): Kürzel aus forbidden_de / forbidden_en (kuerzel: true)
 *    sind in jedem Locale-Wert verboten, ausgenommen im Namensraum „short“
 *    (short.json). Dort muss jeder Wert genau der Kurzform eines Glossar-Eintrags
 *    entsprechen (short.<de|en>, Ort = short.context), und jede Kurzform des
 *    Glossars muss dort stehen. So gibt es genau einen Ort für Kurzformen.
 *
 * forbidden_de gilt für „de“ und – außer die Form ist gültiges Englisch (en-Form des Begriffs) – auch für „en“; forbidden_en nur für „en“.
 * Schema und Begründung: Kopfkommentar von src/i18n/glossary.json.
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
// Die Muster-Bildung steckt in scripts/lib/glossary-patterns.cjs (gemeinsam mit der ESLint-Regel).
const {
  GERMAN_WORD_CHAR,
  escapeRegExp,
  wordBoundaryRegex,
  stripInterpolation,
  buildPatterns,
} = require('./lib/glossary-patterns.cjs');

/** Namensraum, in dem Kurzformen stehen dürfen (src/i18n/locales/<sprache>/short.json). */
const SHORT_NAMESPACE = 'short';
const SHORT_CONTEXTS = ['tabellenkopf', 'ergebniszelle'];

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
 * Kontextregel (wie docs/anforderungen/_tools/glossar-kontext.yaml, C6): Manche verbotenen Begriffe gelten nur im Zusammenhang,
 * für den das Glossar sie verbietet. „abgelehnt“ ist für Einträge des Ausgangs verboten (D-C1), nicht für eine abgelehnte
 * Beitrittsanfrage (@HE-008). Der Begriff wird nur gemeldet, wenn mindestens eines dieser Wörter im selben Wert steht
 * („Wort*“ = Wortanfang, sonst ganzes Wort; Groß-/Kleinschreibung zählt). Begriffe ohne Eintrag gelten überall.
 */
const OUTBOX_CONTEXT = ['Server', 'Eintrag', 'Eintrags', 'Eintrages', 'Einträge', 'Einträgen', 'Ausgang*', 'Warteschlange', 'Übertrag*', 'nicht übernommen'];
const CONTEXT_RULES = {
  abgelehnt: OUTBOX_CONTEXT,
  Ablehnung: OUTBOX_CONTEXT,
  'in Prüfung': OUTBOX_CONTEXT,
  'Review offen': OUTBOX_CONTEXT,
};

function contextWordRegex(word) {
  const prefix = word.endsWith('*');
  const base = prefix ? word.slice(0, -1) : word;
  return new RegExp(`(?<![${GERMAN_WORD_CHAR}])${escapeRegExp(base)}${prefix ? '' : `(?![${GERMAN_WORD_CHAR}])`}`, 'u');
}

/** Gilt das verbotene Synonym für diesen Text? Ohne Kontextregel immer, sonst nur mit einem Kontextwort. */
function contextApplies(forbidden, text) {
  const words = CONTEXT_RULES[forbidden];
  if (!words) return true;
  return words.some((word) => contextWordRegex(word).test(text));
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
 * Alle verbotenen Formen des Glossars (forbidden_de für de, forbidden_en für en).
 * @param {{terms: Record<string, import('./lib/glossary-patterns.d.cts').GlossaryEntry>}} glossary
 * @returns {import('./lib/glossary-patterns.d.cts').GlossaryPattern[]}
 */
function buildForbiddenPatterns(glossary) {
  return buildPatterns(glossary, (forbidden) => Boolean(CONTEXT_RULES[forbidden]));
}

/**
 * Prüft alle Locale-Werte auf verbotene Synonyme aus dem Glossar.
 * @returns {string[]} Fehlermeldungen
 */
function checkForbiddenSynonyms(localesDir, locales, namespaces, patterns) {
  const errors = [];

  for (const locale of locales) {
    // Deutsche verbotene Formen sind auch in englischen Texten falsch („HF“, „SR“, „Elfmeter“); Ausnahme: der Begriff ist
    // auch gültiges Englisch (z. B. „vs“, das Glossar führt es als en-Form von „gegen“).
    const localePatterns = patterns.filter((pattern) => pattern.lang === locale
      || (locale === 'en' && pattern.lang === 'de' && pattern.forbidden.toLowerCase() !== pattern.en.toLowerCase()));
    for (const namespace of namespaces) {
      // Kurzformen dürfen nur im Namensraum „short“ stehen; er wird in Check 4 gegen das Glossar geprüft.
      if (namespace === SHORT_NAMESPACE) continue;
      const data = loadNamespace(localesDir, locale, namespace);
      if (data === null) continue;

      const flattened = flatten(data);
      for (const [key, value] of Object.entries(flattened)) {
        if (typeof value !== 'string') continue;

        const reportedTerms = new Set();
        for (const pattern of localePatterns) {
          if (reportedTerms.has(pattern.term)) continue; // „Nr.“ und „Nr“ sind eine Fundstelle
          const cleaned = pattern.kuerzel ? stripInterpolation(value) : stripInterpolationRefs(value);
          if (pattern.regex.test(cleaned) && contextApplies(pattern.forbidden, cleaned)) {
            reportedTerms.add(pattern.term);
            errors.push(
              `Verbotenes ${pattern.kuerzel ? 'Kürzel' : 'Synonym'} "${pattern.forbidden}" (Begriff "${pattern.term}") in ` +
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
// CHECK 4: KURZFORMEN NUR IM NAMENSRAUM "short"
// =============================================================================

/**
 * Prüft, dass short.json (je Sprache) genau die Kurzformen des Glossars führt:
 * jeder Eintrag mit `short` hat seinen shortKey mit dem Wert short.<sprache>,
 * der Ort (erster Pfadteil) entspricht short.context, und es gibt keinen Schlüssel,
 * den kein Glossar-Eintrag beansprucht. Ohne Eintrag im Glossar gibt es keine Kurzform.
 * @returns {string[]} Fehlermeldungen
 */
function checkShortForms(localesDir, locales, glossary, namespaces = []) {
  const errors = [];
  const claimed = new Set();

  for (const [term, entry] of Object.entries(glossary.terms)) {
    const short = entry.short;
    if (!short) continue;

    if (!SHORT_CONTEXTS.includes(short.context)) {
      errors.push(
        `Glossar-Begriff "${term}": short.context "${short.context}" ist unbekannt ` +
          `(erlaubt: ${SHORT_CONTEXTS.join(', ')}).`
      );
    }
    if (typeof short.shortKey !== 'string' || short.shortKey.split('.')[0] !== short.context) {
      errors.push(
        `Glossar-Begriff "${term}": short.shortKey "${short.shortKey}" muss mit dem Ort "${short.context}." beginnen.`
      );
      continue;
    }
    claimed.add(short.shortKey);

    for (const locale of ['de', 'en']) {
      if (!locales.includes(locale)) continue;
      const data = loadNamespace(localesDir, locale, SHORT_NAMESPACE);
      if (data === null) {
        errors.push(
          `Glossar-Begriff "${term}": Namespace "${SHORT_NAMESPACE}" fehlt in Sprache "${locale}" ` +
            `(src/i18n/locales/${locale}/${SHORT_NAMESPACE}.json).`
        );
        continue;
      }
      const flattened = flatten(data);
      if (!(short.shortKey in flattened)) {
        errors.push(
          `Glossar-Begriff "${term}": Kurzform-Schlüssel "${short.shortKey}" fehlt in ` +
            `src/i18n/locales/${locale}/${SHORT_NAMESPACE}.json.`
        );
      } else if (flattened[short.shortKey] !== short[locale]) {
        errors.push(
          `Glossar-Begriff "${term}": Kurzform "${short.shortKey}" in src/i18n/locales/${locale}/${SHORT_NAMESPACE}.json ` +
            `ist "${flattened[short.shortKey]}", erwartet "${short[locale]}" (glossary.json terms.${term}.short.${locale}).`
        );
      }
    }
  }

  for (const locale of locales) {
    const data = loadNamespace(localesDir, locale, SHORT_NAMESPACE);
    if (data === null) continue;
    for (const key of Object.keys(flatten(data))) {
      if (!claimed.has(key)) {
        errors.push(
          `Kurzform "${key}" in src/i18n/locales/${locale}/${SHORT_NAMESPACE}.json hat keinen Glossar-Eintrag ` +
            `mit short.shortKey "${key}". Kurzformen gibt es nur, wenn das Glossar sie erlaubt.`
        );
      }
    }
  }

  return errors.concat(checkShortReferences(localesDir, locales, namespaces, glossary));
}

/**
 * Verweise `$t(short:…)` in Sprachwerten außerhalb von „short“ sind nur dort erlaubt, wo das Glossar sie nennt
 * (short.usedBy, z. B. die Ergebniszelle `tournament:matchResult.overtimeShort`). Sonst ließe sich eine Kurzform
 * an jeder Stelle einschmuggeln, ohne dass der Ort geprüft wird.
 * @returns {string[]} Fehlermeldungen
 */
function checkShortReferences(localesDir, locales, namespaces, glossary) {
  const errors = [];
  const allowed = new Map(); // shortKey -> erlaubte Fundorte
  for (const entry of Object.values(glossary.terms)) {
    if (entry.short) allowed.set(entry.short.shortKey, new Set(entry.short.usedBy ?? []));
  }
  const referenz = /\$t\(\s*short:([A-Za-z0-9_.]+)/g;
  for (const locale of locales) {
    for (const namespace of namespaces) {
      if (namespace === SHORT_NAMESPACE) continue;
      const data = loadNamespace(localesDir, locale, namespace);
      if (data === null) continue;
      for (const [key, value] of Object.entries(flatten(data))) {
        if (typeof value !== 'string') continue;
        for (const found of value.matchAll(referenz)) {
          const host = `${namespace}:${key}`;
          if (!allowed.get(found[1])?.has(host)) {
            errors.push(
              `Verweis auf die Kurzform "short:${found[1]}" in src/i18n/locales/${locale}/${namespace}.json, Schlüssel "${key}" ` +
                `ist nicht erlaubt (glossary.json: short.usedBy für "${found[1]}" nennt "${host}" nicht). Kurzformen nur an ihrem Ort.`
            );
          }
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
    { check: 'Kurzformen', errors: checkShortForms(localesDir, locales, glossary, namespaces) },
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
    console.log('  4. Kurzformen: nur in src/i18n/locales/{de,en}/short.json, und dort genau wie im Glossar (short.*)');
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
  contextApplies,
  stripInterpolationRefs,
  buildForbiddenPatterns,
  checkKeyParity,
  checkForbiddenSynonyms,
  checkGlossaryKeys,
  checkShortForms,
  checkShortReferences,
  runAllChecks,
};
