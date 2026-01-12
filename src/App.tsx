import { useState, useEffect, useRef, lazy, Suspense, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ScrollToTop } from './components/ScrollToTop';
import { useTournaments } from './hooks/useTournaments';
import { Tournament, TournamentStatus } from './types/tournament';
import { generateTournamentId, generateUniqueId } from './utils/idGenerator';
import { cssVars } from './design-tokens';
import { ToastProvider, useToast } from './components/ui/Toast';
import { ConfirmDialog, useConfirmDialog } from './components/ui/ConfirmDialog';
import { StorageWarningBanner } from './components/StorageWarningBanner';
import { OfflineBanner } from './components/OfflineBanner';
import { useSyncOnReconnect } from './hooks/useSyncOnReconnect';
import { AuthProvider } from './features/auth/context/AuthContext';
import { useAuth } from './features/auth/hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import {
  GuestBanner,
  LoginScreen,
  RegisterScreen,
  UserProfileScreen,
  InviteAcceptScreen,
  AuthCallback,
  SetPasswordScreen,
} from './features/auth/components';
import { Footer } from './components/layout';

// Lazy load screens for better initial load performance
const DashboardScreen = lazy(() =>
  import('./screens/DashboardScreen').then(m => ({ default: m.DashboardScreen }))
);
const TournamentCreationScreen = lazy(() =>
  import('./screens/TournamentCreationScreen').then(m => ({ default: m.TournamentCreationScreen }))
);
const TournamentManagementScreen = lazy(() =>
  import('./screens/TournamentManagementScreen').then(m => ({ default: m.TournamentManagementScreen }))
);
const PublicTournamentViewScreen = lazy(() =>
  import('./screens/PublicTournamentViewScreen').then(m => ({ default: m.PublicTournamentViewScreen }))
);
const LiveViewScreen = lazy(() =>
  import('./screens/LiveViewScreen').then(m => ({ default: m.LiveViewScreen }))
);
// NOTE: PublicLiveViewScreen removed - LiveViewScreen handles /live/:code
const ImpressumScreen = lazy(() =>
  import('./screens/ImpressumScreen').then(m => ({ default: m.ImpressumScreen }))
);
const DatenschutzScreen = lazy(() =>
  import('./screens/DatenschutzScreen').then(m => ({ default: m.DatenschutzScreen }))
);
const SettingsScreen = lazy(() =>
  import('./screens/SettingsScreen').then(m => ({ default: m.SettingsScreen }))
);

// Local Test Screen (DEV only)
const LocalTestScreen = lazy(() =>
  import('./screens/LocalTestScreen').then(m => ({ default: m.LocalTestScreen }))
);

// MON-KONF-01: Monitor Display für TVs/Beamer
const MonitorDisplayPage = lazy(() =>
  import('./features/monitor-display').then(m => ({ default: m.MonitorDisplayPage }))
);

// Tournament Admin Center
const TournamentAdminCenter = lazy(() =>
  import('./features/tournament-admin').then(m => ({ default: m.TournamentAdminCenter }))
);

// Loading fallback component
const ScreenLoader = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 'var(--min-h-screen)',
      background: cssVars.colors.background,
      color: cssVars.colors.textPrimary,
    }}
  >
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          width: 40,
          height: 40,
          border: `3px solid ${cssVars.colors.border}`,
          borderTopColor: cssVars.colors.primary,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px',
        }}
      />
      <div>Lade...</div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  </div>
);

type ScreenType = 'dashboard' | 'create' | 'view' | 'public' | 'live' | 'login' | 'register' | 'profile' | 'settings' | 'invite' | 'impressum' | 'datenschutz' | 'monitor-display' | 'auth-callback' | 'set-password' | 'local-test';

