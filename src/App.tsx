import { useState } from 'react';
import { useTournaments } from './hooks/useTournaments';
import { TournamentCreationScreen } from './screens/TournamentCreationScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { Tournament } from './types/tournament';
import { theme } from './styles/theme';

function App() {
  const { tournaments, loading } = useTournaments();
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
    // TODO: Navigate to tournament view/edit screen
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

      {screen === 'create' && <TournamentCreationScreen onBack={() => setScreen('dashboard')} />}

      {screen === 'view' && selectedTournament && (
        <div style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
          <button
            onClick={() => setScreen('dashboard')}
            style={{
              padding: '12px 24px',
              background: theme.colors.surface,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.md,
              color: theme.colors.text.primary,
              cursor: 'pointer',
              marginBottom: '24px',
            }}
          >
            ← Zurück zum Dashboard
          </button>
          <h2>Tournament View: {selectedTournament.title}</h2>
          <p>TODO: Implement tournament view screen with Spielplan/Live/Bearbeiten buttons</p>
        </div>
      )}
    </div>
  );
}

export default App;
