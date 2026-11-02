'use strict';

const { RuleTester } = require('eslint');
const rule = require('../no-hardcoded-sport-terms.cjs');

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

// --- mode: 'forbidden' (registered as local-rules/no-hardcoded-sport-terms, severity 'error') ---
ruleTester.run('no-hardcoded-sport-terms (forbidden)', rule, {
  valid: [
    // 2. Korrekter t()-Aufruf → keine Meldung (der i18n-Key enthält keinen
    // deutschen Fachbegriff, nur Punktnotation).
    {
      filename: '/repo/src/components/match-cockpit/TiebreakerBanner.tsx',
      code: "const label = t('events.penaltyShootout');",
      options: ['forbidden'],
    },
    {
      filename: '/repo/src/components/match-cockpit/TiebreakerBanner.tsx',
      code: "const label = t('sport:events.penaltyShootout');",
      options: ['forbidden'],
    },
    // 3. Vorkommen in einer Locale-Datei → keine Meldung.
    {
      filename: '/repo/src/i18n/locales/de/sport.json.ts', // hypothetischer .ts-Re-Export
      code: "export const penaltyShootout = 'Elfmeterschießen';",
      options: ['forbidden'],
    },
    // Außerhalb von src/ → keine Meldung (Scope laut Brief ist src/**/*.{ts,tsx}).
    {
      filename: '/repo/tests/e2e/cockpit.spec.ts',
      code: "const label = 'Elfmeterschießen';",
      options: ['forbidden'],
    },
    // Testdateien sind ausgenommen (Testbeschreibungen/-fixtures).
    {
      filename: '/repo/src/components/match-cockpit/__tests__/TiebreakerBanner.test.tsx',
      code: "it('zeigt Elfmeterschießen an', () => {});",
      options: ['forbidden'],
    },
    // Die bevorzugte Form selbst ist im 'forbidden'-Modus kein Verstoß.
    {
      filename: '/repo/src/components/match-cockpit/TiebreakerBanner.tsx',
      code: "const label = 'Strafstoßschießen';",
      options: ['forbidden'],
    },
    // Unverwandter Text bleibt unbeanstandet.
    {
      filename: '/repo/src/components/match-cockpit/TiebreakerBanner.tsx',
      code: "const label = 'Tor für Heimteam';",
      options: ['forbidden'],
    },
  ],
  invalid: [
    // 1. Ein verbotenes Synonym in einer TSX → Fehler, Meldung nennt den Ersatz-Schlüssel.
    {
      filename: '/repo/src/components/match-cockpit/TiebreakerBanner.tsx',
      code: "const label = 'Elfmeterschießen';",
      options: ['forbidden'],
      errors: [
        {
          messageId: 'forbiddenSynonym',
        },
      ],
    },
    // Verbotenes Synonym als JSX-Text.
    {
      filename: '/repo/src/screens/LiveViewScreen.tsx',
      code: 'const el = <span>Vorrunde</span>;',
      options: ['forbidden'],
      errors: [
        {
          messageId: 'forbiddenSynonym',
        },
      ],
    },
    // Verbotenes Synonym in einem Template-Literal.
    {
      filename: '/repo/src/components/match-cockpit/TiebreakerBanner.tsx',
      code: 'const msg = `Jetzt folgt das Golden-Goal-Phase`;',
      options: ['forbidden'],
      errors: [
        {
          messageId: 'forbiddenSynonym',
        },
      ],
    },
    // 'Elfmeter' allein ist ebenfalls verboten (Term 'penalty').
    {
      filename: '/repo/src/components/match-cockpit/TiebreakerBanner.tsx',
      code: "const label = 'Elfmeter-Punkt';",
      options: ['forbidden'],
      errors: [
        {
          messageId: 'forbiddenSynonym',
        },
      ],
    },
  ],
});


