/**
 * Supabase Mock for Auth Tests
 *
 * Provides a type-safe mock of the Supabase client for unit testing
 * authentication actions without network calls.
 */

import { vi } from 'vitest';
import type { User as SupabaseUser, Session as SupabaseSession } from '@supabase/supabase-js';

// =============================================================================
// MOCK TYPES
// =============================================================================

export interface MockSupabaseAuth {
  signUp: ReturnType<typeof vi.fn>;
  signInWithPassword: ReturnType<typeof vi.fn>;
  signInWithOAuth: ReturnType<typeof vi.fn>;
  signInWithOtp: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  resetPasswordForEmail: ReturnType<typeof vi.fn>;
  updateUser: ReturnType<typeof vi.fn>;
  getSession: ReturnType<typeof vi.fn>;
  getUser: ReturnType<typeof vi.fn>;
  onAuthStateChange: ReturnType<typeof vi.fn>;
}

export interface MockSupabaseClient {
  auth: MockSupabaseAuth;
  from: ReturnType<typeof vi.fn>;
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Creates a mock Supabase client with all auth methods mocked
 */
export function createSupabaseMock(): MockSupabaseClient {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      signInWithOtp: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => mockQueryBuilder),
  };
}

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

/**
 * Creates a mock Supabase user
 */
export function createMockSupabaseUser(overrides?: Partial<SupabaseUser>): SupabaseUser {
  return {
    id: 'test-user-id-123',
    app_metadata: {},
    user_metadata: {
      name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg',
    },
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00.000Z',
    email: 'test@example.com',
    email_confirmed_at: '2024-01-01T00:00:00.000Z',
    phone: undefined,
    confirmed_at: '2024-01-01T00:00:00.000Z',
    last_sign_in_at: '2024-01-15T12:00:00.000Z',
    role: 'authenticated',
    updated_at: '2024-01-15T12:00:00.000Z',
    identities: [],
    is_anonymous: false,
    factors: [],
    ...overrides,
  };
}

/**
 * Creates a mock Supabase session
 */
export function createMockSupabaseSession(
  user?: SupabaseUser,
  overrides?: Partial<SupabaseSession>
): SupabaseSession {
  const mockUser = user ?? createMockSupabaseUser();
  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: mockUser,
    ...overrides,
  };
}

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

/**
 * Creates a successful auth response
 */
export function createSuccessResponse<T>(data: T) {
  return { data, error: null };
}

/**
 * Creates an error auth response
 */
export function createErrorResponse(message: string, status = 400) {
  return {
    data: { user: null, session: null },
    error: {
      message,
      status,
      name: 'AuthError',
    },
  };
}

/**
 * Creates a sign-up response with email confirmation pending
 */
export function createSignUpPendingResponse(user: SupabaseUser) {
  return {
    data: {
      user,
      session: null, // No session until email confirmed
    },
    error: null,
  };
}

/**
 * Creates a sign-in response
 */
export function createSignInResponse(user?: SupabaseUser) {
  const mockUser = user ?? createMockSupabaseUser();
  const session = createMockSupabaseSession(mockUser);
  return {
    data: {
      user: mockUser,
      session,
    },
    error: null,
  };
}

// =============================================================================
// MOCK PROFILE DATA
// =============================================================================

export interface MockProfileData {
  id: string;
  name: string;
  avatar_url: string | null;
  global_role: 'admin' | 'verified' | 'user' | 'guest';
}

export function createMockProfileData(overrides?: Partial<MockProfileData>): MockProfileData {
  return {
    id: 'test-user-id-123',
    name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    global_role: 'verified',
    ...overrides,
  };
}

// =============================================================================
// AUTH ACTION DEPS MOCK
// =============================================================================

export function createMockAuthActionDeps() {
  return {
    fetchProfile: vi.fn(),
    setUser: vi.fn(),
    setSession: vi.fn(),
    setIsGuest: vi.fn(),
    setConnectionState: vi.fn(),
    setIsLoading: vi.fn(),
    updateAuthState: vi.fn(),
    getCurrentState: vi.fn(() => ({ user: null, isGuest: true })),
  };
}
