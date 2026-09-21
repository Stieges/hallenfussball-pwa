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
