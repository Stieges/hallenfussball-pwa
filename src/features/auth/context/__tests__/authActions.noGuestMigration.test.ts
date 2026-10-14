/**
 * A-07e (@FU-006, @AN-024, Record Ü1.1): Anmelden und Registrieren migrieren lokale Gast-Turniere
 * NICHT mehr automatisch. Gegenbeispiel „Probelauf“: das Gast-Turnier bleibt lokal und wird beim
 * Anmelden nicht unter dem neuen Konto hochgeladen (der Migrationsdienst wird gar nicht gerufen).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSupabaseMock,
  createMockSupabaseUser,
  createMockSupabaseSession,
  createMockAuthActionDeps,
  createMockProfileData,
  type MockSupabaseClient,
} from './mocks/supabaseMock';

vi.mock('../../../../lib/supabase', async () => ({
  supabase: createSupabaseMock(),
  isSupabaseConfigured: true,
}));

vi.mock('../../services/guestMigrationService', () => ({
  migrateGuestTournaments: vi.fn(async () => ({
    success: true,
    migratedCount: 1,
    failedCount: 0,
    errors: [],
    migratedTitles: ['Probelauf'],
    skippedCount: 0,
    skippedTitles: [],
  })),
}));

import * as authActions from '../authActions';
import { migrateGuestTournaments } from '../../services/guestMigrationService';

describe('authActions ohne automatische Gast-Migration (A-07e)', () => {
  let mockDeps: ReturnType<typeof createMockAuthActionDeps>;
  let supabaseMock: MockSupabaseClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    // register() baut die Bestaetigungs-URL aus window.location (Node-Projekt ohne DOM)
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    mockDeps = createMockAuthActionDeps();
    const supabaseModule = await import('../../../../lib/supabase');
    supabaseMock = supabaseModule.supabase as unknown as MockSupabaseClient;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('Anmelden startet keine Gast-Migration; Probelauf bleibt lokal', async () => {
    const mockUser = createMockSupabaseUser({ id: 'login-user-id', email: 'user@example.com' });
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: { user: mockUser, session: createMockSupabaseSession(mockUser) },
      error: null,
    });
    mockDeps.fetchProfile.mockResolvedValue(createMockProfileData());

    const result = await authActions.login(mockDeps, 'user@example.com', 'Password123!');

    expect(result.success).toBe(true);
    expect(migrateGuestTournaments).not.toHaveBeenCalled();
    expect(result.migratedCount).toBe(0);
  });

  it('Registrieren startet keine Gast-Migration', async () => {
    const mockUser = createMockSupabaseUser({ id: 'new-user-id', email: 'newuser@example.com' });
    supabaseMock.auth.signUp.mockResolvedValue({
      data: { user: mockUser, session: createMockSupabaseSession(mockUser) },
      error: null,
    });
    mockDeps.fetchProfile.mockResolvedValue(createMockProfileData());
    mockDeps.getCurrentState.mockReturnValue({ user: null, isGuest: false });

    const result = await authActions.register(
      mockDeps,
      'New User',
      'newuser@example.com',
      'SecurePassword123!'
    );

    expect(result.success).toBe(true);
    expect(migrateGuestTournaments).not.toHaveBeenCalled();
    expect(result.wasMigrated).toBe(false);
  });
});
