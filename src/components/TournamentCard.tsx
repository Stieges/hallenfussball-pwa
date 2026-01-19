/**
 * TournamentCard Component
 *
 * Displays tournament summary in dashboard:
 * - Titel
 * - Datum (Beginn)
 * - Ort
 * - Altersklasse
 * - Modus (Jeder gegen Jeden / Gruppen + Finale)
 * - Action menu (dropdown on desktop, bottom sheet on mobile)
 */

import { CSSProperties } from 'react';
import { Tournament, PlacementCriterion, GroupSystem } from '../types/tournament';
import { Card } from './ui';
import { cssVars } from '../design-tokens'
import { getLocationName } from '../utils/locationHelpers';
import { formatTournamentDate } from '../utils/tournamentCategories';
import { TournamentActionMenu } from './TournamentActionMenu';

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

/** Map categoryLabel to TournamentActionMenu category */
type TournamentCategory = 'running' | 'upcoming' | 'finished' | 'draft' | 'trashed';

interface TournamentCardProps {
  tournament: Tournament;
  onClick?: () => void;
  categoryLabel?: string; // Optional: "Läuft", "Bevorstehend", etc.
  /** Soft delete callback (moves to trash) */
  onSoftDelete?: () => void;
  /** Copy/duplicate callback */
  onCopy?: () => void;
  /** Share callback */
  onShare?: () => void;
  /** Test ID for E2E tests */
  testId?: string;
}

export const TournamentCard: React.FC<TournamentCardProps> = ({
  tournament,
  onClick,
  categoryLabel,
  onSoftDelete,
  onCopy,
  onShare,
  testId,
}) => {
  // Map categoryLabel to TournamentCategory
  const getCategory = (): TournamentCategory => {
    if (tournament.status === 'draft') {return 'draft';}
    switch (categoryLabel) {
      case 'Läuft':
        return 'running';
      case 'Bevorstehend':
        return 'upcoming';
      case 'Beendet':
        return 'finished';
      default:
        // Check for archived label pattern
        if (categoryLabel?.startsWith('Archiviert')) {return 'finished';}
        return 'draft';
    }
  };

  const category = getCategory();
  const deleteHandler = onSoftDelete;
  const cardStyle: CSSProperties = {
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.2s ease',
    border: `1px solid ${cssVars.colors.border}`,
    position: 'relative',
  };

  const cardHoverStyle: CSSProperties = {
    ...cardStyle,
    transform: 'translateY(-2px)',
    boxShadow: cssVars.shadows.md,
  };

  const headerStyle: CSSProperties = {
    marginTop: cssVars.spacing.xl, // Space below badge
    marginBottom: cssVars.spacing.md,
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    margin: 0,
    paddingRight: '120px', // Space for badge(s)
  };

  const badgeContainerStyle: CSSProperties = {
    position: 'absolute',
    top: cssVars.spacing.md,
    right: cssVars.spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  };

  const badgeStyle: CSSProperties = {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.bold,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  };

  const getBadgeColor = (): { background: string; color: string } => {
    if (tournament.status === 'draft') {
      return {
        background: cssVars.colors.statusDraftBg,
        color: cssVars.colors.statusDraft,
      };
    }
    switch (categoryLabel) {
      case 'Läuft':
        return {
          background: cssVars.colors.statusLiveBg,
          color: cssVars.colors.statusLive,
        };
      case 'Bevorstehend':
        return {
          background: cssVars.colors.statusUpcomingBg,
          color: cssVars.colors.statusUpcoming,
        };
      case 'Beendet':
        return {
          background: cssVars.colors.statusFinishedBg,
          color: cssVars.colors.statusFinished,
        };
      default:
        return {
          background: cssVars.colors.surface,
          color: cssVars.colors.textSecondary,
        };
    }
  };

  const infoGridStyle: CSSProperties = {
    display: 'grid',
    gap: cssVars.spacing.md,
  };

  const infoItemStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
  };

  const labelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: cssVars.colors.textSecondary,
    fontWeight: cssVars.fontWeights.medium,
  };

  const valueStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textPrimary,
    fontWeight: cssVars.fontWeights.medium,
  };

  const badgeColors = getBadgeColor();

  // Check if we need to show action menu (has any action handlers)
  const hasActions = onClick !== undefined || onCopy !== undefined || onShare !== undefined || deleteHandler !== undefined;

  const externalBadgeStyle: CSSProperties = {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: '10px',
    fontWeight: cssVars.fontWeights.medium,
    background: cssVars.colors.statusExternalBg,
    color: cssVars.colors.statusExternal,
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
      data-testid={testId ?? `tournament-card-${tournament.id}`}
    >
      <article
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty categoryLabel should show 'Entwurf'
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
          {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR: show badge if categoryLabel or draft */}
          {(categoryLabel || tournament.status === 'draft') && (
            <span
              style={{ ...badgeStyle, ...badgeColors }}
              // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty categoryLabel should show 'Entwurf'
              aria-label={`Status: ${categoryLabel || 'Entwurf'}`}
            >
              {tournament.status === 'draft' ? 'Entwurf' : categoryLabel}
            </span>
          )}
          {/* Action Menu - Only show if actions available */}
          {hasActions && (
            <div onClick={(e) => e.stopPropagation()}>
              <TournamentActionMenu
                tournament={tournament}
                category={category}
                onOpen={onClick}
                onCopy={onCopy}
                onShare={onShare}
                onDelete={deleteHandler}
                testId={`tournament-${tournament.id}-actions`}
              />
            </div>
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

          {tournament.placementLogic.length > 0 && (
            <div style={infoItemStyle}>
              <dt style={labelStyle}>Platzierung</dt>
              <dd style={{
                ...valueStyle,
                margin: 0,
                fontSize: cssVars.fontSizes.sm,
                color: cssVars.colors.textSecondary,
              }}>
                {formatPlacementLogic(tournament.placementLogic)}
              </dd>
            </div>
          )}

          {tournament.status === 'draft' && (
            <div
              style={{
                marginTop: cssVars.spacing.sm,
                padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
                background: cssVars.colors.statusDraftBg,
                borderRadius: cssVars.borderRadius.sm,
                fontSize: cssVars.fontSizes.sm,
                color: cssVars.colors.textSecondary,
              }}
              role="status"
            >
              Entwurf - Noch nicht veröffentlicht
            </div>
          )}
        </dl>
      </article>
    </Card>
  );
};
