/**
 * CurrentMatchPanel - Hauptpanel für aktuelles Spiel
 *
 * Zeigt: Scoreboard, Timer, Controls, Events
 * Reine Präsentation - alle Daten über Props
 */

import { CSSProperties } from 'react';
import { theme } from '../../styles/theme';
import { Button, Card } from '../ui';
import { LiveMatch, MatchSummary, MatchStatus } from './MatchCockpit';

interface CurrentMatchPanelProps {
  currentMatch: LiveMatch | null;
  lastFinishedMatch?: {
    match: MatchSummary;
    homeScore: number;
    awayScore: number;
  } | null;

  onStart(matchId: string): void;
  onPause(matchId: string): void;
  onFinish(matchId: string): void;
  onGoal(matchId: string, teamId: string, delta: 1 | -1): void;
  onUndoLastEvent(matchId: string): void;
  onManualEditResult(matchId: string, newHomeScore: number, newAwayScore: number): void;
  onLoadNextMatch(fieldId: string): void;
  onReopenLastMatch(fieldId: string): void;
}

export const CurrentMatchPanel: React.FC<CurrentMatchPanelProps> = ({
  currentMatch,
  lastFinishedMatch,
  onStart,
  onPause,
  onFinish,
  onGoal,
  onUndoLastEvent,
  onManualEditResult,
  onLoadNextMatch,
  onReopenLastMatch,
}) => {
  const cardHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  };

  const cardTitleStyle: CSSProperties = {
    fontSize: theme.fontSizes.lg,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary,
  };

  const cardSubtitleStyle: CSSProperties = {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary,
  };

  return (
    <Card>
      {/* HEADER */}
      <div style={cardHeaderStyle}>
        <div>
          <div style={cardTitleStyle}>Aktuelles Spiel</div>
          <div style={cardSubtitleStyle}>
            {currentMatch
              ? `Spiel ${currentMatch.number} · ${currentMatch.phaseLabel}`
              : 'Kein aktives Spiel'}
          </div>
        </div>
        <div style={cardSubtitleStyle}>
          {currentMatch && `Geplante Anstoßzeit: ${currentMatch.scheduledKickoff}`}
        </div>
      </div>

      {/* LAST MATCH BANNER */}
      {lastFinishedMatch && currentMatch?.status === 'NOT_STARTED' && (
        <LastMatchBanner
          lastMatch={lastFinishedMatch}
          onReopen={() => onReopenLastMatch(lastFinishedMatch.match.fieldId)}
        />
      )}

      {/* MATCH CONTENT */}
      {currentMatch ? (
        <>
          {/* MATCH META */}
          <MatchMeta
            refereeName={currentMatch.refereeName}
            matchId={currentMatch.id}
            durationSeconds={currentMatch.durationSeconds}
          />

          {/* SCOREBOARD */}
          <Scoreboard
            match={currentMatch}
            onGoal={onGoal}
            onStart={onStart}
            onPause={onPause}
            onFinish={onFinish}
          />

          {/* FINISH PANEL */}
          {currentMatch.status === 'FINISHED' && (
            <FinishPanel
              match={currentMatch}
              onResume={() => onStart(currentMatch.id)}
              onEdit={() => {
                const input = prompt(
                  `Neues Ergebnis eingeben (Format: Heim:Gast)`,
                  `${currentMatch.homeScore}:${currentMatch.awayScore}`
                );
                if (!input) return;
                const parts = input.split(':').map((p) => parseInt(p.trim(), 10));
                if (parts.length !== 2 || parts.some((n) => Number.isNaN(n) || n < 0)) {
                  alert('Ungültiges Format. Bitte z.B. 3:2 eingeben.');
                  return;
                }
                onManualEditResult(currentMatch.id, parts[0], parts[1]);
              }}
              onNext={() => onLoadNextMatch(currentMatch.fieldId)}
            />
          )}

          {/* EVENTS LIST */}
          <EventsList
            events={currentMatch.events}
            onUndo={() => onUndoLastEvent(currentMatch.id)}
            onManualEdit={() => {
              const input = prompt(
                `Neues Ergebnis eingeben (Format: Heim:Gast)`,
                `${currentMatch.homeScore}:${currentMatch.awayScore}`
              );
              if (!input) return;
              const parts = input.split(':').map((p) => parseInt(p.trim(), 10));
              if (parts.length !== 2 || parts.some((n) => Number.isNaN(n) || n < 0)) {
                alert('Ungültiges Format. Bitte z.B. 3:2 eingeben.');
                return;
              }
              onManualEditResult(currentMatch.id, parts[0], parts[1]);
            }}
          />
        </>
      ) : (
        <div style={{ padding: theme.spacing.xl, textAlign: 'center', color: theme.colors.text.secondary }}>
          Kein aktives Spiel vorhanden
        </div>
      )}
    </Card>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface LastMatchBannerProps {
  lastMatch: {
    match: MatchSummary;
    homeScore: number;
    awayScore: number;
  };
  onReopen(): void;
}

const LastMatchBanner: React.FC<LastMatchBannerProps> = ({ lastMatch, onReopen }) => {
  const bannerStyle: CSSProperties = {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: '999px',
    border: `1px dashed ${theme.colors.border}`,
    background: 'rgba(15, 23, 42, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    fontSize: theme.fontSizes.sm,
  };

  return (
    <div style={bannerStyle}>
      <div style={{ color: theme.colors.text.secondary }}>
        Letztes Spiel:{' '}
        <strong style={{ color: theme.colors.text.primary }}>
          Spiel {lastMatch.match.number}: {lastMatch.match.homeTeam.name} {lastMatch.homeScore} :{' '}
          {lastMatch.awayScore} {lastMatch.match.awayTeam.name}
        </strong>
      </div>
      <Button variant="secondary" size="sm" onClick={onReopen}>
        Als aktuelles Spiel öffnen
      </Button>
    </div>
  );
};

interface MatchMetaProps {
  refereeName?: string;
  matchId: string;
  durationSeconds: number;
}

const MatchMeta: React.FC<MatchMetaProps> = ({ refereeName, matchId, durationSeconds }) => {
  const metaStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    alignItems: 'center',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.md,
  };

  const metaItemStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: `4px ${theme.spacing.sm}`,
    borderRadius: '999px',
    border: `1px solid ${theme.colors.border}`,
    background: 'rgba(15, 23, 42, 0.65)',
  };

  const labelStyle: CSSProperties = {
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.text.primary,
  };

  const minutes = Math.round(durationSeconds / 60);

  return (
    <div style={metaStyle}>
      {refereeName && (
        <span style={metaItemStyle}>
          <span style={labelStyle}>Schiedsrichter:</span>
          <span>{refereeName}</span>
        </span>
      )}
      <span style={metaItemStyle}>
        <span style={labelStyle}>Spiel-ID:</span>
        <span>{matchId}</span>
      </span>
      <span style={metaItemStyle}>
        <span style={labelStyle}>Dauer:</span>
        <span>{minutes}:00 Min</span>
      </span>
    </div>
  );
};

