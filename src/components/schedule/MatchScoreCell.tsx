import { useState, useEffect, CSSProperties } from 'react';
import { borderRadius, colors, fontSizes, fontWeights, spacing } from '../../design-tokens';
interface MatchScoreCellProps {
  matchId: string;
  scoreA: number | undefined;
  scoreB: number | undefined;
  editable: boolean;
  isFinished: boolean;
  inCorrectionMode: boolean;
  onScoreChange: (scoreA: number, scoreB: number) => void;
  onStartCorrection: () => void;
  // Note: Permission check is now handled in the parent component (ScheduleTab)
}

export const MatchScoreCell: React.FC<MatchScoreCellProps> = ({
  matchId,
  scoreA,
  scoreB,
  editable,
  isFinished,
  inCorrectionMode,
  onScoreChange,
  onStartCorrection,
}) => {
  // Local state for partial score entry - allows user to fill one field at a time
  const [localScoreA, setLocalScoreA] = useState<string>(scoreA !== undefined ? String(scoreA) : '');
  const [localScoreB, setLocalScoreB] = useState<string>(scoreB !== undefined ? String(scoreB) : '');

  // Sync local state when props change (e.g., from parent updates)
  useEffect(() => {
    setLocalScoreA(scoreA !== undefined ? String(scoreA) : '');
    setLocalScoreB(scoreB !== undefined ? String(scoreB) : '');
  }, [matchId, scoreA, scoreB]);

  // Only propagate to parent when BOTH fields have valid values
  const handleScoreAChange = (value: string) => {
    setLocalScoreA(value);
    // Only save if both fields have values
    if (value !== '' && localScoreB !== '') {
      onScoreChange(parseInt(value), parseInt(localScoreB));
    }
  };

  const handleScoreBChange = (value: string) => {
    setLocalScoreB(value);
    // Only save if both fields have values
    if (localScoreA !== '' && value !== '') {
      onScoreChange(parseInt(localScoreA), parseInt(value));
    }
  };
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
      fontWeight: fontWeights.bold,
      fontSize: fontSizes.md,
    };

    const buttonStyle: CSSProperties = {
      background: 'transparent',
      border: `1px solid ${colors.border}`,
      borderRadius: borderRadius.sm,
      color: colors.textSecondary,
      fontSize: fontSizes.xs,
      padding: '3px 8px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      whiteSpace: 'nowrap' as const,
    };

    return (
      <>
        <div style={containerStyle} className="match-score-cell-finished">
          <span style={scoreStyle}>
            {scoreA !== undefined && scoreB !== undefined
              ? `${scoreA} : ${scoreB}`
              : '___ : ___'
            }
          </span>
          {/* Correction button always visible - permission check happens in handler */}
          <button
            style={buttonStyle}
            onClick={(e) => {
              e.stopPropagation();
              onStartCorrection();
            }}
            className="correction-button"
          >
            Ergebnis korrigieren
          </button>
        </div>

        <style>{`
          .correction-button:hover {
            background: ${colors.primary};
            color: white;
            border-color: ${colors.primary};
          }

          @media (max-width: 767px) {
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
      gap: spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative' as const,
    };

    const inputStyle: CSSProperties = {
      width: '40px',
      padding: spacing.xs,
      border: inCorrectionMode
        ? `2px solid ${colors.warning}`
        : `1px solid ${colors.border}`,
      borderRadius: borderRadius.sm,
      fontSize: fontSizes.sm,
      fontWeight: fontWeights.bold,
      textAlign: 'center' as const,
      backgroundColor: inCorrectionMode
        ? colors.warningLight
        : colors.background,
      color: colors.textPrimary,
    };

    const iconStyle: CSSProperties = {
      position: 'absolute' as const,
      top: '-8px',
      right: '-8px',
      fontSize: fontSizes.lg,
    };

    return (
      <div style={inputContainerStyle}>
        {inCorrectionMode && <span style={iconStyle}>⚠️</span>}
        <input
          type="number"
          min="0"
          step="1"
          value={localScoreA}
          onChange={(e) => handleScoreAChange(e.target.value)}
          placeholder="–"
          style={inputStyle}
        />
        <span>:</span>
        <input
          type="number"
          min="0"
          step="1"
          value={localScoreB}
          onChange={(e) => handleScoreBChange(e.target.value)}
          placeholder="–"
          style={inputStyle}
        />
      </div>
    );
  }

  // Fallback: Display only
  return (
    <span>
      {scoreA !== undefined && scoreB !== undefined
        ? `${scoreA} : ${scoreB}`
        : '___ : ___'
      }
    </span>
  );
};