// --- Kürzel (@OB-075/@OB-076): ausgeschrieben im Anzeigetext, Kurzformen nur über den Namensraum „short“ ---
const COMPONENT = '/repo/src/components/schedule/MatchCard/MatchCardHeader.tsx';
ruleTester.run('no-hardcoded-sport-terms (Kürzel)', rule, {
  valid: [
    // Ausgeschriebene Begriffe sind in jeder Form erlaubt (auch bei „preferred“: Kürzel-Begriffe lösen keine Warnung aus).
    { filename: COMPONENT, code: "const a = 'Halbfinale 1'; const b = 'Schiedsrichter 2'; const c = 'Gruppe A'; const d = 'gegen';", options: ['forbidden'] },
    { filename: COMPONENT, code: "const a = 'Gruppe A gegen Gruppe B';", options: ['preferred'] },
    // Englisches „vs“ ist erlaubt (nur das deutsche ist verboten), aber ohne Sprache im Code bleibt „vs“ im Literal ein Fund: siehe invalid.
    // `short:`-Schlüssel an den erlaubten Orten (Zuordnung der Kurzformen, PDF-Texte, Statistik-Export)
    { filename: '/repo/src/components/ui/atoms/shortTerms.ts', code: "const k = { short: 'short:tabellenkopf.rank' };", options: ['forbidden'] },
    { filename: '/repo/src/lib/pdf/translations.ts', code: "const head = (key) => translate(`short:tabellenkopf.${key}`);", options: ['forbidden'] },
    // Ein Wort „short“ ohne Namensraum ist kein Schlüssel
    { filename: COMPONENT, code: "const a = 'short: kurz'; const b = 'a-short:x';", options: ['forbidden'] },
    // Kennungen und CSS sind keine Anzeigetexte: Fehlercodes, Spiel-IDs mit Ziffern, CSS-Funktionen, Medienabfragen.
    { filename: COMPONENT, code: "const code = 'HF001'; const id = 'SF1'; const q = '(min-width: 600px)'; const g = 'minmax(min(100%, 20rem), 1fr)';", options: ['forbidden'] },
    { filename: COMPONENT, code: "const css = `grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr))`;", options: ['forbidden'] },
    // Platzhalter sind keine Kürzel: {{min}} ist eine Variable.
    { filename: COMPONENT, code: "const text = 'mindestens {{min}} benötigt';", options: ['forbidden'] },
    // „P3“ ist die interne matchId und nur in Sprachdateien verboten (tsLint: false).
    { filename: '/repo/src/constants/tournamentSchemas.ts', code: "const matchId = 'P3';", options: ['forbidden'] },
    // Vereinskürzel (SF = Sportfreunde), Fixtures und Rechtstexte sind ausgenommen.
    // Der Namensraum `short` über Optionen: erlaubt in ShortLabel.tsx
    { filename: '/repo/src/components/ui/atoms/ShortLabel.tsx', code: "const { t } = useTranslation('short');", options: ['forbidden'] },
    { filename: '/repo/src/core/models/teamNameAbbrev.ts', code: "const kuerzel = ['Sportfreunde', 'SF'];", options: ['forbidden'] },
    { filename: '/repo/src/lib/pdf/fontData/bold.ts', code: "export const data = 'AAEAAAAPAIAAAwBwAF AF xyz';", options: ['forbidden'] },
    { filename: '/repo/src/core/view/__fixtures__/expected.ts', code: "const k = 'F-HF';", options: ['forbidden'] },
    { filename: '/repo/src/screens/DatenschutzScreen.tsx', code: 'const el = <p>§ 25 Abs. 2 Nr. 2 TDDDG</p>;', options: ['forbidden'] },
  ],
  invalid: [
    // Namensraum-Option: der Namensraum `short` lässt sich auch ohne „short:“-Schlüssel einschleusen
    { filename: COMPONENT, code: "const { t } = useTranslation('short');", options: ['forbidden'], errors: [{ messageId: 'shortKeyElsewhere' }] },
    { filename: COMPONENT, code: "const t = i18n.getFixedT('de', 'short');", options: ['forbidden'], errors: [{ messageId: 'shortKeyElsewhere' }] },
    { filename: COMPONENT, code: "const s = t('tabellenkopf.points', { ns: 'short' });", options: ['forbidden'], errors: [{ messageId: 'shortKeyElsewhere' }] },
    { filename: COMPONENT, code: "const { t } = useTranslation(['sport', 'short']);", options: ['forbidden'], errors: [{ messageId: 'shortKeyElsewhere' }] },
    // Die fontData-Ausnahme gilt nur für src/lib/pdf/fontData/, nicht für jeden Pfad mit „fontData“
    { filename: '/repo/src/components/fontDataX.tsx', code: "const text = 'HF 1 gegen SR 2';", options: ['forbidden'], errors: [{ messageId: 'forbiddenAbbreviation' }, { messageId: 'forbiddenAbbreviation' }] },
    { filename: '/repo/src/components/fontDataDemo/Demo.tsx', code: 'const el = <p>HF 1 gegen SR 2</p>;', options: ['forbidden'], errors: [{ messageId: 'forbiddenAbbreviation' }, { messageId: 'forbiddenAbbreviation' }] },
    // Kurzformen-Schlüssel an beliebiger Stelle eingeschmuggelt (Mechanismus-Lücke): in Komponenten und als Verschachtelung
    { filename: COMPONENT, code: "const kopf = t('short:tabellenkopf.played');", options: ['forbidden'], errors: [{ messageId: 'shortKeyElsewhere' }] },
    { filename: COMPONENT, code: "const kopf = 'Spiel $t(short:tabellenkopf.played)';", options: ['forbidden'], errors: [{ messageId: 'shortKeyElsewhere' }] },
    { filename: COMPONENT, code: 'const kopf = <span>{`short:uhr.${x}`}</span>;', options: ['forbidden'], errors: [{ messageId: 'shortKeyElsewhere' }] },
    // Jede Zeile des Grundrisses @OB-075 als fester Text im Code
    { filename: COMPONENT, code: 'const el = <span>HF 1</span>;', options: ['forbidden'], errors: [{ messageId: 'forbiddenAbbreviation' }] },
    { filename: COMPONENT, code: "const label = `SR ${number}`;", options: ['forbidden'], errors: [{ messageId: 'forbiddenAbbreviation' }] },
    { filename: COMPONENT, code: "const label = 'Ref 2';", options: ['forbidden'], errors: [{ messageId: 'forbiddenAbbreviation' }] },
    { filename: COMPONENT, code: "const label = 'Gr. A';", options: ['forbidden'], errors: [{ messageId: 'forbiddenAbbreviation' }] },
    { filename: COMPONENT, code: "const kopf = 'Pl.';", options: ['forbidden'], errors: [{ messageId: 'forbiddenAbbreviation' }] },
    { filename: COMPONENT, code: "const kopf = 'Diff.';", options: ['forbidden'], errors: [{ messageId: 'forbiddenAbbreviation' }] },
    { filename: COMPONENT, code: "const kopf = 'Pts';", options: ['forbidden'], errors: [{ messageId: 'forbiddenAbbreviation' }] },
    { filename: COMPONENT, code: "const rest = '(4:3 i. E.)';", options: ['forbidden'], errors: [{ messageId: 'forbiddenAbbreviation' }] },
    { filename: COMPONENT, code: "const rest = '3:2 n. V.';", options: ['forbidden'], errors: [{ messageId: 'forbiddenAbbreviation' }] },
    { filename: COMPONENT, code: 'const el = <span>Team A vs Team B</span>;', options: ['forbidden'], errors: [{ messageId: 'forbiddenAbbreviation' }] },
    { filename: COMPONENT, code: "const dauer = `${minuten} Min.`;", options: ['forbidden'], errors: [{ messageId: 'forbiddenAbbreviation' }] },
    { filename: COMPONENT, code: "const text = 'Mit AF und VF';", options: ['forbidden'], errors: [{ messageId: 'forbiddenAbbreviation' }, { messageId: 'forbiddenAbbreviation' }] },
  ],
});

