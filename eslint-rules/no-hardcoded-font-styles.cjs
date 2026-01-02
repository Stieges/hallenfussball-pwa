/**
 * ESLint Rule: no-hardcoded-font-styles
 *
 * Prevents hardcoded font sizes (px) and font families in inline styles.
 * Ensures consistent typography via design tokens.
 *
 * ❌ Bad:
 * style={{ fontSize: '14px' }}
 * style={{ fontFamily: 'Arial' }}
 *
 * ✅ Good:
 * style={{ fontSize: cssVars.fontSizes.md }}
 * style={{ fontFamily: cssVars.fontFamilies.base }}
 *
 * Exceptions (allowed px values):
 * - scoreSizes, timerSize (fixed display sizes)
 * - Files: pdfExporter.ts, LiveCockpit*, *Monitor* (special display contexts)
 */

'use strict';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hardcoded font sizes and font families in styles',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noHardcodedFontSize:
        "Avoid hardcoded fontSize '{{ value }}'. Use cssVars.fontSizes.* for scalable typography. " +
        "Exception: scoreSizes/timerSize for fixed display elements.",
      noHardcodedFontFamily:
        "Avoid hardcoded fontFamily '{{ value }}'. Use cssVars.fontFamilies.* to ensure Inter font.",
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Files/paths that are allowed to use hardcoded values
    const allowedPatterns = [
      'pdfExporter',       // PDF generation needs absolute sizes
      'live-cockpit',      // Score/timer displays use fixed sizes
      'match-cockpit',     // Score/timer displays use fixed sizes
      'Monitor',           // Monitor displays use fixed sizes
      'typography.ts',     // Design token definitions
      'cssVars.ts',        // CSS var wrapper
      'FontSizeSelector',  // Preview needs actual px for demonstration
      'ScoreDisplay',      // Score displays use fixed sizes
      'TimerDisplay',      // Timer displays use fixed sizes
      'ImportSteps',       // Import wizard icons (decorative)
      'ModeSelection',     // Mode selection icons (decorative)
      'AuthGuard',         // Auth loading/icons
      'NextMatchCard',     // Match preview with scores
      'StandingsDisplay',  // Standings table display
      'ConflictDialog',    // Conflict display icons
      'GroupFieldMatrix',  // Matrix cell display
    ];

    // Skip allowed files/paths
    if (allowedPatterns.some((f) => filename.includes(f))) {
      return {};
    }

    // Skip test files
    if (filename.includes('.test.') || filename.includes('__tests__')) {
      return {};
    }

    // Pattern for px values like '14px', '1.5rem' etc.
    const pxPattern = /^\d+(\.\d+)?px$/;

    // Common hardcoded font families to catch
    const hardcodedFonts = [
      'arial',
      'helvetica',
      'times',
      'georgia',
      'verdana',
      'courier',
      'sans-serif',
      'serif',
      'monospace',
    ];

    /**
     * Check if a value is a hardcoded px font size
     */
    function isHardcodedPxSize(value) {
      if (typeof value !== 'string') return false;
      return pxPattern.test(value.trim());
    }

    /**
     * Check if a value is a hardcoded font family
     */
    function isHardcodedFontFamily(value) {
      if (typeof value !== 'string') return false;
      const lower = value.toLowerCase().trim();
      // Check if it contains any hardcoded font name
      return hardcodedFonts.some((font) => lower.includes(font));
    }

    /**
     * Check if a property assignment is inside a known exception context
     * e.g., previewSizes, scoreSizes, timerSize
     */
    function isInExceptionContext(node) {
      let parent = node.parent;
      while (parent) {
        // Check for variable declarations like "const previewSizes = ..."
        if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
          const name = parent.id.name;
          if (
            name.includes('preview') ||
            name.includes('Preview') ||
            name.includes('score') ||
            name.includes('Score') ||
            name.includes('timer') ||
            name.includes('Timer') ||
            name.includes('display') ||
            name.includes('Display') ||
            name.includes('icon') ||
            name.includes('Icon') ||
            name.includes('emoji') ||
            name.includes('Emoji') ||
            name.includes('badge') ||
            name.includes('Badge') ||
            name.includes('size') ||
            name.includes('Size')
          ) {
            return true;
          }
        }
        // Check for object property like "scoreSizes: { ... }"
        if (parent.type === 'Property' && parent.key.type === 'Identifier') {
          const name = parent.key.name;
          if (
            name.includes('score') ||
            name.includes('Score') ||
            name.includes('timer') ||
            name.includes('Timer') ||
            name.includes('preview') ||
            name.includes('Preview')
          ) {
            return true;
          }
        }
        parent = parent.parent;
      }
      return false;
    }

    return {
      // Check object properties in style objects
      Property(node) {
        // Only check properties named fontSize or fontFamily
        if (node.key.type !== 'Identifier') return;
        const propName = node.key.name;

        if (propName === 'fontSize') {
          // Check for string literal values
          if (node.value.type === 'Literal' && typeof node.value.value === 'string') {
            const value = node.value.value;

            if (isHardcodedPxSize(value)) {
              // Skip if in exception context
              if (isInExceptionContext(node)) return;

              context.report({
                node: node.value,
                messageId: 'noHardcodedFontSize',
                data: { value },
              });
            }
          }
        }

        if (propName === 'fontFamily') {
          // Check for string literal values
          if (node.value.type === 'Literal' && typeof node.value.value === 'string') {
            const value = node.value.value;

            if (isHardcodedFontFamily(value)) {
              context.report({
                node: node.value,
                messageId: 'noHardcodedFontFamily',
                data: { value },
              });
            }
          }
        }
      },
    };
  },
};
