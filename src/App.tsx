import { useState, useEffect } from 'react';
import { useTournaments } from './hooks/useTournaments';
import { TournamentCreationScreen } from './screens/TournamentCreationScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { TournamentManagementScreen } from './screens/TournamentManagementScreen';
import { PublicTournamentViewScreen } from './screens/PublicTournamentViewScreen';
import { Tournament } from './types/tournament';
import { theme } from './styles/theme';

type ScreenType = 'dashboard' | 'create' | 'view' | 'public';

function App() {
  const { tournaments, loading, saveTournament, deleteTournament } = useTournaments();
  const [screen, setScreen] = useState<ScreenType>('dashboard');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [publicTournamentId, setPublicTournamentId] = useState<string | null>(null);

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
          background: theme.colors.background,
          color: theme.colors.text.primary,
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
        alert('Fehler beim Löschen des Turniers. Bitte versuche es erneut.');
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
      alert('Fehler beim Importieren des Turniers. Bitte versuche es erneut.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: theme.colors.background,
        color: theme.colors.text.primary,
        fontFamily: theme.fonts.body,
      }}
    >
      {screen === 'dashboard' && (
        <DashboardScreen
          tournaments={tournaments}
          onCreateNew={() => setScreen('create')}
          onTournamentClick={handleTournamentClick}
          onDeleteTournament={handleDeleteTournament}
          onImportTournament={handleImportTournament}
        />
      )}

      {screen === 'create' && (
        <TournamentCreationScreen
          onBack={() => {
            setSelectedTournament(null); // Clear selection when going back
            setScreen('dashboard');
          }}
          onSave={async (tournament) => {
            await saveTournament(tournament);
            setSelectedTournament(null); // Clear selection after save
            // Small delay to ensure state updates propagate
            await new Promise(resolve => setTimeout(resolve, 200));
            setScreen('dashboard');
          }}
          existingTournament={selectedTournament || undefined}
        />
      )}

      {screen === 'view' && selectedTournament && (
        <TournamentManagementScreen
          tournamentId={selectedTournament.id}
          onBack={() => setScreen('dashboard')}
        />
      )}

      {screen === 'public' && publicTournamentId && (
        <PublicTournamentViewScreen tournamentId={publicTournamentId} />
      )}
    </div>
  );
}

export default App;
