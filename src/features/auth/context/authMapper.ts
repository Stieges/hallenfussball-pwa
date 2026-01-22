/**
 * Auth Mapper Functions
 *
 * Pure functions for mapping Supabase types to application types.
 * Extracted from AuthContext.tsx for better testability and separation of concerns.
 *
 * @see AuthContext.tsx (original location)
 */

import type { User as SupabaseUser, Session as SupabaseSession } from '@supabase/supabase-js';
import type { User, Session } from '../types/auth.types';
import { generateUUID } from '../utils/tokenGenerator';

/**
 * Profile data structure from Supabase profiles table
 */
export interface ProfileData {
  name: string;
  avatar_url: string | null;
  role: 'user' | 'admin' | null;
}

/**
 * Maps Supabase User to our User type
 *
 * Fallback chain for name:
 * 1. Profile display_name (from profiles table)
 * 2. user_metadata.full_name (from auth.users)
 * 3. Email prefix (before @)
 * 4. 'Gast' for anonymous users, 'User' otherwise
 */
export function mapSupabaseUser(
  supabaseUser: SupabaseUser | null,
  profileData?: ProfileData | null
): User | null {
  if (!supabaseUser) {
    return null;
  }

  // Extract user_metadata with proper typing
  const metadata = supabaseUser.user_metadata as { full_name?: string; avatar_url?: string } | undefined;

  // Check if this is an anonymous user (Supabase sets is_anonymous on the user object)
  const isAnonymous = supabaseUser.is_anonymous === true;

  // Use profile name if non-empty, otherwise fall back through the chain
  const profileName = profileData?.name && profileData.name.trim() !== '' ? profileData.name : undefined;
  const metadataName = metadata?.full_name && metadata.full_name.trim() !== '' ? metadata.full_name : undefined;
  const emailName = supabaseUser.email?.split('@')[0];

  // Default name for anonymous users is 'Gast', for regular users 'User'
  const defaultName = isAnonymous ? 'Gast' : 'User';

  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    name: profileName ?? metadataName ?? emailName ?? defaultName,
    avatarUrl: profileData?.avatar_url ?? metadata?.avatar_url,
    // Anonymous users get 'user' role (not 'guest') since they have a real Supabase account
    globalRole: profileData?.role as 'user' | 'admin' | undefined ?? 'user',
    isAnonymous,
    createdAt: supabaseUser.created_at,
    updatedAt: supabaseUser.updated_at ?? supabaseUser.created_at,
    lastLoginAt: supabaseUser.last_sign_in_at,
  };
}

/**
 * Maps Supabase Session to our Session type
 */
export function mapSupabaseSession(supabaseSession: SupabaseSession | null): Session | null {
  if (!supabaseSession) {
    return null;
  }

  return {
    id: supabaseSession.access_token.substring(0, 36), // Use first part as ID
    userId: supabaseSession.user.id,
    token: supabaseSession.access_token,
    createdAt: new Date().toISOString(),
    expiresAt: new Date((supabaseSession.expires_at ?? Date.now() / 1000) * 1000).toISOString(),
    lastActivityAt: new Date().toISOString(),
  };
}

/**
 * Creates a local guest user (not stored in Supabase)
 *
 * Guest users:
 * - Have a locally generated UUID
 * - Have globalRole: 'guest'
 * - Are stored in localStorage only
 * - Can create/manage local tournaments
 * - Cannot sync to cloud
 */
export function createLocalGuestUser(): User {
  const now = new Date().toISOString();
  return {
    id: generateUUID(),
    email: '',
    name: 'Gast',
    globalRole: 'guest',
    createdAt: now,
    updatedAt: now,
  };
}