// Meldungstext: nennt den ausgeschriebenen Begriff und den Namensraum der Kurzformen.
{
  const { Linter } = require('eslint');
  const linter = new Linter();
  const messages = linter.verify(
    "const kopf = 'Pkt.';",
    [{ files: ['**/*.tsx'], languageOptions: { ecmaVersion: 2022, sourceType: 'module' }, plugins: { local: { rules: { 'no-hardcoded-sport-terms': rule } } }, rules: { 'local/no-hardcoded-sport-terms': ['error', 'forbidden'] } }],
    `${process.cwd()}/src/components/schedule/GroupTables.tsx`,
  );
  if (messages.length !== 1 || !messages[0].message.includes("t('sport:tabelle.points')") || !messages[0].message.includes('`short`')) {
    throw new Error(`Kürzel-Meldung nennt weder den ausgeschriebenen Begriff noch den Namensraum short: ${JSON.stringify(messages)}`);
  }
}

// --- mode: 'preferred' (registered as local-rules/no-hardcoded-sport-terms-preferred, severity 'warn') ---
ruleTester.run('no-hardcoded-sport-terms (preferred)', rule, {
  valid: [
    // Verbotene Synonyme werden im 'preferred'-Modus nicht gemeldet (das übernimmt der 'forbidden'-Modus).
    {
      filename: '/repo/src/components/match-cockpit/TiebreakerBanner.tsx',
      code: "const label = 'Elfmeterschießen';",
      options: ['preferred'],
    },
    // Locale-Dateien sind auch hier ausgenommen.
    {
      filename: '/repo/src/i18n/locales/de/sport.json.ts',
      code: "export const penaltyShootout = 'Strafstoßschießen';",
      options: ['preferred'],
    },
  ],
  invalid: [
    // 4. Die bevorzugte Form → Warnung (kein Fehler; die Severity 'warn' kommt
    // aus der eslint.config.js-Registrierung, hier wird nur der Modus/messageId geprüft).
    {
      filename: '/repo/src/components/match-cockpit/TiebreakerBanner.tsx',
      code: "const label = 'Strafstoßschießen';",
      options: ['preferred'],
      errors: [
        {
          messageId: 'preferredFormHardcoded',
        },
      ],
    },
    {
      filename: '/repo/src/screens/LiveViewScreen.tsx',
      code: 'const el = <span>Gruppenphase</span>;',
      options: ['preferred'],
      errors: [
        {
          messageId: 'preferredFormHardcoded',
        },
      ],
    },
  ],
});

