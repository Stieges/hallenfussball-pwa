/**
 * ESLint Rule: no-hardcoded-sport-terms
 *
 * Enforces the single source of truth for sport terminology defined in
 * src/i18n/glossary.json. Vorher standen 35 Vorkommen von "Elfmeterschießen"
 * verstreut über TSX-Dateien, Sprachdateien und Kommentare — eine Komponente
 * benutzte sogar "Elfmeterschießen" UND "Strafstoßschießen" gleichzeitig.
 * Diese Regel verhindert, dass sich das wiederholt.
 *
 * Liest src/i18n/glossary.json (Struktur: { terms: { <id>: { de, en,
 * forbidden_de[], reason, i18nKey } } }) und meldet Zeichenketten-Literale,
 * Template-Literal-Segmente und JSX-Text in src/**\/*.{ts,tsx}:
 *
 * - `error` für jedes verbotene Synonym aus forbidden_de (z.B. "Elfmeterschießen").
 * - `warn` für die bevorzugte Form (de) selbst — die steht womöglich noch
 *   hartkodiert in Testdaten, Kommentaren oder Demo-Bildschirmen, statt über
 *   t('sport:<i18nKey>') bezogen zu werden. Ein Bruch der gesamten Lint-Kette
 *   dafür wäre unverhältnismäßig (gleiche Abstufung wie prefer-css-vars=warn
 *   gegen no-restricted-syntax=error).
 *
 * ❌ Bad:
 *   <span>Elfmeterschießen</span>
 *   const label = 'Vorrunde';
 *
 * ✅ Good:
 *   const { t } = useTranslation('sport');
 *   <span>{t('events.penaltyShootout')}</span>
 *
 * ESLint kann eine einzelne Regel nicht mit gemischten Severities (error UND
 * warn) gleichzeitig konfigurieren — die Severity gilt pro Config-Eintrag für
 * die ganze Regel. Deshalb exportiert diese Datei EINE Implementierung mit
 * einer Pflicht-Option ('forbidden' | 'preferred'), die in eslint.config.js
 * unter zwei Plugin-Keys registriert wird ('no-hardcoded-sport-terms' als
 * error/forbidden, 'no-hardcoded-sport-terms-preferred' als warn/preferred).
 * Beide Keys zeigen auf dasselbe Regel-Objekt — eine Quelle, zwei Aufrufe.
 *
 * Exceptions (bewusst, siehe allowedPatterns unten):
 * - src/i18n/locales/**  — dort sind die Begriffe die normative Quelle selbst.
 * - Dateien außerhalb von src/ — Scope laut Task-8-Brief ist src/**\/*.{ts,tsx}.
 * - Testdateien (.test., __tests__) — Testbeschreibungen/-fixtures zitieren
 *   Begriffe zu Dokumentationszwecken; siehe no-hardcoded-font-styles.cjs,
 *   das denselben Pfad-Ausschluss für Tests bereits kennt.
 * - Mockup/Demo-Screens (LiveCockpitMockup, MatchCockpitDemoScreen) — nicht
 *   produktiv gerenderte Beispieldaten, vom Brief explizit als Beispiel für
 *   eine begründete Ausnahme genannt ("Demo-Bildschirmen").
 * - pdfExporter.ts — PDF-Layout-Konstanten, gleiche Begründung wie in
 *   no-hardcoded-font-styles.cjs (feste Display-Kontexte, kein t()-Zugriff
 *   im PDF-Renderer vorgesehen).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const glossaryPath = path.join(__dirname, '..', 'src', 'i18n', 'glossary.json');

/** @type {{ terms: Record<string, { de: string; en: string; forbidden_de: string[]; reason: string; i18nKey: string }> }} */
const glossary = JSON.parse(fs.readFileSync(glossaryPath, 'utf8'));

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// JS' \b definiert "Wortzeichen" nur als [A-Za-z0-9_] (ASCII) — Umlaute und ß
// zählen NICHT dazu. Damit würde z.B. \bStrafstoß\b fälschlich INNERHALB von
// "Strafstoßschießen" matchen, weil \b die Lücke zwischen dem (als "kein
// Wortzeichen" behandelten) ß und dem folgenden "s" als Wortgrenze liest.
// Eigene Grenzen per Lookaround mit einer Zeichenklasse, die deutsche Buchstaben
// einschließt, vermeiden das.
const GERMAN_WORD_CHAR = 'A-Za-zÀ-ÖØ-öø-ÿ0-9_';
function wordBoundaryRegex(phrase) {
  return new RegExp(
    `(?<![${GERMAN_WORD_CHAR}])${escapeRegExp(phrase)}(?![${GERMAN_WORD_CHAR}])`,
    'iu',
  );
}

