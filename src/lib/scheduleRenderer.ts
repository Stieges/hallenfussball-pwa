/**
 * Schedule Renderer - Export and print formatting functions
 */

import { GeneratedSchedule } from './scheduleTypes'
import { formatTime } from './scheduleHelpers'

// ============================================================================
// PRINT FORMATTING
// ============================================================================

/**
 * Formatiert Schedule für Druckansicht (HTML/PDF)
 */
export function formatScheduleForPrint(schedule: GeneratedSchedule): {
  header: string
  matchList: string
  standingsTable: string
} {
  // Header
  const header = `
    <div class="schedule-header">
      <h1>${schedule.tournament.title}</h1>
      <div class="meta">
        <span>${schedule.tournament.ageClass}</span>
        <span>${schedule.tournament.date}</span>
        <span>${schedule.tournament.location}</span>
      </div>
      <div class="time-info">
        <span>Start: ${formatTime(schedule.startTime)}</span>
        <span>Ende: ${formatTime(schedule.endTime)}</span>
        <span>Dauer: ${schedule.totalDuration} Min.</span>
      </div>
    </div>
  `

  // Match List (gruppiert nach Phase)
  let matchList = '<div class="match-list">'

  schedule.phases.forEach((phase) => {
    matchList += `
      <div class="phase-section">
        <h2>${phase.label}</h2>
        <table class="matches-table">
          <thead>
            <tr>
              <th>Nr.</th>
              <th>Zeit</th>
              <th>Feld</th>
              <th>Begegnung</th>
              ${phase.name === 'groupStage' ? '<th>Gruppe</th>' : ''}
              <th>Ergebnis</th>
            </tr>
          </thead>
          <tbody>
    `

    phase.matches.forEach((match) => {
      matchList += `
        <tr>
          <td>${match.matchNumber}</td>
          <td>${match.time}</td>
          <td>${match.field}</td>
          <td>${match.homeTeam} - ${match.awayTeam}</td>
          ${phase.name === 'groupStage' ? `<td>${match.group || '-'}</td>` : ''}
          <td class="result">__ : __</td>
        </tr>
      `
    })

    matchList += `
          </tbody>
        </table>
      </div>
    `
  })

  matchList += '</div>'

  // Standings Table (Live-Tabelle)
  let standingsTable = '<div class="standings">'

  // Gruppiere nach Gruppen
  const groups = new Set(schedule.teams.map((t) => t.group).filter(Boolean))

  if (groups.size > 0) {
    groups.forEach((group) => {
      standingsTable += `
        <div class="group-standings">
          <h3>Gruppe ${group}</h3>
          <table class="standings-table">
            <thead>
              <tr>
                <th>Platz</th>
                <th>Team</th>
                <th>Sp.</th>
                <th>S</th>
                <th>U</th>
                <th>N</th>
                <th>Tore</th>
                <th>Diff.</th>
                <th>Pkt.</th>
              </tr>
            </thead>
            <tbody>
      `

      const groupTeams = schedule.teams.filter((t) => t.group === group)
      const groupStandings = schedule.initialStandings.filter((s) =>
        groupTeams.some((t) => t.id === s.team.id)
      )

      groupStandings.forEach((standing, index) => {
        standingsTable += `
          <tr>
            <td>${index + 1}</td>
            <td>${standing.team.name}</td>
            <td>${standing.played}</td>
            <td>${standing.won}</td>
            <td>${standing.drawn}</td>
            <td>${standing.lost}</td>
            <td>${standing.goalsFor}:${standing.goalsAgainst}</td>
            <td>${standing.goalDifference > 0 ? '+' : ''}${standing.goalDifference}</td>
            <td><strong>${standing.points}</strong></td>
          </tr>
        `
      })

      standingsTable += `
            </tbody>
          </table>
        </div>
      `
    })
  } else {
    // Keine Gruppen - eine einzige Tabelle
    standingsTable += `
      <div class="standings-single">
        <h3>Tabelle</h3>
        <table class="standings-table">
          <thead>
            <tr>
              <th>Platz</th>
              <th>Team</th>
              <th>Sp.</th>
              <th>S</th>
              <th>U</th>
              <th>N</th>
              <th>Tore</th>
              <th>Diff.</th>
              <th>Pkt.</th>
            </tr>
          </thead>
          <tbody>
    `

    schedule.initialStandings.forEach((standing, index) => {
      standingsTable += `
        <tr>
          <td>${index + 1}</td>
          <td>${standing.team.name}</td>
          <td>${standing.played}</td>
          <td>${standing.won}</td>
          <td>${standing.drawn}</td>
          <td>${standing.lost}</td>
          <td>${standing.goalsFor}:${standing.goalsAgainst}</td>
          <td>${standing.goalDifference > 0 ? '+' : ''}${standing.goalDifference}</td>
          <td><strong>${standing.points}</strong></td>
        </tr>
      `
    })

    standingsTable += `
          </tbody>
        </table>
      </div>
    `
  }

  standingsTable += '</div>'

  return {
    header,
    matchList,
    standingsTable,
  }
}

// ============================================================================
// CSV EXPORT
// ============================================================================

/**
 * Exportiert Schedule als CSV
 */
export function exportScheduleAsCSV(schedule: GeneratedSchedule): string {
  let csv = 'Nr.,Zeit,Feld,Heim,Gast,Gruppe,Phase,Ergebnis\n'

  schedule.allMatches.forEach((match) => {
    csv += `${match.matchNumber},${match.time},${match.field},"${match.homeTeam}","${match.awayTeam}",${match.group ?? ''},${match.phase},\n`
  })

  return csv
}

// ============================================================================
// STATISTICS
// ============================================================================

export interface ScheduleStats {
  totalMatches: number
  groupStageMatches: number
  finalMatches: number
  averageMatchDuration: number
  matchesPerField: Record<number, number>
  peakTime: string
}

/**
 * Berechnet Statistiken für den Schedule
 */
export function calculateScheduleStats(schedule: GeneratedSchedule): ScheduleStats {
  const stats: ScheduleStats = {
    totalMatches: schedule.allMatches.length,
    groupStageMatches: schedule.allMatches.filter((m) => m.phase === 'groupStage').length,
    finalMatches: schedule.allMatches.filter((m) => m.phase !== 'groupStage').length,
    averageMatchDuration: 0,
    matchesPerField: {},
    peakTime: '',
  }

  // Average Match Duration
  const durations = schedule.allMatches.map((m) => m.duration)
  stats.averageMatchDuration = Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)

  // Matches per Field
  schedule.allMatches.forEach((match) => {
    stats.matchesPerField[match.field] = (stats.matchesPerField[match.field] ?? 0) + 1
  })

  return stats
}