// --- Meldungstext prüfen: die Meldung muss den Ersatz-Schlüssel nennen, nicht
// nur den Verstoß (Anforderung aus dem Task-8-Brief). RuleTester's declarative
// `errors` vergleicht Meldungen nur exakt (inkl. der langen `reason` aus dem
// Glossar) — deshalb hier ein direkter Linter().verify()-Aufruf mit Flat-Config,
// der die tatsächliche Meldung zurückgibt. `files` muss die Endung matchen und
// der Dateiname muss absolut sein (context.filename ist es im echten Betrieb
// immer), sonst löst ESLints Flat-Config-Auflösung keine Config auf.
{
  const { Linter } = require('eslint');
  const linter = new Linter();
  const messages = linter.verify(
    "const label = 'Elfmeterschießen';",
    [
      {
        files: ['**/*.tsx'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
        plugins: { local: { rules: { 'no-hardcoded-sport-terms': rule } } },
        rules: { 'local/no-hardcoded-sport-terms': ['error', 'forbidden'] },
      },
    ],
    `${process.cwd()}/src/components/match-cockpit/TiebreakerBanner.tsx`,
  );

  if (messages.length !== 1) {
    throw new Error(`Expected exactly 1 message, got ${messages.length}: ${JSON.stringify(messages)}`);
  }
  const [message] = messages;
  if (!message.message.includes("t('sport:events.penaltyShootout')")) {
    throw new Error(`Message does not name the replacement key: ${message.message}`);
  }
  if (!message.message.includes("'Elfmeterschießen' ist verboten")) {
    throw new Error(`Message does not name the violation: ${message.message}`);
  }
}

// RuleTester throws on failure — if we get here, all cases passed.
console.log('no-hardcoded-sport-terms: all RuleTester cases passed.'); // eslint-disable-line no-console
