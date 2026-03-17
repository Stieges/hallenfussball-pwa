/**
 * StandingsDisplay - Zeigt Tabellen für Gruppen oder Gesamtturnier
 */
import { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { cssVars } from '../../../design-tokens'
import { Tournament, Standing } from '../../../types/tournament'
import { getGroupDisplayName } from '../../../utils/displayNames'
import { TeamAvatar } from '../../../components/ui/TeamAvatar'

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
  const { t } = useTranslation('tournament');
  const groups = new Set(teams.map((tm) => tm.group).filter(Boolean))

  if (groups.size === 0) {
    return <StandingsTable standings={standings} title={t('standings.table')} />
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: cssVars.spacing.xl,
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
              title={getGroupDisplayName(group ?? '', tournament)}
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
  const { t } = useTranslation('tournament');
  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '22px',
  }

  const thStyle: CSSProperties = {
    background: cssVars.colors.primary,
    color: cssVars.colors.background,
    padding: `${cssVars.spacing.lg} ${cssVars.spacing.md}`,
    textAlign: 'left',
    fontWeight: cssVars.fontWeights.bold,
    fontSize: '20px',
  }

  const tdStyle: CSSProperties = {
    padding: `${cssVars.spacing.lg} ${cssVars.spacing.md}`,
    borderBottom: `2px solid ${cssVars.colors.border}`,
    fontSize: '20px',
  }

  const titleStyle: CSSProperties = {
    fontSize: '32px',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    marginBottom: cssVars.spacing.lg,
    textAlign: 'center',
  }

  return (
    <div>
      <div style={titleStyle}>{title}</div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>{t('standings.rank')}</th>
            <th style={{ ...thStyle, textAlign: 'left' }}>{t('standings.team')}</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>{t('standings.played')}</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>{t('standings.goals')}</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>{t('standings.diff')}</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>{t('standings.points')}</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((standing, index) => (
            <tr key={standing.team.id}>
              <td
                style={{
                  ...tdStyle,
                  fontWeight: cssVars.fontWeights.bold,
                  textAlign: 'center',
                }}
              >
                {index + 1}
              </td>
              <td style={tdStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm }}>
                  <TeamAvatar team={standing.team} size="xs" />
                  {standing.team.name}
                </div>
              </td>
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
                  fontWeight: cssVars.fontWeights.bold,
                  color: cssVars.colors.primary,
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
