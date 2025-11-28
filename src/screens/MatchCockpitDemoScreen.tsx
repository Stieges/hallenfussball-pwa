/**
 * MatchCockpitDemoScreen - Demo/Example für MatchCockpit
 *
 * Zeigt, wie man die MatchCockpit Komponente verwendet.
 * Dieser Container hat die gesamte Geschäftslogik und State-Management.
 * Die MatchCockpit Komponente selbst ist reine Präsentation.
 *
 * In Production würde dieser Container:
 * - Daten von API/Backend laden
 * - WebSocket für Live-Updates nutzen
 * - State in Redux/Zustand/Context verwalten
 * - API-Calls für Aktionen durchführen
 */

import { useState, useEffect, useRef } from 'react';
import { MatchCockpit, LiveMatch, MatchSummary, MatchEvent } from '../components/match-cockpit';

export const MatchCockpitDemoScreen: React.FC = () => {
  // ============================================================================
  // STATE MANAGEMENT (würde in Production aus Backend/Context kommen)
  // ============================================================================

  const [currentMatch, setCurrentMatch] = useState<LiveMatch>(createInitialMatch());
  const [lastFinishedMatch, setLastFinishedMatch] = useState<{
    match: MatchSummary;
    homeScore: number;
    awayScore: number;
  } | null>(null);

  const timerRef = useRef<number | null>(null);

  // Timer für laufendes Spiel
  useEffect(() => {
    if (currentMatch.status === 'RUNNING') {
      timerRef.current = window.setInterval(() => {
        setCurrentMatch((prev) => {
          if (prev.status !== 'RUNNING') return prev;

          const newElapsed = Math.min(prev.elapsedSeconds + 0.5, prev.durationSeconds);

          // Auto-Finish bei Ende
          if (newElapsed >= prev.durationSeconds) {
            return {
              ...prev,
              elapsedSeconds: prev.durationSeconds,
              status: 'FINISHED' as const,
            };
          }

          return {
            ...prev,
            elapsedSeconds: newElapsed,
          };
        });
      }, 500);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [currentMatch.status]);

  // ============================================================================
  // CALLBACK HANDLERS (in Production würden diese API-Calls machen)
  // ============================================================================

  const handleStart = (matchId: string) => {
    setCurrentMatch((prev) => {
      if (prev.id !== matchId || prev.status === 'RUNNING') return prev;
      const newEvent = createEvent(prev, 'STATUS_CHANGE', { toStatus: 'RUNNING' });
      return {
        ...prev,
        status: 'RUNNING',
        events: [...prev.events, newEvent],
      };
    });
  };

  const handlePause = (matchId: string) => {
    setCurrentMatch((prev) => {
      if (prev.id !== matchId || prev.status !== 'RUNNING') return prev;
      const newEvent = createEvent(prev, 'STATUS_CHANGE', { toStatus: 'PAUSED' });
      return {
        ...prev,
        status: 'PAUSED',
        events: [...prev.events, newEvent],
      };
    });
  };

  const handleFinish = (matchId: string) => {
    setCurrentMatch((prev) => {
      if (prev.id !== matchId || prev.status === 'FINISHED') return prev;
      const newEvent = createEvent(prev, 'STATUS_CHANGE', { toStatus: 'FINISHED' });
      return {
        ...prev,
        status: 'FINISHED',
        elapsedSeconds: prev.durationSeconds,
        events: [...prev.events, newEvent],
      };
    });
  };

  const handleGoal = (matchId: string, teamId: string, delta: 1 | -1) => {
    setCurrentMatch((prev) => {
      if (prev.id !== matchId) return prev;

      const isHome = teamId === prev.homeTeam.id;
      const currentScore = isHome ? prev.homeScore : prev.awayScore;
      const newScore = Math.max(0, currentScore + delta);

      const newHomeScore = isHome ? newScore : prev.homeScore;
      const newAwayScore = !isHome ? newScore : prev.awayScore;

      const newEvent = createEvent(prev, 'GOAL', {
        teamId,
        direction: delta === 1 ? 'INC' : 'DEC',
      });

      return {
        ...prev,
        homeScore: newHomeScore,
        awayScore: newAwayScore,
        events: [...prev.events, { ...newEvent, scoreAfter: { home: newHomeScore, away: newAwayScore } }],
      };
    });
  };

  const handleUndoLastEvent = (matchId: string) => {
    setCurrentMatch((prev) => {
      if (prev.id !== matchId || prev.events.length === 0) return prev;

      // Events ohne letztes Event
      const remainingEvents = prev.events.slice(0, -1);

      // Score aus verbleibenden Events neu berechnen
      let newHomeScore = 0;
      let newAwayScore = 0;

      remainingEvents.forEach((evt) => {
        if (evt.type === 'GOAL') {
          const isHome = evt.payload.teamId === prev.homeTeam.id;
          const delta = evt.payload.direction === 'INC' ? 1 : -1;
          if (isHome) {
            newHomeScore = Math.max(0, newHomeScore + delta);
          } else {
            newAwayScore = Math.max(0, newAwayScore + delta);
          }
        }
      });

      return {
        ...prev,
        homeScore: newHomeScore,
        awayScore: newAwayScore,
        events: remainingEvents,
      };
    });
  };

  const handleManualEditResult = (matchId: string, newHomeScore: number, newAwayScore: number) => {
    setCurrentMatch((prev) => {
      if (prev.id !== matchId) return prev;

      const newEvent = createEvent(prev, 'RESULT_EDIT', {
        newHomeScore,
        newAwayScore,
      });

      return {
        ...prev,
        homeScore: newHomeScore,
        awayScore: newAwayScore,
        events: [...prev.events, { ...newEvent, scoreAfter: { home: newHomeScore, away: newAwayScore } }],
      };
    });
  };

  const handleLoadNextMatch = () => {
    // Aktuelles Spiel als "letztes Spiel" speichern
    setLastFinishedMatch({
      match: {
        id: currentMatch.id,
        number: currentMatch.number,
        phaseLabel: currentMatch.phaseLabel,
        scheduledKickoff: currentMatch.scheduledKickoff,
        fieldId: currentMatch.fieldId,
        homeTeam: currentMatch.homeTeam,
        awayTeam: currentMatch.awayTeam,
      },
      homeScore: currentMatch.homeScore,
      awayScore: currentMatch.awayScore,
    });

    // Nächstes Spiel laden (Demo: neues Spiel mit anderen Teams)
    const nextMatch = createNextMatch();
    setCurrentMatch(nextMatch);
  };

  const handleReopenLastMatch = () => {
    if (!lastFinishedMatch) return;

    // Letztes Spiel wieder laden
    setCurrentMatch({
      ...currentMatch,
      id: lastFinishedMatch.match.id,
      number: lastFinishedMatch.match.number,
      phaseLabel: lastFinishedMatch.match.phaseLabel,
      scheduledKickoff: lastFinishedMatch.match.scheduledKickoff,
      homeTeam: lastFinishedMatch.match.homeTeam,
      awayTeam: lastFinishedMatch.match.awayTeam,
      homeScore: lastFinishedMatch.homeScore,
      awayScore: lastFinishedMatch.awayScore,
      status: 'FINISHED',
      elapsedSeconds: currentMatch.durationSeconds,
    });

    setLastFinishedMatch(null);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const handleAdjustTime = (matchId: string, newElapsedSeconds: number) => {
    setCurrentMatch((prev) => {
      if (prev.id !== matchId) return prev;
      return {
        ...prev,
        elapsedSeconds: newElapsedSeconds,
      };
    });
  };

  return (
    <MatchCockpit
      fieldName="Feld 1"
      tournamentName="Wieninger-Libella-Hallenturniere 2025/2026"
      currentMatch={currentMatch}
      lastFinishedMatch={lastFinishedMatch}
      upcomingMatches={getUpcomingMatches()}
      highlightNextMatchMinutesBefore={5}
      onStart={handleStart}
      onPause={handlePause}
      onFinish={handleFinish}
      onGoal={handleGoal}
      onUndoLastEvent={handleUndoLastEvent}
      onManualEditResult={handleManualEditResult}
      onAdjustTime={handleAdjustTime}
      onLoadNextMatch={handleLoadNextMatch}
      onReopenLastMatch={handleReopenLastMatch}
    />
  );
};

// ============================================================================
// DEMO DATA GENERATORS (würde in Production vom Backend kommen)
// ============================================================================

function createInitialMatch(): LiveMatch {
  return {
    id: 'A-7',
    number: 7,
    phaseLabel: 'Vorrunde Gruppe A',
    fieldId: 'field-1',
    scheduledKickoff: '14:20',
    durationSeconds: 10 * 60,
    refereeName: 'Max Mustermann',
    homeTeam: { id: 'team-1', name: 'SV Waging' },
    awayTeam: { id: 'team-2', name: 'TSV Traunstein' },
    homeScore: 0,
    awayScore: 0,
    status: 'NOT_STARTED',
    elapsedSeconds: 0,
    events: [],
  };
}

function createNextMatch(): LiveMatch {
  return {
    id: 'A-8',
    number: 8,
    phaseLabel: 'Vorrunde Gruppe A',
    fieldId: 'field-1',
    scheduledKickoff: '14:30',
    durationSeconds: 10 * 60,
    refereeName: 'Anna Schiedsrichter',
    homeTeam: { id: 'team-3', name: 'SC Burghausen' },
    awayTeam: { id: 'team-4', name: 'TSV Tittmoning' },
    homeScore: 0,
    awayScore: 0,
    status: 'NOT_STARTED',
    elapsedSeconds: 0,
    events: [],
  };
}

function getUpcomingMatches(): MatchSummary[] {
  return [
    {
      id: 'A-8',
      number: 8,
      phaseLabel: 'Vorrunde Gruppe A',
      scheduledKickoff: '14:30',
      fieldId: 'field-1',
      homeTeam: { id: 'team-3', name: 'SC Burghausen' },
      awayTeam: { id: 'team-4', name: 'TSV Tittmoning' },
    },
    {
      id: 'A-9',
      number: 9,
      phaseLabel: 'Vorrunde Gruppe A',
      scheduledKickoff: '14:40',
      fieldId: 'field-1',
      homeTeam: { id: 'team-1', name: 'SV Waging' },
      awayTeam: { id: 'team-3', name: 'SC Burghausen' },
    },
    {
      id: 'A-10',
      number: 10,
      phaseLabel: 'Vorrunde Gruppe A',
      scheduledKickoff: '14:50',
      fieldId: 'field-1',
      homeTeam: { id: 'team-2', name: 'TSV Traunstein' },
      awayTeam: { id: 'team-4', name: 'TSV Tittmoning' },
    },
  ];
}

function createEvent(match: LiveMatch, type: MatchEvent['type'], payload: any): MatchEvent {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    matchId: match.id,
    timestampSeconds: match.elapsedSeconds,
    type,
    payload,
    scoreAfter: {
      home: match.homeScore,
      away: match.awayScore,
    },
  };
}
