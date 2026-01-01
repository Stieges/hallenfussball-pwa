import { useState, useEffect, useRef, lazy, Suspense, useCallback } from 'react';
import { useTournaments } from './hooks/useTournaments';
import { Tournament, TournamentStatus } from './types/tournament';
import { cssVars } from './design-tokens';
import { ToastProvider, useToast } from './components/ui/Toast';
import { ConfirmDialog, useConfirmDialog } from './components/ui/ConfirmDialog';
import { StorageWarningBanner } from './components/StorageWarningBanner';
import { OfflineBanner } from './components/OfflineBanner';
import { AuthProvider } from './features/auth/context/AuthContext';
import { useAuth } from './features/auth/hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import {
  GuestBanner,
  LoginScreen,
  RegisterScreen,
  UserProfileScreen,
  InviteAcceptScreen,
} from './features/auth/components';

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

type ScreenType = 'dashboard' | 'create' | 'view' | 'public' | 'login' | 'register' | 'profile' | 'invite';

function AppContent() {
  const { showError } = useToast();
  const { isGuest } = useAuth();
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
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [quickEditMode, setQuickEditMode] = useState(false); // Für schnelles Bearbeiten & Zurück
  const originalStatusRef = useRef<TournamentStatus | null>(null); // Original-Status vor Wizard-Edit

  // Parse URL on mount to detect public tournament view or invite
  useEffect(() => {
    const path = window.location.pathname;
    const publicMatch = path.match(/^\/public\/([a-zA-Z0-9-]+)$/);
    const inviteMatch = path.match(/^\/invite$/);

    if (publicMatch) {
      const tournamentId = publicMatch[1];
      setPublicTournamentId(tournamentId);
      setScreen('public');
    } else if (inviteMatch) {
      // Parse invite token from URL params
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        setInviteToken(token);
        setScreen('invite');
      }
    }
  }, []);

  if (loading) {
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
    setSelectedTournament(tournament);

    // If tournament is a draft, open in edit mode
    if (tournament.status === 'draft') {
      setScreen('create');
    } else {
      // Published tournaments open in view/management mode
      setScreen('view');
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
        // Complete import → Just save and stay in dashboard
        await saveTournament(tournament);
        // Dashboard will auto-refresh via useTournaments hook
      } else {
        // Partial import → Open wizard at Step 2 to generate schedule
        const tournamentWithStep = {
          ...tournament,
          lastVisitedStep: 2, // Go to Mode/System step
        };
        await saveTournament(tournamentWithStep);
        setSelectedTournament(tournamentWithStep);
        setScreen('create');
      }
    } catch (error) {
      console.error('[App] Failed to import tournament:', error);
      showError('Fehler beim Importieren des Turniers. Bitte versuche es erneut.');
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

      // Enable quick edit mode and navigate to create screen
      setQuickEditMode(true);
      setSelectedTournament(tournamentToEdit);
      setScreen('create');
    } catch (error) {
      console.error('[App] Failed to open tournament in wizard:', error);
      showError('Fehler beim Öffnen des Turniers im Wizard. Bitte versuche es erneut.');
    }
  };

  // Helper to navigate to tournament after accepting invite
  const handleInviteAccepted = (tournamentId: string) => {
    // Clear URL params
    window.history.replaceState({}, '', '/');
    setInviteToken(null);
    // Navigate to the tournament
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (tournament) {
      setSelectedTournament(tournament);
      setScreen('view');
    } else {
      setScreen('dashboard');
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
      {/* Guest Banner - shows registration prompt for guests */}
      {isGuest && screen === 'dashboard' && (
        <GuestBanner
          dismissible
          onDismiss={() => { /* stays dismissed */ }}
          onRegisterClick={() => setScreen('register')}
        />
      )}

      <Suspense fallback={<ScreenLoader />}>
        {/* Auth Screens */}
        {screen === 'login' && (
          <LoginScreen
            onSuccess={() => setScreen('dashboard')}
            onNavigateToRegister={() => setScreen('register')}
            onBack={() => setScreen('dashboard')}
            onContinueAsGuest={() => setScreen('dashboard')}
          />
        )}

        {screen === 'register' && (
          <RegisterScreen
            onSuccess={() => setScreen('dashboard')}
            onNavigateToLogin={() => setScreen('login')}
            onBack={() => setScreen('dashboard')}
          />
        )}

        {screen === 'profile' && (
          <UserProfileScreen
            onBack={() => setScreen('dashboard')}
          />
        )}

        {screen === 'invite' && inviteToken && (
          <InviteAcceptScreen
            token={inviteToken}
            onAccepted={handleInviteAccepted}
            onNeedLogin={() => setScreen('login')}
            onCancel={() => {
              window.history.replaceState({}, '', '/');
              setInviteToken(null);
              setScreen('dashboard');
            }}
          />
        )}

        {/* Main App Screens */}
        {screen === 'dashboard' && (
          <DashboardScreen
            tournaments={tournaments}
            onCreateNew={() => setScreen('create')}
            onTournamentClick={handleTournamentClick}
            onDeleteTournament={(id, title) => void handleDeleteTournament(id, title)}
            onImportTournament={(tournament) => void handleImportTournament(tournament)}
            onSoftDelete={(id, title) => void handleSoftDelete(id, title)}
            onRestore={(id, title) => void handleRestore(id, title)}
            onPermanentDelete={(id, title) => void handlePermanentDelete(id, title)}
            onNavigateToLogin={() => setScreen('login')}
            onNavigateToRegister={() => setScreen('register')}
            onNavigateToProfile={() => setScreen('profile')}
          />
        )}

        {screen === 'create' && (
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
              setScreen('dashboard');
            }}
            onSave={async (tournament) => {
              await saveTournament(tournament);
              originalStatusRef.current = null; // Reset ref after successful save
              setSelectedTournament(null); // Clear selection after save
              setQuickEditMode(false); // Reset quick edit mode
              // Small delay to ensure state updates propagate
              await new Promise(resolve => setTimeout(resolve, 200));
              setScreen('dashboard');
            }}
            existingTournament={selectedTournament ?? undefined}
            quickEditMode={quickEditMode}
            onNavigateToLogin={() => setScreen('login')}
            onNavigateToRegister={() => setScreen('register')}
            onNavigateToProfile={() => setScreen('profile')}
          />
        )}

        {screen === 'view' && selectedTournament && (
          <TournamentManagementScreen
            tournamentId={selectedTournament.id}
            onBack={() => setScreen('dashboard')}
            onEditInWizard={(tournament, step) => void handleEditInWizard(tournament, step)}
            onNavigateToLogin={() => setScreen('login')}
            onNavigateToRegister={() => setScreen('register')}
            onNavigateToProfile={() => setScreen('profile')}
          />
        )}

        {screen === 'public' && publicTournamentId && (
          <PublicTournamentViewScreen tournamentId={publicTournamentId} />
        )}
      </Suspense>

      {/* Confirm Dialogs */}
      <ConfirmDialog {...softDeleteDialog.dialogProps} />
      <ConfirmDialog {...permanentDeleteDialog.dialogProps} />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <AuthProvider>
        <ToastProvider>
          <StorageWarningBanner />
          <OfflineBanner />
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
