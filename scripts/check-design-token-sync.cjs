#!/usr/bin/env node

/**
 * Design Token Sync Check
 *
 * Prüft Synchronisation aller Design Token Dateien:
 * - Alle semantic*.ts Dateien (dynamisch erkannt)
 * - cssVars.ts (CSS Variable Wrapper)
 * - global.css (alle [data-theme="X"] Blöcke, dynamisch erkannt)
 *
 * Usage:
 *   npm run tokens:check
 *
 * Neue Themes hinzufügen:
 *   1. Erstelle semantic-{name}.ts mit gleichen Properties
 *   2. Füge [data-theme="{name}"] Block zu global.css hinzu
 *   3. Script erkennt beides automatisch!
 */

'use strict';

const fs = require('fs');
const path = require('path');

// =============================================================================
// CONFIGURATION
// =============================================================================

const PATHS = {
  colorsDir: path.join(__dirname, '..', 'src', 'design-tokens', 'colors'),
  cssVars: path.join(__dirname, '..', 'src', 'design-tokens', 'cssVars.ts'),
  globalCss: path.join(__dirname, '..', 'src', 'styles', 'global.css'),
};

// =============================================================================
// HELPERS
// =============================================================================

function toKebabCase(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

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
 * The sync check will skip these themes.
 */
const OVERLAY_THEMES = new Set([
  'high-contrast', // Overlay on dark theme with enhanced contrast
]);

// =============================================================================
// DYNAMIC DISCOVERY
// =============================================================================

/**
 * Findet alle semantic*.ts Dateien und extrahiert deren Properties
 * @returns {Array<{name: string, path: string, properties: string[]}>}
 */
function discoverSemanticFiles() {
  const files = [];
  const entries = fs.readdirSync(PATHS.colorsDir);

  for (const entry of entries) {
    // Match: semantic.ts, semantic-light.ts, semantic-corporate.ts, etc.
    const match = entry.match(/^semantic(-([a-z-]+))?\.ts$/);
    if (!match) continue;

    const themeName = match[2] || 'dark'; // semantic.ts = dark (default)
    const filePath = path.join(PATHS.colorsDir, entry);
    const properties = extractTsProperties(filePath);

    files.push({
      name: themeName,
      path: filePath,
      properties,
    });
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Findet alle [data-theme="X"] Blöcke in global.css
 * @returns {Array<{name: string, selector: string, variables: string[]}>}
 */
function discoverCssThemeBlocks() {
  const content = fs.readFileSync(PATHS.globalCss, 'utf-8');
  const blocks = [];

  // Finde :root Block (Default Theme)
  const rootVars = extractCssVariablesFromBlock(content, ':root');
  if (rootVars.length > 0) {
    blocks.push({
      name: 'dark',
      selector: ':root',
      variables: rootVars,
    });
  }

  // Finde alle [data-theme="X"] Blöcke
  const themeRegex = /\[data-theme="([^"]+)"\]/g;
  let match;
  const foundThemes = new Set();

  while ((match = themeRegex.exec(content)) !== null) {
    const themeName = match[1];
    if (foundThemes.has(themeName)) continue;
    foundThemes.add(themeName);

    const selector = `[data-theme="${themeName}"]`;
    const variables = extractCssVariablesFromBlock(content, selector);

    blocks.push({
      name: themeName,
      selector,
      variables,
    });
  }

  return blocks.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Extrahiert Properties aus einer TypeScript Datei
 * @param {string} filePath
 * @returns {string[]}
 */
function extractTsProperties(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Match property definitions like "  propertyName: " at 2-space indent
  const regex = /^  (\w+)\s*:/gm;
  const properties = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    const prop = match[1];
    // Exclude internal properties, palette references, and non-color types
    if (
      prop &&
      !prop.startsWith('_') &&
      prop !== 'palette' &&
      prop !== 'colors' &&
      !EXCLUDED_PROPERTIES.has(prop)
    ) {
      properties.push(prop);
    }
  }

  return [...new Set(properties)].sort();
}

/**
 * Extrahiert color Properties aus cssVars.ts
 * @returns {string[]}
 */
function extractCssVarsProperties() {
  const content = fs.readFileSync(PATHS.cssVars, 'utf-8');
  const regex = /^\s+(\w+):\s*'var\(--color-/gm;
  const properties = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    properties.push(match[1]);
  }

  return [...new Set(properties)].sort();
}

/**
 * Extrahiert CSS Variables aus einem Block
 * @param {string} cssContent
 * @param {string} selector
 * @returns {string[]}
 */
function extractCssVariablesFromBlock(cssContent, selector) {
  // Find the block - handle multi-line with a more robust approach
  // Match from selector to the closing brace, handling nested braces
  const startIndex = cssContent.indexOf(selector);
  if (startIndex === -1) return [];

  let braceCount = 0;
  let blockStart = -1;
  let blockEnd = -1;

  for (let i = startIndex; i < cssContent.length; i++) {
    if (cssContent[i] === '{') {
      if (braceCount === 0) blockStart = i + 1;
      braceCount++;
    } else if (cssContent[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        blockEnd = i;
        break;
      }
    }
  }

  if (blockStart === -1 || blockEnd === -1) return [];

  const block = cssContent.substring(blockStart, blockEnd);

  // Extract --color-* variables only
  const varRegex = /--color-([a-z0-9-]+)\s*:/g;
  const variables = [];
  let varMatch;

  while ((varMatch = varRegex.exec(block)) !== null) {
    variables.push(varMatch[1]);
  }

  return [...new Set(variables)].sort();
}

// =============================================================================
// SYNC CHECKS
// =============================================================================

/**
 * Vergleicht zwei Property-Listen
 * @param {string} sourceName
 * @param {string[]} sourceProps
 * @param {string} targetName
 * @param {string[]} targetProps
 * @returns {{check: string, pass: boolean, missing: string[], extra: string[]}}
 */
function checkSync(sourceName, sourceProps, targetName, targetProps) {
  const missing = sourceProps.filter((p) => !targetProps.includes(p));
  const extra = targetProps.filter((p) => !sourceProps.includes(p));

  return {
    check: `${sourceName} → ${targetName}`,
    pass: missing.length === 0,
    missing,
    extra,
  };
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  console.log('');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('║           DESIGN TOKEN SYNC CHECK                            ║');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');

  // =========================================================================
  // DISCOVERY
  // =========================================================================

  console.log('🔍 Discovering theme files...\n');

  const semanticFiles = discoverSemanticFiles();
  console.log(`   Found ${semanticFiles.length} semantic files:`);
  semanticFiles.forEach((f) => {
    console.log(`     - ${f.name}: ${f.properties.length} properties (${path.basename(f.path)})`);
  });

  const cssVarsProps = extractCssVarsProperties();
  console.log(`\n   cssVars.ts: ${cssVarsProps.length} color properties`);

  const cssThemeBlocks = discoverCssThemeBlocks();
  console.log(`\n   Found ${cssThemeBlocks.length} CSS theme blocks:`);
  cssThemeBlocks.forEach((b) => {
    const isOverlay = OVERLAY_THEMES.has(b.name);
    const suffix = isOverlay ? ' [overlay]' : '';
    console.log(`     - ${b.name}: ${b.variables.length} variables (${b.selector})${suffix}`);
  });

  console.log('');

  // =========================================================================
  // VALIDATION
  // =========================================================================

  const results = [];

  // Use first semantic file as source of truth (usually semantic.ts = dark)
  const sourceOfTruth = semanticFiles.find((f) => f.name === 'dark') || semanticFiles[0];
  if (!sourceOfTruth) {
    console.error('❌ No semantic.ts file found!');
    process.exit(1);
  }

  console.log(
    `📋 Using "${sourceOfTruth.name}" (${path.basename(sourceOfTruth.path)}) as source of truth\n`
  );

  // Check 1: All semantic files have same properties
  for (const file of semanticFiles) {
    if (file.name === sourceOfTruth.name) continue;

    results.push(
      checkSync(
        `semantic (${sourceOfTruth.name})`,
        sourceOfTruth.properties,
        `semantic (${file.name})`,
        file.properties
      )
    );
  }

  // Check 2: cssVars.ts has all properties
  results.push(
    checkSync(`semantic (${sourceOfTruth.name})`, sourceOfTruth.properties, 'cssVars.ts', cssVarsProps)
  );

  // Check 3: Each CSS theme block has all variables (skip overlay themes)
  const cssVarsAsKebab = cssVarsProps.map((p) => toKebabCase(p));

  for (const block of cssThemeBlocks) {
    // Skip overlay themes - they only override specific variables
    if (OVERLAY_THEMES.has(block.name)) {
      console.log(`   ⏭️  Skipping overlay theme: ${block.selector} (${block.variables.length} overrides)`);
      continue;
    }
    results.push(checkSync('cssVars.ts', cssVarsAsKebab, `global.css ${block.selector}`, block.variables));
  }

  // Check 4: Warn if semantic file exists but no CSS block
  for (const file of semanticFiles) {
    const hasBlock = cssThemeBlocks.some((b) => b.name === file.name);
    if (!hasBlock && file.name !== 'dark') {
      // :root covers 'dark'
      results.push({
        check: `CSS block for "${file.name}"`,
        pass: false,
        missing: [`[data-theme="${file.name}"] block in global.css`],
        extra: [],
      });
    }
  }

  // =========================================================================
  // REPORT
  // =========================================================================

  console.log('─'.repeat(60));
  console.log('RESULTS');
  console.log('─'.repeat(60));

  let allPassed = true;

  results.forEach((result) => {
    const icon = result.pass ? '✓' : '✗';
    console.log(`\n${icon} ${result.check}`);

    if (!result.pass) {
      allPassed = false;

      if (result.missing.length > 0) {
        console.log(`   Missing (${result.missing.length}):`);
        result.missing.slice(0, 15).forEach((p) => console.log(`     - ${p}`));
        if (result.missing.length > 15) {
          console.log(`     ... and ${result.missing.length - 15} more`);
        }
      }

      if (result.extra.length > 0) {
        console.log(`   Extra (${result.extra.length}):`);
        result.extra.slice(0, 10).forEach((p) => console.log(`     - ${p}`));
        if (result.extra.length > 10) {
          console.log(`     ... and ${result.extra.length - 10} more`);
        }
      }
    }
  });

  console.log('\n' + '─'.repeat(60));

  if (allPassed) {
    console.log('✅ All design token files are in sync!');
    console.log(`   ${semanticFiles.length} semantic files`);
    console.log(`   ${cssThemeBlocks.length} CSS theme blocks`);
    console.log(`   ${sourceOfTruth.properties.length} color properties each`);
    process.exit(0);
  } else {
    console.log('❌ Design token sync check FAILED\n');
    console.log('To fix, ensure ALL files have the SAME properties:\n');
    console.log('1. Semantic files (TypeScript):');
    semanticFiles.forEach((f) => console.log(`   - ${f.path}`));
    console.log('\n2. CSS Variable wrapper:');
    console.log(`   - ${PATHS.cssVars}`);
    console.log('\n3. CSS theme blocks in global.css:');
    cssThemeBlocks.forEach((b) => console.log(`   - ${b.selector}`));
    console.log('\nNaming convention:');
    console.log('  TS property:  textPrimary');
    console.log("  cssVars:      textPrimary: 'var(--color-text-primary)'");
    console.log('  CSS variable: --color-text-primary: #hexvalue;');
    process.exit(1);
  }
}

main();
