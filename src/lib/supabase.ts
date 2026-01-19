/**
 * Supabase Client Configuration
 *
 * Zentraler Supabase-Client für die gesamte App.
 * Verwendet Umgebungsvariablen für URL und Anon-Key.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { safeLocalStorage } from '../core/utils/safeStorage';

// Trim to prevent issues with trailing newlines in env vars (e.g., from copy-paste in Vercel)
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/**
 * Check if Supabase is configured
 *
 * When running in development or CI without Supabase credentials,
 * the app falls back to localStorage-only mode.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Log warning in development mode only (not in production or tests)
if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[Supabase] Environment variables not set. Running in offline-only mode. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local for cloud features.'
  );
}

/**
 * Supabase Client Singleton
 *
 * Konfiguriert mit:
 * - Auto Token Refresh
 * - Session Persistence
 * - Manual URL handling (detectSessionInUrl: false)
 *   → AuthCallback.tsx handles code exchange explicitly
 *   → Prevents race conditions with double code processing
 *
 * Returns null if Supabase is not configured (offline-only mode)
 */
function createSupabaseClient(): SupabaseClient<Database> | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // We handle code exchange manually in AuthCallback
      storage: safeLocalStorage,
    },
  });
}

export const supabase = createSupabaseClient();

/**
 * Helper: Aktuellen User holen
 * Returns null if Supabase is not configured
 */
export async function getCurrentUser() {
  if (!supabase) { return null; }
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) { throw error; }
  return user;
}

/**
 * Helper: Aktuelle Session holen
 * Returns null if Supabase is not configured
 */
export async function getCurrentSession() {
  if (!supabase) { return null; }
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) { throw error; }
  return session;
}

/**
 * Helper: Public URL für Storage-Dateien generieren
 * Returns null if Supabase is not configured
 */
export function getPublicUrl(bucket: string, path: string): string | null {
  if (!supabase) { return null; }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Helper: Team-Logo URL
 */
export function getTeamLogoUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) { return null; }
  return getPublicUrl('team-logos', logoPath);
}

/**
 * Helper: Sponsor-Logo URL
 */
export function getSponsorLogoUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) { return null; }
  return getPublicUrl('sponsor-logos', logoPath);
}
