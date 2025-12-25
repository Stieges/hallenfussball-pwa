/**
 * TournamentCard Component
 *
 * Displays tournament summary in dashboard:
 * - Titel
 * - Datum (Beginn)
 * - Ort
 * - Altersklasse
 * - Modus (Jeder gegen Jeden / Gruppen + Finale)
 */

import { CSSProperties } from 'react';
import { Tournament, PlacementCriterion, GroupSystem } from '../types/tournament';
import { Card, Icons } from './ui';
import { theme } from '../styles/theme';
import { getLocationName } from '../utils/locationHelpers';
import { formatTournamentDate } from '../utils/tournamentCategories';

/**
 * Get display name for tournament system
 */
function getGroupSystemLabel(groupSystem?: GroupSystem): string {
  switch (groupSystem) {
    case 'groupsAndFinals':
      return 'Gruppen + Finale';
    case 'roundRobin':
    default:
      return 'Jeder gegen Jeden';
  }
}

/**
 * Get short abbreviation for placement criteria
 */
function getPlacementAbbreviation(id: string): string {
  const abbreviations: Record<string, string> = {
    points: 'Pkt',
    goalDifference: 'Diff',
    goalsFor: 'Tore',
    directComparison: 'DV',
  };
  return abbreviations[id] || id;
}

/**
 * Format placement logic for compact display
 */
function formatPlacementLogic(placementLogic: PlacementCriterion[]): string {
  const active = placementLogic.filter(p => p.enabled);
  if (active.length === 0) {return 'Keine';}
  return active.map(p => getPlacementAbbreviation(p.id)).join(' > ');
}

interface TournamentCardProps {
  tournament: Tournament;
  onClick?: () => void;
  categoryLabel?: string; // Optional: "Läuft", "Bevorstehend", etc.
  onDelete?: () => void; // Optional: Delete callback
}

