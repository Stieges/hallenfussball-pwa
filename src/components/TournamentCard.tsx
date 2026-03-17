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
import { useTranslation } from 'react-i18next';
import { Tournament, PlacementCriterion, GroupSystem } from '../types/tournament';
import { Card } from './ui';
import { cssVars } from '../design-tokens'
import { getLocationName } from '../utils/locationHelpers';
import { formatTournamentDate } from '../utils/tournamentCategories';
import { TournamentActionMenu } from './TournamentActionMenu';

/** Map categoryLabel to TournamentActionMenu category */
type TournamentCategory = 'running' | 'upcoming' | 'finished' | 'draft' | 'trashed';

interface TournamentCardProps {
  tournament: Tournament;
  onClick?: () => void;
  categoryLabel?: string; // Optional: "running", "upcoming", "draft", "archived", etc.
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
  const { t } = useTranslation('dashboard');

  // Helper functions that need t()
  const getGroupSystemLabel = (groupSystem?: GroupSystem): string => {
    switch (groupSystem) {
      case 'groupsAndFinals':
        return t('card.groupSystem.groupsAndFinals');
      case 'roundRobin':
      default:
        return t('card.groupSystem.roundRobin');
    }
  };

  const getPlacementAbbreviation = (id: string): string => {
    const key = `card.placementAbbreviations.${id}`;
    return t(key, { defaultValue: id });
  };

  const formatPlacementLogic = (placementLogic: PlacementCriterion[]): string => {
    const active = placementLogic.filter(p => p.enabled);
    if (active.length === 0) { return t('card.noPlacement'); }
    return active.map(p => getPlacementAbbreviation(p.id)).join(' > ');
  };

  const getCategoryDisplayLabel = (): string => {
    if (tournament.status === 'draft') { return t('status.draft'); }
    if (!categoryLabel) { return t('status.draft'); }
    const key = `status.${categoryLabel}`;
    return t(key, { defaultValue: categoryLabel });
  };

  // Map categoryLabel to TournamentCategory
  const getCategory = (): TournamentCategory => {
    if (tournament.status === 'draft') {return 'draft';}
    switch (categoryLabel) {
      case 'running':
        return 'running';
      case 'upcoming':
        return 'upcoming';
      case 'finished':
        return 'finished';
      default:
        if (categoryLabel?.startsWith('archived')) {return 'finished';}
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
      case 'running':
        return {
          background: cssVars.colors.statusLiveBg,
          color: cssVars.colors.statusLive,
        };
      case 'upcoming':
        return {
          background: cssVars.colors.statusUpcomingBg,
          color: cssVars.colors.statusUpcoming,
        };
      case 'finished':
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
        aria-label={tournament.externalSource
          ? t('card.ariaLabelExternal', { title: tournament.title, status: getCategoryDisplayLabel(), source: tournament.externalSource })
          : t('card.ariaLabel', { title: tournament.title, status: getCategoryDisplayLabel() })}
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
              aria-label={t('card.statusLabel', { status: getCategoryDisplayLabel() })}
            >
              {tournament.status === 'draft' ? t('status.draft') : getCategoryDisplayLabel()}
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
            <dt style={labelStyle}>{t('card.labels.dateTime')}</dt>
            <dd style={{ ...valueStyle, margin: 0 }}>{formatTournamentDate(tournament)}</dd>
          </div>

          <div style={infoItemStyle}>
            <dt style={labelStyle}>{t('card.labels.location')}</dt>
            <dd style={{ ...valueStyle, margin: 0 }}>{getLocationName(tournament)}</dd>
          </div>

          <div style={infoItemStyle}>
            <dt style={labelStyle}>{t('card.labels.ageClass')}</dt>
            <dd style={{ ...valueStyle, margin: 0 }}>{tournament.ageClass}</dd>
          </div>

          <div style={infoItemStyle}>
            <dt style={labelStyle}>{t('card.labels.mode')}</dt>
            <dd style={{ ...valueStyle, margin: 0 }}>{getGroupSystemLabel(tournament.groupSystem)}</dd>
          </div>

          {tournament.organizer && (
            <div style={infoItemStyle}>
              <dt style={labelStyle}>{t('card.labels.organizer')}</dt>
              <dd style={{ ...valueStyle, margin: 0 }}>{tournament.organizer}</dd>
            </div>
          )}

          {tournament.placementLogic.length > 0 && (
            <div style={infoItemStyle}>
              <dt style={labelStyle}>{t('card.labels.placement')}</dt>
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
              {t('card.draftNotice')}
            </div>
          )}
        </dl>
      </article>
    </Card>
  );
};
