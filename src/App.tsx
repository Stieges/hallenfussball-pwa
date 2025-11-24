import React, { useState } from 'react';
import { Tournament } from './types/tournament';
import { useTournaments } from './hooks/useTournaments';
import { theme } from './styles/theme';

function App() {
  const { tournaments, loading, saveTournament, deleteTournament } = useTournaments();
  const [screen, setScreen] = useState<'list' | 'create'>('list');

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

  return (
    <div
      style={{
        minHeight: '100vh',
        background: theme.colors.background,
        color: theme.colors.text.primary,
        fontFamily: theme.fonts.body,
      }}
    >
      {screen === 'list' && (
        <div style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '32px',
            }}
          >
            <h1
              style={{
                fontFamily: theme.fonts.heading,
                fontSize: theme.fontSizes.xxxl,
                margin: 0,
                background: theme.gradients.primary,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              HALLENFUSSBALL PWA
            </h1>
            <button
              onClick={() => setScreen('create')}
              style={{
                padding: `${theme.spacing.md} ${theme.spacing.xl}`,
                background: theme.gradients.primary,
                border: 'none',
                borderRadius: theme.borderRadius.md,
                color: theme.colors.background,
                fontSize: theme.fontSizes.md,
                fontWeight: theme.fontWeights.bold,
                cursor: 'pointer',
              }}
            >
              + Neues Turnier
            </button>
          </div>

          {tournaments.length === 0 ? (
            <div
              style={{
                padding: '60px 20px',
                textAlign: 'center',
                background: theme.colors.surface,
                borderRadius: theme.borderRadius.lg,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚽</div>
              <h2 style={{ fontSize: theme.fontSizes.xl, marginBottom: '8px' }}>
                Noch keine Turniere
              </h2>
              <p style={{ color: theme.colors.text.secondary }}>
                Erstelle dein erstes Turnier mit dem Button oben
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {tournaments.map((tournament) => (
                <div
                  key={tournament.id}
                  style={{
                    padding: '24px',
                    background: theme.gradients.card,
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.borderRadius.lg,
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <h3 style={{ margin: '0 0 12px 0', fontSize: theme.fontSizes.lg }}>
                    {tournament.title}
                  </h3>
                  <div style={{ fontSize: theme.fontSizes.sm, color: theme.colors.text.secondary }}>
                    <div>📅 {tournament.date}</div>
                    <div>📍 {tournament.location}</div>
                    <div>👥 {tournament.teams.length} Teams</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {screen === 'create' && (
        <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
          <button
            onClick={() => setScreen('list')}
            style={{
              marginBottom: '24px',
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              background: 'transparent',
              border: 'none',
              color: theme.colors.text.secondary,
              fontSize: theme.fontSizes.md,
              cursor: 'pointer',
            }}
          >
            ← Zurück
          </button>
          <h2 style={{ fontSize: theme.fontSizes.xxl, marginBottom: '24px' }}>
            Turnier-Erstellung (In Entwicklung)
          </h2>
          <div
            style={{
              padding: '32px',
              background: theme.colors.surface,
              borderRadius: theme.borderRadius.lg,
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <p style={{ color: theme.colors.text.secondary }}>
              Die einzelnen Steps werden hier eingebunden.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
