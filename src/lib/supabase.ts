/**
 * Supabase Client Configuration
 *
 * Zentraler Supabase-Client für die gesamte App.
 * Verwendet Umgebungsvariablen für URL und Anon-Key.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file.'
  );
}

/**
 * Supabase Client Singleton
 *
 * Konfiguriert mit:
 * - Auto Token Refresh
 * - Session Persistence
 * - URL Session Detection (für OAuth Callbacks)
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

/**
 * Helper: Aktuellen User holen
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

/**
 * Helper: Aktuelle Session holen
 */
export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

/**
 * Helper: Public URL für Storage-Dateien generieren
 */
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Helper: Team-Logo URL
 */
export function getTeamLogoUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null;
  return getPublicUrl('team-logos', logoPath);
}

/**
 * Helper: Sponsor-Logo URL
 */
export function getSponsorLogoUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null;
  return getPublicUrl('sponsor-logos', logoPath);
}
