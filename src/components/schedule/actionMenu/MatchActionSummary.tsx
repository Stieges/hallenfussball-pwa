/**
 * Kopf des Aktionsblatts (@SL-239): Abzeichen mit dem Wort des Zustands (@OB-066) und darunter Meta-Zeile
 * („09:40 Uhr · Feld 1 · Schiedsrichter 2“) und Spielzeile mit beiden Teams und den Kästen (@OB-064, `TeamScoreRows`).
 * Reine Anzeige aus der Ansicht des Spiels; die Kennungen tragen das Präfix `aktion-`, damit dasselbe Spiel in der Liste dahinter eindeutig bleibt.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import type { ScheduledMatch } from '../../../core/generators';
import type { MatchView } from '../../../core/view';
import { MatchStatusBadge } from '../../ui/molecules/MatchStatusBadge';
import { TeamScoreRows } from '../MatchCard/TeamScoreRows';
import { cardStatusOf, resultFigures } from '../matchResult';
import { sideDisplay, type SideContext } from '../matchSides';

const noop = (): void => undefined;

const metaStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, color: cssVars.colors.textSecondary, overflowWrap: 'anywhere' };
const timeStyle: CSSProperties = { fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary, fontVariantNumeric: 'tabular-nums' };
const plannedStyle: CSSProperties = { fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textSecondary, whiteSpace: 'nowrap' };
const rowsStyle: CSSProperties = { display: 'flex', minWidth: 0 };

/** Abzeichen neben dem Titel: Zustands-Abzeichen der Ansicht; ein geplantes Spiel trägt das Wort „Geplant“ (die Anstoßzeit steht darunter). */
export function MatchActionBadge({ match }: { match: MatchView | undefined }): ReactElement {
  const { t } = useTranslation('tournament');
  if (match?.badge.kind === 'badge') {
    return <MatchStatusBadge model={match.badge} size="card" testId="match-action-badge" />;
  }
  return <span style={plannedStyle} data-testid="match-action-badge" data-state="planned">{t('actionMenu.summary.planned')}</span>;
}

export interface MatchActionSummaryProps {
  match: ScheduledMatch;
  view: MatchView | undefined;
  sides: SideContext;
}

export function MatchActionSummary({ match, view, sides }: MatchActionSummaryProps): ReactElement {
  const { t } = useTranslation('tournament');
  const status = cardStatusOf(view);
  const meta = [
    <span key="time" style={timeStyle}>{t('header.timeValue', { time: view?.kickoff?.time ?? match.time })}</span>,
    t('matchCard.field', { field: view?.field ?? match.field }),
    ...(match.referee ? [t('matchCard.refereePrefix', { referee: match.referee })] : []),
  ];
  return (
    <>
      <p style={metaStyle} data-testid="match-action-meta">
        {meta.map((part, index) => <span key={index}>{index > 0 && ' · '}{part}</span>)}
      </p>
      {view === undefined ? (
        // Ohne Ansicht (Vorschau): keine Kästen, nur die Paarung als Satz
        <p style={metaStyle}>{t('actionMenu.pairing', { home: sideDisplay(match, 'A', sides).name, away: sideDisplay(match, 'B', sides).name })}</p>
      ) : (
        <div style={rowsStyle}>
          <TeamScoreRows
            matchId={`aktion-${match.id}`}
            homeTeam={sideDisplay(match, 'A', sides)}
            awayTeam={sideDisplay(match, 'B', sides)}
            result={resultFigures(view.score, status)}
            status={status}
            onScoreClick={noop}
            disabled
            kasten={view.boxes}
            ende={status === 'finished' ? { cup: view.phase === 'final' } : undefined}
            blankWithoutScore
          />
        </div>
      )}
    </>
  );
}
