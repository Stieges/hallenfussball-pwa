/**
 * Auth Actions Tests
 *
 * Unit tests for authentication action functions.
 * Uses mocked Supabase client to test without network calls.
 *
 * @see authActions.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSupabaseMock,
  createMockSupabaseUser,
  createMockSupabaseSession,
  createErrorResponse,
  createMockAuthActionDeps,
  createMockProfileData,
  type MockSupabaseClient,
} from './mocks/supabaseMock';

// We need to mock the supabase module before importing authActions
vi.mock('../../../../lib/supabase', async () => {
  const mockClient = createSupabaseMock();
  return {
    supabase: mockClient,
    isSupabaseConfigured: true,
  };
});

// Import after mock setup
import * as authActions from '../authActions';

// =============================================================================
// TEST SETUP
// =============================================================================

describe('authActions', () => {
  let mockDeps: ReturnType<typeof createMockAuthActionDeps>;
  let supabaseMock: MockSupabaseClient;

  beforeEach(async () => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Get fresh mock instances
    mockDeps = createMockAuthActionDeps();

    // Get the mocked supabase client
    const supabaseModule = await import('../../../../lib/supabase');
    supabaseMock = supabaseModule.supabase as unknown as MockSupabaseClient;
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ===========================================================================
  // register()
  // ===========================================================================

  describe('register', () => {
    it('creates user and profile on success', async () => {
      const mockUser = createMockSupabaseUser({
        id: 'new-user-id',
        email: 'newuser@example.com',
      });
      const mockSession = createMockSupabaseSession(mockUser);

      // Mock successful sign up
      supabaseMock.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      // Mock profile fetch
      mockDeps.fetchProfile.mockResolvedValue(createMockProfileData());
      mockDeps.getCurrentState.mockReturnValue({ user: null, isGuest: false });

      const result = await authActions.register(
        mockDeps,
        'New User',
        'newuser@example.com',
        'SecurePassword123!'
      );

      expect(result.success).toBe(true);
      expect(supabaseMock.auth.signUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        options: expect.objectContaining({
          data: { full_name: 'New User' },
        }),
      });
    });

    it('returns error for existing email', async () => {
      supabaseMock.auth.signUp.mockResolvedValue(
        createErrorResponse('User already registered', 400)
      );
      mockDeps.getCurrentState.mockReturnValue({ user: null, isGuest: false });

      const result = await authActions.register(
        mockDeps,
        'Test User',
        'existing@example.com',
        'Password123!'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('emailAlreadyRegistered');
    });

    it('returns error for weak password', async () => {
      supabaseMock.auth.signUp.mockResolvedValue(
        createErrorResponse('Password should be at least 6 characters', 422)
      );
      mockDeps.getCurrentState.mockReturnValue({ user: null, isGuest: false });

      const result = await authActions.register(
        mockDeps,
        'Test User',
        'user@example.com',
        '123' // Too short
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('handles network errors gracefully', async () => {
      supabaseMock.auth.signUp.mockRejectedValue(new Error('Network error'));
      mockDeps.getCurrentState.mockReturnValue({ user: null, isGuest: false });

      const result = await authActions.register(
        mockDeps,
        'Test User',
        'user@example.com',
        'Password123!'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns success when session is returned', async () => {
      const mockUser = createMockSupabaseUser();
      const mockSession = createMockSupabaseSession(mockUser);

      supabaseMock.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });
      mockDeps.fetchProfile.mockResolvedValue(createMockProfileData());
      mockDeps.getCurrentState.mockReturnValue({ user: null, isGuest: false });

      const result = await authActions.register(
        mockDeps,
        'Test User',
        'user@example.com',
        'Password123!'
      );

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
    });
  });

  // ===========================================================================
  // login()
  // ===========================================================================

  describe('login', () => {
    it('authenticates valid credentials', async () => {
      const mockUser = createMockSupabaseUser({
        id: 'login-user-id',
        email: 'user@example.com',
      });
      const mockSession = createMockSupabaseSession(mockUser);

      supabaseMock.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      mockDeps.fetchProfile.mockResolvedValue(createMockProfileData());

      const result = await authActions.login(
        mockDeps,
        'user@example.com',
        'CorrectPassword123!'
      );

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(mockDeps.setConnectionState).toHaveBeenCalledWith('connected');
    });

    it('returns error for invalid password', async () => {
      supabaseMock.auth.signInWithPassword.mockResolvedValue(
        createErrorResponse('Invalid login credentials', 400)
      );

      const result = await authActions.login(
        mockDeps,
        'user@example.com',
        'WrongPassword'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('invalidCredentials');
    });

    it('returns error for user not found', async () => {
      supabaseMock.auth.signInWithPassword.mockResolvedValue(
        createErrorResponse('Invalid login credentials', 400)
      );

      const result = await authActions.login(
        mockDeps,
        'nonexistent@example.com',
        'AnyPassword'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('handles AbortError gracefully', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      supabaseMock.auth.signInWithPassword.mockRejectedValue(abortError);

      const result = await authActions.login(
        mockDeps,
        'user@example.com',
        'Password123!'
      );

      expect(result.success).toBe(false);
      // AbortError should be handled without crashing
    });

    it('handles network errors', async () => {
      supabaseMock.auth.signInWithPassword.mockRejectedValue(
        new Error('Failed to fetch')
      );

      const result = await authActions.login(
        mockDeps,
        'user@example.com',
        'Password123!'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ===========================================================================
  // logout()
  // ===========================================================================

  describe('logout', () => {
    it('signs out successfully', async () => {
      supabaseMock.auth.signOut.mockResolvedValue({ error: null });

      await authActions.logout(mockDeps);

      expect(supabaseMock.auth.signOut).toHaveBeenCalled();
      expect(mockDeps.setUser).toHaveBeenCalledWith(null);
      expect(mockDeps.setSession).toHaveBeenCalledWith(null);
      expect(mockDeps.setIsGuest).toHaveBeenCalledWith(false);
    });

    it('handles signOut error gracefully', async () => {
      supabaseMock.auth.signOut.mockResolvedValue({
        error: { message: 'Sign out failed' },
      });

      // Should not throw
      await expect(authActions.logout(mockDeps)).resolves.not.toThrow();

      // State should still be cleared
      expect(mockDeps.setUser).toHaveBeenCalledWith(null);
    });
  });

  // ===========================================================================
  // sendMagicLink()
  // ===========================================================================

  describe('sendMagicLink', () => {
    it('sends magic link successfully', async () => {
      supabaseMock.auth.signInWithOtp.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      const result = await authActions.sendMagicLink('user@example.com');

      expect(result.success).toBe(true);
      expect(supabaseMock.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'user@example.com',
        options: expect.any(Object),
      });
    });

    it('returns error for invalid email', async () => {
      supabaseMock.auth.signInWithOtp.mockResolvedValue(
        createErrorResponse('Invalid email', 422)
      );

      const result = await authActions.sendMagicLink('invalid-email');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('handles rate limiting', async () => {
      supabaseMock.auth.signInWithOtp.mockResolvedValue(
        createErrorResponse('For security purposes, you can only request this once every 60 seconds', 429)
      );

      const result = await authActions.sendMagicLink('user@example.com');

      expect(result.success).toBe(false);
      // Should indicate rate limiting
    });
  });

  // ===========================================================================
  // loginWithGoogle()
  // ===========================================================================

  describe('loginWithGoogle', () => {
    it('initiates OAuth flow successfully', async () => {
      supabaseMock.auth.signInWithOAuth.mockResolvedValue({
        data: { provider: 'google', url: 'https://accounts.google.com/...' },
        error: null,
      });

      const result = await authActions.loginWithGoogle();

      expect(result.success).toBe(true);
      expect(supabaseMock.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: expect.any(Object),
      });
    });

    it('returns error when OAuth fails', async () => {
      supabaseMock.auth.signInWithOAuth.mockResolvedValue(
        createErrorResponse('OAuth configuration error', 500)
      );

      const result = await authActions.loginWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ===========================================================================
  // resetPassword()
  // ===========================================================================

  describe('resetPassword', () => {
    it('sends reset email successfully', async () => {
      supabaseMock.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      });

      const result = await authActions.resetPassword('user@example.com');

      expect(result.success).toBe(true);
      expect(supabaseMock.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(Object)
      );
    });

    it('returns error for non-existent email', async () => {
      // Note: Supabase often returns success even for non-existent emails
      // for security reasons, but we test the error case
      supabaseMock.auth.resetPasswordForEmail.mockResolvedValue(
        createErrorResponse('User not found', 400)
      );

      const result = await authActions.resetPassword('nonexistent@example.com');

      expect(result.success).toBe(false);
    });

    it('handles network errors', async () => {
      supabaseMock.auth.resetPasswordForEmail.mockRejectedValue(
        new Error('Network error')
      );

      const result = await authActions.resetPassword('user@example.com');

      expect(result.success).toBe(false);
    });
  });

  // ===========================================================================
  // updatePassword()
  // ===========================================================================

  describe('updatePassword', () => {
    it('updates password successfully', async () => {
      const mockUser = createMockSupabaseUser();

      supabaseMock.auth.updateUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await authActions.updatePassword('NewSecurePassword123!');

      expect(result.success).toBe(true);
      expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({
        password: 'NewSecurePassword123!',
      });
    });

    it('returns error for weak password', async () => {
      supabaseMock.auth.updateUser.mockResolvedValue(
        createErrorResponse('Password should be at least 6 characters', 422)
      );

      const result = await authActions.updatePassword('123');

      expect(result.success).toBe(false);
    });

    it('returns error when not authenticated', async () => {
      supabaseMock.auth.updateUser.mockResolvedValue(
        createErrorResponse('Not authenticated', 401)
      );

      const result = await authActions.updatePassword('NewPassword123!');

      expect(result.success).toBe(false);
    });
  });

  // ===========================================================================
  // continueAsGuest()
  // ===========================================================================

  describe('continueAsGuest', () => {
    it('creates a local guest user', async () => {
      const guestUser = await authActions.continueAsGuest(mockDeps);

      expect(guestUser).toBeDefined();
      expect(guestUser.id).toBeDefined();
      expect(guestUser.globalRole).toBe('guest');
      expect(guestUser.name).toBe('Gast');
      expect(mockDeps.setUser).toHaveBeenCalledWith(guestUser);
      expect(mockDeps.setIsGuest).toHaveBeenCalledWith(true);
    });

    it('sets session to null', async () => {
      await authActions.continueAsGuest(mockDeps);

      expect(mockDeps.setSession).toHaveBeenCalledWith(null);
    });
  });

  // ===========================================================================
  // reconnect()
  // ===========================================================================

  describe('reconnect', () => {
    it('reconnects successfully when session exists', async () => {
      const mockUser = createMockSupabaseUser();
      const mockSession = createMockSupabaseSession(mockUser);

      supabaseMock.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const result = await authActions.reconnect(mockDeps);

      expect(result).toBe(true);
      expect(mockDeps.setConnectionState).toHaveBeenCalledWith('connecting');
      expect(mockDeps.setConnectionState).toHaveBeenCalledWith('connected');
      expect(mockDeps.updateAuthState).toHaveBeenCalledWith(mockSession);
    });

    it('sets offline when reconnect fails', async () => {
      // Use fake timers to skip retry delays
      vi.useFakeTimers();

      supabaseMock.auth.getSession.mockRejectedValue(
        new Error('Network error')
      );

      // Start the reconnect (don't await yet)
      const reconnectPromise = authActions.reconnect(mockDeps);

      // Advance all timers to skip retry delays
      await vi.runAllTimersAsync();

      const result = await reconnectPromise;

      expect(result).toBe(false);
      expect(mockDeps.setConnectionState).toHaveBeenCalledWith('offline');

      // Restore real timers
      vi.useRealTimers();
    });

    it('handles AbortError without setting offline immediately', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      supabaseMock.auth.getSession.mockRejectedValue(abortError);

      const result = await authActions.reconnect(mockDeps);

      expect(result).toBe(false);
      // AbortError is handled gracefully
    });
  });

  // ===========================================================================
  // getReconnectState() and resetReconnectState()
  // ===========================================================================

  describe('reconnect state management', () => {
    it('getReconnectState returns current state', () => {
      const state = authActions.getReconnectState();

      expect(state).toBeDefined();
      expect(typeof state.attempt).toBe('number');
      expect(typeof state.isRetrying).toBe('boolean');
    });

    it('resetReconnectState clears state', () => {
      // First trigger a reconnect to set some state
      authActions.resetReconnectState();

      const state = authActions.getReconnectState();
      expect(state.attempt).toBe(0);
      expect(state.isRetrying).toBe(false);
    });
  });
});
