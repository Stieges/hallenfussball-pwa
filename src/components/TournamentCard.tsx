/**
 * TournamentCard Component (@OB-079): zeigt nur, was man zum Finden braucht.
 * Zeile 1: Name in voller Breite (höchstens zwei Zeilen, kein Wortbruch, nie abgeschnitten). Zeile 2: Zeit (unter „Heute“ nur die
 * Uhrzeit, sonst Tag und Uhrzeit) und Zustandswort. Zeile 3: Ort, nie gekürzt. Das Menü steht rechts neben Zeile 2 und 3.
 * Altersklasse, Modus, Veranstalter und Platzierung stehen in der Übersicht des Turniers.
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
import { statusBadgeColors, statusBadgeStyle } from './tournamentCardStyles';
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
  // nie ein Wort trennen, nie abschneiden (@OB-058); in voller Breite bleiben auch 50 Zeichen bei zwei Zeilen
  overflowWrap: 'normal',
  wordBreak: 'normal',
  hyphens: 'manual',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  columnGap: cssVars.spacing.sm,
  alignItems: 'center',
};

const lineStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: cssVars.spacing.sm,
  minWidth: 0,
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

  // Die Karte unter der Maus liegt über ihren Nachbarn: das Aktionsmenü ragt bei den kompakten Karten in die nächste Karte hinein und
  // bliebe sonst (Stapelkontext durch `transform`) unter ihr, nicht klickbar (@OB-079). Beim Verlassen wird beides wieder zurückgesetzt.
  const cardHoverStyle: CSSProperties = {
    ...cardStyle,
    transform: 'translateY(-2px)',
    boxShadow: cssVars.shadows.md,
    zIndex: 1,
  };
  const cardRestStyle: CSSProperties = { ...cardStyle, transform: 'none', zIndex: 'auto' };

  const badgeColors = statusBadgeColors(tournament.status, categoryLabel);

  // Check if we need to show action menu (has any action handlers)
  const hasActions = onClick !== undefined || onCopy !== undefined || onShare !== undefined || deleteHandler !== undefined;

  const location = getLocationName(tournament);
  const timeText = formatCardTime(tournament, i18n.language, !inToday, t('card.noDate'));
  // Der aria-label der Karte überdeckt ihren Inhalt: Zeit und Ort gehören hinein (sonst liest der Screenreader nur Name und Zustand vor)
  const labelParams = {
    title: tournament.title,
    status: getCategoryDisplayLabel(),
    time: timeText !== '' ? timeText : t('sections.today'),
    location,
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
          Object.assign(e.currentTarget.style, cardRestStyle);
        }
      }}
      data-testid={testId ?? `tournament-card-${tournament.id}`}
    >
      <article
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={tournament.externalSource
          ? t(location !== '' ? 'card.ariaLabelExternal' : 'card.ariaLabelExternalNoLocation', { ...labelParams, source: tournament.externalSource })
          : t(location !== '' ? 'card.ariaLabel' : 'card.ariaLabelNoLocation', labelParams)}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {/* Zeile 1: Name in voller Breite */}
        <h3 style={titleStyle} title={tournament.title}>{tournament.title}</h3>

        {/* Zeile 2: Zeit und Zustandswort; Zeile 3: Ort in der Breite neben dem Menü, das beide Zeilen rechts begleitet (der Ort wird nie gekürzt) */}
        <div style={gridStyle}>
          <div style={{ ...lineStyle, gridColumn: 1, gridRow: 1 }}>
            {timeText !== '' && (
              <span style={{ fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.md }} data-testid="card-time">{timeText}</span>
            )}
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
            {myRole !== undefined && myRole !== 'owner' && (
              <TextTag testId={`tournament-role-${tournament.id}`}>
                {t(`card.role.${myRole}`)}
              </TextTag>
            )}
          </div>
          {location !== '' && (
            <div style={{ gridColumn: 1, gridRow: 2, minWidth: 0, fontSize: cssVars.fontSizes.md, color: cssVars.colors.textSecondary }} data-testid="card-location">
              {location}
            </div>
          )}
          {/* Action Menu - Only show if actions available */}
          {hasActions && (
            <div style={{ gridColumn: 2, gridRow: '1 / span 2', alignSelf: 'center' }} onClick={(e) => e.stopPropagation()}>
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
        <LateFinishNotice tournament={tournament} mayFinish={myRole !== undefined && canWithListedRole(myRole, 'manageLifecycle')} />
      </article>
    </Card>
  );
};