/** @type {Array<{ regex: RegExp; term: string; de: string; i18nKey: string }>} */
const forbiddenPatterns = [];
/** @type {Array<{ regex: RegExp; term: string; de: string; i18nKey: string }>} */
const preferredPatterns = [];

for (const [term, entry] of Object.entries(glossary.terms)) {
  preferredPatterns.push({
    regex: wordBoundaryRegex(entry.de),
    term,
    de: entry.de,
    i18nKey: entry.i18nKey,
  });
  for (const forbidden of entry.forbidden_de) {
    forbiddenPatterns.push({
      regex: wordBoundaryRegex(forbidden),
      term,
      de: entry.de,
      i18nKey: entry.i18nKey,
      matched: forbidden,
    });
  }
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hardcoded sport terminology; enforce src/i18n/glossary.json as single source of truth',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      forbiddenSynonym:
        "'{{ matched }}' ist verboten ({{ reason }}). Stattdessen `t('sport:{{ i18nKey }}')` verwenden " +
        "oder in einer Sprachdatei `$t(sport:{{ i18nKey }})` verschachteln.",
      preferredFormHardcoded:
        "'{{ matched }}' ist die bevorzugte Form aus src/i18n/glossary.json, aber hartkodiert statt " +
        "über `t('sport:{{ i18nKey }}')` bezogen zu werden.",
    },
    schema: [
      {
        type: 'string',
        enum: ['forbidden', 'preferred'],
      },
    ],
  },

  create(context) {
    const mode = context.options[0] ?? 'forbidden';

    // ESLint 10 entfernt context.getFilename(); 8.40+ haben context.filename
    const filename = context.filename ?? context.getFilename();
    const normalized = filename.split(path.sep).join('/');

    // Nur src/**/*.{ts,tsx} — siehe Task-8-Brief.
    if (!normalized.includes('/src/')) {
      return {};
    }

    // Begründete Ausnahmen (siehe Datei-Kopfkommentar).
    const allowedPatterns = [
      '/src/i18n/locales/', // normative Quelle der Begriffe selbst
      '.test.',             // Testdateien
      '__tests__',          // Testdateien
      'LiveCockpitMockup',  // Demo-Screen, nicht produktiv gerendert
      'MatchCockpitDemoScreen', // Demo-Screen, nicht produktiv gerendert
      'pdfExporter.ts',     // PDF-Layout-Konstanten, wie in no-hardcoded-font-styles.cjs
    ];
    if (allowedPatterns.some((p) => normalized.includes(p))) {
      return {};
    }

    function reasonFor(term) {
      return glossary.terms[term].reason;
    }

    function checkText(node, text) {
      if (typeof text !== 'string' || text.trim() === '') return;

      if (mode === 'forbidden') {
        for (const pattern of forbiddenPatterns) {
          const match = pattern.regex.exec(text);
          if (match) {
            context.report({
              node,
              messageId: 'forbiddenSynonym',
              data: {
                matched: match[0],
                reason: reasonFor(pattern.term),
                i18nKey: pattern.i18nKey,
              },
            });
          }
        }
        return;
      }

      for (const pattern of preferredPatterns) {
        const match = pattern.regex.exec(text);
        if (match) {
          context.report({
            node,
            messageId: 'preferredFormHardcoded',
            data: {
              matched: match[0],
              i18nKey: pattern.i18nKey,
            },
          });
        }
      }
    }

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        // TS-Typ-Literale (z.B. 'shootout' | 'overtime-then-shootout') sind
        // keine Anzeige-Texte, sondern Identifier-artige Union-Member.
        if (node.parent && node.parent.type === 'TSLiteralType') return;
        checkText(node, node.value);
      },
      TemplateElement(node) {
        checkText(node, node.value.cooked ?? '');
      },
      JSXText(node) {
        checkText(node, node.value);
      },
    };
  },
};
