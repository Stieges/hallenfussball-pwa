/**
 * Storage Module - Unified storage abstraction layer
 *
 * Provides automatic backend selection (IndexedDB → localStorage fallback)
 * and migration utilities for existing data.
 *
 * Quick Start:
 * ```typescript
 * import { createStorage } from '@/core/storage';
 *
 * const storage = await createStorage();
 * await storage.set('tournaments', tournamentData);
 * const data = await storage.get<Tournament[]>('tournaments');
 * ```
 *
 * Migration (one-time):
 * ```typescript
 * import { autoMigrate } from '@/core/storage';
 *
 * // In App.tsx or main.ts
 * await autoMigrate(); // Automatically migrates localStorage → IndexedDB
 * ```
 */

// Core interface
export type { IStorageAdapter } from './IStorageAdapter';

// Implementations
export { IndexedDBAdapter } from './IndexedDBAdapter';
export { LocalStorageAdapter } from './LocalStorageAdapter';

// Factory
export { createStorage, isIndexedDBAvailable, getStorageQuota } from './StorageFactory';

// Migration
export {
  migrateToIndexedDB,
  isMigrationNeeded,
  autoMigrate,
  type MigrationResult,
  type MigrationOptions,
} from './migrateToIndexedDB';
