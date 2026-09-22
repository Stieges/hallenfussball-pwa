/**
 * E2E Test i18n Helper
 *
 * Loads German translations directly from the source JSON files.
 * This ensures E2E tests always use the same text as the app,
 * so tests won't break when translations change.
 *
 * Resolves i18next-style nesting ($t(namespace:key.path)) the same way the
 * app's i18next runtime does, so values that delegate to a shared term (e.g.
 * sport.json's terminology glossary) resolve to the final display string
 * instead of the raw "$t(...)" placeholder.
 *
 * Usage:
 *   import { t } from './helpers/i18n';
 *
 *   // Simple key lookup
 *   await page.getByRole('button', { name: t('common:actions.cancel') });
 *   await page.getByText(t('dashboard:emptyState.noTournaments'));
 *
 *   // With interpolation
 *   await page.getByText(t('wizard:step4.teamsAdded_other', { count: '8' }));
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load all German translation namespaces
// Use import.meta.url for ESM compatibility (CI runs Playwright in ESM mode)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCALES_DIR = path.resolve(__dirname, '../../../src/i18n/locales/de');

type TranslationMap = Record<string, unknown>;

const namespaces: Record<string, TranslationMap> = {};

function loadNamespace(ns: string): TranslationMap {
  if (namespaces[ns]) {
    return namespaces[ns];
  }
  const filePath = path.join(LOCALES_DIR, `${ns}.json`);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    namespaces[ns] = JSON.parse(content) as TranslationMap;
    return namespaces[ns];
  } catch {
    throw new Error(`[i18n] Translation namespace "${ns}" not found at ${filePath}`);
  }
}

/**
 * Get a nested value from an object by dot-separated path.
 */
function getNestedValue(obj: TranslationMap, keyPath: string): string | undefined {
  const parts = keyPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

// Matches i18next's nesting syntax, e.g. "$t(sport:events.penaltyShootout)".
// See src/i18n/index.ts — nesting uses i18next's default $t(ns:key) prefix/suffix,
// no plugin required at runtime, but this standalone helper reads raw JSON and
// must resolve it itself to stay text-stable with the app.
const NESTING_PATTERN = /\$t\(([^):]+):([^)]+)\)/g;

/**
 * Resolve i18next-style nested references ($t(namespace:key.path)) within a
 * translated string by recursively looking up the referenced key.
 *
 * @param value - Raw translation value, possibly containing $t(...) references
 * @param depth - Recursion guard against circular references
 */
function resolveNesting(value: string, depth = 0): string {
  if (depth > 5) {
    throw new Error(`[i18n] Nesting too deep (possible circular $t() reference) resolving "${value}"`);
  }

  if (!NESTING_PATTERN.test(value)) {
    return value;
  }
  NESTING_PATTERN.lastIndex = 0;

  return value.replace(NESTING_PATTERN, (_match, ns: string, keyPath: string) => {
    const translations = loadNamespace(ns);
    const resolved = getNestedValue(translations, keyPath);
    if (resolved === undefined) {
      throw new Error(`[i18n] Nested key "${keyPath}" not found in namespace "${ns}"`);
    }
    return resolveNesting(resolved, depth + 1);
  });
}

/**
 * Translate a key with optional interpolation.
 *
 * @param key - Namespaced key like "common:actions.cancel" or "dashboard:emptyState.noTournaments"
 * @param params - Optional interpolation params like { count: '5', name: 'Test' }
 * @returns The translated string
 * @throws If namespace or key is not found
 *
 * @example
 * t('common:actions.cancel')          // → "Abbrechen"
 * t('dashboard:buttons.newTournament') // → "Neues Turnier"
 * t('wizard:step4.teamsAdded_other', { count: '8' }) // → "8 Teams hinzugefügt"
 */
export function t(key: string, params?: Record<string, string>): string {
  const colonIndex = key.indexOf(':');
  if (colonIndex === -1) {
    throw new Error(`[i18n] Key must be namespaced (e.g., "common:actions.cancel"), got: "${key}"`);
  }

  const ns = key.slice(0, colonIndex);
  const keyPath = key.slice(colonIndex + 1);

  const translations = loadNamespace(ns);
  const value = getNestedValue(translations, keyPath);

  if (value === undefined) {
    throw new Error(`[i18n] Key "${keyPath}" not found in namespace "${ns}"`);
  }

  const resolved = resolveNesting(value);

  if (!params) {
    return resolved;
  }

  // Replace {{param}} placeholders
  return resolved.replace(/\{\{(\w+)\}\}/g, (_, paramName: string) => {
    return params[paramName] ?? `{{${paramName}}}`;
  });
}

/**
 * Create a namespace-scoped translator for convenience.
 *
 * @example
 * const tc = scopedT('common');
 * tc('actions.cancel') // → "Abbrechen"
 */
export function scopedT(namespace: string): (key: string, params?: Record<string, string>) => string {
  return (key: string, params?: Record<string, string>) => t(`${namespace}:${key}`, params);
}
