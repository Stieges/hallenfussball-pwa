/**
 * NextMatchCard - Zeigt das nächste anstehende Spiel
 */
import { CSSProperties } from 'react'
import { theme } from '../../../styles/theme'
import { Tournament } from '../../../types/tournament'
import { getGroupDisplayName } from '../../../utils/displayNames'

export interface NextMatchInfo {
  id: string
  number: number
  homeTeam: string
  awayTeam: string
  field?: number
  group?: string
  scheduledTime?: string
}

interface NextMatchCardProps {
  match: NextMatchInfo
  tournament: Tournament
}

export const NextMatchCard: React.FC<NextMatchCardProps> = ({ match, tournament }) => {
  const cardStyle: CSSProperties = {
    background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.1), rgba(0, 176, 255, 0.1))',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    border: `2px solid ${theme.colors.primary}`,
    textAlign: 'center',
  }

  const timeStyle: CSSProperties = {
    fontSize: '28px',
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.md,
  }

  const teamsStyle: CSSProperties = {
    fontSize: '42px',
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.text.primary,
  }

  const metaStyle: CSSProperties = {
    fontSize: '20px',
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.md,
  }

  return (
    <div style={cardStyle}>
      {match.scheduledTime && <div style={timeStyle}>{match.scheduledTime}</div>}
      <div style={teamsStyle}>
        {match.homeTeam} vs. {match.awayTeam}
      </div>
      <div style={metaStyle}>
        Spiel {match.number}
        {match.field && ` · Feld ${match.field}`}
        {match.group && ` · ${getGroupDisplayName(match.group, tournament)}`}
      </div>
    </div>
  )
}
