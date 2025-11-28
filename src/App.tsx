import { useState } from 'react';
import { useTournaments } from './hooks/useTournaments';
import { TournamentCreationScreen } from './screens/TournamentCreationScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { TournamentManagementScreen } from './screens/TournamentManagementScreen';
import { Tournament } from './types/tournament';
import { theme } from './styles/theme';

function App() {
  const { tournaments, loading, saveTournament } = useTournaments();
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
    setScreen('view');
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
        />
      )}

      {screen === 'create' && (
        <TournamentCreationScreen
          onBack={() => setScreen('dashboard')}
          onSave={async (tournament) => {
            await saveTournament(tournament);
            // Small delay to ensure state updates propagate
            await new Promise(resolve => setTimeout(resolve, 200));
            setScreen('dashboard');
          }}
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
