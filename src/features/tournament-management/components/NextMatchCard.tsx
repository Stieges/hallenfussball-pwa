/**
 * NextMatchCard - Zeigt das nächste anstehende Spiel
 */
import { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { cssVars } from '../../../design-tokens'
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
  const { t } = useTranslation('tournament');
  const cardStyle: CSSProperties = {
    background: cssVars.colors.gradientNextMatch,
    borderRadius: cssVars.borderRadius.lg,
    padding: cssVars.spacing.xl,
    border: `2px solid ${cssVars.colors.primary}`,
    textAlign: 'center',
  }

  const timeStyle: CSSProperties = {
    fontSize: '28px',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.primary,
    marginBottom: cssVars.spacing.md,
  }

  const teamsStyle: CSSProperties = {
    fontSize: '42px',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
  }

  const metaStyle: CSSProperties = {
    fontSize: '20px',
    color: cssVars.colors.textSecondary,
    marginTop: cssVars.spacing.md,
  }

  return (
    <div style={cardStyle}>
      {match.scheduledTime && <div style={timeStyle}>{match.scheduledTime}</div>}
      <div style={teamsStyle}>
        {match.homeTeam} vs. {match.awayTeam}
      </div>
      <div style={metaStyle}>
        {t('nextMatch.matchNumber', { number: match.number })}
        {match.field && ` · ${t('nextMatch.field', { field: match.field })}`}
        {match.group && ` · ${getGroupDisplayName(match.group, tournament)}`}
      </div>
    </div>
  )
}
