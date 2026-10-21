/**
 * Profil (Anzeigename, Avatar, Rolle) aus der Tabelle `profiles` lesen (aus AuthContext ausgelagert).
 * Erwartete Fehler (noch kein Profil, AbortError) liefern still `null`.
 */

import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { captureFeatureError } from '../../../lib/sentry';

export interface ProfileFields {
  name: string;
  avatar_url: string | null;
  role: 'user' | 'admin';
}

export async function fetchProfile(userId: string): Promise<ProfileFields | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, avatar_url, role')
      .eq('id', userId)
      .single();

    if (error) {
      // PGRST116 is "No Data Found" - expected if trigger hasn't finished yet
      // AbortError is expected in React StrictMode or during navigation
      const isExpectedError =
        error.code === 'PGRST116' ||
        error.message?.includes('AbortError') ||
        error.message?.includes('aborted');
      if (!isExpectedError) {
        console.warn('Profile fetch error:', error.message);
      }
      return null;
    }

    // Map to expected format
    return {
      name: data.display_name ?? '',
      avatar_url: data.avatar_url,
      role: (data.role as 'user' | 'admin' | null) ?? 'user',
    };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('Profile fetch failed:', err);
    }
    if (err instanceof Error) {
      captureFeatureError(err, 'auth', 'fetchProfile');
    }
    return null;
  }
}
