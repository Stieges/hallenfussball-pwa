/**
 * B-03 (V3) — gemeinsame Mocks und Helfer für die je @OB-Gruppe geteilten Dateien
 * B03.platzhalterListe.obXXX.test.tsx. Aus B03.platzhalterListe.test.tsx herausgelöst,
 * keine Verhaltensänderung. Diese Datei enthält keine Tests (kein ".test." im Namen).
 */
import { vi, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactElement } from 'react';
import type { Tournament } from '../../types/tournament';

// ---------------------------------------------------------------------------
// Mocks (Umgebung der betroffenen Seiten)
// ---------------------------------------------------------------------------

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

// Merge Spur A/B: AuthSection meldet seit A-07c ueber useGuardedLogout ab, der useRepositories() liest
// (Muster wie AuthSection.test.tsx); hier ohne Konto-Queue.
vi.mock('../../core/contexts/RepositoryContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/contexts/RepositoryContext')>()),
  useRepositories: () => ({ tournamentRepository: {} }),
}));

vi.mock('../../lib/sentry', () => ({ reinitializeSentry: vi.fn() }));

vi.mock('../../hooks/useRepository', () => ({
  useRepository: () => ({
    makeTournamentPublic: vi.fn(() => Promise.resolve(null)),
    makeTournamentPrivate: vi.fn(() => Promise.resolve()),
    regenerateShareCode: vi.fn(() => Promise.resolve(null)),
  }),
}));

vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn(), resolvedTheme: 'light' }),
}));

vi.mock('../../features/settings/hooks/useSettings', () => ({
  useSettings: () => ({
    fontSize: 16,
    setFontSize: vi.fn(),
    confirmDelete: true,
    autoSave: true,
    timerSound: true,
    hapticFeedback: true,
    toggleConfirmDelete: vi.fn(),
    toggleAutoSave: vi.fn(),
    toggleTimerSound: vi.fn(),
    toggleHapticFeedback: vi.fn(),
  }),
}));

vi.mock('../../hooks', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useTournaments: () => ({ saveTournament: vi.fn(() => Promise.resolve()) }),
    // F-06 (Fixrunde 1): LiveCockpit rendert den Timer — useMatchSound braucht eine
    // AudioContext-Umgebung, die jsdom nicht liefert (gleiches Muster wie
    // LiveCockpit.readOnly.test.tsx).
    useMatchSound: () => ({
      play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(),
      isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null,
    }),
  };
});

// F-06 (Fixrunde 1): SyncStatusIndicator (LiveCockpit-Header) zieht useSyncStatus direkt
// aus hooks/useSyncStatus — ohne Repository-Context wirft es (gleiches Muster wie
// LiveCockpit.readOnly.test.tsx).
vi.mock('../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(),
    isCloudSyncAvailable: false,
  }),
}));

vi.mock('../../hooks/useTournaments', () => ({
  useTournaments: () => ({
    saveTournament: vi.fn(() => Promise.resolve()),
    deleteTournament: vi.fn(() => Promise.resolve()),
  }),
}));

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));

vi.mock('../../hooks/useTournamentWizard', () => ({
  useTournamentWizard: () => ({
    step: 1,
    formData: { title: 'Hallencup Ost', location: { name: 'Halle Ost' }, teams: [] },
    visitedSteps: new Set([1]),
    stepErrors: {},
    scheduleError: null,
    hasResults: false,
    lastSavedDataRef: { current: '' },
    setStep: vi.fn(),
    setFormData: vi.fn(),
    setScheduleError: vi.fn(),
    updateForm: vi.fn(),
    handleStepChange: vi.fn(),
    handleNavigateToStep: vi.fn(),
    canGoNext: () => true,
    canNavigateToStep: () => true,
    validateStep: () => [],
    addTeam: vi.fn(),
    removeTeam: vi.fn(),
    updateTeam: vi.fn(),
    movePlacementLogic: vi.fn(),
    togglePlacementLogic: vi.fn(),
    reorderPlacementLogic: vi.fn(),
    handleTournamentTypeChange: vi.fn(),
    handleResetTournament: vi.fn(),
    createDraftTournament: vi.fn(),
    saveDraft: vi.fn(() => Promise.resolve({})),
    publishTournament: vi.fn(() => Promise.resolve({})),
  }),
}));

