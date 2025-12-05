import { useState } from 'react';
import { useTournaments } from './hooks/useTournaments';
import { TournamentCreationScreen } from './screens/TournamentCreationScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { TournamentManagementScreen } from './screens/TournamentManagementScreen';
import { Tournament } from './types/tournament';
import { theme } from './styles/theme';

function App() {
  const { tournaments, loading, saveTournament, deleteTournament } = useTournaments();
  const [screen, setScreen] = useState<'dashboard' | 'create' | 'view'>('dashboard');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

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
    </div>
  );
}

export default App;
