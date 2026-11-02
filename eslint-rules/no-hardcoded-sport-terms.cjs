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
 * forbidden_de[], forbidden_en?[], reason, i18nKey, kuerzel?, tsLint?, short? } } },
 * Schema im Kopfkommentar der Datei) und meldet Zeichenketten-Literale,
 * Template-Literal-Segmente und JSX-Text in src/**\/*.{ts,tsx}:
 *
 * - `error` für jedes verbotene Synonym aus forbidden_de / forbidden_en (z.B. "Elfmeterschießen").
 *   Kürzel (Begriffe mit `kuerzel: true`, @OB-075) werden groß-/kleinschreibungssensibel gesucht;
 *   in .ts/.tsx gibt es dafür keine Ausnahme: Kurzformen im Tabellenkopf, in Ergebniszellen und
 *   bei Uhr-Beschriftungen kommen aus dem Namensraum `short` (`t('short:tabellenkopf.played')`)
 *   und stehen nie als Literal im Code. Begriffe mit `tsLint: false` (interne matchId „P3“)
 *   werden nur in Sprachdateien geprüft.
 * - `warn` für die bevorzugte Form (de) selbst (nicht bei Kürzel-Begriffen: „Gruppe“ oder „gegen“
 *   sind gewöhnliche Wörter) — die steht womöglich noch
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
 */

'use strict';

const fs = require('fs');
const path = require('path');

const glossaryPath = path.join(__dirname, '..', 'src', 'i18n', 'glossary.json');

const { buildPatterns, stripInterpolation, wordBoundaryRegex } = require('../scripts/lib/glossary-patterns.cjs');

/** @type {{ terms: Record<string, any> }} */
const glossary = JSON.parse(fs.readFileSync(glossaryPath, 'utf8'));

// In .ts/.tsx gibt es keine Sprache: verboten ist jede Form beider Sprachen (außer tsLint: false).
const allPatterns = buildPatterns(glossary).filter((pattern) => pattern.tsLint);
// Gleiche Form in beiden Sprachen (z.B. „P3“, „KO“, „Gr.“) nur einmal melden.
const seen = new Set();
const forbiddenPatterns = allPatterns.filter((pattern) => {
  const id = `${pattern.term}|${pattern.forbidden}`;
  if (seen.has(id)) return false;
  seen.add(id);
  return true;
});

/** @type {Array<{ regex: RegExp; term: string; de: string; i18nKey: string }>} */
const preferredPatterns = [];
for (const [term, entry] of Object.entries(glossary.terms)) {
  if (entry.kuerzel === true) continue; // Kürzel-Begriffe: nur die verbotenen Kürzel zählen
  preferredPatterns.push({
    regex: wordBoundaryRegex(entry.de),
    term,
    de: entry.de,
    i18nKey: entry.i18nKey,
  });
}

/** Ein kleingeschriebenes Kürzel („vs“, „min“) ist in einem Literal ohne Leerzeichen kein Anzeigetext (z.B. 'min-content'). */
function looksLikeIdentifier(pattern, text, isJsxText) {
  return !isJsxText && /^[a-z]/.test(pattern.forbidden) && !/\s/.test(text);
}

/** Kleingeschriebenes Kürzel direkt vor „(“ ist eine CSS-Funktion („minmax(min(100%, …)“), kein Anzeigetext. */
function isCssFunctionCall(pattern, text, match) {
  return /^[a-z]/.test(pattern.forbidden) && text[match.index + match[0].length] === '(';
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
      shortKeyElsewhere:
        "Schlüssel des Namensraums `short` ('{{ matched }}') dürfen nur in {{ files }} stehen. Im Tabellenkopf <ShortLabel term=… />, " +
        "in der Ergebniszelle die Texte aus `matchResult.*` verwenden (Regel: .claude/conventions/TERMINOLOGY.md).",
      forbiddenAbbreviation:
        "'{{ matched }}' ist ein Kürzel und im Anzeigetext verboten ({{ reason }}). Ausgeschrieben `t('sport:{{ i18nKey }}')` " +
        "verwenden; im Tabellenkopf, in Ergebniszellen und bei Uhr-Beschriftungen die Kurzform aus dem Namensraum " +
        "`short` (Komponente ShortLabel), nie als Literal im Code.",
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
      '__fixtures__',       // Testdaten mit Kennungen wie „F-HF“, nie angezeigt
      'teamNameAbbrev',     // Vereinskürzel (SF = Sportfreunde): Datenabgleich, kein Anzeigetext für Begriffe des Glossars
      'fontData',           // eingebettete Schriften (Base64), kein Anzeigetext
      'DatenschutzScreen',  // Rechtstext mit wörtlichen Gesetzeszitaten („Nr. 2“)
      'ImpressumScreen',    // Rechtstext
    ];
    if (allowedPatterns.some((p) => normalized.includes(p))) {
      return {};
    }

    // `short:`-Schlüssel (Kurzformen) nur dort, wo das Glossar den Ort kennt (shortTerms.ts) oder der Text eines Dokuments sie braucht.
    const SHORT_KEY_FILES = ['/src/components/ui/atoms/shortTerms.ts', '/src/lib/pdf/translations.ts', '/src/lib/pdfStatisticsExporter.ts'];
    const shortKeyAllowed = SHORT_KEY_FILES.some((f) => normalized.endsWith(f));
    const SHORT_KEY = /(?:^|[^A-Za-z0-9_-])short:[A-Za-z][A-Za-z0-9_.]*/;

    function reasonFor(term) {
      return glossary.terms[term].reason;
    }

    function checkText(node, rawText, isJsxText = false) {
      if (typeof rawText !== 'string' || rawText.trim() === '') return;

      if (mode === 'forbidden' && !shortKeyAllowed) {
        const key = SHORT_KEY.exec(rawText);
        if (key) {
          context.report({
            node,
            messageId: 'shortKeyElsewhere',
            data: { matched: key[0].replace(/^[^s]/, ''), files: 'shortTerms.ts, src/lib/pdf/translations.ts und src/lib/pdfStatisticsExporter.ts' },
          });
        }
      }

      if (mode === 'forbidden') {
        // {{Platzhalter}} und $t(...)-Verweise sind keine Fließtexte (z.B. {{min}}).
        const text = stripInterpolation(rawText);
        const reportedTerms = new Set();
        for (const pattern of forbiddenPatterns) {
          // „Gr.“ und „Gr“, „Min“ und „Min.“ sind eine Fundstelle: je Begriff nur eine Meldung je Text.
          if (pattern.kuerzel && reportedTerms.has(pattern.term)) continue;
          if (pattern.kuerzel && looksLikeIdentifier(pattern, text, isJsxText)) continue;
          const match = pattern.regex.exec(text);
          if (match && !(pattern.kuerzel && isCssFunctionCall(pattern, text, match))) {
            reportedTerms.add(pattern.term);
            context.report({
              node,
              messageId: pattern.kuerzel ? 'forbiddenAbbreviation' : 'forbiddenSynonym',
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
        const match = pattern.regex.exec(rawText);
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
        checkText(node, node.value, true);
      },
    };
  },
};