function AppContent() {
  const { showError } = useToast();
  const { isGuest } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if current path is a dashboard path
  const isDashboardPath = ['/', '/archiv', '/papierkorb'].includes(location.pathname);

  // Check if current path is an admin center path (e.g., /tournament/:id/admin or /tournament/:id/admin/:category)
  const adminMatch = location.pathname.match(/^\/tournament\/([a-zA-Z0-9-]+)\/admin(?:\/([a-z-]+))?$/);
  const isAdminPath = !!adminMatch;
  const adminTournamentId = adminMatch?.[1] ?? null;
  const adminCategory = adminMatch?.[2];

  // Check if current path is a tournament path (e.g., /tournament/:id or /tournament/:id/:tab)
  const tournamentMatch = location.pathname.match(/^\/tournament\/([a-zA-Z0-9-]+)(?:\/([a-z]+))?$/);
  const isTournamentPath = !!tournamentMatch && !location.pathname.includes('/new') && !location.pathname.endsWith('/edit') && !isAdminPath;
  const tournamentIdFromUrl = tournamentMatch?.[1] ?? null;

  // Check if current path is a public live view path (/live/:shareCode)
  const publicLiveMatch = location.pathname.match(/^\/live\/([A-Za-z0-9]+)$/);
  const isPublicLivePath = !!publicLiveMatch;

  // Check if current path is a monitor display path (/display/:tournamentId/:monitorId)
  const monitorDisplayMatch = location.pathname.match(/^\/display\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)$/);
  const isMonitorDisplayPath = !!monitorDisplayMatch;
  const monitorDisplayParamsFromUrl = monitorDisplayMatch
    ? { tournamentId: monitorDisplayMatch[1], monitorId: monitorDisplayMatch[2] }
    : null;

  // Check if current path is a wizard path (/tournament/new or /tournament/:id/edit)
  const isNewWizardPath = location.pathname === '/tournament/new';
  const editWizardMatch = location.pathname.match(/^\/tournament\/([a-zA-Z0-9-]+)\/edit$/);
  const isEditWizardPath = !!editWizardMatch;
  const isWizardPath = isNewWizardPath || isEditWizardPath;
  const editingTournamentId = editWizardMatch?.[1] ?? null;
  const {
    tournaments,
    loading,
    saveTournament,
    deleteTournament: _deleteTournament, // Legacy - use softDeleteTournament instead
    softDeleteTournament,
    restoreTournament,
    permanentDeleteTournament,
  } = useTournaments();

  // ============================================================================
  // CONFIRM DIALOG HOOKS (must be called unconditionally before any returns)
  // ============================================================================

  // Soft Delete Confirmation (move to trash)
  const softDeleteDialog = useConfirmDialog({
    title: 'Turnier löschen?',
    message: 'Das Turnier wird in den Papierkorb verschoben und kann 30 Tage lang wiederhergestellt werden.',
    variant: 'warning',
    confirmText: 'In Papierkorb',
    cancelText: 'Abbrechen',
  });

  // Permanent Delete Confirmation
  const permanentDeleteDialog = useConfirmDialog({
    title: 'Endgültig löschen?',
    message: 'Das Turnier wird unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
    variant: 'danger',
    confirmText: 'Endgültig löschen',
    cancelText: 'Abbrechen',
  });

  // ============================================================================
  // SOFT DELETE HANDLERS (with Confirm Dialogs)
  // ============================================================================

  const handleSoftDelete = useCallback(async (id: string, title: string) => {
    const confirmed = await softDeleteDialog.confirm({
      message: `Das Turnier "${title}" wird in den Papierkorb verschoben und kann 30 Tage lang wiederhergestellt werden.`,
    });

    if (confirmed) {
      try {
        await softDeleteTournament(id);
      } catch (error) {
        console.error('[App] Failed to soft delete tournament:', error);
        showError('Fehler beim Löschen des Turniers. Bitte versuche es erneut.');
      }
    }
  }, [softDeleteDialog, softDeleteTournament, showError]);

  const handleRestore = useCallback(async (id: string, title: string) => {
    try {
      await restoreTournament(id);
      // Optionally show success toast
    } catch (error) {
      console.error('[App] Failed to restore tournament:', error);
      showError(`Fehler beim Wiederherstellen von "${title}". Bitte versuche es erneut.`);
    }
  }, [restoreTournament, showError]);

  const handlePermanentDelete = useCallback(async (id: string, title: string) => {
    const confirmed = await permanentDeleteDialog.confirm({
      message: `Das Turnier "${title}" wird unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`,
    });

    if (confirmed) {
      try {
        await permanentDeleteTournament(id);
      } catch (error) {
        console.error('[App] Failed to permanently delete tournament:', error);
        showError('Fehler beim Löschen des Turniers. Bitte versuche es erneut.');
      }
    }
  }, [permanentDeleteDialog, permanentDeleteTournament, showError]);
  const [screen, setScreen] = useState<ScreenType>('dashboard');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [publicTournamentId, setPublicTournamentId] = useState<string | null>(null);
  const [liveShareCode, setLiveShareCode] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [quickEditMode, setQuickEditMode] = useState(false); // Für schnelles Bearbeiten & Zurück
  const originalStatusRef = useRef<TournamentStatus | null>(null); // Original-Status vor Wizard-Edit

  // MON-KONF-01: Monitor Display Route params (now using URL-based detection above)
  // Removed monitorDisplayParams state in favor of monitorDisplayParamsFromUrl

  // Parse URL on mount to detect public tournament view, invite, or monitor display
  // IMPORTANT: Use location.pathname from useLocation() hook, NOT window.location.pathname
  // because HashRouter puts routes in the hash fragment, not pathname
  useEffect(() => {
    const path = location.pathname; // Use React Router's parsed pathname
    const search = location.search; // Use React Router's parsed search params
    const publicMatch = path.match(/^\/public\/([a-zA-Z0-9-]+)$/);
    const liveMatch = path.match(/^\/live\/([A-Z0-9]{6})$/i);
    const inviteMatch = path.match(/^\/invite$/);
    // MON-KONF-01: Monitor Display route /display/:tournamentId/:monitorId
    const displayMatch = path.match(/^\/display\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)$/);

    if (displayMatch) {
      // Monitor Display route (for TVs/Beamer)
      // Note: Using URL-based detection (monitorDisplayParamsFromUrl) for rendering
      setScreen('monitor-display');
    } else if (liveMatch) {
      // Live View via share code (e.g., /live/ABC123)
      setLiveShareCode(liveMatch[1].toUpperCase());
      setScreen('live');
    } else if (publicMatch) {
      setPublicTournamentId(publicMatch[1]);
      setScreen('public');
    } else if (inviteMatch) {
      const params = new URLSearchParams(search);
      const token = params.get('token');
      if (token) {
        setInviteToken(token);
        setScreen('invite');
      }
    } else if (path === '/auth/callback') {
      // Handle OAuth/Magic Link callback
      setScreen('auth-callback');
    } else if (path === '/test-live') {
      // Local test screen (DEV only)
      setScreen('local-test');
    } else if (path === '/settings') {
      setScreen('settings');
    } else if (path === '/profile') {
      setScreen('profile');
    } else if (path === '/register') {
      setScreen('register');
    } else if (path === '/login') {
      setScreen('login');
    } else if (path === '/set-password') {
      setScreen('set-password');
    } else if (['/', '/archiv', '/papierkorb'].includes(path)) {
      setScreen('dashboard');
    }
  }, [location.pathname, location.search]); // Depend on location to react to URL changes

  // Don't block public/display screens with global loading state
  // These screens have their own data loading logic
  // IMPORTANT: Use URL-based detection (defined above) to avoid timing issues with state
  const isPublicScreenByPath = isMonitorDisplayPath || isPublicLivePath || location.pathname.startsWith('/public/') || location.pathname === '/test-live';

  if (loading && !isPublicScreenByPath) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 'var(--min-h-screen)',
          background: cssVars.colors.background,
          color: cssVars.colors.textPrimary,
        }}
      >
        <div>Lade Turniere...</div>
      </div>
    );
  }

  const handleTournamentClick = (tournament: Tournament) => {
    // If tournament is a draft, open in edit mode via URL
    if (tournament.status === 'draft') {
      void navigate(`/tournament/${tournament.id}/edit`);
    } else {
      // Published tournaments open in view/management mode via URL
      void navigate(`/tournament/${tournament.id}`);
    }
  };

  // Legacy delete handler (for backwards compatibility)
  const handleDeleteTournament = async (id: string, title: string) => {
    await handleSoftDelete(id, title);
  };

  const handleImportTournament = async (tournament: Tournament) => {
    try {
      const hasMatches = tournament.matches.length > 0;

      if (hasMatches) {
        // Complete import → Set status to 'published' (ready to use)
        const completeTournament: Tournament = {
          ...tournament,
          status: 'published', // Complete imports are ready to use
        };
        await saveTournament(completeTournament);
        // Dashboard will auto-refresh via useTournaments hook
      } else {
        // Partial import → Open wizard at Step 2 to generate schedule
        const tournamentWithStep = {
          ...tournament,
          lastVisitedStep: 2, // Go to Mode/System step
        };
        await saveTournament(tournamentWithStep);
        // Navigate to wizard with step 2 via URL
        void navigate(`/tournament/${tournament.id}/edit?step=2`);
      }
    } catch (error) {
      console.error('[App] Failed to import tournament:', error);
      showError('Fehler beim Importieren des Turniers. Bitte versuche es erneut.');
    }
  };

  // Handler for copying/duplicating a tournament
  const handleCopyTournament = async (tournament: Tournament) => {
    try {
      const now = new Date().toISOString();
      const newId = generateTournamentId();

      // Create a deep copy with new IDs
      const copiedTournament: Tournament = {
        ...tournament,
        id: newId,
        title: `${tournament.title} (Kopie)`,
        status: 'draft' as TournamentStatus,
        createdAt: now,
        updatedAt: now,
        lastVisitedStep: 1, // Start at Step 1 so user can review
        // Generate new IDs for teams
        teams: tournament.teams.map(team => ({
          ...team,
          id: generateUniqueId('team'),
        })),
        // Generate new IDs for matches and update team references
        matches: tournament.matches.map(match => {
          const newMatchId = generateUniqueId('match');
          return {
            ...match,
            id: newMatchId,
            matchStatus: 'scheduled' as const,
            scoreA: 0,
            scoreB: 0,
            events: [],
          };
        }),
        // Reset soft-delete state
        deletedAt: undefined,
      };

      // Update match team IDs to use new team IDs
      const teamIdMap = new Map<string, string>();
      tournament.teams.forEach((oldTeam, index) => {
        teamIdMap.set(oldTeam.id, copiedTournament.teams[index]?.id ?? oldTeam.id);
      });

      copiedTournament.matches = copiedTournament.matches.map((match, index) => {
        const originalMatch = tournament.matches[index];
        const newTeamA = teamIdMap.get(originalMatch.teamA) ?? match.teamA;
        const newTeamB = teamIdMap.get(originalMatch.teamB) ?? match.teamB;
        return {
          ...match,
          teamA: newTeamA,
          teamB: newTeamB,
        };
      });

      await saveTournament(copiedTournament);
      // Stay on dashboard - user can see the new tournament
    } catch (error) {
      console.error('[App] Failed to copy tournament:', error);
      showError('Fehler beim Kopieren des Turniers. Bitte versuche es erneut.');
    }
  };

  // Handler for editing a published tournament in the wizard
  const handleEditInWizard = async (tournament: Tournament, targetStep?: number) => {
    try {
      // "Erweiterte Bearbeitung" is only available for published tournaments
      // SettingsTab already sets status to 'draft', so we always restore to 'published'
      originalStatusRef.current = 'published';

      // Update lastVisitedStep if targetStep is provided
      const tournamentToEdit = targetStep
        ? { ...tournament, lastVisitedStep: targetStep }
        : tournament;

      // Save the tournament with draft status (already set by SettingsTab)
      await saveTournament(tournamentToEdit);

      // Enable quick edit mode and navigate to wizard via URL
      setQuickEditMode(true);
      setSelectedTournament(tournamentToEdit);
      const stepParam = targetStep ? `?step=${targetStep}` : '';
      void navigate(`/tournament/${tournament.id}/edit${stepParam}`);
    } catch (error) {
      console.error('[App] Failed to open tournament in wizard:', error);
      showError('Fehler beim Öffnen des Turniers im Wizard. Bitte versuche es erneut.');
    }
  };

  // Helper to navigate to tournament after accepting invite
  const handleInviteAccepted = (tournamentId: string) => {
    setInviteToken(null);
    // Navigate to the tournament
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (tournament) {
      setSelectedTournament(tournament);
      setScreen('view');
    } else {
      void navigate('/');
    }
  };

  return (
    <div
      style={{
        minHeight: 'var(--min-h-screen)',
        background: cssVars.colors.background,
        color: cssVars.colors.textPrimary,
        fontFamily: cssVars.fontFamilies.body,
      }}
    >
      {/* Scroll to top on route changes */}
      <ScrollToTop />

      {/* Guest Banner - shows registration prompt for guests */}
      {isGuest && isDashboardPath && (
        <GuestBanner
          dismissible
          onDismiss={() => { /* stays dismissed */ }}
          onRegisterClick={() => setScreen('register')}
        />
      )}

      <Suspense fallback={<ScreenLoader />}>
        {/* Auth Screens */}
        {/* Auth Screens */}
        {screen === 'login' && (
          <LoginScreen
            onSuccess={() => void navigate('/')}
            onNavigateToRegister={() => setScreen('register')}
            onBack={() => {
              setScreen('dashboard');
              void navigate('/');
            }}
            onContinueAsGuest={() => {
              setScreen('dashboard');
              void navigate('/');
            }}
          />
        )}

        {screen === 'register' && (
          <RegisterScreen
            onSuccess={() => void navigate('/')}
            onNavigateToLogin={() => setScreen('login')}
            onBack={() => {
              setScreen('dashboard');
              void navigate('/');
            }}
          />
        )}

        {screen === 'auth-callback' && <AuthCallback />}

        {screen === 'set-password' && <SetPasswordScreen />}

        {screen === 'profile' && (
          <UserProfileScreen
            onBack={() => void navigate('/')}
            onOpenSettings={() => {
              setScreen('settings');
              void navigate('/settings');
            }}
          />
        )}

        {screen === 'settings' && (
          <SettingsScreen
            onBack={() => {
              // Use navigate(-1) if we have history, or fallback to profile
              // For now, explicit navigation to profile is safer for this hub-and-spoke model
              setScreen('profile');
              void navigate('/profile');
            }}
            onNavigateToImpressum={() => setScreen('impressum')}
            onNavigateToDatenschutz={() => setScreen('datenschutz')}
          />
        )}

        {screen === 'invite' && inviteToken && (
          <InviteAcceptScreen
            token={inviteToken}
            onAccepted={handleInviteAccepted}
            onNeedLogin={() => setScreen('login')}
            onCancel={() => {
              setInviteToken(null);
              void navigate('/');
            }}
          />
        )}

        {/* Main App Screens */}
        {isDashboardPath && (
          <DashboardScreen
            tournaments={tournaments}
            onCreateNew={() => void navigate('/tournament/new')}
            onTournamentClick={handleTournamentClick}
            onDeleteTournament={(id, title) => void handleDeleteTournament(id, title)}
            onImportTournament={(tournament) => void handleImportTournament(tournament)}
            onSoftDelete={(id, title) => void handleSoftDelete(id, title)}
            onRestore={(id, title) => void handleRestore(id, title)}
            onPermanentDelete={(id, title) => void handlePermanentDelete(id, title)}
            onCopyTournament={(tournament) => void handleCopyTournament(tournament)}
            onNavigateToLogin={() => setScreen('login')}
            onNavigateToRegister={() => setScreen('register')}
            onNavigateToProfile={() => setScreen('profile')}
            onNavigateToSettings={() => setScreen('settings')}
          />
        )}

        {(isWizardPath || screen === 'create') && (
          <TournamentCreationScreen
            onBack={() => {
              // If in quickEditMode and user cancels, restore original status
              if (quickEditMode && selectedTournament && originalStatusRef.current) {
                const restoredTournament: Tournament = {
                  ...selectedTournament,
                  status: originalStatusRef.current,
                  updatedAt: new Date().toISOString(),
                };
                // Fire-and-forget: Don't await, just trigger the save
                saveTournament(restoredTournament)
                  .catch((err) => console.error('[App] Failed to restore tournament status:', err));
              }
              originalStatusRef.current = null; // Reset ref
              setSelectedTournament(null); // Clear selection when going back
              setQuickEditMode(false); // Reset quick edit mode
              void navigate('/');
            }}
            onSave={async (tournament) => {
              await saveTournament(tournament);
              originalStatusRef.current = null; // Reset ref after successful save
              setSelectedTournament(null); // Clear selection after save
              setQuickEditMode(false); // Reset quick edit mode
              // Small delay to ensure state updates propagate
              await new Promise(resolve => setTimeout(resolve, 200));
              // If published/created, go to tournament dashboard. If draft, go to main dashboard.
              if (tournament.status !== 'draft') {
                void navigate(`/tournament/${tournament.id}`);
              } else {
                void navigate('/');
              }
            }}
            existingTournament={
              selectedTournament ??
              (editingTournamentId ? tournaments.find(t => t.id === editingTournamentId) : undefined)
            }
            quickEditMode={quickEditMode}
            onNavigateToLogin={() => setScreen('login')}
            onNavigateToRegister={() => setScreen('register')}
            onNavigateToProfile={() => setScreen('profile')}
            onNavigateToSettings={() => setScreen('settings')}
          />
        )}

        {/* Tournament Admin Center */}
        {isAdminPath && adminTournamentId && (
          <TournamentAdminCenter
            tournamentId={adminTournamentId}
            initialCategory={adminCategory}
            onBackToTournament={() => void navigate(`/tournament/${adminTournamentId}`)}
          />
        )}

        {isTournamentPath && tournamentIdFromUrl && (
          <TournamentManagementScreen
            tournamentId={tournamentIdFromUrl}
            onBack={() => void navigate('/')}
            onEditInWizard={(tournament, step) => void handleEditInWizard(tournament, step)}
            onNavigateToLogin={() => setScreen('login')}
            onNavigateToRegister={() => setScreen('register')}
            onNavigateToProfile={() => setScreen('profile')}
            onNavigateToSettings={() => setScreen('settings')}
          />
        )}

        {/* NOTE: Public Live View removed - LiveViewScreen handles /live/:code
            PublicLiveViewScreen was causing duplicate rendering with LiveViewScreen */}

        {screen === 'public' && publicTournamentId && (
          <PublicTournamentViewScreen tournamentId={publicTournamentId} />
        )}

        {/* Live View via Share Code (e.g., /live/ABC123) */}
        {screen === 'live' && liveShareCode && (
          <LiveViewScreen shareCode={liveShareCode} />
        )}

        {/* Local Test Screen (DEV only) */}
        {screen === 'local-test' && (
          <LocalTestScreen />
        )}

        {/* MON-KONF-01: Monitor Display (fullscreen for TVs/Beamer) */}
        {/* Use URL-based detection for immediate rendering without waiting for useEffect */}
        {isMonitorDisplayPath && monitorDisplayParamsFromUrl && (
          <MonitorDisplayPage
            tournamentId={monitorDisplayParamsFromUrl.tournamentId}
            monitorId={monitorDisplayParamsFromUrl.monitorId}
            onBack={() => {
              void navigate('/');
            }}
          />
        )}

        {/* Legal Screens */}
        {screen === 'impressum' && (
          <ImpressumScreen onBack={() => {
            setScreen('dashboard');
            void navigate('/');
          }} />
        )}

        {screen === 'datenschutz' && (
          <DatenschutzScreen
            onBack={() => {
              setScreen('dashboard');
              void navigate('/');
            }}
            onOpenCookieSettings={() => {
              // TODO: Integrate with Cookie Banner when implemented
              // Cookie banner will be added in a future commit
            }}
          />
        )}
      </Suspense>

      {/* Footer - shown on main screens (not on public/invite flows) */}
      {(isDashboardPath || isTournamentPath || isAdminPath || isWizardPath || ['create', 'profile', 'settings', 'login', 'register'].includes(screen)) && (
        <Footer
          onNavigate={(target) => {
            if (target === 'impressum') { setScreen('impressum'); }
            if (target === 'datenschutz') { setScreen('datenschutz'); }
          }}
          onOpenCookieSettings={() => {
            // TODO: Integrate with Cookie Banner when implemented
            // Cookie banner will be added in a future commit
          }}
        />
      )}

      {/* Confirm Dialogs */}
      <ConfirmDialog {...softDeleteDialog.dialogProps} />
      <ConfirmDialog {...permanentDeleteDialog.dialogProps} />
    </div>
  );
}

// Providers
import { RepositoryProvider } from './core/contexts/RepositoryContext';

/**
 * SyncManager - Background component that syncs local data to cloud
 * Triggers sync when:
 * - User reconnects after being offline
 * - App starts while online
 */
function SyncManager(): null {
  useSyncOnReconnect();
  return null;
}

function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <AuthProvider>
        <RepositoryProvider>
          <SyncManager />
          <ToastProvider>
            <StorageWarningBanner />
            <OfflineBanner />
            <AppContent />
          </ToastProvider>
        </RepositoryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
