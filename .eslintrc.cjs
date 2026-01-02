/**
 * ESLint Configuration
 *
 * Custom local rules are defined in eslint-local-rules.cjs
 * and used via the 'local-rules' plugin.
 */

module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', '*.js', '*.cjs', 'node_modules', 'mcp-adesso-analyzer', 'eslint-rules'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['react-refresh', 'local-rules'],
  rules: {
    // React Refresh
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],

    // TypeScript Strict Rules
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    '@typescript-eslint/no-explicit-any': 'warn', // Gradually remove any types
    '@typescript-eslint/explicit-function-return-type': 'off', // Too noisy for React components
    '@typescript-eslint/no-non-null-assertion': 'warn', // Existing codebase uses this
    // prefer-nullish-coalescing: Allow || for primitives where empty string/0 should also trigger fallback
    '@typescript-eslint/prefer-nullish-coalescing': ['warn', {
      ignorePrimitives: {
        string: true,  // Allow: name || 'Unknown' (empty string should fallback)
        number: true,  // Allow: count || 0 (though rare, can be intentional)
        boolean: true, // Allow: flag || false
      },
      ignoreConditionalTests: true, // Default in v8+
      ignoreMixedLogicalExpressions: true, // Allow mixed && and ||
    }],
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'off', // Too strict for React patterns
    '@typescript-eslint/no-floating-promises': 'warn', // Needs gradual fixes
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'warn', // Needs gradual fixes

    // General Best Practices
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'eqeqeq': ['error', 'always'],
    'curly': ['warn', 'all'], // Gradually enforce
    'prefer-const': 'error',
    'no-var': 'error',

    // Design Tokens / Theme Support
    // Enforces cssVars usage instead of direct token imports
    // See: docs/concepts/THEME-MIGRATION-KOMPLETT.md
    'local-rules/prefer-css-vars': 'warn',

    // Typography Enforcement
    // Prevents hardcoded px font sizes and font families
    // Ensures Inter font and rem-based sizing via design tokens
    'local-rules/no-hardcoded-font-styles': 'warn',

    // Temporarily relaxed for existing codebase
    '@typescript-eslint/no-unnecessary-condition': 'warn',
    '@typescript-eslint/no-confusing-void-expression': 'off',
    '@typescript-eslint/consistent-indexed-object-style': 'off',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/array-type': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-argument': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/restrict-template-expressions': 'warn',
    '@typescript-eslint/no-base-to-string': 'warn',
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/consistent-generic-constructors': 'warn',
    '@typescript-eslint/no-dynamic-delete': 'warn',
    '@typescript-eslint/dot-notation': 'off',
    '@typescript-eslint/no-useless-constructor': 'warn',
    '@typescript-eslint/consistent-type-definitions': 'off',
  },
  overrides: [
    {
      // Test files: Relax strict rules that reduce test readability
      files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**/*.ts', '**/__tests__/**/*.tsx'],
      rules: {
        // Allow non-null assertions in tests - they make test expectations clearer
        '@typescript-eslint/no-non-null-assertion': 'off',
        // Allow explicit any in test mocks and fixtures
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        // Allow unnecessary conditions in test assertions
        '@typescript-eslint/no-unnecessary-condition': 'off',
      },
    },
  ],
};
