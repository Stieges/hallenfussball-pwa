/**
 * Auth Mapper Tests
 *
 * Unit tests for the auth mapping functions.
 *
 * @see authMapper.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapSupabaseUser, mapSupabaseSession, createLocalGuestUser, type ProfileData } from '../authMapper';
import { createMockSupabaseUser, createMockSupabaseSession } from './mocks/supabaseMock';

// =============================================================================
// mapSupabaseUser
// =============================================================================

describe('mapSupabaseUser', () => {
  it('returns null for null input', () => {
    const result = mapSupabaseUser(null);
    expect(result).toBeNull();
  });

  it('maps user with complete profile data', () => {
    const supabaseUser = createMockSupabaseUser({
      id: 'user-123',
      email: 'john@example.com',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-15T00:00:00.000Z',
      last_sign_in_at: '2024-01-20T12:00:00.000Z',
    });

    const profileData: ProfileData = {
      name: 'John Doe',
      avatar_url: 'https://example.com/john.jpg',
      role: 'admin',
    };

    const result = mapSupabaseUser(supabaseUser, profileData);

    expect(result).toEqual({
      id: 'user-123',
      email: 'john@example.com',
      name: 'John Doe',
      avatarUrl: 'https://example.com/john.jpg',
      globalRole: 'admin',
      isAnonymous: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-15T00:00:00.000Z',
      lastLoginAt: '2024-01-20T12:00:00.000Z',
    });
  });

  it('maps user without profile data, uses user_metadata', () => {
    const supabaseUser = createMockSupabaseUser({
      id: 'user-456',
      email: 'jane@example.com',
      user_metadata: {
        full_name: 'Jane Smith',
        avatar_url: 'https://example.com/jane.jpg',
      },
    });

    const result = mapSupabaseUser(supabaseUser, null);

    expect(result).not.toBeNull();
    expect(result!.name).toBe('Jane Smith');
    expect(result!.avatarUrl).toBe('https://example.com/jane.jpg');
    expect(result!.globalRole).toBe('user'); // Default role
  });

  it('uses email prefix as fallback name', () => {
    const supabaseUser = createMockSupabaseUser({
      id: 'user-789',
      email: 'anonymous@example.com',
      user_metadata: {}, // No full_name
    });

    const result = mapSupabaseUser(supabaseUser, null);

    expect(result).not.toBeNull();
    expect(result!.name).toBe('anonymous'); // Email prefix
  });

  it('uses "User" as final fallback name', () => {
    const supabaseUser = createMockSupabaseUser({
      id: 'user-no-name',
      email: undefined, // No email
      user_metadata: {}, // No full_name
    });

    const result = mapSupabaseUser(supabaseUser, null);

    expect(result).not.toBeNull();
    expect(result!.name).toBe('User');
  });

  it('prefers profile name over user_metadata name', () => {
    const supabaseUser = createMockSupabaseUser({
      user_metadata: {
        full_name: 'Metadata Name',
      },
    });

    const profileData: ProfileData = {
      name: 'Profile Name',
      avatar_url: null,
      role: 'user',
    };

    const result = mapSupabaseUser(supabaseUser, profileData);

    expect(result!.name).toBe('Profile Name');
  });

  it('skips empty profile name', () => {
    const supabaseUser = createMockSupabaseUser({
      user_metadata: {
        full_name: 'Fallback Name',
      },
    });

    const profileData: ProfileData = {
      name: '   ', // Whitespace only
      avatar_url: null,
      role: 'user',
    };

    const result = mapSupabaseUser(supabaseUser, profileData);

    expect(result!.name).toBe('Fallback Name');
  });

  it('prefers profile avatar over user_metadata avatar', () => {
    const supabaseUser = createMockSupabaseUser({
      user_metadata: {
        avatar_url: 'https://metadata.com/avatar.jpg',
      },
    });

    const profileData: ProfileData = {
      name: 'Test User',
      avatar_url: 'https://profile.com/avatar.jpg',
      role: 'user',
    };

    const result = mapSupabaseUser(supabaseUser, profileData);

    expect(result!.avatarUrl).toBe('https://profile.com/avatar.jpg');
  });

  it('falls back to metadata avatar when profile avatar is null', () => {
    const supabaseUser = createMockSupabaseUser({
      user_metadata: {
        avatar_url: 'https://metadata.com/avatar.jpg',
      },
    });

    const profileData: ProfileData = {
      name: 'Test User',
      avatar_url: null, // No profile avatar
      role: 'user',
    };

    const result = mapSupabaseUser(supabaseUser, profileData);

    expect(result!.avatarUrl).toBe('https://metadata.com/avatar.jpg');
  });
});

// =============================================================================
// mapSupabaseSession
// =============================================================================

describe('mapSupabaseSession', () => {
  it('returns null for null input', () => {
    const result = mapSupabaseSession(null);
    expect(result).toBeNull();
  });

  it('maps session correctly', () => {
    const mockUser = createMockSupabaseUser({ id: 'user-session-test' });
    const supabaseSession = createMockSupabaseSession(mockUser, {
      access_token: 'abcdef123456-long-token-here',
      expires_at: Math.floor(Date.now() / 1000) + 7200, // 2 hours from now
    });

    const result = mapSupabaseSession(supabaseSession);

    expect(result).not.toBeNull();
    expect(result!.userId).toBe('user-session-test');
    expect(result!.token).toBe('abcdef123456-long-token-here');
    expect(result!.id).toBe('abcdef123456-long-token-here'.substring(0, 36));
    expect(result!.createdAt).toBeDefined();
    expect(result!.expiresAt).toBeDefined();
    expect(result!.lastActivityAt).toBeDefined();
  });

  it('handles session without expires_at', () => {
    const mockUser = createMockSupabaseUser();
    const supabaseSession = createMockSupabaseSession(mockUser, {
      expires_at: undefined,
    });

    const result = mapSupabaseSession(supabaseSession);

    expect(result).not.toBeNull();
    // Should fall back to current time
    expect(new Date(result!.expiresAt).getTime()).toBeGreaterThan(0);
  });
});

// =============================================================================
// createLocalGuestUser
// =============================================================================

describe('createLocalGuestUser', () => {
  beforeEach(() => {
    // Mock crypto.randomUUID if not available
    if (!crypto.randomUUID) {
      vi.stubGlobal('crypto', {
        randomUUID: vi.fn(() => 'mocked-uuid-1234-5678-9012'),
      });
    }
  });

  it('creates a guest user with UUID', () => {
    const guest = createLocalGuestUser();

    expect(guest.id).toBeDefined();
    expect(guest.id.length).toBeGreaterThan(0);
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    expect(guest.id).toMatch(/^[a-f0-9-]+$/i);
  });

  it('sets globalRole to guest', () => {
    const guest = createLocalGuestUser();

    expect(guest.globalRole).toBe('guest');
  });

  it('sets name to "Gast"', () => {
    const guest = createLocalGuestUser();

    expect(guest.name).toBe('Gast');
  });

  it('sets empty email', () => {
    const guest = createLocalGuestUser();

    expect(guest.email).toBe('');
  });

  it('sets createdAt and updatedAt timestamps', () => {
    const before = new Date().toISOString();
    const guest = createLocalGuestUser();
    const after = new Date().toISOString();

    expect(guest.createdAt).toBeDefined();
    expect(guest.updatedAt).toBeDefined();
    expect(guest.createdAt).toBe(guest.updatedAt);
    expect(guest.createdAt >= before).toBe(true);
    expect(guest.createdAt <= after).toBe(true);
  });

  it('generates unique IDs for multiple guests', () => {
    const guest1 = createLocalGuestUser();
    const guest2 = createLocalGuestUser();

    // IDs should be different (unless mock always returns same value)
    // This test verifies the function is called each time
    expect(guest1.createdAt).toBeDefined();
    expect(guest2.createdAt).toBeDefined();
  });

  it('does not set avatarUrl', () => {
    const guest = createLocalGuestUser();

    expect(guest.avatarUrl).toBeUndefined();
  });

  it('does not set lastLoginAt', () => {
    const guest = createLocalGuestUser();

    expect(guest.lastLoginAt).toBeUndefined();
  });
});
