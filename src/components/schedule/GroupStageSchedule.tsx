/**
 * GroupStageSchedule - Displays group stage matches in MeinTurnierplan style
 */

import { CSSProperties } from 'react';
import { theme } from '../../styles/theme';
import { ScheduledMatch } from '../../lib/scheduleGenerator';

interface GroupStageScheduleProps {
  matches: ScheduledMatch[];
  hasGroups: boolean;
}

export const GroupStageSchedule: React.FC<GroupStageScheduleProps> = ({
  matches,
  hasGroups,
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
    color: theme.colors.primary,
    marginBottom: '16px',
  };

  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    minWidth: '600px',
  };

  const thStyle: CSSProperties = {
    background: theme.colors.primary,
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

  const infoCellStyle: CSSProperties = {
    ...tdStyle,
    fontSize: '11px',
    color: theme.colors.text.secondary,
  };

  return (
    <div style={containerStyle} className="group-stage-schedule">
      <h2 style={titleStyle}>
        {hasGroups ? 'Vorrunde' : 'Spielplan'}
      </h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '40px' }}>Nr.</th>
            <th style={{ ...thStyle, width: '60px' }}>Zeit</th>
            {hasGroups && <th style={{ ...thStyle, width: '40px' }}>Gr</th>}
            <th style={thStyle}>Heim</th>
            <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>Ergebnis</th>
            <th style={thStyle}>Gast</th>
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
              {hasGroups && (
                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: theme.fontWeights.semibold }}>
                  {match.group || '-'}
                </td>
              )}
              <td style={tdStyle}>{match.homeTeam}</td>
              <td style={resultCellStyle}>___ : ___</td>
              <td style={tdStyle}>{match.awayTeam}</td>
              <td style={infoCellStyle}>
                {match.field && `Feld ${match.field}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
        @media (max-width: 768px) {
          .group-stage-schedule table {
            font-size: 11px;
          }
          .group-stage-schedule th,
          .group-stage-schedule td {
            padding: 6px 4px;
          }
        }

        @media print {
          .group-stage-schedule {
            break-inside: avoid;
          }
          .group-stage-schedule table {
            min-width: 100%;
          }
        }
      `}</style>
    </div>
  );
};
