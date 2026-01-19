/**
 * Design Token Synchronization Tests
 *
 * Verifies that all design token files are in sync:
 * - All semantic*.ts files have the same properties
 * - cssVars.ts has all color properties from semantic files
 * - global.css has all CSS variables for each theme block
 *
 * These tests dynamically discover theme files and blocks,
 * so adding new themes automatically includes them in tests.
 */

import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Properties that are intentionally excluded from sync checks.
 * These are non-color types (arrays, gradient strings) that can't be CSS variables.
 */
const EXCLUDED_PROPERTIES = new Set([
  'confettiColors', // Array of strings - not CSS variable compatible
  'backgroundGradientDark', // CSS gradient string
  'gradientNextMatch', // CSS gradient string
]);

/**
 * Overlay themes that only override specific variables from the base theme.
 * These themes inherit from dark theme and only need to define overrides.
 * The sync tests will skip these themes for full variable checks.
 */
const OVERLAY_THEMES = new Set([
  'high-contrast', // Overlay on dark theme with enhanced contrast
]);

// =============================================================================
// HELPERS
// =============================================================================

function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function getThemeNameFromSelector(selector: string): string {
  if (selector === ':root') {return 'dark';}
  const match = selector.match(/\[data-theme="([^"]+)"\]/);
  return match?.[1] ?? '';
}

function isOverlayTheme(selector: string): boolean {
  return OVERLAY_THEMES.has(getThemeNameFromSelector(selector));
}

function getColorsDir(): string {
  return path.resolve(__dirname, '../colors');
}

function getGlobalCssPath(): string {
  return path.resolve(__dirname, '../../styles/global.css');
}

function getCssVarsPath(): string {
  return path.resolve(__dirname, '../cssVars.ts');
}

// =============================================================================
// DYNAMIC DISCOVERY
// =============================================================================

interface SemanticFile {
  name: string;
  path: string;
}

