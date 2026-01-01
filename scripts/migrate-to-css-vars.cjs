#!/usr/bin/env node

/**
 * Theme Migration Script
 *
 * Migrates Design Token imports to cssVars for theme support.
 *
 * Usage:
 *   node scripts/migrate-to-css-vars.js --dry-run
 *   node scripts/migrate-to-css-vars.js --path=src/components/ui
 *   node scripts/migrate-to-css-vars.js
 */

const fs = require('fs');
const path = require('path');

// =============================================================================
// CONFIGURATION
// =============================================================================

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const TARGET_PATH = args.find((a) => a.startsWith('--path='))?.split('=')[1] || 'src';

// Token categories to migrate
const TOKENS_TO_MIGRATE = [
  'colors',
  'spacing',
  'borderRadius',
  'radii',
  'shadows',
  'fontSizes',
  'gradients',
  'fontWeights',
  'lineHeights',
];

// Mapping from old import names to cssVars property names
const TOKEN_MAPPING = {
  colors: 'colors',
  spacing: 'spacing',
  borderRadius: 'borderRadius',
  radii: 'borderRadius', // radii is alias for borderRadius
  shadows: 'shadows',
  fontSizes: 'fontSizes',
  gradients: 'gradients',
  fontWeights: 'fontWeights',
  lineHeights: 'lineHeights',
};

// Files/folders to skip
const SKIP_PATTERNS = [
  'design-tokens',
  'node_modules',
  '.test.',
  '.spec.',
  '__tests__',
  'cssVars.ts',
];

// =============================================================================
// UTILITIES
// =============================================================================

function shouldSkipFile(filePath) {
  for (const pattern of SKIP_PATTERNS) {
    if (filePath.includes(pattern)) {
      return `Contains '${pattern}'`;
    }
  }
  return null;
}

function findFiles(dir, extensions = ['.tsx', '.ts']) {
  const files = [];

  function walk(currentPath) {
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (err) {
      console.error(`Error reading ${currentPath}:`, err.message);
    }
  }

  walk(dir);
  return files;
}

// =============================================================================
// MIGRATION LOGIC
// =============================================================================

function migrateFile(filePath) {
  const skipReason = shouldSkipFile(filePath);
  if (skipReason) {
    return { file: filePath, changes: 0, warnings: [], skipped: true, skipReason };
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  const warnings = [];
  let changeCount = 0;

  // Find design-tokens imports
  const importRegex =
    /import\s*\{([^}]+)\}\s*from\s*['"](?:\.\.\/)*design-tokens(?:\/[^'"]*)?['"]/g;
  const imports = content.match(importRegex);

  if (!imports) {
    return { file: filePath, changes: 0, warnings: [], skipped: false };
  }

  // Track which legacy tokens are imported
  const importedLegacyTokens = new Set();

  for (const importStatement of imports) {
    const match = importStatement.match(/import\s*\{([^}]+)\}/);
    if (!match) continue;

    const importedNames = match[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim());

    for (const name of importedNames) {
      if (TOKENS_TO_MIGRATE.includes(name)) {
        importedLegacyTokens.add(name);
      }
    }
  }

  if (importedLegacyTokens.size === 0) {
    return { file: filePath, changes: 0, warnings: [], skipped: false };
  }

  // Add cssVars to imports if not already present
  if (!content.includes('cssVars')) {
    // Find the first design-tokens import and add cssVars
    content = content.replace(
      /import\s*\{([^}]+)\}\s*from\s*(['"])(?:\.\.\/)*design-tokens(?:\/[^'"]*)?['"]/,
      (match, imports, quote) => {
        const importList = imports.split(',').map((s) => s.trim());
        if (!importList.includes('cssVars')) {
          importList.unshift('cssVars');
        }
        return `import { ${importList.join(', ')} } from ${quote}${match.includes('@/') ? '@/design-tokens' : match.match(/from\s*(['"])([^'"]+)['"]/)[2]}${quote}`;
      }
    );
    changeCount++;
  }

  // Replace token usage: colors.X -> cssVars.colors.X
  for (const token of importedLegacyTokens) {
    const cssVarCategory = TOKEN_MAPPING[token];
    if (!cssVarCategory) continue;

    // Pattern: token.property (not already cssVars.token.property)
    const usageRegex = new RegExp(`(?<!cssVars\\.)(?<!\\w)${token}\\.(\\w+)`, 'g');

    const beforeReplace = content;
    content = content.replace(usageRegex, `cssVars.${cssVarCategory}.$1`);

    if (content !== beforeReplace) {
      changeCount++;
    }

    // Detect complex patterns that need manual review
    // Dynamic property access: colors[key]
    if (new RegExp(`\\b${token}\\s*\\[`).test(content)) {
      warnings.push(`Dynamic property access on '${token}' - manual review needed`);
    }

    // Spread operator: { ...colors }
    if (new RegExp(`\\.\\.\\.\\s*${token}\\b`).test(content)) {
      warnings.push(`Spread operator on '${token}' - manual review needed`);
    }

    // Destructuring: const { primary } = colors
    if (new RegExp(`}\\s*=\\s*${token}\\b`).test(content)) {
      warnings.push(`Destructuring '${token}' - manual review needed`);
    }
  }

  // Write file if changed and not dry-run
  if (content !== originalContent && !DRY_RUN) {
    fs.writeFileSync(filePath, content);
  }

  return {
    file: filePath,
    changes: content !== originalContent ? changeCount : 0,
    warnings,
    skipped: false,
  };
}

