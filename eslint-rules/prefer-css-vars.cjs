/**
 * ESLint Rule: prefer-css-vars
 *
 * Warns when importing design tokens directly instead of using cssVars.
 * This ensures theme-switching works correctly via CSS Variables.
 *
 * ❌ Bad:
 * import { colors, spacing } from '../design-tokens';
 * style={{ color: colors.primary }}
 *
 * ✅ Good:
 * import { cssVars } from '../design-tokens';
 * style={{ color: cssVars.colors.primary }}
 *
 * Exceptions (allowed direct imports):
 * - colors.confettiColors (array type - not CSS var compatible)
 * - fontWeights, fontSizes for dynamic property access
 * - Internal token files (typography.ts, themeManager.ts, pdfExporter.ts)
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer cssVars over direct design token imports for theme support',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      preferCssVars:
        "Import '{{ name }}' from design-tokens should use 'cssVars.{{ name }}' for theme support. " +
        "Direct imports bypass CSS Variables and won't respond to theme changes.",
      preferCssVarsUsage:
        "Direct usage of '{{ name }}' bypasses CSS Variables. Use 'cssVars.{{ name }}' instead.",
    },
    schema: [],
  },

  create(context) {
    // Files that are allowed to use direct imports (internal token files)
    const allowedFiles = [
      'typography.ts',
      'themeManager.ts',
      'pdfExporter.ts',
      'theme.ts',
      'cssVars.ts',
      'colors.ts',
      'semantic.ts',
      'semantic-light.ts',
      'spacing.ts',
      'gradients.ts',
      'shadows.ts',
      'index.ts',
    ];

    // Token names that should use cssVars
    const tokenNames = new Set([
      'colors',
      'spacing',
      'fontSizes',
      'fontWeights',
      'fontFamilies',
      'radii',
      'shadows',
      'gradients',
      'breakpoints',
      'lineHeights',
    ]);

    // Exceptions - these are allowed as direct imports
    const exceptions = new Set([
      // confettiColors is an array, can't be CSS var
      'confettiColors',
      // These are needed for dynamic property access in some components
      'FontSizeKey',
      'fontSizesMd3',
    ]);

    const filename = context.getFilename();
    const basename = filename.split('/').pop() || '';

    // Skip internal token files
    if (allowedFiles.some((f) => basename.endsWith(f))) {
      return {};
    }

    // Skip test files
    if (filename.includes('.test.') || filename.includes('__tests__')) {
      return {};
    }

    // Track imported token names in this file
    const importedTokens = new Map();

    return {
      ImportDeclaration(node) {
        // Only check imports from design-tokens
        if (!node.source.value.includes('design-tokens')) {
          return;
        }

        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') continue;

          const importedName = specifier.imported.name;

          // Skip exceptions
          if (exceptions.has(importedName)) continue;

          // Skip cssVars itself - that's what we want!
          if (importedName === 'cssVars') continue;

          // Check if this is a token that should use cssVars
          if (tokenNames.has(importedName)) {
            // Track it for usage checking
            importedTokens.set(specifier.local.name, importedName);

            // Report the import
            context.report({
              node: specifier,
              messageId: 'preferCssVars',
              data: { name: importedName },
            });
          }
        }
      },

      // Also check for direct usage patterns like colors.primary
      MemberExpression(node) {
        if (node.object.type !== 'Identifier') return;

        const objectName = node.object.name;

        // Check if this identifier was imported from design-tokens
        if (importedTokens.has(objectName)) {
          const tokenName = importedTokens.get(objectName);

          // Skip if it's accessing an exception property
          if (
            node.property.type === 'Identifier' &&
            exceptions.has(node.property.name)
          ) {
            return;
          }

          context.report({
            node,
            messageId: 'preferCssVarsUsage',
            data: { name: tokenName },
          });
        }
      },
    };
  },
};
