/**
 * UpcomingMatchesSidebar - Zeigt anstehende Spiele
 *
 * Für Stadionsprecher & Organisation
 * Reine Präsentation - alle Daten über Props
 */

import { CSSProperties } from 'react';
import { theme } from '../../styles/theme';
import { Button, Card } from '../ui';
import { useIsMobile } from '../../hooks/useIsMobile';
import { calculateMinutesUntil } from '../../utils/timeHelpers';
import { MatchSummary } from './MatchCockpit';

interface UpcomingMatchesSidebarProps {
  upcomingMatches: MatchSummary[];
  highlightMinutesBefore?: number;
  fieldName?: string; // BUG-MOD-003 FIX: Pass field name for display
}

export const UpcomingMatchesSidebar: React.FC<UpcomingMatchesSidebarProps> = ({
  upcomingMatches,
  highlightMinutesBefore = 5,
  fieldName,
}) => {
  const isMobile = useIsMobile();

  const cardHeaderStyle: CSSProperties = {
    marginBottom: isMobile ? theme.spacing.sm : theme.spacing.md,
  };

  const cardTitleStyle: CSSProperties = {
    fontSize: isMobile ? theme.fontSizes.md : theme.fontSizes.lg,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary,
    marginBottom: '2px',
  };

  const cardSubtitleStyle: CSSProperties = {
    fontSize: isMobile ? theme.fontSizes.xs : theme.fontSizes.sm,
    color: theme.colors.text.secondary,
  };

  const matchesContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  };

  return (
    <Card>
      <div style={cardHeaderStyle}>
        <div style={cardTitleStyle}>Nächste Spiele{fieldName ? ` – ${fieldName}` : ''}</div>
        <div style={cardSubtitleStyle}>Für Stadionsprecher & Organisation</div>
      </div>

      <div style={matchesContainerStyle}>
        {upcomingMatches.length === 0 ? (
          <div style={{ padding: theme.spacing.lg, textAlign: 'center', color: theme.colors.text.secondary }}>
            Keine anstehenden Spiele
          </div>
        ) : (
          upcomingMatches.map((match, index) => {
            const minutesUntil = calculateMinutesUntil(match.scheduledKickoff);
            const isHighlighted =
              index === 0 && minutesUntil !== null && minutesUntil >= 0 && minutesUntil <= highlightMinutesBefore;

            return (
              <NextMatchCard
                key={match.id}
                match={match}
                minutesUntil={minutesUntil}
                isHighlighted={isHighlighted}
                isFirst={index === 0}
              />
            );
          })
        )}
      </div>
    </Card>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface NextMatchCardProps {
  match: MatchSummary;
  minutesUntil: number | null;
  isHighlighted: boolean;
  isFirst: boolean;
}

const NextMatchCard: React.FC<NextMatchCardProps> = ({ match, minutesUntil, isHighlighted, isFirst }) => {
  const isMobile = useIsMobile();

  const cardStyle: CSSProperties = {
    borderRadius: theme.borderRadius.lg,
    padding: isMobile ? theme.spacing.lg : theme.spacing.md,
    border: isHighlighted ? `1px solid ${theme.colors.warning}` : `1px solid ${theme.colors.border}`,
    background: 'radial-gradient(circle at top left, rgba(15, 23, 42, 0.95), rgba(3, 7, 18, 0.96))',
    display: 'flex',
    flexDirection: 'column',
    gap: isMobile ? theme.spacing.sm : theme.spacing.xs,
    position: 'relative',
    overflow: 'hidden',
    boxShadow: isHighlighted ? `0 10px 30px ${theme.colors.warning}35` : 'none',
  };

  const glowStyle: CSSProperties = {
    position: 'absolute',
    inset: '-40%',
    background: `radial-gradient(circle at 10% 0, ${theme.colors.warning}40, transparent 55%)`,
    pointerEvents: 'none',
    opacity: isHighlighted ? 0.5 : 0,
  };

  const pillStyle: CSSProperties = {
    fontSize: isMobile ? theme.fontSizes.sm : theme.fontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#fef3c7',
    background: `${theme.colors.warning}20`,
    borderRadius: '999px',
    padding: isMobile ? `6px ${theme.spacing.md}` : `3px ${theme.spacing.sm}`,
    border: `1px solid ${theme.colors.warning}80`,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    alignSelf: 'flex-start',
  };

  const timeStyle: CSSProperties = {
    fontSize: isMobile ? theme.fontSizes.sm : theme.fontSizes.xs,
    color: theme.colors.text.secondary,
  };

  const teamsStyle: CSSProperties = {
    fontSize: isMobile ? theme.fontSizes.lg : theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary,
  };

  const metaStyle: CSSProperties = {
    fontSize: isMobile ? theme.fontSizes.md : theme.fontSizes.sm,
    color: theme.colors.text.secondary,
  };

  const actionsStyle: CSSProperties = {
    marginTop: theme.spacing.xs,
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    flexWrap: 'wrap',
    gap: isMobile ? theme.spacing.sm : '6px',
  };

  const getTimeLabel = () => {
    if (isFirst && minutesUntil !== null && minutesUntil >= 0) {
      return `Geplante Anstoßzeit: ${match.scheduledKickoff}`;
    }
    if (isFirst) {
      return `Danach · ca. ${match.scheduledKickoff}`;
    }
    return `Später · ca. ${match.scheduledKickoff}`;
  };

  return (
    <div style={cardStyle}>
      <div style={glowStyle} />

      {isHighlighted && minutesUntil !== null && (
        <div style={pillStyle}>
          <span>In ca. {minutesUntil} Minuten</span>
        </div>
      )}

      <div style={timeStyle}>{getTimeLabel()}</div>

      <div style={teamsStyle}>
        Spiel {match.number}: {match.homeTeam.name} vs. {match.awayTeam.name}
      </div>

      <div style={metaStyle}>{match.phaseLabel}</div>

      {isFirst && (
        <div style={actionsStyle}>
          <Button
            variant="secondary"
            size={isMobile ? "md" : "sm"}
            disabled
            style={{ flex: isMobile ? '1' : '0 1 auto', minHeight: isMobile ? '48px' : 'auto', opacity: 0.5, cursor: 'not-allowed' }}
          >
            Ansage-Text anzeigen
          </Button>
          <Button
            variant="secondary"
            size={isMobile ? "md" : "sm"}
            disabled
            style={{ flex: isMobile ? '1' : '0 1 auto', minHeight: isMobile ? '48px' : 'auto', opacity: 0.5, cursor: 'not-allowed' }}
          >
            Paarung auf Hallenanzeige
          </Button>
        </div>
      )}
    </div>
  );
};

// Note: calculateMinutesUntil is now imported from utils/timeHelpers.ts
