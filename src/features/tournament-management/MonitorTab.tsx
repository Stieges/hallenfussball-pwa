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

import { CSSProperties, useState, useMemo } from 'react'
import { cssVars } from '../../design-tokens'
import { Tournament, Standing } from '../../types/tournament'
import { GeneratedSchedule } from '../../core/generators'
import { useLiveMatches } from '../../hooks/useLiveMatches'
import {
  LiveMatchDisplay,
  NoMatchDisplay,
  FieldSelector,
  FullscreenControls,
  useFullscreen,
  GoalAnimation,
  CardAnimation,
  NextMatchPreview,
} from '../../components/monitor'
import { NextMatchCard, NextMatchInfo } from './components/NextMatchCard'
import { StandingsDisplay } from './components/StandingsDisplay'

interface MonitorTabProps {
  tournament: Tournament
  schedule: GeneratedSchedule
  currentStandings: Standing[]
}

export const MonitorTab: React.FC<MonitorTabProps> = ({
  tournament,
  schedule,
  currentStandings,
}) => {
  const { isFullscreen, toggleFullscreen } = useFullscreen()
  const [selectedField, setSelectedField] = useState(1)

  // Get live match data from localStorage
  const {
    runningMatches,
    pausedMatches,
    lastGoalEvent,
    clearLastGoalEvent,
    lastCardEvent,
    clearLastCardEvent,
    calculateElapsedSeconds,
  } = useLiveMatches(tournament.id)

  // All matches from schedule
  const allMatches = useMemo(
    () => schedule.phases.flatMap((phase) => phase.matches),
    [schedule.phases]
  )

  // Number of fields
  const numberOfFields = tournament.numberOfFields

  // Find running or paused match on selected field
  const activeMatches = useMemo(
    () => [...runningMatches, ...pausedMatches],
    [runningMatches, pausedMatches]
  )

  const matchOnSelectedField = useMemo(
    () => activeMatches.find((m) => (m.field ?? 1) === selectedField),
    [activeMatches, selectedField]
  )

  // Fields with running matches (for indicator dots)
  const fieldsWithRunningMatches = useMemo(
    () => new Set(runningMatches.map((m) => m.field ?? 1)),
    [runningMatches]
  )

  // Find next match (first without result)
  const nextMatch = useMemo<NextMatchInfo | null>(() => {
    const upcoming = allMatches.find(
      (m) => m.scoreA === undefined || m.scoreB === undefined
    )
    if (!upcoming) {return null}

    return {
      id: upcoming.id,
      number: upcoming.matchNumber,
      homeTeam: upcoming.homeTeam,
      awayTeam: upcoming.awayTeam,
      field: upcoming.field,
      group: upcoming.group,
      scheduledTime: upcoming.time,
    }
  }, [allMatches])

  // Calculate remaining seconds for current match
  const currentMatchRemainingSeconds = useMemo(() => {
    if (!matchOnSelectedField) {return 0}
    const elapsed = calculateElapsedSeconds(matchOnSelectedField)
    return Math.max(0, matchOnSelectedField.durationSeconds - elapsed)
  }, [matchOnSelectedField, calculateElapsedSeconds])

  // Whether to show standings (no running matches)
  const showStandings = runningMatches.length === 0 && pausedMatches.length === 0

  // Check if tournament has groups
  const hasGroups = schedule.teams.some((t) => t.group)

  // Styles
  const containerStyle: CSSProperties = {
    minHeight: 'var(--min-h-screen)',
    height: isFullscreen ? 'var(--h-screen)' : 'auto',
    overflow: isFullscreen ? 'hidden' : 'visible',
    padding: isFullscreen ? 0 : cssVars.spacing.xxl,
    background: cssVars.colors.backgroundGradientDark,
    color: cssVars.colors.textPrimary,
    position: 'relative',
    display: isFullscreen ? 'flex' : 'block',
    flexDirection: 'column',
  }

  const contentWrapperStyle: CSSProperties = {
    maxWidth: isFullscreen ? 'none' : '1600px',
    width: '100%',
    height: isFullscreen ? '100%' : 'auto',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: isFullscreen ? 'center' : 'flex-start',
    gap: isFullscreen ? 0 : cssVars.spacing.xxl,
    padding: isFullscreen ? cssVars.spacing.lg : 0,
    flex: isFullscreen ? 1 : undefined,
  }

  const sectionStyle: CSSProperties = {
    background: cssVars.colors.monitorSectionBg,
    borderRadius: cssVars.borderRadius.xl,
    padding: cssVars.spacing.xxl,
    border: `1px solid ${cssVars.colors.border}`,
    boxShadow: cssVars.shadows.lg,
    width: '100%',
  }

  const sectionTitleStyle: CSSProperties = {
    fontSize: '36px',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.primary,
    marginBottom: cssVars.spacing.xl,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textAlign: 'center',
  }

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
                <StandingsDisplay
                  standings={currentStandings}
                  teams={schedule.teams}
                  tournament={tournament}
                />
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
            <NextMatchCard match={nextMatch} tournament={tournament} />
          </section>
        )}
      </div>

      {/* GOAL ANIMATION OVERLAY */}
      <GoalAnimation
        goalEvent={lastGoalEvent}
        onAnimationComplete={clearLastGoalEvent}
      />

      {/* CARD ANIMATION OVERLAY */}
      <CardAnimation
        cardEvent={lastCardEvent}
        onAnimationComplete={clearLastCardEvent}
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
  )
}
