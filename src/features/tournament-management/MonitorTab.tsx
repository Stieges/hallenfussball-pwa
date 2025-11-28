/**
 * MonitorTab - Große Zuschauer-Ansicht (Monitor/Display)
 *
 * Features:
 * - Aktueller Spielstand (alle Felder)
 * - Nächstes Spiel
 * - Live-Tabellen
 * - Große, gut lesbare Darstellung für Projektor/TV
 */

import { CSSProperties, useState } from 'react';
import { theme } from '../../styles/theme';
import { Tournament, Standing } from '../../types/tournament';
import { GeneratedSchedule } from '../../lib/scheduleGenerator';

interface MonitorTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  currentStandings: Standing[];
}

export const MonitorTab: React.FC<MonitorTabProps> = ({
  schedule,
  currentStandings,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const containerStyle: CSSProperties = {
    minHeight: '100vh',
    padding: theme.spacing.xxl,
    background: 'radial-gradient(circle at top, #111827 0%, #020617 55%, #000 100%)',
    color: theme.colors.text.primary,
    position: 'relative',
  };

  const contentWrapperStyle: CSSProperties = {
    maxWidth: '1600px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xxl,
  };

  const sectionStyle: CSSProperties = {
    background: 'rgba(15, 23, 42, 0.9)',
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xxl,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadows.lg,
  };

  const sectionTitleStyle: CSSProperties = {
    fontSize: '36px',
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xl,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const placeholderStyle: CSSProperties = {
    fontSize: theme.fontSizes.xl,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    padding: theme.spacing.xxl,
  };

  // Hole alle Matches aus allen Phasen
  const allMatches = schedule.phases.flatMap(phase => phase.matches);

  // Finde aktuelle Spiele (haben Ergebnisse aber sind noch nicht beendet)
  // Für jetzt: Spiele ohne Ergebnis als "bevorstehend", mit Ergebnis als "beendet"
  const currentMatches = allMatches.filter(m =>
    m.scoreA !== undefined && m.scoreB !== undefined &&
    // Hier könnte später ein "status" Feld geprüft werden
    false // Aktuell keine laufenden Spiele, da wir keinen Status haben
  );

  // Finde nächstes Spiel (erstes ohne Ergebnis)
  const nextMatch = allMatches.find(m => m.scoreA === undefined || m.scoreB === undefined);

  const hasGroups = schedule.teams.some((t) => t.group);

  const fullscreenButtonStyle: CSSProperties = {
    position: 'fixed',
    top: theme.spacing.lg,
    right: theme.spacing.lg,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    background: 'rgba(0, 230, 118, 0.15)',
    border: `2px solid ${theme.colors.primary}`,
    borderRadius: theme.borderRadius.md,
    color: theme.colors.primary,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.bold,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    transition: 'all 0.2s',
    zIndex: 1000,
  };

  return (
    <div style={containerStyle}>
      {/* Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        style={fullscreenButtonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0, 230, 118, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(0, 230, 118, 0.15)';
        }}
      >
        {isFullscreen ? '🗙 Vollbild verlassen' : '⛶ Vollbild'}
      </button>

      <div style={contentWrapperStyle}>
        {/* AKTUELLES SPIEL / AKTUELLE SPIELE */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Live Spielstand</h2>
          {currentMatches.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: theme.spacing.xl }}>
              {currentMatches.map((match) => (
                <CurrentMatchCard key={match.id} match={match} />
              ))}
            </div>
          ) : (
            <div style={placeholderStyle}>
              <p>Keine laufenden Spiele</p>
              <p style={{ fontSize: theme.fontSizes.md, marginTop: theme.spacing.md, color: theme.colors.text.secondary }}>
                (Wird angezeigt, sobald ein Spiel gestartet wird)
              </p>
            </div>
          )}
        </section>

        {/* NÄCHSTES SPIEL */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Nächstes Spiel</h2>
          <div style={placeholderStyle}>
            {nextMatch ? (
              <NextMatchCard match={nextMatch} />
            ) : (
              <p>Alle Spiele beendet</p>
            )}
          </div>
        </section>

        {/* LIVE TABELLE(N) */}
        {hasGroups && (
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Tabellen</h2>
            <div style={placeholderStyle}>
              <StandingsDisplay standings={currentStandings} teams={schedule.teams} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface CurrentMatchCardProps {
  match: any;
}

const CurrentMatchCard: React.FC<CurrentMatchCardProps> = ({ match }) => {
  const cardStyle: CSSProperties = {
    background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.2), rgba(0, 176, 255, 0.2))',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xxl,
    border: `3px solid ${theme.colors.primary}`,
    boxShadow: '0 0 30px rgba(0, 230, 118, 0.3)',
    animation: 'pulse 2s ease-in-out infinite',
  };

  const fieldStyle: CSSProperties = {
    fontSize: '18px',
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.accent,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  };

  const matchupStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: '32px',
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.text.primary,
    flex: 1,
  };

  const scoreStyle: CSSProperties = {
    fontSize: '64px',
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.primary,
    fontFamily: theme.fonts.heading,
    minWidth: '80px',
    textAlign: 'center',
  };

  const vsStyle: CSSProperties = {
    fontSize: '24px',
    color: theme.colors.text.secondary,
    padding: `0 ${theme.spacing.md}`,
  };

  const metaStyle: CSSProperties = {
    fontSize: '16px',
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  };

  return (
    <>
      <div style={cardStyle}>
        {match.field && <div style={fieldStyle}>⚽ Feld {match.field}</div>}
        <div style={matchupStyle}>
          <div style={{ ...teamNameStyle, textAlign: 'right' }}>{match.homeTeam}</div>
          <div style={scoreStyle}>{match.scoreA ?? 0}</div>
          <div style={vsStyle}>:</div>
          <div style={scoreStyle}>{match.scoreB ?? 0}</div>
          <div style={{ ...teamNameStyle, textAlign: 'left' }}>{match.awayTeam}</div>
        </div>
        <div style={metaStyle}>
          {match.time} · Spiel {match.matchNumber}
          {match.group && ` · Gruppe ${match.group}`}
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 30px rgba(0, 230, 118, 0.3); }
          50% { box-shadow: 0 0 50px rgba(0, 230, 118, 0.6); }
        }
      `}</style>
    </>
  );
};

interface NextMatchCardProps {
  match: any;
}

const NextMatchCard: React.FC<NextMatchCardProps> = ({ match }) => {
  const cardStyle: CSSProperties = {
    background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.1), rgba(0, 176, 255, 0.1))',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    border: `2px solid ${theme.colors.primary}`,
  };

  const timeStyle: CSSProperties = {
    fontSize: '28px',
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.md,
  };

  const teamsStyle: CSSProperties = {
    fontSize: '42px',
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.text.primary,
    textAlign: 'center',
  };

  const metaStyle: CSSProperties = {
    fontSize: '20px',
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  };

  return (
    <div style={cardStyle}>
      <div style={timeStyle}>{match.time}</div>
      <div style={teamsStyle}>
        {match.homeTeam} vs. {match.awayTeam}
      </div>
      <div style={metaStyle}>
        Spiel {match.matchNumber} · {match.phase || 'Vorrunde'}
        {match.field && ` · Feld ${match.field}`}
      </div>
    </div>
  );
};

interface StandingsDisplayProps {
  standings: Standing[];
  teams: any[];
}

const StandingsDisplay: React.FC<StandingsDisplayProps> = ({ standings, teams }) => {
  // Gruppiere Standings nach Gruppe
  const groups = new Set(teams.map((t) => t.group).filter(Boolean));

  if (groups.size === 0) {
    // Keine Gruppen - Gesamttabelle
    return <StandingsTable standings={standings} title="Tabelle" />;
  }

  // Mit Gruppen
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: theme.spacing.xl }}>
      {Array.from(groups)
        .sort()
        .map((group) => {
          const groupTeams = teams.filter((t) => t.group === group);
          const groupStandings = standings
            .filter((s) => groupTeams.some((t) => t.id === s.team.id))
            .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference);

          return <StandingsTable key={group} standings={groupStandings} title={`Gruppe ${group}`} />;
        })}
    </div>
  );
};

interface StandingsTableProps {
  standings: Standing[];
  title: string;
}

const StandingsTable: React.FC<StandingsTableProps> = ({ standings, title }) => {
  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '22px',
  };

  const thStyle: CSSProperties = {
    background: theme.colors.primary,
    color: theme.colors.background,
    padding: `${theme.spacing.lg} ${theme.spacing.md}`,
    textAlign: 'left',
    fontWeight: theme.fontWeights.bold,
    fontSize: '20px',
  };

  const tdStyle: CSSProperties = {
    padding: `${theme.spacing.lg} ${theme.spacing.md}`,
    borderBottom: `2px solid ${theme.colors.border}`,
    fontSize: '20px',
  };

  const titleStyle: CSSProperties = {
    fontSize: '32px',
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  };

  return (
    <div>
      <div style={titleStyle}>{title}</div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Pl</th>
            <th style={{ ...thStyle, textAlign: 'left' }}>Team</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Sp</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Tore</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Diff</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Pkt</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((standing, index) => (
            <tr key={standing.team.id}>
              <td style={{ ...tdStyle, fontWeight: theme.fontWeights.bold, textAlign: 'center' }}>
                {index + 1}
              </td>
              <td style={tdStyle}>{standing.team.name}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{standing.played || 0}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                {standing.goalsFor}:{standing.goalsAgainst}
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                {standing.goalDifference > 0 ? `+${standing.goalDifference}` : standing.goalDifference}
              </td>
              <td
                style={{
                  ...tdStyle,
                  textAlign: 'center',
                  fontWeight: theme.fontWeights.bold,
                  color: theme.colors.primary,
                }}
              >
                {standing.points || 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