interface ScoreboardProps {
  match: LiveMatch;
  onGoal(matchId: string, teamId: string, delta: 1 | -1): void;
  onStart(matchId: string): void;
  onPause(matchId: string): void;
  onFinish(matchId: string): void;
}

const Scoreboard: React.FC<ScoreboardProps> = ({ match, onGoal, onStart, onPause, onFinish }) => {
  const scoreboardStyle: CSSProperties = {
    marginTop: theme.spacing.sm,
    display: 'grid',
    gridTemplateColumns: '1.4fr auto 1.4fr',
    gap: theme.spacing.sm,
    alignItems: 'center',
  };

  return (
    <div style={scoreboardStyle}>
      {/* HOME TEAM */}
      <TeamBlock
        label="Heim"
        team={match.homeTeam}
        score={match.homeScore}
        onGoal={(delta) => onGoal(match.id, match.homeTeam.id, delta)}
      />

      {/* CENTER */}
      <CenterBlock
        elapsedSeconds={match.elapsedSeconds}
        durationSeconds={match.durationSeconds}
        status={match.status}
        phaseLabel={match.phaseLabel}
        onStart={() => onStart(match.id)}
        onPause={() => onPause(match.id)}
        onFinish={() => {
          if (window.confirm('Spiel wirklich beenden?')) {
            onFinish(match.id);
          }
        }}
      />

      {/* AWAY TEAM */}
      <TeamBlock
        label="Gast"
        team={match.awayTeam}
        score={match.awayScore}
        onGoal={(delta) => onGoal(match.id, match.awayTeam.id, delta)}
        align="right"
      />
    </div>
  );
};

