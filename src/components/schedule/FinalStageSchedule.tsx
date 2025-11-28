/**
 * FinalStageSchedule - Displays playoff/final matches in MeinTurnierplan style
 */

import { CSSProperties } from 'react';
import { theme } from '../../styles/theme';
import { ScheduledMatch } from '../../lib/scheduleGenerator';
import { RefereeConfig } from '../../types/tournament';

interface FinalStageScheduleProps {
  matches: ScheduledMatch[];
  refereeConfig?: RefereeConfig;
  numberOfFields?: number;
  onRefereeChange?: (matchId: string, refereeNumber: number | null) => void;
  onFieldChange?: (matchId: string, fieldNumber: number) => void;
  onScoreChange?: (matchId: string, scoreA: number, scoreB: number) => void;
  editable?: boolean;
}

export const FinalStageSchedule: React.FC<FinalStageScheduleProps> = ({
  matches,
  refereeConfig,
  numberOfFields = 1,
  onRefereeChange,
  onFieldChange,
  onScoreChange,
  editable = false,
}) => {
  if (matches.length === 0) {
    return null;
  }

  // Show referees in finals for both organizer and teams mode
  const showReferees = refereeConfig && refereeConfig.mode !== 'none';
  const showFields = numberOfFields > 1;

  // Generate referee options for dropdown (nur Nummern)
  const getRefereeOptions = () => {
    if (!refereeConfig) return [];

    const numberOfReferees = refereeConfig.mode === 'organizer'
      ? (refereeConfig.numberOfReferees || 2)
      : matches.length;

    const options = [];
    for (let i = 1; i <= numberOfReferees; i++) {
      options.push({ value: i, label: i.toString() });
    }
    return options;
  };

  // Generate field options for dropdown
  const getFieldOptions = () => {
    const options = [];
    for (let i = 1; i <= numberOfFields; i++) {
      options.push({ value: i, label: i.toString() });
    }
    return options;
  };

  // Check if a field is already assigned to an overlapping match
  const findFieldConflict = (matchId: string, fieldNumber: number): ScheduledMatch | null => {
    const targetMatch = matches.find(m => m.id === matchId);
    if (!targetMatch) return null;

    // Find all matches on this field (excluding target match)
    const fieldMatches = matches.filter(m => m.field === fieldNumber && m.id !== matchId);

    // Check for time overlaps
    for (const match of fieldMatches) {
      const targetStart = targetMatch.startTime.getTime();
      const targetEnd = targetMatch.endTime.getTime();
      const matchStart = match.startTime.getTime();
      const matchEnd = match.endTime.getTime();

      // Overlap occurs if: (start1 < end2) AND (start2 < end1)
      if (targetStart < matchEnd && matchStart < targetEnd) {
        return match;
      }
    }

    return null;
  };

  const refereeOptions = getRefereeOptions();
  const fieldOptions = getFieldOptions();

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
            {showReferees && <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>SR</th>}
            <th style={{ ...thStyle, width: '60px' }}>Zeit</th>
            <th style={thStyle}>Spiel</th>
            <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>Ergebnis</th>
            {showFields && <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}>Feld</th>}
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => (
            <tr key={match.id}>
              <td style={{ ...tdStyle, fontWeight: theme.fontWeights.semibold }}>
                {match.matchNumber}
              </td>
              {showReferees && (
                <td style={{ ...tdStyle, textAlign: 'center', padding: editable ? '4px' : '8px' }}>
                  {editable && onRefereeChange ? (
                    <select
                      value={match.referee || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        onRefereeChange(match.id, value ? parseInt(value) : null);
                      }}
                      style={{
                        width: '100%',
                        padding: '4px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: theme.fontWeights.semibold,
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text.primary,
                      }}
                    >
                      <option value="">-</option>
                      {refereeOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ fontWeight: theme.fontWeights.semibold }}>
                      {match.referee || '-'}
                    </span>
                  )}
                </td>
              )}
              <td style={tdStyle}>{match.time}</td>
              <td style={tdStyle}>
                <div style={matchLabelStyle}>
                  {getFinalMatchLabel(match)}
                </div>
                <div style={matchTeamsStyle}>
                  {match.homeTeam} - {match.awayTeam}
                </div>
              </td>
              <td style={resultCellStyle}>
                {editable && onScoreChange ? (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      value={match.scoreA !== undefined ? match.scoreA : ''}
                      onChange={(e) => {
                        const scoreA = e.target.value ? parseInt(e.target.value) : 0;
                        const scoreB = match.scoreB !== undefined ? match.scoreB : 0;
                        onScoreChange(match.id, scoreA, scoreB);
                      }}
                      style={{
                        width: '40px',
                        padding: '4px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontWeight: theme.fontWeights.bold,
                        textAlign: 'center',
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text.primary,
                      }}
                    />
                    <span>:</span>
                    <input
                      type="number"
                      min="0"
                      value={match.scoreB !== undefined ? match.scoreB : ''}
                      onChange={(e) => {
                        const scoreB = e.target.value ? parseInt(e.target.value) : 0;
                        const scoreA = match.scoreA !== undefined ? match.scoreA : 0;
                        onScoreChange(match.id, scoreA, scoreB);
                      }}
                      style={{
                        width: '40px',
                        padding: '4px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontWeight: theme.fontWeights.bold,
                        textAlign: 'center',
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text.primary,
                      }}
                    />
                  </div>
                ) : (
                  <span>
                    {match.scoreA !== undefined && match.scoreB !== undefined
                      ? `${match.scoreA} : ${match.scoreB}`
                      : '___ : ___'
                    }
                  </span>
                )}
              </td>
              {showFields && (
                <td style={{ ...tdStyle, textAlign: 'center', padding: editable ? '4px' : '8px' }}>
                  {editable && onFieldChange ? (
                    <select
                      value={match.field || 1}
                      onChange={(e) => {
                        const fieldNum = parseInt(e.target.value);
                        const conflict = findFieldConflict(match.id, fieldNum);
                        if (conflict) {
                          const confirmed = window.confirm(
                            `⚠️ Zeitkonflikt erkannt!\n\n` +
                            `Feld ${fieldNum} ist bereits für Spiel #${conflict.matchNumber} (${conflict.time}) belegt.\n\n` +
                            `Die Spiele überschneiden sich zeitlich.\n\n` +
                            `Möchtest du die Zuweisung trotzdem vornehmen?`
                          );
                          if (!confirmed) return;
                        }
                        onFieldChange(match.id, fieldNum);
                      }}
                      style={{
                        width: '100%',
                        padding: '4px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: theme.fontWeights.semibold,
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text.primary,
                      }}
                    >
                      {fieldOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ fontWeight: theme.fontWeights.semibold }}>
                      {match.field || '-'}
                    </span>
                  )}
                </td>
              )}
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