export const TournamentCard: React.FC<TournamentCardProps> = ({
  tournament,
  onClick,
  categoryLabel,
  onDelete,
}) => {
  const cardStyle: CSSProperties = {
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.2s ease',
    border: `1px solid ${theme.colors.border}`,
    position: 'relative',
  };

  const cardHoverStyle: CSSProperties = {
    ...cardStyle,
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows.md,
  };

  const headerStyle: CSSProperties = {
    marginTop: theme.spacing.xl, // Space below badge
    marginBottom: theme.spacing.md,
  };

  const titleStyle: CSSProperties = {
    fontSize: theme.fontSizes.xl,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary,
    margin: 0,
    paddingRight: '120px', // Space for badge(s)
  };

  const badgeContainerStyle: CSSProperties = {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  };

  const badgeStyle: CSSProperties = {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.fontSizes.xs,
    fontWeight: theme.fontWeights.bold,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  };

  const getBadgeColor = (): { background: string; color: string } => {
    if (tournament.status === 'draft') {
      return {
        background: theme.colors.status.draftBg,
        color: theme.colors.status.draft,
      };
    }
    switch (categoryLabel) {
      case 'Läuft':
        return {
          background: theme.colors.status.liveBg,
          color: theme.colors.status.live,
        };
      case 'Bevorstehend':
        return {
          background: theme.colors.status.upcomingBg,
          color: theme.colors.status.upcoming,
        };
      case 'Beendet':
        return {
          background: theme.colors.status.finishedBg,
          color: theme.colors.status.finished,
        };
      default:
        return {
          background: theme.colors.surface,
          color: theme.colors.text.secondary,
        };
    }
  };

  const infoGridStyle: CSSProperties = {
    display: 'grid',
    gap: theme.spacing.md,
  };

  const infoItemStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  };

  const labelStyle: CSSProperties = {
    fontSize: theme.fontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: theme.colors.text.secondary,
    fontWeight: theme.fontWeights.medium,
  };

  const valueStyle: CSSProperties = {
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary,
    fontWeight: theme.fontWeights.medium,
  };

  const deleteButtonStyle: CSSProperties = {
    marginTop: theme.spacing.md,
    width: '100%',
    background: 'transparent',
    color: theme.colors.text.secondary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    transition: 'all 0.2s ease',
  };

  const badgeColors = getBadgeColor();

  const externalBadgeStyle: CSSProperties = {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    fontSize: '10px',
    fontWeight: theme.fontWeights.medium,
    background: theme.colors.status.externalBg,
    color: theme.colors.status.external,
    whiteSpace: 'nowrap',
  };

  return (
    <Card
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick) {
          Object.assign(e.currentTarget.style, cardHoverStyle);
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          Object.assign(e.currentTarget.style, cardStyle);
        }
      }}
    >
      <article
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={`Turnier: ${tournament.title}, ${categoryLabel || 'Entwurf'}${tournament.externalSource ? `, ${tournament.externalSource}` : ''}`}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {/* Badge container - absolute positioned top-right */}
        <div style={badgeContainerStyle}>
          {tournament.isExternal && tournament.externalSource && (
            <span style={externalBadgeStyle} aria-label={tournament.externalSource}>
              {tournament.externalSource}
            </span>
          )}
          {(categoryLabel || tournament.status === 'draft') && (
            <span
              style={{ ...badgeStyle, ...badgeColors }}
              aria-label={`Status: ${categoryLabel || 'Entwurf'}`}
            >
              {tournament.status === 'draft' ? 'Entwurf' : categoryLabel}
            </span>
          )}
        </div>

        <div style={headerStyle}>
          <h3 style={titleStyle}>{tournament.title}</h3>
        </div>

        <dl style={infoGridStyle}>
          <div style={infoItemStyle}>
            <dt style={labelStyle}>Datum & Uhrzeit</dt>
            <dd style={{ ...valueStyle, margin: 0 }}>{formatTournamentDate(tournament)}</dd>
          </div>

          <div style={infoItemStyle}>
            <dt style={labelStyle}>Ort</dt>
            <dd style={{ ...valueStyle, margin: 0 }}>{getLocationName(tournament)}</dd>
          </div>

          <div style={infoItemStyle}>
            <dt style={labelStyle}>Altersklasse</dt>
            <dd style={{ ...valueStyle, margin: 0 }}>{tournament.ageClass}</dd>
          </div>

          <div style={infoItemStyle}>
            <dt style={labelStyle}>Modus</dt>
            <dd style={{ ...valueStyle, margin: 0 }}>{getGroupSystemLabel(tournament.groupSystem)}</dd>
          </div>

          {tournament.organizer && (
            <div style={infoItemStyle}>
              <dt style={labelStyle}>Veranstalter</dt>
              <dd style={{ ...valueStyle, margin: 0 }}>{tournament.organizer}</dd>
            </div>
          )}

          {tournament.placementLogic && tournament.placementLogic.length > 0 && (
            <div style={infoItemStyle}>
              <dt style={labelStyle}>Platzierung</dt>
              <dd style={{
                ...valueStyle,
                margin: 0,
                fontSize: theme.fontSizes.sm,
                color: theme.colors.text.secondary,
              }}>
                {formatPlacementLogic(tournament.placementLogic)}
              </dd>
            </div>
          )}

          {tournament.status === 'draft' && (
            <div
              style={{
                marginTop: theme.spacing.sm,
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                background: theme.colors.status.draftBg,
                borderRadius: theme.borderRadius.sm,
                fontSize: theme.fontSizes.sm,
                color: theme.colors.text.secondary,
              }}
              role="status"
            >
              Entwurf - Noch nicht veröffentlicht
            </div>
          )}
        </dl>

        {/* Delete Button - Only show if onDelete is provided - At the bottom */}
        {onDelete && (
          <button
            style={deleteButtonStyle}
            onClick={(e) => {
              e.stopPropagation(); // Prevent card click
              onDelete();
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 82, 82, 0.1)';
              e.currentTarget.style.borderColor = theme.colors.error;
              e.currentTarget.style.color = theme.colors.error;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.color = theme.colors.text.secondary;
            }}
            aria-label={`Turnier "${tournament.title}" löschen`}
          >
            <Icons.Trash size={16} />
            <span>Löschen</span>
          </button>
        )}
      </article>
    </Card>
  );
};
