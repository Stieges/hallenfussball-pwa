/**
 * migrateToIndexedDB - Migrate data from localStorage to IndexedDB
 *
 * Migration Strategy:
 * 1. Check for existing data in localStorage
 * 2. Copy to IndexedDB
 * 3. Verify migration success
 * 4. Optionally clear localStorage
 *
 * Safety:
 * - Non-destructive by default (keeps localStorage as backup)
 * - Validates data integrity before/after migration
 * - Logs migration progress in dev mode
 * - Returns detailed migration result
 */

import { LocalStorageAdapter } from './LocalStorageAdapter';
import { IndexedDBAdapter } from './IndexedDBAdapter';

export interface MigrationResult {
  success: boolean;
  migratedKeys: string[];
  failedKeys: string[];
  totalKeys: number;
  errors: string[];
}

export interface MigrationOptions {
  /**
   * Clear localStorage after successful migration
   * Default: false (keeps as backup)
   */
  clearSource?: boolean;

  /**
   * Keys to exclude from migration (e.g., temporary data)
   * Default: []
   */
  excludeKeys?: string[];

  /**
   * Dry run - check what would be migrated without actually migrating
   * Default: false
   */
  dryRun?: boolean;
}

/**
 * Migrate all data from localStorage to IndexedDB
 */
export async function migrateToIndexedDB(
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const { clearSource = false, excludeKeys = [], dryRun = false } = options;

  const result: MigrationResult = {
    success: false,
    migratedKeys: [],
    failedKeys: [],
    totalKeys: 0,
    errors: [],
  };

  try {
    // Initialize adapters
    const source = new LocalStorageAdapter();
    const target = new IndexedDBAdapter();
    await target.init();

    // Get all keys from localStorage
    const allKeys = await source.keys();
    const keysToMigrate = allKeys.filter((key) => !excludeKeys.includes(key));
    result.totalKeys = keysToMigrate.length;

    if (result.totalKeys === 0) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('ℹ️ No data to migrate from localStorage');
      }
      result.success = true;
      return result;
    }

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(`🔄 Migrating ${result.totalKeys} keys from localStorage to IndexedDB...`);
      if (dryRun) {
        // eslint-disable-next-line no-console
        console.log('🧪 DRY RUN - No data will be modified');
      }
    }

    // Migrate each key
    for (const key of keysToMigrate) {
      try {
        // Read from localStorage
        const value = await source.get(key);

        if (value === null) {
          if (import.meta.env.DEV) {
             
            console.warn(`⚠️ Key "${key}" is null, skipping`);
          }
          continue;
        }

        // Write to IndexedDB (unless dry run)
        if (!dryRun) {
          await target.set(key, value);

          // Verify migration
          const verifyValue = await target.get(key);
          if (verifyValue === null) {
            throw new Error('Verification failed: value not found after migration');
          }
        }

        result.migratedKeys.push(key);

        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log(`✅ Migrated: ${key}`);
        }
      } catch (error) {
        const errorMsg = `Failed to migrate key "${key}": ${(error as Error).message}`;
        result.failedKeys.push(key);
        result.errors.push(errorMsg);

        if (import.meta.env.DEV) {
           
          console.error(`❌ ${errorMsg}`);
        }
      }
    }

    // Clear localStorage if requested and all keys migrated successfully
    if (clearSource && !dryRun && result.failedKeys.length === 0) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('🧹 Clearing localStorage after successful migration...');
      }
      await source.clear();
    }

    result.success = result.failedKeys.length === 0;

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(
        `${result.success ? '✅' : '⚠️'} Migration complete: ${result.migratedKeys.length}/${result.totalKeys} keys`
      );
      if (result.failedKeys.length > 0) {
         
        console.warn(`Failed keys: ${result.failedKeys.join(', ')}`);
      }
    }
  } catch (error) {
    result.errors.push(`Migration failed: ${(error as Error).message}`);
    if (import.meta.env.DEV) {
      console.error('❌ Migration error:', error);
    }
  }

  return result;
}

/**
 * Check if migration is needed
 * Returns true if localStorage has data but IndexedDB doesn't
 */
export async function isMigrationNeeded(): Promise<boolean> {
  try {
    const source = new LocalStorageAdapter();
    const target = new IndexedDBAdapter();
    await target.init();

    const sourceKeys = await source.keys();
    const targetKeys = await target.keys();

    // Migration needed if source has data but target is empty
    return sourceKeys.length > 0 && targetKeys.length === 0;
  } catch {
    return false;
  }
}

/**
 * Auto-migrate on first load if needed
 * Safe to call multiple times - only migrates once
 */
export async function autoMigrate(): Promise<void> {
  try {
    const needed = await isMigrationNeeded();

    if (!needed) {
      return;
    }

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('🔄 Auto-migration triggered');
    }

    const result = await migrateToIndexedDB({
      clearSource: false, // Keep localStorage as backup
      excludeKeys: [], // Migrate everything
    });

    if (!result.success && import.meta.env.DEV) {
       
      console.error('⚠️ Auto-migration incomplete:', result.errors);
    }
  } catch (error) {
    if (import.meta.env.DEV) {
       
      console.error('❌ Auto-migration failed:', error);
    }
    // Don't throw - app should continue with current storage
  }
}