interface TeamBlockProps {
  label: string;
  team: { id: string; name: string };
  score: number;
  onGoal(delta: 1 | -1): void;
  align?: 'left' | 'right';
}

const TeamBlock: React.FC<TeamBlockProps> = ({ label, team, score, onGoal, align = 'left' }) => {
  const blockStyle: CSSProperties = {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(3, 7, 18, 0.9))',
    border: `1px solid ${theme.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    alignItems: align === 'right' ? 'flex-end' : 'flex-start',
  };

  const labelStyle: CSSProperties = {
    fontSize: theme.fontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: theme.colors.text.secondary,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: theme.fontSizes.lg,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.text.primary,
  };

  const scoreStyle: CSSProperties = {
    fontSize: '30px',
    fontWeight: theme.fontWeights.bold,
    marginTop: '2px',
  };

  const controlsStyle: CSSProperties = {
    marginTop: theme.spacing.xs,
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  };

  return (
    <div style={blockStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={teamNameStyle}>{team.name}</div>
      <div style={scoreStyle}>{score}</div>

      <div style={controlsStyle}>
        <Button variant="primary" size="sm" onClick={() => onGoal(1)}>
          Tor {team.name}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onGoal(-1)}
          style={{ width: '36px', padding: '6px' }}
          disabled={score === 0}
        >
          −
        </Button>
      </div>
    </div>
  );
};

interface CenterBlockProps {
  elapsedSeconds: number;
  durationSeconds: number;
  status: MatchStatus;
  phaseLabel: string;
  onStart(): void;
  onPause(): void;
  onFinish(): void;
}

const CenterBlock: React.FC<CenterBlockProps> = ({
  elapsedSeconds,
  durationSeconds,
  status,
  phaseLabel,
  onStart,
  onPause,
  onFinish,
}) => {
  const blockStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
  };

  const timerStyle: CSSProperties = {
    fontFamily: 'ui-monospace, monospace',
    fontSize: '26px',
    fontWeight: theme.fontWeights.semibold,
    padding: `6px ${theme.spacing.md}`,
    borderRadius: '999px',
    border: `1px solid ${theme.colors.border}`,
    background: 'radial-gradient(circle at top, rgba(15, 23, 42, 0.98), #020617)',
    boxShadow: `0 0 25px ${theme.colors.primary}40`,
  };

  const phaseLabelStyle: CSSProperties = {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary,
  };

  const statusPillStyle: CSSProperties = {
    fontSize: theme.fontSizes.xs,
    padding: `4px ${theme.spacing.sm}`,
    borderRadius: '999px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    border: `1px solid ${getStatusColor(status)}`,
    background: `${getStatusColor(status)}20`,
    color: getStatusColor(status),
  };

  const dotStyle: CSSProperties = {
    width: '7px',
    height: '7px',
    borderRadius: '999px',
    background: 'currentColor',
  };

  const controlsStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  };

  const minutes = Math.floor(durationSeconds / 60);

  return (
    <div style={blockStyle}>
      <div style={timerStyle}>{formatTime(elapsedSeconds)}</div>
      <div style={phaseLabelStyle}>
        {phaseLabel} · {minutes}:00 Min
      </div>
      <div style={statusPillStyle}>
        <span style={dotStyle} />
        <span>{getStatusLabel(status)}</span>
      </div>
      <div style={controlsStyle}>
        <Button variant="primary" size="sm" onClick={onStart} disabled={status === 'RUNNING'}>
          Start
        </Button>
        <Button variant="secondary" size="sm" onClick={onPause} disabled={status !== 'RUNNING'}>
          Pause
        </Button>
        <Button variant="danger" size="sm" onClick={onFinish} disabled={status === 'FINISHED'}>
          Beenden
        </Button>
      </div>
    </div>
  );
};

interface FinishPanelProps {
  match: LiveMatch;
  onResume(): void;
  onEdit(): void;
  onNext(): void;
}

const FinishPanel: React.FC<FinishPanelProps> = ({ match, onResume, onEdit, onNext }) => {
  const panelStyle: CSSProperties = {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    border: `1px dashed ${theme.colors.border}`,
    background: 'rgba(15, 23, 42, 0.95)',
    fontSize: theme.fontSizes.sm,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  };

  const titleStyle: CSSProperties = {
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary,
  };

  const summaryStyle: CSSProperties = {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary,
  };

  const controlsStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  };

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>Spiel beendet – Ergebnis prüfen</div>
      <div style={summaryStyle}>
        <div>
          <strong style={{ color: theme.colors.text.primary }}>{match.homeTeam.name}</strong> vs.{' '}
          <strong style={{ color: theme.colors.text.primary }}>{match.awayTeam.name}</strong>
        </div>
        <div>
          Endstand:{' '}
          <strong style={{ color: theme.colors.text.primary }}>
            {match.homeScore} : {match.awayScore}
          </strong>
        </div>
      </div>
      <div style={controlsStyle}>
        <Button variant="secondary" size="sm" onClick={onEdit}>
          Ergebnis korrigieren
        </Button>
        <Button variant="secondary" size="sm" onClick={onResume}>
          Spiel wieder aufnehmen
        </Button>
        <Button variant="primary" size="sm" onClick={onNext}>
          Nächstes Spiel laden
        </Button>
      </div>
    </div>
  );
};

interface EventsListProps {
  events: Array<{
    id: string;
    time: number;
    type: string;
    payload: any;
    scoreAfter: { home: number; away: number };
  }>;
  onUndo(): void;
  onManualEdit(): void;
}

const EventsList: React.FC<EventsListProps> = ({ events, onUndo, onManualEdit }) => {
  const containerStyle: CSSProperties = {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTop: `1px dashed ${theme.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
  };

  const titleStyle: CSSProperties = {
    fontSize: theme.fontSizes.sm,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: theme.colors.text.secondary,
  };

  const listStyle: CSSProperties = {
    maxHeight: '140px',
    overflowY: 'auto',
    paddingRight: theme.spacing.xs,
  };

  const eventItemStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.xs} 0`,
    fontSize: theme.fontSizes.sm,
    borderBottom: `1px dashed ${theme.colors.border}`,
  };

  const timeStyle: CSSProperties = {
    fontFamily: 'ui-monospace, monospace',
    color: theme.colors.text.secondary,
    fontSize: theme.fontSizes.xs,
    minWidth: '54px',
  };

  const descStyle: CSSProperties = {
    flex: 1,
  };

  const scoreStyle: CSSProperties = {
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary,
    fontSize: theme.fontSizes.xs,
  };

  const getEventDescription = (event: any) => {
    if (event.type === 'GOAL') {
      const { teamName, direction } = event.payload;
      const sign = direction === 'INC' ? '+' : '-';
      return `Tor ${teamName} (${sign}1)`;
    } else if (event.type === 'RESULT_EDIT') {
      return 'Ergebnis manuell angepasst';
    } else if (event.type === 'STATUS_CHANGE') {
      return `Status: ${event.payload.to}`;
    }
    return 'Ereignis';
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={titleStyle}>Spielereignisse</div>
        <div style={{ display: 'flex', gap: theme.spacing.xs }}>
          <Button variant="secondary" size="sm" onClick={onManualEdit}>
            Ergebnis manuell anpassen
          </Button>
          <Button variant="danger" size="sm" onClick={onUndo} disabled={events.length === 0}>
            Letztes Ereignis zurücknehmen
          </Button>
        </div>
      </div>
      <div style={listStyle}>
        {events
          .slice()
          .reverse()
          .map((event) => (
            <div key={event.id} style={eventItemStyle}>
              <div style={timeStyle}>{formatTime(event.time)}</div>
              <div style={descStyle}>{getEventDescription(event)}</div>
              <div style={scoreStyle}>
                {event.scoreAfter.home}:{event.scoreAfter.away}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

function getStatusLabel(status: MatchStatus): string {
  switch (status) {
    case 'RUNNING':
      return 'läuft';
    case 'PAUSED':
      return 'pausiert';
    case 'FINISHED':
      return 'beendet';
    default:
      return 'bereit';
  }
}

function getStatusColor(status: MatchStatus): string {
  switch (status) {
    case 'RUNNING':
      return theme.colors.primary;
    case 'PAUSED':
      return theme.colors.warning;
    case 'FINISHED':
      return theme.colors.text.secondary;
    default:
      return theme.colors.text.secondary;
  }
}
