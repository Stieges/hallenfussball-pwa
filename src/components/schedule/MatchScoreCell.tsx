import { useState, useEffect, useRef, CSSProperties, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, mediaQueries } from '../../design-tokens'
import type { ViewMatchStatus } from '../../core/view';
import { formatTableResult, type ResultFigures } from './matchResult';
interface MatchScoreCellProps {
  matchId: string;
  scoreA: number | undefined;
  scoreB: number | undefined;
  editable: boolean;
  isFinished: boolean;
  inCorrectionMode: boolean;
  /** Tore, Strafstoß und Sieger (`resultFigures`): zeigt „2:2 (4:3 i. E.)“ bzw. „3:2 n. V.“ statt `scoreA : scoreB` (@OB-064) */
  result?: ResultFigures | null;
  /** Fachlicher Status der Ansicht: „ausgefallen“ statt Platzhalter, „gewertet“ neben dem Ergebnis (@ZM-104) */
  viewStatus?: ViewMatchStatus;
  onScoreChange: (scoreA: number, scoreB: number) => void;
  /** Ohne Handler (bis B-24) gibt es keinen Korrigieren-Knopf. */
  onStartCorrection?: () => void;
  // Note: Permission check is now handled in the parent component (ScheduleTab)
}

export const MatchScoreCell: React.FC<MatchScoreCellProps> = ({
  matchId,
  scoreA,
  scoreB,
  editable,
  isFinished,
  inCorrectionMode,
  result,
  viewStatus,
  onScoreChange,
  onStartCorrection,
}) => {
  const { t } = useTranslation('tournament');

  const toField = (value: number | undefined): string => (value === undefined ? '' : String(value));

  // Lokaler Eingabestand: jede Ziffer bleibt lokal, gespeichert wird erst beim Verlassen des Feldes oder bei Enter
  // (@FU-101: „1“ dann „0“ ergibt 10:2, nicht 1:2). Escape verwirft zum zuletzt gespeicherten Stand.
  const [localScoreA, setLocalScoreA] = useState<string>(toField(scoreA));
  const [localScoreB, setLocalScoreB] = useState<string>(toField(scoreB));
  // Zuletzt bekannter bzw. gespeicherter Stand: verhindert doppeltes Speichern (Enter, danach Verlassen)
  const committedRef = useRef<{ a: number | undefined; b: number | undefined }>({ a: scoreA, b: scoreB });

  // Sync local state when props change (e.g., from parent updates)
  useEffect(() => {
    committedRef.current = { a: scoreA, b: scoreB };
    setLocalScoreA(toField(scoreA));
    setLocalScoreB(toField(scoreB));
  }, [matchId, scoreA, scoreB]);

  // Speichert nur, wenn beide Felder gefüllt und der Stand neu ist
  const commitScore = (valueA: string, valueB: string) => {
    if (valueA === '' || valueB === '') {
      return;
    }
    const nextA = parseInt(valueA, 10);
    const nextB = parseInt(valueB, 10);
    const committed = committedRef.current;
    if (committed.a === nextA && committed.b === nextB) {
      return;
    }
    committedRef.current = { a: nextA, b: nextB };
    onScoreChange(nextA, nextB);
  };

  const handleFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitScore(localScoreA, localScoreB);
    } else if (event.key === 'Escape') {
      setLocalScoreA(toField(committedRef.current.a));
      setLocalScoreB(toField(committedRef.current.b));
    }
  };
  const placeholder = viewStatus === 'cancelled' ? t('view.status.cancelled') : '___ : ___';
  const awardedMark = viewStatus === 'awarded' ? ` ${t('view.status.awarded')}` : '';
  const shownResult = result === undefined || result === null
    ? (typeof scoreA === 'number' && typeof scoreB === 'number' && viewStatus === undefined ? `${scoreA} : ${scoreB}` : placeholder)
    : `${formatTableResult(result, t)}${awardedMark}`;

  // State 1: Finished match - ALWAYS read-only with correction button
  // BUG FIX: Beendete Spiele dürfen nicht direkt bearbeitet werden, auch wenn editable=true
  // Der CorrectionDialog muss verwendet werden, um Ergebnisse zu korrigieren
  if (isFinished && !inCorrectionMode) {
    const containerStyle: CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
    };

    const scoreStyle: CSSProperties = {
      fontWeight: cssVars.fontWeights.bold,
      fontSize: cssVars.fontSizes.md,
    };

    const buttonStyle: CSSProperties = {
      background: 'transparent',
      border: `1px solid ${cssVars.colors.borderControl}`,
      borderRadius: cssVars.borderRadius.sm,
      color: cssVars.colors.textSecondary,
      fontSize: cssVars.fontSizes.xs,
      padding: '3px 8px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      whiteSpace: 'nowrap' as const,
    };

    return (
      <>
        <div style={containerStyle} className="match-score-cell-finished">
          <span style={scoreStyle}>
            {shownResult}
          </span>
          {onStartCorrection && (
            <button
              style={buttonStyle}
              onClick={(e) => {
                e.stopPropagation();
                onStartCorrection();
              }}
              className="correction-button"
              data-testid={`correction-button-${matchId}`}
            >
              {t('scoreCell.correctResult')}
            </button>
          )}
        </div>

        <style>{`
          .correction-button:hover,
          .correction-button:active {
            background: ${cssVars.colors.primary};
            color: white;
            border-color: ${cssVars.colors.primary};
          }

          ${mediaQueries.tabletDown} {
            .match-score-cell-finished {
              gap: 4px !important;
            }

            .correction-button {
              font-size: 10px !important;
              padding: 2px 6px !important;
            }
          }
        `}</style>
      </>
    );
  }

  // State 2 & 3: Editable (active) or Correction mode
  if (editable || inCorrectionMode) {
    const inputContainerStyle: CSSProperties = {
      display: 'flex',
      gap: cssVars.spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative' as const,
    };

    const inputStyle: CSSProperties = {
      width: cssVars.touchTargets.minimum,
      height: cssVars.touchTargets.minimum,
      padding: cssVars.spacing.xs,
      border: inCorrectionMode
        ? `2px solid ${cssVars.colors.warning}`
        : `1px solid ${cssVars.colors.borderControl}`,
      borderRadius: cssVars.borderRadius.sm,
      // Eingabefelder mindestens 16 px und 44 px hoch (Touch-Ziel)
      fontSize: cssVars.fontSizes.lg,
      fontWeight: cssVars.fontWeights.bold,
      textAlign: 'center' as const,
      backgroundColor: inCorrectionMode
        ? cssVars.colors.warningLight
        : cssVars.colors.background,
      color: cssVars.colors.textPrimary,
    };

    const iconStyle: CSSProperties = {
      position: 'absolute' as const,
      top: '-8px',
      right: '-8px',
      fontSize: cssVars.fontSizes.lg,
    };

    return (
      <div style={inputContainerStyle}>
        {inCorrectionMode && <span style={iconStyle}>⚠️</span>}
        <input
          type="number"
          min="0"
          step="1"
          value={localScoreA}
          onChange={(e) => setLocalScoreA(e.target.value)}
          onBlur={() => commitScore(localScoreA, localScoreB)}
          onKeyDown={handleFieldKeyDown}
          placeholder="–"
          style={inputStyle}
        />
        <span>:</span>
        <input
          type="number"
          min="0"
          step="1"
          value={localScoreB}
          onChange={(e) => setLocalScoreB(e.target.value)}
          onBlur={() => commitScore(localScoreA, localScoreB)}
          onKeyDown={handleFieldKeyDown}
          placeholder="–"
          style={inputStyle}
        />
      </div>
    );
  }

  // Fallback: Display only
  return (
    <span>
      {shownResult}
    </span>
  );
};