function discoverSemanticFiles(): SemanticFile[] {
  const colorsDir = getColorsDir();
  const entries = fs.readdirSync(colorsDir);

  return entries
    .filter((e) => e.match(/^semantic(-[a-z-]+)?\.ts$/))
    .map((e) => {
      const match = e.match(/^semantic(-([a-z-]+))?\.ts$/);
      return {
        name: match?.[2] ?? 'dark',
        path: path.join(colorsDir, e),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function discoverCssThemeSelectors(): string[] {
  const content = fs.readFileSync(getGlobalCssPath(), 'utf-8');
  const selectors: string[] = [':root'];

  const themeRegex = /\[data-theme="([^"]+)"\]/g;
  let match;

  while ((match = themeRegex.exec(content)) !== null) {
    const selector = `[data-theme="${match[1]}"]`;
    if (!selectors.includes(selector)) {
      selectors.push(selector);
    }
  }

  return selectors;
}

function extractPropertiesFromTs(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const regex = /^[ ]{2}(\w+)\s*:/gm;
  const props: string[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    const prop = match[1];
    if (
      prop &&
      !prop.startsWith('_') &&
      !['palette', 'colors'].includes(prop) &&
      !EXCLUDED_PROPERTIES.has(prop)
    ) {
      props.push(prop);
    }
  }

  return [...new Set(props)].sort();
}

function extractCssVarsColors(): string[] {
  const content = fs.readFileSync(getCssVarsPath(), 'utf-8');
  const regex = /^\s+(\w+):\s*'var\(--color-/gm;
  const props: string[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    props.push(match[1]);
  }

  return [...new Set(props)].sort();
}

function extractCssVariables(selector: string): string[] {
  const content = fs.readFileSync(getGlobalCssPath(), 'utf-8');

  // Find the block start
  const startIndex = content.indexOf(selector);
  if (startIndex === -1) {
    return [];
  }

  let braceCount = 0;
  let blockStart = -1;
  let blockEnd = -1;

  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '{') {
      if (braceCount === 0) {
        blockStart = i + 1;
      }
      braceCount++;
    } else if (content[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        blockEnd = i;
        break;
      }
    }
  }

  if (blockStart === -1 || blockEnd === -1) {
    return [];
  }

  const block = content.substring(blockStart, blockEnd);
  const varRegex = /--color-([a-z0-9-]+)\s*:/g;
  const variables: string[] = [];
  let varMatch;

  while ((varMatch = varRegex.exec(block)) !== null) {
    variables.push(varMatch[1]);
  }

  return [...new Set(variables)].sort();
}

// =============================================================================
// TESTS
// =============================================================================

describe('Design Token Synchronization', () => {
  const semanticFiles = discoverSemanticFiles();
  const cssVarsColors = extractCssVarsColors();
  const cssThemeSelectors = discoverCssThemeSelectors();

  // Source of truth = semantic.ts (dark)
  const sourceOfTruth = semanticFiles.find((f) => f.name === 'dark') ?? semanticFiles[0];
  const sourceProperties = sourceOfTruth ? extractPropertiesFromTs(sourceOfTruth.path) : [];

  describe('Discovery', () => {
    test('found at least one semantic file', () => {
      expect(semanticFiles.length).toBeGreaterThan(0);
    });

    test('found cssVars colors', () => {
      expect(cssVarsColors.length).toBeGreaterThan(0);
    });

    test('found at least :root CSS block', () => {
      expect(cssThemeSelectors).toContain(':root');
    });

    test('found light theme CSS block', () => {
      expect(cssThemeSelectors).toContain('[data-theme="light"]');
    });
  });

  describe('Semantic files sync', () => {
    semanticFiles.forEach((file) => {
      if (file.name === sourceOfTruth?.name) {
        return;
      }

      test(`${file.name} has all properties from ${sourceOfTruth?.name}`, () => {
        const targetProps = extractPropertiesFromTs(file.path);
        const missing = sourceProperties.filter((p) => !targetProps.includes(p));

        expect(missing, `semantic-${file.name}.ts is missing: ${missing.join(', ')}`).toEqual([]);
      });

      test(`${file.name} has no extra properties compared to ${sourceOfTruth?.name}`, () => {
        const targetProps = extractPropertiesFromTs(file.path);
        const extra = targetProps.filter((p) => !sourceProperties.includes(p));

        expect(extra, `semantic-${file.name}.ts has extra: ${extra.join(', ')}`).toEqual([]);
      });
    });
  });

  describe('cssVars.ts sync', () => {
    test('cssVars.colors has all properties from source of truth', () => {
      const missing = sourceProperties.filter((p) => !cssVarsColors.includes(p));

      expect(missing, `cssVars.ts colors is missing: ${missing.join(', ')}`).toEqual([]);
    });

    test('cssVars.colors has no extra properties', () => {
      const extra = cssVarsColors.filter((p) => !sourceProperties.includes(p));

      expect(extra, `cssVars.ts has extra properties: ${extra.join(', ')}`).toEqual([]);
    });
  });

  describe('global.css sync', () => {
    const cssVarsAsKebab = cssVarsColors.map((p) => toKebabCase(p));

    // Filter out overlay themes - they only define overrides
    const fullThemeSelectors = cssThemeSelectors.filter((s) => !isOverlayTheme(s));

    fullThemeSelectors.forEach((selector) => {
      test(`${selector} has all CSS variables`, () => {
        const cssVars = extractCssVariables(selector);
        const missing = cssVarsAsKebab.filter((v) => !cssVars.includes(v));

        expect(
          missing,
          `global.css ${selector} is missing: ${missing.map((v) => `--color-${v}`).join(', ')}`
        ).toEqual([]);
      });

      test(`${selector} has no extra CSS variables`, () => {
        const cssVars = extractCssVariables(selector);
        const extra = cssVars.filter((v) => !cssVarsAsKebab.includes(v));

        expect(
          extra,
          `global.css ${selector} has extra: ${extra.map((v) => `--color-${v}`).join(', ')}`
        ).toEqual([]);
      });
    });

    // Test overlay themes only check their variables are valid (subset of full theme)
    const overlaySelectors = cssThemeSelectors.filter((s) => isOverlayTheme(s));

    overlaySelectors.forEach((selector) => {
      test(`${selector} (overlay) has only valid CSS variables`, () => {
        const cssVars = extractCssVariables(selector);
        const invalid = cssVars.filter((v) => !cssVarsAsKebab.includes(v));

        expect(
          invalid,
          `global.css ${selector} has invalid variables: ${invalid.map((v) => `--color-${v}`).join(', ')}`
        ).toEqual([]);
      });
    });
  });

  describe('Naming conventions', () => {
    test('cssVars uses correct CSS variable names', () => {
      const content = fs.readFileSync(getCssVarsPath(), 'utf-8');
      const violations: string[] = [];

      cssVarsColors.forEach((prop) => {
        const expectedVar = `var(--color-${toKebabCase(prop)})`;
        const regex = new RegExp(`${prop}:\\s*'([^']+)'`);
        const match = content.match(regex);

        if (match && match[1] !== expectedVar) {
          violations.push(`${prop}: expected '${expectedVar}', got '${match[1]}'`);
        }
      });

      expect(violations).toEqual([]);
    });
  });

  describe('Property count consistency', () => {
    test('all semantic files have the same property count', () => {
      const counts = semanticFiles.map((f) => ({
        name: f.name,
        count: extractPropertiesFromTs(f.path).length,
      }));

      const firstCount = counts[0]?.count;
      const mismatches = counts.filter((c) => c.count !== firstCount);

      expect(mismatches, `Property count mismatches: ${JSON.stringify(mismatches)}`).toEqual([]);
    });

    test('cssVars has same count as semantic files', () => {
      expect(cssVarsColors.length).toBe(sourceProperties.length);
    });

    test('CSS theme blocks have same variable count (excluding overlay themes)', () => {
      // Filter out overlay themes - they only define overrides
      const fullThemeSelectors = cssThemeSelectors.filter((s) => !isOverlayTheme(s));

      const counts = fullThemeSelectors.map((s) => ({
        selector: s,
        count: extractCssVariables(s).length,
      }));

      const firstCount = counts[0]?.count;
      const mismatches = counts.filter((c) => c.count !== firstCount);

      expect(mismatches, `Variable count mismatches: ${JSON.stringify(mismatches)}`).toEqual([]);
    });
  });
});
