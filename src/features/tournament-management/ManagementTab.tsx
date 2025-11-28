/**
 * ManagementTab - Turnierleitung (Kampfgericht)
 *
 * Integriert das MatchCockpit für Live-Spielverwaltung pro Feld
 */

import { CSSProperties, useState } from 'react';
import { theme } from '../../styles/theme';
import { Tournament } from '../../types/tournament';
import { GeneratedSchedule, ScheduledMatch } from '../../lib/scheduleGenerator';
import {
  MatchCockpit,
  LiveMatch,
  MatchSummary,
  MatchStatus,
  Team,
  MatchEvent,
} from '../../components/match-cockpit/MatchCockpit';

interface ManagementTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
}

export const ManagementTab: React.FC<ManagementTabProps> = ({ tournament, schedule }) => {
  const [selectedFieldNumber, setSelectedFieldNumber] = useState<number>(1);

  // State für Live-Matches (später aus Backend/localStorage)
  const [liveMatches, setLiveMatches] = useState<Map<string, LiveMatch>>(new Map());

  const containerStyle: CSSProperties = {
    padding: theme.spacing.lg,
    background: theme.colors.background,
    minHeight: 'calc(100vh - 200px)',
  };

  const fieldSelectorStyle: CSSProperties = {
    maxWidth: '1080px',
    margin: '0 auto',
    padding: theme.spacing.md,
    display: 'flex',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  };

  const fieldButtonStyle = (isActive: boolean): CSSProperties => ({
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    background: isActive ? theme.colors.primary : theme.colors.surface,
    color: isActive ? theme.colors.background : theme.colors.text.primary,
    border: `1px solid ${isActive ? theme.colors.primary : theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    transition: 'all 0.2s ease',
  });

  // Hilfsfunktion: Konvertiere ScheduledMatch zu MatchSummary
  const toMatchSummary = (sm: ScheduledMatch): MatchSummary => ({
    id: sm.id,
    number: sm.matchNumber,
    phaseLabel: sm.label || (sm.phase === 'groupStage' ? 'Vorrunde' : 'Finalrunde'),
    scheduledKickoff: sm.time,
    fieldId: `field-${sm.field}`,
    homeTeam: { id: sm.homeTeam, name: sm.homeTeam },
    awayTeam: { id: sm.awayTeam, name: sm.awayTeam },
  });

  // Get matches for selected field
  const fieldMatches = schedule.allMatches
    .filter((m) => m.field === selectedFieldNumber)
    .sort((a, b) => a.slot - b.slot);

  // Find current match (first match without result)
  const currentMatchData = fieldMatches.find((m) => m.scoreA === undefined || m.scoreB === undefined);

  const currentMatch: LiveMatch | null = currentMatchData
    ? {
        id: currentMatchData.id,
        number: currentMatchData.matchNumber,
        phaseLabel: currentMatchData.label || (currentMatchData.phase === 'groupStage' ? 'Vorrunde' : 'Finalrunde'),
        fieldId: `field-${currentMatchData.field}`,
        scheduledKickoff: currentMatchData.time,
        durationSeconds: tournament.matchDuration * 60,
        refereeName: currentMatchData.referee ? `SR ${currentMatchData.referee}` : undefined,
        homeTeam: { id: currentMatchData.homeTeam, name: currentMatchData.homeTeam },
        awayTeam: { id: currentMatchData.awayTeam, name: currentMatchData.awayTeam },
        homeScore: currentMatchData.scoreA || 0,
        awayScore: currentMatchData.scoreB || 0,
        status: 'NOT_STARTED' as MatchStatus,
        elapsedSeconds: 0,
        events: [],
      }
    : null;

  // Find last finished match
  const lastFinishedMatchData = fieldMatches
    .reverse()
    .find((m) => m.scoreA !== undefined && m.scoreB !== undefined);

  const lastFinishedMatch = lastFinishedMatchData
    ? {
        match: toMatchSummary(lastFinishedMatchData),
        homeScore: lastFinishedMatchData.scoreA || 0,
        awayScore: lastFinishedMatchData.scoreB || 0,
      }
    : null;

  // Upcoming matches (matches after current)
  const currentIndex = fieldMatches.findIndex((m) => m.id === currentMatchData?.id);
  const upcomingMatches =
    currentIndex !== -1
      ? fieldMatches.slice(currentIndex + 1).map(toMatchSummary)
      : fieldMatches.map(toMatchSummary);

  // Handlers (TODO: Implement state management)
  const handleStart = (matchId: string) => {
    console.log('Start match:', matchId);
    // TODO: Start match timer
  };

  const handlePause = (matchId: string) => {
    console.log('Pause match:', matchId);
    // TODO: Pause match timer
  };

  const handleFinish = (matchId: string) => {
    console.log('Finish match:', matchId);
    // TODO: Save result to tournament.matches
  };

  const handleGoal = (matchId: string, teamId: string, delta: 1 | -1) => {
    console.log('Goal:', matchId, teamId, delta);
    // TODO: Update score
  };

  const handleUndoLastEvent = (matchId: string) => {
    console.log('Undo last event:', matchId);
    // TODO: Undo last goal/event
  };

  const handleManualEditResult = (matchId: string, newHomeScore: number, newAwayScore: number) => {
    console.log('Manual edit:', matchId, newHomeScore, newAwayScore);
    // TODO: Update scores
  };

  const handleLoadNextMatch = (fieldId: string) => {
    console.log('Load next match for field:', fieldId);
    // TODO: Load next match
  };

  const handleReopenLastMatch = (fieldId: string) => {
    console.log('Reopen last match for field:', fieldId);
    // TODO: Reopen last finished match
  };

  return (
    <div style={containerStyle}>
      {/* FIELD SELECTOR (if multiple fields) */}
      {tournament.numberOfFields > 1 && (
        <div style={fieldSelectorStyle}>
          {Array.from({ length: tournament.numberOfFields }, (_, i) => i + 1).map((fieldNum) => (
            <button
              key={fieldNum}
              style={fieldButtonStyle(fieldNum === selectedFieldNumber)}
              onClick={() => setSelectedFieldNumber(fieldNum)}
            >
              Feld {fieldNum}
            </button>
          ))}
        </div>
      )}

      {/* MATCH COCKPIT */}
      <MatchCockpit
        fieldName={`Feld ${selectedFieldNumber}`}
        tournamentName={tournament.title}
        currentMatch={currentMatch}
        lastFinishedMatch={lastFinishedMatch}
        upcomingMatches={upcomingMatches}
        highlightNextMatchMinutesBefore={5}
        onStart={handleStart}
        onPause={handlePause}
        onFinish={handleFinish}
        onGoal={handleGoal}
        onUndoLastEvent={handleUndoLastEvent}
        onManualEditResult={handleManualEditResult}
        onLoadNextMatch={handleLoadNextMatch}
        onReopenLastMatch={handleReopenLastMatch}
      />
    </div>
  );
};
