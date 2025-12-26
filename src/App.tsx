import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useTournaments } from './hooks/useTournaments';
import { Tournament, TournamentStatus } from './types/tournament';
import { colors, fontFamilies } from './design-tokens';
import { ToastProvider, useToast } from './components/ui/Toast';
import { StorageWarningBanner } from './components/StorageWarningBanner';
import { OfflineBanner } from './components/OfflineBanner';

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
      minHeight: '100vh',
      background: colors.background,
      color: colors.textPrimary,
    }}
  >
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          width: 40,
          height: 40,
          border: `3px solid ${colors.border}`,
          borderTopColor: colors.primary,
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

type ScreenType = 'dashboard' | 'create' | 'view' | 'public';

function AppContent() {
  const { showError } = useToast();
  const { tournaments, loading, saveTournament, deleteTournament } = useTournaments();
  const [screen, setScreen] = useState<ScreenType>('dashboard');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [publicTournamentId, setPublicTournamentId] = useState<string | null>(null);
  const [quickEditMode, setQuickEditMode] = useState(false); // Für schnelles Bearbeiten & Zurück
  const originalStatusRef = useRef<TournamentStatus | null>(null); // Original-Status vor Wizard-Edit

  // Parse URL on mount to detect public tournament view
  useEffect(() => {
    const path = window.location.pathname;
    const publicMatch = path.match(/^\/public\/([a-zA-Z0-9-]+)$/);

    if (publicMatch) {
      const tournamentId = publicMatch[1];
      setPublicTournamentId(tournamentId);
      setScreen('public');
    }
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: colors.background,
          color: colors.textPrimary,
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

  const handleDeleteTournament = async (id: string, title: string) => {
    const confirmed = window.confirm(
      `Möchtest du das Turnier "${title}" wirklich löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden.`
    );

    if (confirmed) {
      try {
        await deleteTournament(id);
        console.log(`[App] Tournament ${id} deleted successfully`);
      } catch (error) {
        console.error('[App] Failed to delete tournament:', error);
        showError('Fehler beim Löschen des Turniers. Bitte versuche es erneut.');
      }
    }
  };

  const handleImportTournament = async (tournament: Tournament) => {
    try {
      const hasMatches = tournament.matches && tournament.matches.length > 0;

      if (hasMatches) {
        // Complete import → Just save and stay in dashboard
        await saveTournament(tournament);
        console.log(`[App] Tournament "${tournament.title}" imported (complete) - staying in dashboard`);
        // Dashboard will auto-refresh via useTournaments hook
      } else {
        // Partial import → Open wizard at Step 2 to generate schedule
        const tournamentWithStep = {
          ...tournament,
          lastVisitedStep: 2, // Go to Mode/System step
        };
        await saveTournament(tournamentWithStep);
        console.log(`[App] Tournament "${tournament.title}" imported (teams only) - opening wizard`);
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
      console.log(`[App] Tournament "${tournament.title}" opened in wizard at step ${targetStep || 1} (original status: ${originalStatusRef.current})`);

      // Enable quick edit mode and navigate to create screen
      setQuickEditMode(true);
      setSelectedTournament(tournamentToEdit);
      setScreen('create');
    } catch (error) {
      console.error('[App] Failed to open tournament in wizard:', error);
      showError('Fehler beim Öffnen des Turniers im Wizard. Bitte versuche es erneut.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.background,
        color: colors.textPrimary,
        fontFamily: fontFamilies.body,
      }}
    >
      <Suspense fallback={<ScreenLoader />}>
        {screen === 'dashboard' && (
          <DashboardScreen
            tournaments={tournaments}
            onCreateNew={() => setScreen('create')}
            onTournamentClick={handleTournamentClick}
            onDeleteTournament={(id, title) => void handleDeleteTournament(id, title)}
            onImportTournament={(tournament) => void handleImportTournament(tournament)}
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
                  .then(() => console.log(`[App] Tournament status restored to "${originalStatusRef.current}"`))
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
            existingTournament={selectedTournament || undefined}
            quickEditMode={quickEditMode}
          />
        )}

        {screen === 'view' && selectedTournament && (
          <TournamentManagementScreen
            tournamentId={selectedTournament.id}
            onBack={() => setScreen('dashboard')}
            onEditInWizard={(tournament, step) => void handleEditInWizard(tournament, step)}
          />
        )}

        {screen === 'public' && publicTournamentId && (
          <PublicTournamentViewScreen tournamentId={publicTournamentId} />
        )}
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <StorageWarningBanner />
      <OfflineBanner />
      <AppContent />
    </ToastProvider>
  );
}

export default App;
