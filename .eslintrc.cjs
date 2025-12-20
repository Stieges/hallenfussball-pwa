module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', '*.js', 'node_modules', 'mcp-adesso-analyzer'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['react-refresh'],
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
    '@typescript-eslint/prefer-nullish-coalescing': 'warn', // Many existing uses of ||
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
};
