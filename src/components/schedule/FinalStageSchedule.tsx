/**
 * FinalStageSchedule - Displays playoff/final matches in MeinTurnierplan style
 */

import { CSSProperties } from 'react';
import { theme } from '../../styles/theme';
import { ScheduledMatch } from '../../lib/scheduleGenerator';

interface FinalStageScheduleProps {
  matches: ScheduledMatch[];
}

export const FinalStageSchedule: React.FC<FinalStageScheduleProps> = ({
  matches,
}) => {
  if (matches.length === 0) {
    return null;
  }

  const containerStyle: CSSProperties = {
    marginBottom: '24px',
    overflowX: 'auto',
  };

  const titleStyle: CSSProperties = {
    fontSize: '18px',
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.accent,
    marginBottom: '16px',
  };

  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    minWidth: '600px',
  };

  const thStyle: CSSProperties = {
    background: theme.colors.accent,
    color: theme.colors.background,
    padding: '10px 8px',
    textAlign: 'left',
    fontWeight: theme.fontWeights.semibold,
    borderBottom: `2px solid ${theme.colors.border}`,
  };

  const tdStyle: CSSProperties = {
    padding: '8px',
    borderBottom: `1px solid ${theme.colors.border}`,
    color: theme.colors.text.primary,
  };

  const resultCellStyle: CSSProperties = {
    ...tdStyle,
    textAlign: 'center',
    fontWeight: theme.fontWeights.bold,
    minWidth: '60px',
  };

  const matchLabelStyle: CSSProperties = {
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.accent,
    marginBottom: '4px',
  };

  const matchTeamsStyle: CSSProperties = {
    fontSize: '12px',
    color: theme.colors.text.secondary,
  };

  return (
    <div style={containerStyle} className="final-stage-schedule">
      <h2 style={titleStyle}>Finalrunde</h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '40px' }}>Nr.</th>
            <th style={{ ...thStyle, width: '60px' }}>Zeit</th>
            <th style={thStyle}>Spiel</th>
            <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>Ergebnis</th>
            <th style={{ ...thStyle, width: '100px' }}>Info</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => (
            <tr key={match.id}>
              <td style={{ ...tdStyle, fontWeight: theme.fontWeights.semibold }}>
                {match.matchNumber}
              </td>
              <td style={tdStyle}>{match.time}</td>
              <td style={tdStyle}>
                <div style={matchLabelStyle}>
                  {getFinalMatchLabel(match)}
                </div>
                <div style={matchTeamsStyle}>
                  {match.homeTeam} - {match.awayTeam}
                </div>
              </td>
              <td style={resultCellStyle}>___ : ___</td>
              <td style={{ ...tdStyle, fontSize: '11px', color: theme.colors.text.secondary }}>
                {match.field && `Feld ${match.field}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
        @media (max-width: 768px) {
          .final-stage-schedule table {
            font-size: 11px;
          }
          .final-stage-schedule th,
          .final-stage-schedule td {
            padding: 6px 4px;
          }
        }

        @media print {
          .final-stage-schedule {
            break-inside: avoid;
          }
          .final-stage-schedule table {
            min-width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

function getFinalMatchLabel(match: ScheduledMatch): string {
  if (match.finalType === 'final') return '🏆 Finale';
  if (match.finalType === 'thirdPlace') return '🥉 Spiel um Platz 3';
  if (match.finalType === 'fifthSixth') return 'Spiel um Platz 5';
  if (match.finalType === 'seventhEighth') return 'Spiel um Platz 7';

  if (match.phase === 'semifinal') return 'Halbfinale';
  if (match.phase === 'quarterfinal') return 'Viertelfinale';

  // Check match label for semifinals
  if (match.label?.includes('Halbfinale')) return match.label;

  return 'Finalspiel';
}
