/**
 * MatchCardScore - waagerechtes Ergebnis der Tabellenzeile (@OB-064, Paket SK)
 *
 * Heim und Gast stehen in der Tabelle nebeneinander, deshalb steht das Ergebnis waagerecht:
 * - geplant: "VS"
 * - läuft: "1:0" mit Restzeit darunter
 * - beendet: "1:0", "3:2 n. V." oder "2:2 (4:3 i. E.)"
 *
 * Der Knopf ist das Klickziel ins Cockpit (≥ 44 px hoch). Der frühere Kreis mit Fortschrittsring entfällt.
 */

import { type CSSProperties, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens'
import type { SpectatorClock, ViewMatchStatus } from '../../../core/view';
import { MatchClock } from '../../ui/molecules/MatchClock';
import { formatTableResult, type ResultFigures } from '../matchResult';

export type MatchCardStatus = 'scheduled' | 'waiting' | 'running' | 'finished' | 'skipped';

export interface MatchCardScoreProps {
  /** Tore, Strafstoß und Sieger; `null` für ein geplantes Spiel */
  result: ResultFigures | null;
  /** Current match status */
  status: MatchCardStatus;
  /** Restzeit beim Stand (@ZM-162) */
  clock?: SpectatorClock | null;
  /** Click handler */
  onClick?: () => void;
  /** Disable interaction */
  disabled?: boolean;
  /** Match ID for testing */
  matchId?: string;
  /** Fachlicher Status der Ansicht: „ausgefallen“ statt „VS“, „gewertet“ neben dem Ergebnis (@ZM-104) */
  viewStatus?: ViewMatchStatus;
}

export const MatchCardScore: React.FC<MatchCardScoreProps> = ({
  result,
  status,
  clock,
  onClick,
  disabled = false,
  matchId,
  viewStatus,
}) => {
  const { t } = useTranslation('tournament');
  const [isHovered, setIsHovered] = useState(false);

  const isLive = status === 'running';
  const showsResult = result !== null && status !== 'scheduled' && status !== 'waiting';

  const buttonStyle: CSSProperties = {
    minWidth: cssVars.touchTargets.minimum,
    minHeight: cssVars.touchTargets.minimum,
    padding: `0 ${cssVars.spacing.md}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: `1px solid ${isLive || (isHovered && !disabled) ? cssVars.colors.primary : 'transparent'}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: disabled ? 'default' : 'pointer',
    color: showsResult ? cssVars.colors.textPrimary : cssVars.colors.textSecondary,
    fontFamily: 'inherit',
    fontSize: showsResult ? cssVars.fontSizes.lg : cssVars.fontSizes.sm,
    fontWeight: showsResult ? cssVars.fontWeights.bold : cssVars.fontWeights.semibold,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    transition: 'border-color 0.15s ease',
  };

  const label = (() => {
    if (!showsResult) { return t('matchCard.startMatch'); }
    const values = { homeScore: result.goalsA, awayScore: result.goalsB, homePenalty: result.penaltyA, awayPenalty: result.penaltyB };
    if (isLive) { return t('matchCard.scoreAriaLive', { ...values, elapsed: clock?.remaining === undefined || clock.remaining === null ? t('matchCard.live') : t('matchClock.ariaRemaining', { time: clock.remaining }) }); }
    if (result.decision === 'penalty') { return t('matchResult.scoreAriaPenalty', values); }
    if (result.decision === 'overtime') { return t('matchResult.scoreAriaOvertime', values); }
    return t('matchCard.scoreAriaFinal', values);
  })();

  return (
    <button
      type="button"
      style={buttonStyle}
      onClick={(e) => { e.stopPropagation(); if (!disabled && onClick) { onClick(); } }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={label}
      data-testid={matchId ? `match-circle-${matchId}` : 'match-circle'}
      data-match-status={isLive ? 'running' : showsResult ? 'finished' : status === 'skipped' ? 'skipped' : 'scheduled'}
    >
      {showsResult ? <span>{formatTableResult(result, t)}</span> : <span>{viewStatus === 'cancelled' ? t('view.status.cancelled') : 'VS'}</span>}
      {viewStatus === 'awarded' && (
        <span style={{ fontSize: cssVars.fontSizes.xs, fontWeight: cssVars.fontWeights.semibold }} data-testid="match-awarded-mark">
          {t('view.status.awarded')}
        </span>
      )}
      {isLive && clock && <MatchClock clock={clock} size="card" testId={`match-row-clock-${matchId ?? ''}`} />}
    </button>
  );
};

export default MatchCardScore;
