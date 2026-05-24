import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

// Local rules als Plugin-Objekt
import preferCssVars from './eslint-rules/prefer-css-vars.cjs';
import noHardcodedFontStyles from './eslint-rules/no-hardcoded-font-styles.cjs';
import noTokenInLogs from './eslint-rules/no-token-in-logs.cjs';

const localRulesPlugin = {
  meta: { name: 'local-rules' },
  rules: {
    'prefer-css-vars': preferCssVars,
    'no-hardcoded-font-styles': noHardcodedFontStyles,
    'no-token-in-logs': noTokenInLogs,
  },
};

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/mcp-ai-hub-analyzer/**',
      '**/eslint-rules/**',
      '**/scripts/**',
      '**/supabase/functions/**',
      '**/.gemini/**',
      '**/.serena/**',
      '**/.claude/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
      'eslint.config.js',
    ],
  },

  // Base config for all TS/TSX files
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Main configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'local-rules': localRulesPlugin,
    },
    rules: {
      // React Hooks
      ...reactHooks.configs.recommended.rules,
      // New rules in eslint-plugin-react-hooks v5.2.0 - temporarily disabled for migration
      // These rules are stricter and require incremental fixes across the codebase
      'react-hooks/set-state-in-effect': 'off',  // 41 violations - fix incrementally
      'react-hooks/refs': 'off',                  // 41 violations - fix incrementally
      'react-hooks/preserve-manual-memoization': 'off', // 3 violations
      // ✅ Fixed in Phase 14:
      'react-hooks/purity': 'error',
      'react-hooks/immutability': 'error',
      'react-hooks/static-components': 'error',

      // React Refresh
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // TypeScript Strict Rules
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_|^e$|^err$|^error$',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'off',

      // General Best Practices
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'eqeqeq': ['error', 'always'],
      'curly': ['warn', 'all'],
      'prefer-const': 'error',
      'no-var': 'error',

      // Design Tokens / Theme Support
      'local-rules/prefer-css-vars': 'warn',
      'local-rules/no-hardcoded-font-styles': 'warn',

      // Auth-Token-Guardrail (HP-5d): blockt das Loggen von credential-artigen
      // Identifiern (token, jwt, password, secret, credential) via console.*.
      // Siehe eslint-rules/no-token-in-logs.cjs für Begründung und Beispiele.
      'local-rules/no-token-in-logs': 'error',

      // New rules in typescript-eslint v8 - temporarily disabled for migration
      '@typescript-eslint/prefer-regexp-exec': 'off',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
      '@typescript-eslint/no-deprecated': 'warn', // Re-enabled: warns about deprecated APIs
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/only-throw-error': 'off',
      '@typescript-eslint/no-unnecessary-template-expression': 'off',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      '@typescript-eslint/related-getter-setter-pairs': 'off',
      '@typescript-eslint/return-await': 'off',
      '@typescript-eslint/no-unnecessary-type-conversion': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      'no-misleading-character-class': 'off',
      '@typescript-eslint/no-misused-spread': 'off',

      // Temporarily relaxed for existing codebase
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/consistent-indexed-object-style': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/restrict-template-expressions': ['warn', {
        allowNumber: true,
        allowBoolean: true,
        allowNullish: true,
      }],
      '@typescript-eslint/no-base-to-string': 'off', // Re-enable after migration complete
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/consistent-generic-constructors': 'warn',
      '@typescript-eslint/no-dynamic-delete': 'warn',
      '@typescript-eslint/dot-notation': 'off',
      '@typescript-eslint/no-useless-constructor': 'warn',
      '@typescript-eslint/consistent-type-definitions': 'off',

      // Supabase-spezifische Guardrails: blockt `as any`-Bypässe der typisierten Client-API
      // (eingeführt nach PR #137 — Sanitizer-Bypass via untyped .from()).
      // HP-5d ergänzt um localStorage/sessionStorage.setItem mit credential-artigen Keys.
      'no-restricted-syntax': ['error',
        {
          selector: "TSAsExpression[expression.name='supabase'][typeAnnotation.type='TSAnyKeyword']",
          message: 'Avoid `supabase as any`. Use the typed client (Database generic) or extend the mapper layer.',
        },
        {
          selector: "MemberExpression[object.type='TSAsExpression'][object.typeAnnotation.type='TSAnyKeyword'][property.name='from']",
          message: 'Avoid `(x as any).from(...)`. Use the typed Supabase client to keep row types in sync.',
        },
        {
          selector: "CallExpression[callee.object.name=/^(localStorage|sessionStorage)$/][callee.property.name='setItem'][arguments.0.type='Literal'][arguments.0.value=/token|jwt|password|secret|credential/i]",
          message: 'Do not persist credential-like keys (token/jwt/password/secret/credential) to localStorage/sessionStorage. Use a secure transport (HttpOnly cookies / Supabase auth-helper) instead.',
        },
      ],

      // Layering-Guardrail (Clean-Architecture-Boundaries):
      // Spezifischere Overrides unten setzen Layer-Boundaries pro Folder
      // (core/, hooks/, components/). Cross-Feature-Boundary (features/<X> →
      // features/<Y>) ist mit statischen Patterns nicht ohne false-positives
      // ausdrückbar (screens/ orchestrieren features, das ist OK) — bleibt
      // manueller Review-Punkt. Details: .claude/conventions/LAYERING.md
    },
  },

  // Layering-Override: core/ ist framework-free — KEINE features/hooks/components/react Imports
  {
    files: ['src/core/**/*.ts', 'src/core/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['**/features/**', '@/features/**'],   message: 'core/ darf nicht aus features/ importieren (core ist pure business logic).' },
          { group: ['**/hooks/**', '@/hooks/**'],         message: 'core/ darf nicht aus hooks/ importieren (core ist React-frei).' },
          { group: ['**/components/**', '@/components/**'], message: 'core/ darf nicht aus components/ importieren.' },
          { group: ['react', 'react-dom', 'react/*'],     message: 'core/ ist framework-free, kein React.' },
        ],
      }],
    },
  },

  // ANMERKUNG: Boundaries components/→features/ und hooks/→features/ sind
  // aktuell NICHT enforced. Der semantische Status von src/features/ ist
  // ungeklärt (Module/Reuse-Units vs. echte Bounded Contexts). Bis die
  // Architektur-Entscheidung gefallen ist, bleiben diese Boundaries
  // Review-Pflicht statt automatisierter Lint. Siehe LAYERING.md.

  // Test files: Relax strict rules
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**/*.ts', '**/__tests__/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      // Supabase-Guardrail in Tests: nicht hart blocken (Tests dürfen pragmatischer
      // sein z.B. zum Mocken untypisierter Antworten), aber als Warnung sichtbar bleiben.
      'no-restricted-syntax': 'warn',
    },
  },

  // E2E test files: Different environment, no React hooks
  {
    files: ['tests/e2e/**/*.ts', 'tests/e2e/**/*.tsx'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      'no-console': 'off',
    },
  },
);