vi.mock('../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 'user-1', email: 'olli@example.org', name: 'Olli Turnierleitung' },
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('../../features/auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({
    myMembership: {
      id: 'm1', userId: 'user-1', tournamentId: 't1', role: 'owner',
      teamIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    },
    members: [],
    isLoading: false,
  }),
}));

// ---------------------------------------------------------------------------
// Textkorpus-Prüfung (@OB-003): Ankündigungen „für später" sind wörtlich verboten
// ---------------------------------------------------------------------------

export const VERBOTENE_ANKUENDIGUNG =
  /\bComing Soon\b|\bkommt bald\b|\bBald\b|folgt später|in einer späteren Version|in Kürze|\bsoon\b|later version/i;

export const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCALE_MARKER = join('i18n', 'locales');

export function walkFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === '__tests__' || name === 'node_modules') { continue; }
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walkFiles(full, out);
    } else if (/\.(ts|tsx|json)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

export function findeAnkuendigungen(language: 'de' | 'en'): string[] {
  const treffer: string[] = [];
  const localeDir = join(SRC_ROOT, 'i18n', 'locales', language);
  for (const file of walkFiles(localeDir)) {
    const text = readFileSync(file, 'utf8');
    const match = VERBOTENE_ANKUENDIGUNG.exec(text);
    if (match) {
      treffer.push(`${file}: ${match[0]}`);
    }
  }
  for (const file of walkFiles(SRC_ROOT)) {
    if (file.includes(LOCALE_MARKER)) { continue; }
    if (!/\.(ts|tsx)$/.test(file)) { continue; }
    const text = readFileSync(file, 'utf8');
    const match = VERBOTENE_ANKUENDIGUNG.exec(text);
    if (match) {
      treffer.push(`${file}: ${match[0]}`);
    }
  }
  return treffer;
}

// ---------------------------------------------------------------------------
// Render-Helfer
// ---------------------------------------------------------------------------

export function makeTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1',
    title: 'Hallencup Ost',
    status: 'published',
    publishedAt: '2026-02-01T10:00:00.000Z',
    location: { name: 'Halle Ost', city: 'Oststadt', street: 'Sportweg 1' },
    teams: [
      { id: 'vfb', name: 'VfB Ufer' },
      { id: 'fc', name: 'FC Nord' },
    ],
    matches: [],
    numberOfFields: 2,
    groupPhaseGameDuration: 12,
    groupPhaseBreakDuration: 2,
    ...overrides,
  } as unknown as Tournament;
}

export function renderInRouter(element: ReactElement) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

/** Kollabierte Abschnitte rendern ihre Kinder nicht – vor der Prüfung öffnen. */
export function oeffneAlleAbschnitte(container: HTMLElement) {
  const toggles = container.querySelectorAll('[role="button"][aria-expanded="false"]');
  for (const toggle of toggles) {
    fireEvent.click(toggle);
  }
}

export function expectAbsent(...patterns: RegExp[]) {
  const body = document.body.textContent ?? '';
  for (const pattern of patterns) {
    expect(body).not.toMatch(pattern);
  }
}

export function expectRendered(container: HTMLElement) {
  expect(container.firstChild).not.toBeNull();
}

export async function renderSettingsScreen() {
  const { SettingsScreen } = await import('../../features/settings/components/SettingsScreen');
  return renderInRouter(<SettingsScreen onBack={vi.fn()} />);
}

export async function renderAdminSidebar() {
  const { AdminSidebar } = await import('../../features/tournament-admin/components/AdminSidebar');
  return renderInRouter(
    <AdminSidebar
      activeCategory="dashboard"
      onNavigate={vi.fn()}
      onBackToTournament={vi.fn()}
    />
  );
}
