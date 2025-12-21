/**
 * MonitorTab - Große Zuschauer-Ansicht (Monitor/Display)
 *
 * Features:
 * - TV-optimierte Einzelspiel-Anzeige
 * - Feld-Auswahl bei mehreren Feldern
 * - Live-Timer mit Fortschrittsbalken
 * - Tor-Animation
 * - Vorschau nächstes Spiel
 * - Tabellen-Anzeige wenn kein Spiel läuft
 * - Vollbild-Modus mit Auto-Hide Controls
 */

import { CSSProperties, useState, useMemo } from 'react';
import { theme } from '../../styles/theme';
import { Tournament, Standing } from '../../types/tournament';
import { GeneratedSchedule } from '../../lib/scheduleGenerator';
import { useLiveMatches } from '../../hooks/useLiveMatches';
import {
  LiveMatchDisplay,
  NoMatchDisplay,
  FieldSelector,
  FullscreenControls,
  useFullscreen,
  GoalAnimation,
  NextMatchPreview,
} from '../../components/monitor';

interface MonitorTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  currentStandings: Standing[];
}

export const MonitorTab: React.FC<MonitorTabProps> = ({
  tournament,
  schedule,
  currentStandings,
}) => {
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const [selectedField, setSelectedField] = useState(1);

  // Get live match data from localStorage
  const {
    runningMatches,
    pausedMatches,
    lastGoalEvent,
    clearLastGoalEvent,
    calculateElapsedSeconds,
  } = useLiveMatches(tournament.id);

  // All matches from schedule
  const allMatches = useMemo(
    () => schedule.phases.flatMap(phase => phase.matches),
    [schedule.phases]
  );

  // Number of fields
  const numberOfFields = tournament.numberOfFields || 1;

  // Find running or paused match on selected field
  const activeMatches = useMemo(
    () => [...runningMatches, ...pausedMatches],
    [runningMatches, pausedMatches]
  );

  const matchOnSelectedField = useMemo(
    () => activeMatches.find(m => (m.field || 1) === selectedField),
    [activeMatches, selectedField]
  );

  // Fields with running matches (for indicator dots)
  const fieldsWithRunningMatches = useMemo(
    () => new Set(runningMatches.map(m => m.field || 1)),
    [runningMatches]
  );

  // Find next match (first without result)
  const nextMatch = useMemo(() => {
    const upcoming = allMatches.find(m =>
      m.scoreA === undefined || m.scoreB === undefined
    );
    if (!upcoming) {return null;}

    return {
      id: upcoming.id,
      number: upcoming.matchNumber || 0,
      homeTeam: upcoming.homeTeam || 'TBD',
      awayTeam: upcoming.awayTeam || 'TBD',
      field: upcoming.field,
      group: upcoming.group,
      scheduledTime: upcoming.time,
    };
  }, [allMatches]);

  // Calculate remaining seconds for current match
  const currentMatchRemainingSeconds = useMemo(() => {
    if (!matchOnSelectedField) {return 0;}
    const elapsed = calculateElapsedSeconds(matchOnSelectedField);
    return Math.max(0, matchOnSelectedField.durationSeconds - elapsed);
  }, [matchOnSelectedField, calculateElapsedSeconds]);

  // Whether to show standings (no running matches)
  const showStandings = runningMatches.length === 0 && pausedMatches.length === 0;

  // Check if tournament has groups
  const hasGroups = schedule.teams.some((t) => t.group);

  // Styles
  const containerStyle: CSSProperties = {
    minHeight: '100vh',
    height: isFullscreen ? '100vh' : 'auto',
    overflow: isFullscreen ? 'hidden' : 'visible',
    padding: isFullscreen ? 0 : theme.spacing.xxl,
    background: 'radial-gradient(circle at top, #111827 0%, #020617 55%, #000 100%)',
    color: theme.colors.text.primary,
    position: 'relative',
    display: isFullscreen ? 'flex' : 'block',
    flexDirection: 'column',
  };

  const contentWrapperStyle: CSSProperties = {
    maxWidth: isFullscreen ? 'none' : '1600px',
    width: '100%',
    height: isFullscreen ? '100%' : 'auto',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: isFullscreen ? 'center' : 'flex-start',
    gap: isFullscreen ? 0 : theme.spacing.xxl,
    padding: isFullscreen ? theme.spacing.lg : 0,
    flex: isFullscreen ? 1 : undefined,
  };

  const sectionStyle: CSSProperties = {
    background: 'rgba(15, 23, 42, 0.9)',
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xxl,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadows.lg,
    width: '100%',
  };

  const sectionTitleStyle: CSSProperties = {
    fontSize: '36px',
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xl,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textAlign: 'center',
  };

  return (
    <div style={containerStyle}>
      {/* Fullscreen Controls with Field Selector */}
      <FullscreenControls
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      >
        {numberOfFields > 1 && (
          <FieldSelector
            numberOfFields={numberOfFields}
            selectedField={selectedField}
            onSelectField={setSelectedField}
            fieldsWithRunningMatches={fieldsWithRunningMatches}
            hidden={false}
          />
        )}
      </FullscreenControls>

      <div style={contentWrapperStyle}>
        {/* LIVE MATCH DISPLAY */}
        {matchOnSelectedField ? (
          <LiveMatchDisplay
            match={matchOnSelectedField}
            size={isFullscreen ? 'xl' : 'lg'}
            fullscreen={isFullscreen}
          />
        ) : (
          <>
            {/* No active match - show placeholder or standings */}
            {showStandings && hasGroups && !isFullscreen ? (
              <section style={sectionStyle}>
                <h2 style={sectionTitleStyle}>Tabellen</h2>
                <StandingsDisplay standings={currentStandings} teams={schedule.teams} />
              </section>
            ) : (
              <NoMatchDisplay
                message={
                  numberOfFields > 1
                    ? `Kein Spiel auf Feld ${selectedField}`
                    : 'Kein laufendes Spiel'
                }
                size={isFullscreen ? 'xl' : 'lg'}
                fullscreen={isFullscreen}
              />
            )}
          </>
        )}

        {/* NEXT MATCH SECTION (only if no active match and not in fullscreen) */}
        {!matchOnSelectedField && nextMatch && !isFullscreen && (
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Nächstes Spiel</h2>
            <NextMatchCard match={nextMatch} />
          </section>
        )}
      </div>

      {/* GOAL ANIMATION OVERLAY */}
      <GoalAnimation
        goalEvent={lastGoalEvent}
        onAnimationComplete={clearLastGoalEvent}
      />

      {/* NEXT MATCH PREVIEW BANNER */}
      {matchOnSelectedField && (
        <NextMatchPreview
          nextMatch={nextMatch}
          currentMatchStatus={matchOnSelectedField.status}
          remainingSeconds={currentMatchRemainingSeconds}
        />
      )}
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface NextMatchCardProps {
  match: {
    id: string;
    number: number;
    homeTeam: string;
    awayTeam: string;
    field?: number;
    group?: string;
    scheduledTime?: string;
  };
}

const NextMatchCard: React.FC<NextMatchCardProps> = ({ match }) => {
  const cardStyle: CSSProperties = {
    background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.1), rgba(0, 176, 255, 0.1))',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    border: `2px solid ${theme.colors.primary}`,
    textAlign: 'center',
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
  };

  const metaStyle: CSSProperties = {
    fontSize: '20px',
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.md,
  };

  return (
    <div style={cardStyle}>
      {match.scheduledTime && <div style={timeStyle}>{match.scheduledTime}</div>}
      <div style={teamsStyle}>
        {match.homeTeam} vs. {match.awayTeam}
      </div>
      <div style={metaStyle}>
        Spiel {match.number}
        {match.field && ` · Feld ${match.field}`}
        {match.group && ` · Gruppe ${match.group}`}
      </div>
    </div>
  );
};

interface StandingsDisplayProps {
  standings: Standing[];
  teams: { id: string; name: string; group?: string }[];
}

const StandingsDisplay: React.FC<StandingsDisplayProps> = ({ standings, teams }) => {
  const groups = new Set(teams.map((t) => t.group).filter(Boolean));

  if (groups.size === 0) {
    return <StandingsTable standings={standings} title="Tabelle" />;
  }

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
