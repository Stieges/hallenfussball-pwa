/**
 * StandingsDisplay - Zeigt Tabellen für Gruppen oder Gesamtturnier
 */
import { CSSProperties } from 'react'
import { colors, fontWeights, spacing } from '../../../design-tokens';
import { Tournament, Standing } from '../../../types/tournament'
import { getGroupDisplayName } from '../../../utils/displayNames'

interface StandingsDisplayProps {
  standings: Standing[]
  teams: { id: string; name: string; group?: string }[]
  tournament: Tournament
}

export const StandingsDisplay: React.FC<StandingsDisplayProps> = ({
  standings,
  teams,
  tournament,
}) => {
  const groups = new Set(teams.map((t) => t.group).filter(Boolean))

  if (groups.size === 0) {
    return <StandingsTable standings={standings} title="Tabelle" />
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: spacing.xl,
      }}
    >
      {Array.from(groups)
        .sort()
        .map((group) => {
          const groupTeams = teams.filter((t) => t.group === group)
          const groupStandings = standings
            .filter((s) => groupTeams.some((t) => t.id === s.team.id))
            .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference)

          return (
            <StandingsTable
              key={group}
              standings={groupStandings}
              title={getGroupDisplayName(group!, tournament)}
            />
          )
        })}
    </div>
  )
}

// ============================================================================
// StandingsTable
// ============================================================================

interface StandingsTableProps {
  standings: Standing[]
  title: string
}

export const StandingsTable: React.FC<StandingsTableProps> = ({ standings, title }) => {
  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '22px',
  }

  const thStyle: CSSProperties = {
    background: colors.primary,
    color: colors.background,
    padding: `${spacing.lg} ${spacing.md}`,
    textAlign: 'left',
    fontWeight: fontWeights.bold,
    fontSize: '20px',
  }

  const tdStyle: CSSProperties = {
    padding: `${spacing.lg} ${spacing.md}`,
    borderBottom: `2px solid ${colors.border}`,
    fontSize: '20px',
  }

  const titleStyle: CSSProperties = {
    fontSize: '32px',
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  }

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
              <td
                style={{
                  ...tdStyle,
                  fontWeight: fontWeights.bold,
                  textAlign: 'center',
                }}
              >
                {index + 1}
              </td>
              <td style={tdStyle}>{standing.team.name}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{standing.played || 0}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                {standing.goalsFor}:{standing.goalsAgainst}
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                {standing.goalDifference > 0
                  ? `+${standing.goalDifference}`
                  : standing.goalDifference}
              </td>
              <td
                style={{
                  ...tdStyle,
                  textAlign: 'center',
                  fontWeight: fontWeights.bold,
                  color: colors.primary,
                }}
              >
                {standing.points || 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
