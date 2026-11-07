/**
 * TournamentCard Component (@OB-079): zeigt nur, was man zum Finden braucht.
 * Zeile 1: Name in voller Breite (höchstens zwei Zeilen, kein Wortbruch, nie abgeschnitten). Zeile 2: Altersklasse · Zeit (unter „Heute“
 * nur die Uhrzeit, sonst Tag und Uhrzeit); die Altersklasse unterscheidet gleichnamige Turniere. Dahinter der Zustand mit Symbol und Wort,
 * aber nur wenn er vom Normalfall „Bereit“ abweicht (Läuft, Abgeschlossen, Abgebrochen). Zeile 3: Ort, nie gekürzt (er bricht notfalls um),
 * rechts daneben das Schild der eigenen Rolle (macht die Karte nicht höher). Das Menü steht rechts neben Zeile 2 und 3.
 * Modus, Veranstalter und Platzierung stehen in der Übersicht des Turniers.
 */

import { isTournamentClosed } from '../core/services/lifecycle';
import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Tournament } from '../types/tournament';
import { Card } from './ui';
import { cssVars } from '../design-tokens';
import { ageClassText } from '../core/view';
import { getLocationName } from '../utils/locationHelpers';
import { formatCardTime } from '../utils/formatCardTime';
import { TournamentActionMenu } from './TournamentActionMenu';
import { useTournamentStartState } from '../hooks/useTournamentStartState';
import { canWithListedRole } from '../features/auth/hooks/useCan';
import { TextTag } from './ui/atoms';
import { LateFinishNotice } from './LateFinishNotice';
import { StateMark } from './ui/molecules/StateMark';
import { cardStateOf, hasVisibleStateMark, STATE_MARK, STATE_WORD_KEY } from './tournamentCardState';
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

const placeRowStyle: CSSProperties = {
  gridColumn: 1,
  gridRow: 2,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: cssVars.spacing.xs,
  minWidth: 0,
};

const locationStyle: CSSProperties = {
  flex: '1 1 0',
  minWidth: 0,
  fontSize: cssVars.fontSizes.md,
  color: cssVars.colors.textSecondary,
};

const menuSlotStyle: CSSProperties = { gridColumn: 2, gridRow: '1 / span 2', alignSelf: 'center' };

/**
 * Das Schild steht rechts in der Zeile des Orts; ohne Ort trotzdem rechts. Es ist höher als eine Textzeile (Rand + Innenabstand);
 * der negative Spielraum oben und unten hält die Zeile so hoch wie den Ort allein: das Schild macht die Karte nicht höher (@OB-079).
 */
const roleSlotStyle: CSSProperties = { flex: 'none', marginLeft: 'auto', marginBlock: `calc(-1 * ${cssVars.spacing.xs})` };

const whenStyle: CSSProperties = {
  fontWeight: cssVars.fontWeights.semibold,
  color: cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.md,
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
    // Am Handy knapper Innenabstand, rechts am knappsten (das Menü-Feld bringt eigenen Rand mit): alle Turniere des Tages sollen ohne Scrollen
    // sichtbar sein, und Ort und Rollen-Schild bei 360 Bildpunkten in einer Zeile stehen (@OB-079)
    padding: isMobile ? `${cssVars.spacing.sm} ${cssVars.spacing.sm} ${cssVars.spacing.sm} ${cssVars.spacing.md}` : `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
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

  const cardState = cardStateOf(tournament, categoryLabel);
  // Check if we need to show action menu (has any action handlers)
  const hasActions = onClick !== undefined || onCopy !== undefined || onShare !== undefined || deleteHandler !== undefined;

  const location = getLocationName(tournament);
  const timeText = formatCardTime(tournament, i18n.language, !inToday, t('card.noDate'));
  const ageClass = ageClassText(tournament.ageClass);
  // Der aria-label der Karte überdeckt ihren Inhalt: Zustand (nur wenn er nicht „Bereit“ ist), Altersklasse, Zeit, Ort, Rolle und Quelle
  // gehören hinein (sonst liest der Screenreader nur den Namen vor). Leere Teile entfallen, damit kein loses Komma bleibt.
  const showRole = myRole !== undefined && myRole !== 'owner';
  const ariaLabel = [
    t('card.ariaLabelTitle', { title: tournament.title }),
    cardState === 'ready' ? '' : t(STATE_WORD_KEY[cardState]),
    ageClass,
    timeText !== '' ? timeText : t('sections.today'),
    location,
    showRole ? t(`card.role.${myRole}`) : '',
    tournament.externalSource ?? '',
  ].filter((part) => part !== '').join(', ');

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
        aria-label={ariaLabel}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {/* Zeile 1: Name in voller Breite */}
        <h3 style={titleStyle} title={tournament.title}>{tournament.title}</h3>

        {/* Zeile 2: Altersklasse · Zeit und Zustandswort; Zeile 3: Ort in der Breite neben dem Menü, das beide Zeilen rechts begleitet (der Ort wird nie gekürzt) */}
        <div style={gridStyle}>
          <div style={{ ...lineStyle, gridColumn: 1, gridRow: 1 }}>
            {(ageClass !== '' || timeText !== '') && (
              <span style={whenStyle}>
                {ageClass !== '' && <span data-testid="card-age-class">{ageClass}</span>}
                {ageClass !== '' && timeText !== '' && ' · '}
                {timeText !== '' && <span data-testid="card-time">{timeText}</span>}
              </span>
            )}
            {tournament.isExternal && tournament.externalSource && (
              <span style={externalBadgeStyle} aria-label={tournament.externalSource}>
                {tournament.externalSource}
              </span>
            )}
            {hasVisibleStateMark(cardState) && (
              <StateMark dense tone={STATE_MARK[cardState].tone} symbol={STATE_MARK[cardState].symbol} data-testid="card-state">
                {t(STATE_WORD_KEY[cardState])}
              </StateMark>
            )}
          </div>
          {(location !== '' || showRole) && (
            <div style={placeRowStyle}>
              {location !== '' && (
                <div style={locationStyle} data-testid="card-location">
                  {location}
                </div>
              )}
              {showRole && (
                <div style={roleSlotStyle}>
                  <TextTag testId={`tournament-role-${tournament.id}`}>{t(`card.role.${myRole}`)}</TextTag>
                </div>
              )}
            </div>
          )}
          {/* Action Menu - Only show if actions available */}
          {hasActions && (
            <div style={menuSlotStyle} onClick={(e) => e.stopPropagation()}>
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
