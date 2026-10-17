/**
 * TeamScoreRows - Mannschaften untereinander, Tore je Zeile (@OB-064, Mockup Variante D)
 *
 * ┌────────────────────────────────────┐
 * │ [FN] FC Nord                  2 (4)│
 * │ [SM] SG Mitte                 2 (3)│
 * └────────────────────────────────────┘
 *
 * Die Torzahl steht rechts in der Zeile ihrer Mannschaft, ein Strafstoßergebnis kleiner daneben. Der Sieger eines
 * beendeten Spiels steht fett. Die Torzahl ist der Klickbereich ins Cockpit (≥ 44 px hoch).
 */
import { Fragment, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { TeamAvatar } from '../../ui/TeamAvatar';
import type { ResultFigures } from '../matchResult';
import type { MatchCardStatus } from './MatchCardScore';
import type { Team } from './MatchCard';

export interface TeamScoreRowsProps {
  matchId: string;
  homeTeam: Team;
  awayTeam: Team;
  /** `null`: geplantes Spiel, es stehen keine Tore */
  result: ResultFigures | null;
  status: MatchCardStatus;
  onScoreClick: () => void;
  disabled?: boolean;
}

type Side = 'a' | 'b';

/** Ein Raster für beide Zeilen: Torzahlen und Strafstöße stehen untereinander in einer Spalte. */
const gridStyle: CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
  alignItems: 'center',
  columnGap: cssVars.spacing.sm,
  rowGap: cssVars.spacing.xs,
  minWidth: 0,
};

const teamStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm, minWidth: 0 };

const goalsStyle: CSSProperties = {
  minWidth: cssVars.touchTargets.minimum,
  minHeight: cssVars.touchTargets.minimum,
  padding: 0,
  background: 'transparent',
  border: 'none',
  textAlign: 'right',
  fontSize: cssVars.fontSizes.xl,
  fontVariantNumeric: 'tabular-nums',
  fontFamily: 'inherit',
};

export const TeamScoreRows: React.FC<TeamScoreRowsProps> = ({ matchId, homeTeam, awayTeam, result, status, onScoreClick, disabled = false }) => {
  const { t } = useTranslation('tournament');
  const decided = result?.winner !== undefined && result.winner !== null;

  const spokenResult = (() => {
    if (result === null) { return t('matchCard.startMatch'); }
    const values = { homeScore: result.goalsA, awayScore: result.goalsB, homePenalty: result.penaltyA, awayPenalty: result.penaltyB };
    if (status === 'running') { return t('matchCard.scoreAriaLive', { ...values, elapsed: t('matchCard.live') }); }
    if (result.decision === 'penalty') { return t('matchResult.scoreAriaPenalty', values); }
    if (result.decision === 'overtime') { return t('matchResult.scoreAriaOvertime', values); }
    return t('matchCard.scoreAriaFinal', values);
  })();

  const renderRow = (side: Side, team: Team) => {
    const isWinner = decided && result?.winner === side;
    const isLoser = decided && result?.winner !== side;
    const goals = result === null ? undefined : side === 'a' ? result.goalsA : result.goalsB;
    const penalty = side === 'a' ? result?.penaltyA : result?.penaltyB;
    const nameStyle: CSSProperties = {
      fontSize: cssVars.fontSizes.lg,
      fontWeight: isWinner ? cssVars.fontWeights.bold : isLoser || status === 'finished' ? cssVars.fontWeights.medium : cssVars.fontWeights.semibold,
      color: isLoser ? cssVars.colors.textSecondary : cssVars.colors.textPrimary,
      // MOBILE-UX: Mannschaftsnamen werden nie abgeschnitten
      wordBreak: 'break-word',
      overflowWrap: 'break-word',
    };
    const first = side === 'a';
    // Feste Zelle je Element: ohne Strafstoß-Spalte würde die automatische Platzierung die nächste Zeile in die freie Zelle ziehen
    const row = first ? 1 : 2;
    return (
      <Fragment key={side}>
        <div style={{ ...teamStyle, gridColumn: 1, gridRow: row }}>
          <TeamAvatar team={team} size="md" />
          <span style={nameStyle} data-winner={isWinner ? 'true' : undefined} data-testid={`match-name-${matchId}-${side === 'a' ? 'home' : 'away'}`}>{team.name}</span>
        </div>
        <button
          type="button"
          data-score-circle
          data-testid={`match-goals-${matchId}-${side === 'a' ? 'home' : 'away'}`}
          style={{
            ...goalsStyle,
            gridColumn: 2,
            gridRow: row,
            cursor: disabled ? 'default' : 'pointer',
            fontWeight: isWinner ? cssVars.fontWeights.bold : cssVars.fontWeights.semibold,
            color: isLoser || goals === undefined ? cssVars.colors.textSecondary : cssVars.colors.textPrimary,
          }}
          aria-label={first ? spokenResult : undefined}
          aria-hidden={first ? undefined : true}
          tabIndex={first && !disabled ? 0 : -1}
          onClick={(e) => { e.stopPropagation(); if (!disabled) { onScoreClick(); } }}
        >
          {goals ?? '–'}
        </button>
        {penalty !== undefined && (
          <span
            style={{
              fontSize: cssVars.fontSizes.md,
              fontWeight: isWinner ? cssVars.fontWeights.bold : cssVars.fontWeights.semibold,
              color: cssVars.colors.textSecondary,
              fontVariantNumeric: 'tabular-nums',
              textAlign: 'right',
              gridColumn: 3,
              gridRow: row,
            }}
            data-testid={`match-penalty-${matchId}-${side === 'a' ? 'home' : 'away'}`}
          >
            ({penalty})
          </span>
        )}
      </Fragment>
    );
  };

  return (
    <div style={gridStyle}>
      {renderRow('a', homeTeam)}
      {renderRow('b', awayTeam)}
    </div>
  );
};

export default TeamScoreRows;
