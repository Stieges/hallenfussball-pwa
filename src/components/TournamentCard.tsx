/**
 * TournamentCard Component (@OB-079): zeigt nur, was man zum Finden braucht.
 * Zeile 1: Name (höchstens zwei Zeilen, kein Wortbruch), Zustandswort, Menü. Zeile 2: Zeit (unter „Heute“ nur die Uhrzeit,
 * sonst Tag und Uhrzeit) und Ort. Altersklasse, Modus, Veranstalter und Platzierung stehen in der Übersicht des Turniers.
 */

import { isTournamentClosed, lifecycleOf } from '../core/services/lifecycle';
import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Tournament } from '../types/tournament';
import { Card } from './ui';
import { cssVars } from '../design-tokens';
import { getLocationName } from '../utils/locationHelpers';
import { formatCardTime } from '../utils/formatCardTime';
import { TournamentActionMenu } from './TournamentActionMenu';
import { useTournamentStartState } from '../hooks/useTournamentStartState';
import { canWithListedRole } from '../features/auth/hooks/useCan';
import { TextTag } from './ui/atoms';
import { LateFinishNotice } from './LateFinishNotice';
import { badgeContainerStyle, statusBadgeColors, statusBadgeStyle } from './tournamentCardStyles';
import { useIsMobile } from '../hooks/useIsMobile';

/** Map categoryLabel to TournamentActionMenu category */
type TournamentCategory = 'running' | 'upcoming' | 'finished' | 'draft' | 'trashed';

interface TournamentCardProps {
  tournament: Tournament;
  onClick?: () => void;
  categoryLabel?: string; // Optional: "running", "upcoming", "draft", "archived", etc.
  /** Steht die Karte unter „Heute“? Dann zeigt sie nur die Uhrzeit, sonst Tag und Uhrzeit (@OB-079). */
  inToday?: boolean;
  /** Soft delete callback (moves to trash) */
  onSoftDelete?: () => void;
  /** Copy/duplicate callback */
  onCopy?: () => void;
  /** Share callback */
  onShare?: () => void;
  /** Test ID for E2E tests */
  testId?: string;
}

const titleStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.lg,
  fontWeight: cssVars.fontWeights.semibold,
  color: cssVars.colors.textPrimary,
  lineHeight: cssVars.lineHeights.bodyMd,
  margin: 0,
  // höchstens zwei Zeilen, nie ein Wort trennen (@OB-058)
  overflowWrap: 'normal',
  wordBreak: 'normal',
  hyphens: 'manual',
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  overflow: 'hidden',
};

const metaRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: cssVars.spacing.sm,
  minWidth: 0,
  fontSize: cssVars.fontSizes.md,
  color: cssVars.colors.textSecondary,
};

const externalBadgeStyle: CSSProperties = {
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
  borderRadius: cssVars.borderRadius.sm,
  fontSize: cssVars.fontSizes.sm,
  fontWeight: cssVars.fontWeights.medium,
  background: cssVars.colors.statusExternalBg,
  color: cssVars.colors.statusExternal,
  whiteSpace: 'nowrap',
};

export const TournamentCard: React.FC<TournamentCardProps> = ({
  tournament,
  onClick,
  categoryLabel,
  inToday = false,
  onSoftDelete,
  onCopy,
  onShare,
  testId,
}) => {
  const { t, i18n } = useTranslation('dashboard');
  const isMobile = useIsMobile();
  // @LZ-003 / W4: Papierkorb nur vor dem ersten Anpfiff — gleiche gemeinsame
  // Anpfiff-Funktion wie „Turnier löschen" (DangerZone) und „Im Wizard bearbeiten".
  // P1: Live-Abfrage nur, wenn ein Papierkorb angeboten werden könnte.
  // CA-5 (@HE-085, Auflage 10c): „Löschen“ nur mit dem Recht deleteTournament; ohne Rolle (Gast, lokal) = eigenes Turnier.
  const { myRole } = tournament;
  const mayDelete = canWithListedRole(myRole, 'deleteTournament', isTournamentClosed(tournament)); // R3-3: abgeschlossen = kein Papierkorb
  const { state: matchStartState } = useTournamentStartState(tournament, {
    enabled: Boolean(onSoftDelete) && mayDelete,
  });

  const getCategoryDisplayLabel = (): string => {
    if (tournament.status === 'draft') { return t('status.draft'); }
    if (!categoryLabel) { return t('status.draft'); }
    // @LZ-001: im Archiv trägt die Karte dasselbe Wort wie der Zustand – Abgeschlossen oder Abgebrochen
    if (categoryLabel === 'archived') { return lifecycleOf(tournament) === 'cancelled' ? t('status.cancelled') : t('status.finished'); }
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
  const deleteHandler = mayDelete && matchStartState === 'not-started' ? onSoftDelete : undefined;
  const cardStyle: CSSProperties = {
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.2s ease',
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
    position: 'relative',
    // Am Handy knapper Innenabstand: alle Turniere des Tages sollen ohne Scrollen sichtbar sein (@OB-079)
    padding: isMobile ? `${cssVars.spacing.sm} ${cssVars.spacing.md}` : `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
  };

  const cardHoverStyle: CSSProperties = {
    ...cardStyle,
    transform: 'translateY(-2px)',
    boxShadow: cssVars.shadows.md,
  };

  const badgeColors = statusBadgeColors(tournament.status, categoryLabel);

  // Check if we need to show action menu (has any action handlers)
  const hasActions = onClick !== undefined || onCopy !== undefined || onShare !== undefined || deleteHandler !== undefined;

  const location = getLocationName(tournament);
  const timeText = formatCardTime(tournament, i18n.language, !inToday, t('card.noDate'));

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
        {/* Zeile 1: Name, Zustandswort, Menü */}
        <div style={badgeContainerStyle}>
          <h3 style={{ ...titleStyle, flex: '1 1 0', minWidth: 0 }} title={tournament.title}>{tournament.title}</h3>
          {tournament.isExternal && tournament.externalSource && (
            <span style={externalBadgeStyle} aria-label={tournament.externalSource}>
              {tournament.externalSource}
            </span>
          )}
          {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR: show badge if categoryLabel or draft */}
          {(categoryLabel || tournament.status === 'draft') && (
            <span
              style={{ ...statusBadgeStyle, ...badgeColors }}
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

        {/* Zeile 2: Zeit und Ort (einzeilig, der Ort wird mit Auslassung gekürzt) */}
        <div style={metaRowStyle} data-testid="card-meta">
          <span style={{ whiteSpace: 'nowrap', fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }} data-testid="card-time">{timeText}</span>
          {location !== '' && (
            <>
              <span aria-hidden="true">·</span>
              <span
                title={location}
                data-testid="card-location"
                style={{ minWidth: 0, flex: '1 1 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {location}
              </span>
            </>
          )}
          {myRole !== undefined && myRole !== 'owner' && (
            <TextTag testId={`tournament-role-${tournament.id}`}>
              {t(`card.role.${myRole}`)}
            </TextTag>
          )}
        </div>
        <LateFinishNotice tournament={tournament} mayFinish={myRole !== undefined && canWithListedRole(myRole, 'manageLifecycle')} />
      </article>
    </Card>
  );
};