// =============================================================================
// REPORT GENERATION
// =============================================================================

function generateReport(results) {
  const lines = [];
  const timestamp = new Date().toISOString();

  lines.push('# Theme Migration Report');
  lines.push('');
  lines.push(`**Timestamp:** ${timestamp}`);
  lines.push(`**Mode:** ${DRY_RUN ? 'Dry Run' : 'Live'}`);
  lines.push(`**Target:** ${TARGET_PATH}`);
  lines.push('');

  // Summary
  const changedFiles = results.filter((r) => r.changes > 0);
  const skippedFiles = results.filter((r) => r.skipped);
  const filesWithWarnings = results.filter((r) => r.warnings.length > 0);

  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Files Scanned | ${results.length} |`);
  lines.push(`| Files Changed | ${changedFiles.length} |`);
  lines.push(`| Files Skipped | ${skippedFiles.length} |`);
  lines.push(`| Files with Warnings | ${filesWithWarnings.length} |`);
  lines.push('');

  // Warnings
  if (filesWithWarnings.length > 0) {
    lines.push('## Manual Review Required');
    lines.push('');
    lines.push('These files have patterns that need manual review:');
    lines.push('');

    for (const result of filesWithWarnings) {
      lines.push(`### ${result.file}`);
      lines.push('');
      for (const warning of result.warnings) {
        lines.push(`- ${warning}`);
      }
      lines.push('');
    }
  }

  // Changed files
  if (changedFiles.length > 0) {
    lines.push('## Changed Files');
    lines.push('');
    lines.push('| File | Changes |');
    lines.push('|------|---------|');
    for (const result of changedFiles) {
      const relativePath = result.file.replace(process.cwd() + '/', '');
      lines.push(`| ${relativePath} | ${result.changes} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  console.log('');
  console.log('═'.repeat(60));
  console.log('  THEME MIGRATION SCRIPT');
  console.log('═'.repeat(60));
  console.log(`  Mode:   ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (writing files)'}`);
  console.log(`  Target: ${TARGET_PATH}`);
  console.log('═'.repeat(60));
  console.log('');

  const targetDir = path.resolve(TARGET_PATH);
  if (!fs.existsSync(targetDir)) {
    console.error(`Error: Target path does not exist: ${targetDir}`);
    process.exit(1);
  }

  console.log(`Scanning ${targetDir}...`);
  const files = findFiles(targetDir);
  console.log(`Found ${files.length} TypeScript/TSX files`);
  console.log('');

  const results = [];
  let changedCount = 0;

  for (const file of files) {
    const result = migrateFile(file);
    results.push(result);

    if (result.skipped) {
      if (VERBOSE) {
        console.log(`⏭️  ${file} (skipped: ${result.skipReason})`);
      }
    } else if (result.changes > 0) {
      changedCount++;
      console.log(`✅ ${file} (${result.changes} changes)`);
      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          console.log(`   ⚠️  ${warning}`);
        }
      }
    } else if (VERBOSE) {
      console.log(`➖ ${file} (no changes needed)`);
    }
  }

  // Generate and save report
  const report = generateReport(results);
  const reportPath = 'docs/theme-migration-report.md';
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  fs.writeFileSync(reportPath, report);

  // Summary
  console.log('');
  console.log('─'.repeat(60));
  console.log('MIGRATION SUMMARY');
  console.log('─'.repeat(60));
  console.log(`  Files scanned:  ${files.length}`);
  console.log(`  Files changed:  ${changedCount}`);
  console.log(`  Report:         ${reportPath}`);
  console.log('');

  if (DRY_RUN) {
    console.log('This was a DRY RUN. No files were modified.');
    console.log('Run without --dry-run to apply changes.');
  }

  console.log('');
}

main();
