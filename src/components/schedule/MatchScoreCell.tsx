import { CSSProperties } from 'react';
import { theme } from '../../styles/theme';

interface MatchScoreCellProps {
  matchId: string;
  scoreA: number | undefined;
  scoreB: number | undefined;
  editable: boolean;
  isFinished: boolean;
  inCorrectionMode: boolean;
  onScoreChange: (scoreA: number, scoreB: number) => void;
  onStartCorrection: () => void;
}

export const MatchScoreCell: React.FC<MatchScoreCellProps> = ({
  scoreA,
  scoreB,
  editable,
  isFinished,
  inCorrectionMode,
  onScoreChange,
  onStartCorrection,
}) => {
  // State 1: Finished match - read-only with correction button
  if (isFinished && !inCorrectionMode && !editable) {
    const containerStyle: CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
    };

    const scoreStyle: CSSProperties = {
      fontWeight: theme.fontWeights.bold,
      fontSize: '14px',
    };

    const buttonStyle: CSSProperties = {
      background: 'transparent',
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.borderRadius.sm,
      color: theme.colors.text.secondary,
      fontSize: '11px',
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
            background: ${theme.colors.primary};
            color: white;
            border-color: ${theme.colors.primary};
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
      gap: '4px',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative' as const,
    };

    const inputStyle: CSSProperties = {
      width: '40px',
      padding: '4px',
      border: inCorrectionMode
        ? `2px solid #FFC107` // Warning border in correction mode
        : `1px solid ${theme.colors.border}`,
      borderRadius: '4px',
      fontSize: '13px',
      fontWeight: theme.fontWeights.bold,
      textAlign: 'center' as const,
      backgroundColor: inCorrectionMode
        ? '#FFF3CD' // Light yellow background in correction mode
        : theme.colors.background,
      color: theme.colors.text.primary,
    };

    const iconStyle: CSSProperties = {
      position: 'absolute' as const,
      top: '-8px',
      right: '-8px',
      fontSize: '16px',
    };

    return (
      <div style={inputContainerStyle}>
        {inCorrectionMode && <span style={iconStyle}>⚠️</span>}
        <input
          type="number"
          min="0"
          step="1"
          value={scoreA !== undefined ? scoreA : ''}
          onChange={(e) => {
            const newScoreA = e.target.value ? parseInt(e.target.value) : 0;
            const newScoreB = scoreB !== undefined ? scoreB : 0;
            onScoreChange(newScoreA, newScoreB);
          }}
          style={inputStyle}
        />
        <span>:</span>
        <input
          type="number"
          min="0"
          step="1"
          value={scoreB !== undefined ? scoreB : ''}
          onChange={(e) => {
            const newScoreB = e.target.value ? parseInt(e.target.value) : 0;
            const newScoreA = scoreA !== undefined ? scoreA : 0;
            onScoreChange(newScoreA, newScoreB);
          }}
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
