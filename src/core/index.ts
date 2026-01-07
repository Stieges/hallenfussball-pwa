/**
 * Core Module
 * 
 * Pure business logic without React dependencies.
 * This module is designed to be:
 * - Testable in isolation
 * - Portable to different UI frameworks
 * - Ready for backend migration (Supabase)
 */

// Models
export * from './models';

// Repositories
export * from './repositories';

// Services
export * from './services';
