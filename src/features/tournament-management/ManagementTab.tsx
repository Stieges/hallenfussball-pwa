/**
 * ManagementTab - Turnierleitung (Kampfgericht)
 *
 * Live-Spielverwaltung mit MatchCockpit:
 * - Timer-Management für jedes Spiel
 * - Live-Torzählung mit Event-Tracking
 * - Speicherung in tournament.matches
 * - Persistierung in localStorage
 * - Match-Selektor für flexible Auswahl
 * - Zeit-Editor für manuelle Anpassungen
 */

import { CSSProperties, useState, useEffect, useCallback } from 'react';
import { theme } from '../../styles/theme';
import { Tournament } from '../../types/tournament';
import { GeneratedSchedule, ScheduledMatch } from '../../lib/scheduleGenerator';
import {
  MatchCockpit,
  LiveMatch,
  MatchSummary,
  MatchStatus,
  MatchEvent,
} from '../../components/match-cockpit/MatchCockpit';
import { autoResolvePlayoffsIfReady } from '../../utils/playoffResolver';

interface ManagementTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
}

export const ManagementTab: React.FC<ManagementTabProps> = ({
  tournament,
  schedule,
  onTournamentUpdate
}) => {
  const [selectedFieldNumber, setSelectedFieldNumber] = useState<number>(1);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  // State für Live-Matches (persistiert in localStorage)
  const [liveMatches, setLiveMatches] = useState<Map<string, LiveMatch>>(() => {
    const stored = localStorage.getItem(`liveMatches-${tournament.id}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return new Map(Object.entries(parsed));
      } catch (e) {
        return new Map();
      }
    }
    return new Map();
  });

  // Persistiere liveMatches in localStorage bei Änderungen
  useEffect(() => {
    const obj = Object.fromEntries(liveMatches.entries());
    localStorage.setItem(`liveMatches-${tournament.id}`, JSON.stringify(obj));
  }, [liveMatches, tournament.id]);

  // DEF-005: beforeunload handler for crash safety
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Ensure final state is saved before tab closes
      const obj = Object.fromEntries(liveMatches.entries());
      localStorage.setItem(`liveMatches-${tournament.id}`, JSON.stringify(obj));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [liveMatches, tournament.id]);

  // Timer für laufende Spiele (DEF-005: Timestamp-based calculation)
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveMatches(prev => {
        const updated = new Map(prev);
        let hasChanges = false;

        updated.forEach((match, matchId) => {
          if (match.status === 'RUNNING' && match.timerStartTime) {
            // Calculate elapsed time based on start timestamp
            const startTime = new Date(match.timerStartTime).getTime();
            const now = Date.now();
            const runtimeSeconds = Math.floor((now - startTime) / 1000);
            const totalElapsed = (match.timerElapsedSeconds || 0) + runtimeSeconds;

            updated.set(matchId, {
              ...match,
              elapsedSeconds: totalElapsed,
            });
            hasChanges = true;
          }
        });

        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const containerStyle: CSSProperties = {
    padding: theme.spacing.lg,
    background: theme.colors.background,
    minHeight: 'calc(100vh - 200px)',
  };

  // Responsive container style for mobile
  const responsiveContainerStyle: CSSProperties = {
    ...containerStyle,
    padding: window.innerWidth < 768 ? theme.spacing.md : theme.spacing.lg,
  };

  const fieldSelectorStyle: CSSProperties = {
    maxWidth: '1080px',
    margin: '0 auto',
    padding: window.innerWidth < 768 ? theme.spacing.sm : theme.spacing.md,
    display: 'flex',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    flexWrap: 'wrap',
  };

  const fieldButtonStyle = (isActive: boolean): CSSProperties => ({
    padding: window.innerWidth < 768
      ? `${theme.spacing.md} ${theme.spacing.md}`
      : `${theme.spacing.sm} ${theme.spacing.lg}`,
    background: isActive ? theme.colors.primary : theme.colors.surface,
    color: isActive ? theme.colors.background : theme.colors.text.primary,
    border: `1px solid ${isActive ? theme.colors.primary : theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    fontSize: window.innerWidth < 768 ? theme.fontSizes.lg : theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    transition: 'all 0.2s ease',
    minHeight: '44px',
    minWidth: window.innerWidth < 768 ? '80px' : 'auto',
    flex: window.innerWidth < 768 ? '1 1 calc(50% - 4px)' : '0 0 auto',
  });

  const matchSelectorStyle: CSSProperties = {
    maxWidth: '1080px',
    margin: '0 auto',
    padding: window.innerWidth < 768 ? theme.spacing.sm : theme.spacing.md,
    marginBottom: theme.spacing.lg,
  };

  const selectStyle: CSSProperties = {
    width: '100%',
    padding: window.innerWidth < 768 ? theme.spacing.md : theme.spacing.md,
    background: theme.colors.surface,
    color: theme.colors.text.primary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: window.innerWidth < 768 ? theme.fontSizes.lg : theme.fontSizes.md,
    cursor: 'pointer',
    minHeight: '44px',
  };

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
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));

  // Find current match (selected OR running OR first without result)
  let currentMatchData: ScheduledMatch | undefined;

  if (selectedMatchId) {
    // Benutzer hat ein Spiel manuell ausgewählt
    currentMatchData = fieldMatches.find(m => m.id === selectedMatchId);
  } else {
    // Automatische Auswahl: Laufendes Spiel oder erstes ohne Ergebnis
    const runningMatch = fieldMatches.find((m) => liveMatches.has(m.id) && liveMatches.get(m.id)!.status !== 'FINISHED');
    currentMatchData = runningMatch || fieldMatches.find((m) => m.scoreA === undefined || m.scoreB === undefined);
  }

  // Hole gespeicherte LiveMatch-Daten oder erstelle Default
  const getLiveMatchData = (matchData: ScheduledMatch): LiveMatch => {
    const existing = liveMatches.get(matchData.id);
    if (existing) {
      return existing;
    }

    // Default: Neues Match - ERSTELLE es sofort in liveMatches
    const newMatch: LiveMatch = {
      id: matchData.id,
      number: matchData.matchNumber,
      phaseLabel: matchData.label || (matchData.phase === 'groupStage' ? 'Vorrunde' : 'Finalrunde'),
      fieldId: `field-${matchData.field}`,
      scheduledKickoff: matchData.time,
      durationSeconds: (tournament.groupPhaseGameDuration || tournament.gameDuration || 10) * 60,
      refereeName: matchData.referee ? `SR ${matchData.referee}` : undefined,
      homeTeam: { id: matchData.homeTeam, name: matchData.homeTeam },
      awayTeam: { id: matchData.awayTeam, name: matchData.awayTeam },
      homeScore: matchData.scoreA || 0,
      awayScore: matchData.scoreB || 0,
      status: 'NOT_STARTED' as MatchStatus,
      elapsedSeconds: 0,
      events: [],
    };

    // Speichere es sofort
    setLiveMatches(prev => {
      const updated = new Map(prev);
      updated.set(matchData.id, newMatch);
      return updated;
    });

    return newMatch;
  };

  const currentMatch: LiveMatch | null = currentMatchData ? getLiveMatchData(currentMatchData) : null;

  // Find last finished match
  const finishedMatches = fieldMatches.filter((m) => m.scoreA !== undefined && m.scoreB !== undefined);
  const lastFinishedMatchData = finishedMatches[finishedMatches.length - 1];

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

  // Handler: Start match
  const handleStart = useCallback((matchId: string) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {
        console.error('handleStart: Match not found:', matchId);
        return prev;
      }

      // Prüfe, ob bereits Ergebnisse im Spielplan vorhanden sind
      const hasExistingResult = match.homeScore > 0 || match.awayScore > 0;

      if (hasExistingResult && match.status === 'NOT_STARTED') {
        const confirmStart = window.confirm(
          `⚠️ WARNUNG: Für dieses Spiel liegen bereits Ergebnisse vor!\n\n` +
          `Aktueller Stand: ${match.homeScore}:${match.awayScore}\n\n` +
          `Wenn Sie das Spiel jetzt starten, werden die vorhandenen Ergebnisse gelöscht ` +
          `und durch die Live-Erfassung ersetzt (Start bei 0:0).\n\n` +
          `Möchten Sie trotzdem starten?`
        );

        if (!confirmStart) {
          return prev; // Abbrechen
        }

        // Lösche vorhandene Ergebnisse und starte bei 0:0
        const updated = new Map(prev);
        updated.set(matchId, {
          ...match,
          homeScore: 0,
          awayScore: 0,
          status: 'RUNNING' as MatchStatus,
          elapsedSeconds: 0,
          // DEF-005: Timer persistence - set start time
          timerStartTime: new Date().toISOString(),
          timerElapsedSeconds: 0,
          timerPausedAt: undefined,
          events: [{
            id: `${matchId}-${Date.now()}`,
            matchId,
            timestampSeconds: 0,
            type: 'STATUS_CHANGE',
            payload: {
              toStatus: 'RUNNING',
            },
            scoreAfter: {
              home: 0,
              away: 0,
            },
          }],
        });
        return updated;
      }

      // Normaler Start ohne vorhandene Ergebnisse
      const event: MatchEvent = {
        id: `${matchId}-${Date.now()}`,
        matchId,
        timestampSeconds: match.elapsedSeconds,
        type: 'STATUS_CHANGE',
        payload: {
          toStatus: 'RUNNING',
        },
        scoreAfter: {
          home: match.homeScore,
          away: match.awayScore,
        },
      };

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        status: 'RUNNING' as MatchStatus,
        // DEF-005: Timer persistence - set start time
        timerStartTime: new Date().toISOString(),
        timerElapsedSeconds: match.elapsedSeconds || 0,
        timerPausedAt: undefined,
        events: [...match.events, event],
      });
      return updated;
    });
  }, []);

  // Handler: Pause match
  const handlePause = useCallback((matchId: string) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {
        console.error('handlePause: Match not found:', matchId);
        return prev;
      }

      const event: MatchEvent = {
        id: `${matchId}-${Date.now()}`,
        matchId,
        timestampSeconds: match.elapsedSeconds,
        type: 'STATUS_CHANGE',
        payload: {
          toStatus: 'PAUSED',
        },
        scoreAfter: {
          home: match.homeScore,
          away: match.awayScore,
        },
      };

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        status: 'PAUSED' as MatchStatus,
        // DEF-005: Timer persistence - save pause timestamp and elapsed time
        timerPausedAt: new Date().toISOString(),
        timerElapsedSeconds: match.elapsedSeconds,
        events: [...match.events, event],
      });
      return updated;
    });
  }, []);

  // Handler: Resume match (from PAUSED)
  const handleResume = useCallback((matchId: string) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {
        console.error('handleResume: Match not found:', matchId);
        return prev;
      }

      const event: MatchEvent = {
        id: `${matchId}-${Date.now()}`,
        matchId,
        timestampSeconds: match.elapsedSeconds,
        type: 'STATUS_CHANGE',
        payload: {
          toStatus: 'RUNNING',
        },
        scoreAfter: {
          home: match.homeScore,
          away: match.awayScore,
        },
      };

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        status: 'RUNNING' as MatchStatus,
        // DEF-005: Timer persistence - resume with new start time accounting for elapsed time
        timerStartTime: new Date().toISOString(),
        timerElapsedSeconds: match.elapsedSeconds,
        timerPausedAt: undefined,
        events: [...match.events, event],
      });
      return updated;
    });
  }, []);

  // Handler: Finish match
  const handleFinish = useCallback((matchId: string) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {
        console.error('handleFinish: Match not found:', matchId);
        return prev;
      }

      // Aktualisiere tournament.matches
      const updatedMatches = tournament.matches.map(m => {
        if (m.id === matchId) {
          return {
            ...m,
            scoreA: match.homeScore,
            scoreB: match.awayScore,
          };
        }
        return m;
      });

      const updatedTournament = {
        ...tournament,
        matches: updatedMatches,
        updatedAt: new Date().toISOString(),
      };

      // Speichere Tournament
      onTournamentUpdate(updatedTournament, false);

      // ✅ FIX DEF-003: Automatic playoff resolution after group match completion
      const playoffResolution = autoResolvePlayoffsIfReady(updatedTournament);
      if (playoffResolution?.wasResolved) {
        console.log('✅ Playoff-Paarungen automatisch aufgelöst:', playoffResolution);

        // Update tournament with resolved playoff matches
        onTournamentUpdate(updatedTournament, false);

        // Notify user
        setTimeout(() => {
          alert(
            `🎉 Gruppenphase abgeschlossen!\n\n` +
            `${playoffResolution.message}\n\n` +
            `Die Playoff-Paarungen wurden automatisch basierend auf den Gruppenplatzierungen erstellt.`
          );
        }, 500);
      }

      const event: MatchEvent = {
        id: `${matchId}-${Date.now()}`,
        matchId,
        timestampSeconds: match.elapsedSeconds,
        type: 'STATUS_CHANGE',
        payload: {
          toStatus: 'FINISHED',
        },
        scoreAfter: {
          home: match.homeScore,
          away: match.awayScore,
        },
      };

      // Markiere Match als FINISHED
      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        status: 'FINISHED' as MatchStatus,
        elapsedSeconds: match.durationSeconds,
        events: [...match.events, event],
      });

      // Reset selected match nach dem Update
      setTimeout(() => setSelectedMatchId(null), 0);

      return updated;
    });
  }, [tournament, onTournamentUpdate]);

  // Handler: Goal
  const handleGoal = useCallback((matchId: string, teamId: string, delta: 1 | -1) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {
        console.error('handleGoal: Match not found:', matchId);
        return prev;
      }

      const isHomeTeam = match.homeTeam.id === teamId || match.homeTeam.name === teamId;
      const newHomeScore = isHomeTeam ? Math.max(0, match.homeScore + delta) : match.homeScore;
      const newAwayScore = !isHomeTeam ? Math.max(0, match.awayScore + delta) : match.awayScore;

      // Erstelle Event
      const event: MatchEvent = {
        id: `${matchId}-${Date.now()}`,
        matchId,
        timestampSeconds: match.elapsedSeconds,
        type: 'GOAL',
        payload: {
          teamId: isHomeTeam ? match.homeTeam.id : match.awayTeam.id,
          teamName: isHomeTeam ? match.homeTeam.name : match.awayTeam.name, // DEF-004: Add team name
          direction: delta > 0 ? 'INC' : 'DEC',
        },
        scoreAfter: {
          home: newHomeScore,
          away: newAwayScore,
        },
      };

      // Aktualisiere auch sofort tournament.matches
      const updatedMatches = tournament.matches.map(m => {
        if (m.id === matchId) {
          return {
            ...m,
            scoreA: newHomeScore,
            scoreB: newAwayScore,
          };
        }
        return m;
      });

      const updatedTournament = {
        ...tournament,
        matches: updatedMatches,
        updatedAt: new Date().toISOString(),
      };

      // Speichere Tournament
      onTournamentUpdate(updatedTournament, false);

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        homeScore: newHomeScore,
        awayScore: newAwayScore,
        events: [...match.events, event],
      });
      return updated;
    });
  }, [tournament, onTournamentUpdate]);

  // Handler: Undo last event
  const handleUndoLastEvent = useCallback((matchId: string) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match || match.events.length === 0) {
        console.error('handleUndoLastEvent: No events to undo');
        return prev;
      }

      const events = [...match.events];
      events.pop(); // Entferne letztes Event

      // Hole vorherigen Score
      const previousEvent = events[events.length - 1];
      const { home, away } = previousEvent?.scoreAfter || { home: 0, away: 0 };

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        homeScore: home,
        awayScore: away,
        events,
      });
      return updated;
    });
  }, []);

  // Handler: Manual edit result
  const handleManualEditResult = useCallback((matchId: string, newHomeScore: number, newAwayScore: number) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {
        console.error('handleManualEditResult: Match not found:', matchId);
        return prev;
      }

      const event: MatchEvent = {
        id: `${matchId}-${Date.now()}`,
        matchId,
        timestampSeconds: match.elapsedSeconds,
        type: 'RESULT_EDIT',
        payload: {
          newHomeScore,
          newAwayScore,
        },
        scoreAfter: {
          home: newHomeScore,
          away: newAwayScore,
        },
      };

      // Aktualisiere auch sofort tournament.matches
      const updatedMatches = tournament.matches.map(m => {
        if (m.id === matchId) {
          return {
            ...m,
            scoreA: newHomeScore,
            scoreB: newAwayScore,
          };
        }
        return m;
      });

      const updatedTournament = {
        ...tournament,
        matches: updatedMatches,
        updatedAt: new Date().toISOString(),
      };

      // Speichere Tournament
      onTournamentUpdate(updatedTournament, false);

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        homeScore: newHomeScore,
        awayScore: newAwayScore,
        events: [...match.events, event],
      });
      return updated;
    });
  }, [tournament, onTournamentUpdate]);

  // Handler: Load next match (DEF-006 fix)
  const handleLoadNextMatch = useCallback(() => {
    // Find current match index
    const currentIndex = fieldMatches.findIndex(m => m.id === currentMatchData?.id);

    // Find next match without result after current match
    const nextMatch = fieldMatches
      .slice(currentIndex + 1)
      .find(m => m.scoreA === undefined || m.scoreB === undefined);

    if (nextMatch) {
      setSelectedMatchId(nextMatch.id);
    } else {
      // No next match available - show user feedback
      alert('ℹ️ Kein weiteres Spiel auf diesem Feld verfügbar.');
    }
  }, [fieldMatches, currentMatchData]);

  // Handler: Reopen last match
  const handleReopenLastMatch = useCallback(() => {
    if (!lastFinishedMatchData) return;

    // Setze selectedMatchId auf das letzte beendete Spiel
    setSelectedMatchId(lastFinishedMatchData.id);

    // Erstelle neues LiveMatch aus dem letzten beendeten Spiel
    const reopenedMatch: LiveMatch = {
      id: lastFinishedMatchData.id,
      number: lastFinishedMatchData.matchNumber,
      phaseLabel: lastFinishedMatchData.label || (lastFinishedMatchData.phase === 'groupStage' ? 'Vorrunde' : 'Finalrunde'),
      fieldId: `field-${lastFinishedMatchData.field}`,
      scheduledKickoff: lastFinishedMatchData.time,
      durationSeconds: (tournament.groupPhaseGameDuration || tournament.gameDuration || 10) * 60,
      refereeName: lastFinishedMatchData.referee ? `SR ${lastFinishedMatchData.referee}` : undefined,
      homeTeam: { id: lastFinishedMatchData.homeTeam, name: lastFinishedMatchData.homeTeam },
      awayTeam: { id: lastFinishedMatchData.awayTeam, name: lastFinishedMatchData.awayTeam },
      homeScore: lastFinishedMatchData.scoreA || 0,
      awayScore: lastFinishedMatchData.scoreB || 0,
      status: 'PAUSED' as MatchStatus,
      elapsedSeconds: 0,
      events: [],
    };

    setLiveMatches(prev => {
      const updated = new Map(prev);
      updated.set(lastFinishedMatchData.id, reopenedMatch);
      return updated;
    });
  }, [lastFinishedMatchData, tournament]);

  // Handler: Adjust elapsed time
  const handleAdjustTime = useCallback((matchId: string, newElapsedSeconds: number) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {
        console.error('handleAdjustTime: Match not found:', matchId);
        return prev;
      }

      // Ensure time is not negative and doesn't exceed duration
      const adjustedTime = Math.max(0, Math.min(newElapsedSeconds, match.durationSeconds));

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        elapsedSeconds: adjustedTime,
      });
      return updated;
    });
  }, []);

  // Handler: Match selection change with warning
  const handleMatchSelectionChange = useCallback((newMatchId: string | null) => {
    // Prüfe, ob aktuell ein Spiel läuft
    const currentRunningMatch = Array.from(liveMatches.values()).find(m => m.status === 'RUNNING');

    if (currentRunningMatch && currentRunningMatch.id !== newMatchId) {
      const confirmSwitch = window.confirm(
        `⚠️ WARNUNG: Spiel #${currentRunningMatch.number} läuft noch!\n\n` +
        `${currentRunningMatch.homeTeam.name} vs ${currentRunningMatch.awayTeam.name}\n` +
        `Aktueller Stand: ${currentRunningMatch.homeScore}:${currentRunningMatch.awayScore}\n\n` +
        `Wenn Sie zu einem anderen Spiel wechseln, wird das laufende Spiel automatisch beendet.\n\n` +
        `Möchten Sie trotzdem wechseln?`
      );

      if (!confirmSwitch) {
        return; // Abbrechen - Match-Wechsel nicht durchführen
      }

      // Beende das laufende Spiel automatisch
      handleFinish(currentRunningMatch.id);
    }

    // Wechsel durchführen
    setSelectedMatchId(newMatchId);
  }, [liveMatches, handleFinish]);

  return (
    <div style={responsiveContainerStyle}>
      {/* FIELD SELECTOR (if multiple fields) */}
      {tournament.numberOfFields > 1 && (
        <div style={fieldSelectorStyle}>
          {Array.from({ length: tournament.numberOfFields }, (_, i) => i + 1).map((fieldNum) => (
            <button
              key={fieldNum}
              style={fieldButtonStyle(fieldNum === selectedFieldNumber)}
              onClick={() => {
                setSelectedFieldNumber(fieldNum);
                setSelectedMatchId(null); // Reset match selection when changing fields
              }}
            >
              Feld {fieldNum}
            </button>
          ))}
        </div>
      )}

      {/* MATCH SELECTOR */}
      <div style={matchSelectorStyle}>
        <label style={{ display: 'block', marginBottom: theme.spacing.sm, color: theme.colors.text.secondary }}>
          Spiel auswählen (optional - automatisch wird das nächste ausgewählt):
        </label>
        <select
          style={selectStyle}
          value={selectedMatchId || ''}
          onChange={(e) => handleMatchSelectionChange(e.target.value || null)}
        >
          <option value="">Automatisch (nächstes Spiel)</option>
          {fieldMatches.map(match => (
            <option key={match.id} value={match.id}>
              #{match.matchNumber} - {match.homeTeam} vs {match.awayTeam} ({match.time})
              {match.scoreA !== undefined ? ` [${match.scoreA}:${match.scoreB}]` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* MATCH COCKPIT */}
      {currentMatch ? (
        <MatchCockpit
          fieldName={`Feld ${selectedFieldNumber}`}
          tournamentName={tournament.title}
          currentMatch={currentMatch}
          lastFinishedMatch={lastFinishedMatch}
          upcomingMatches={upcomingMatches}
          highlightNextMatchMinutesBefore={5}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onFinish={handleFinish}
          onGoal={handleGoal}
          onUndoLastEvent={handleUndoLastEvent}
          onManualEditResult={handleManualEditResult}
          onAdjustTime={handleAdjustTime}
          onLoadNextMatch={handleLoadNextMatch}
          onReopenLastMatch={handleReopenLastMatch}
        />
      ) : (
        <div style={{
          textAlign: 'center',
          padding: window.innerWidth < 768 ? theme.spacing.lg : theme.spacing.xxl,
          color: theme.colors.text.secondary,
          fontSize: window.innerWidth < 768 ? theme.fontSizes.md : theme.fontSizes.lg,
        }}>
          Keine Spiele auf diesem Feld vorhanden
        </div>
      )}
    </div>
  );
};
