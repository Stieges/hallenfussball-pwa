/**
 * GroupStageSchedule - Displays group stage matches in MeinTurnierplan style
 * Fully responsive with table view for desktop and card view for mobile
 */

import { CSSProperties } from 'react';
import { theme } from '../../styles/theme';
import { ScheduledMatch } from '../../lib/scheduleGenerator';
import { RefereeConfig, Tournament } from '../../types/tournament';
import { MatchScoreCell } from './MatchScoreCell';
import { LiveBadge } from './LiveBadge';
import { getGroupShortCode } from '../../utils/displayNames';

interface GroupStageScheduleProps {
  matches: ScheduledMatch[];
  hasGroups: boolean;
  refereeConfig?: RefereeConfig;
  numberOfFields?: number;
  onRefereeChange?: (matchId: string, refereeNumber: number | null) => void;
  onFieldChange?: (matchId: string, fieldNumber: number) => void;
  onScoreChange?: (matchId: string, scoreA: number, scoreB: number) => void;
  editable?: boolean;
  finishedMatches?: Set<string>;
  correctionMatchId?: string | null;
  onStartCorrection?: (matchId: string) => void;
  /** MON-LIVE-INDICATOR-01: IDs of matches that are currently running */
  runningMatchIds?: Set<string>;
  /** Tournament data for group name resolution */
  tournament?: Tournament;
  // Note: Permission check is now handled in ScheduleTab
}

export const GroupStageSchedule: React.FC<GroupStageScheduleProps> = ({
  matches,
  hasGroups,
  refereeConfig,
  numberOfFields = 1,
  onRefereeChange,
  onFieldChange,
  onScoreChange,
  editable = false,
  finishedMatches,
  correctionMatchId,
  onStartCorrection,
  runningMatchIds,
  tournament,
}) => {
  if (matches.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '40px 20px',
        color: theme.colors.text.secondary,
        fontSize: '15px'
      }}>
        Keine Spiele vorhanden
      </div>
    );
  }

  const showReferees = refereeConfig && refereeConfig.mode !== 'none';
  const showFields = numberOfFields > 1;

  // Generate referee options for dropdown (nur Nummern)
  const getRefereeOptions = () => {
    if (!refereeConfig) {return [];}

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
    if (!targetMatch) {return null;}

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

  // Styles
  const containerStyle: CSSProperties = {
    marginBottom: '24px',
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

  // Mobile Card Styles
  const mobileCardStyle: CSSProperties = {
    backgroundColor: theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  };

  const mobileCardHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  const mobileMatchNumberStyle: CSSProperties = {
    fontSize: '16px',
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.primary,
  };

  const mobileTimeStyle: CSSProperties = {
    fontSize: '14px',
    color: theme.colors.text.secondary,
  };

  const mobileTeamsContainerStyle: CSSProperties = {
    marginBottom: '12px',
  };

  const mobileTeamStyle: CSSProperties = {
    fontSize: '15px',
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary,
    marginBottom: '8px',
  };

  const mobileScoreContainerStyle: CSSProperties = {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
    backgroundColor: theme.colors.surfaceDark,
    borderRadius: '6px',
    marginBottom: '12px',
  };

  const mobileMetaStyle: CSSProperties = {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    fontSize: '13px',
    color: theme.colors.text.secondary,
  };

  const mobileMetaItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  const mobileSelectStyle: CSSProperties = {
    padding: '8px 12px',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: theme.fontWeights.semibold,
    cursor: 'pointer',
    backgroundColor: theme.colors.background,
    color: theme.colors.text.primary,
    minHeight: '44px',
  };

  return (
    <div style={containerStyle} className="group-stage-schedule">
      <h2 style={titleStyle}>
        {hasGroups ? 'Vorrunde' : 'Spielplan'}
      </h2>

      {/* Desktop Table View */}
      <div className="desktop-view" style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '40px' }}>Nr.</th>
              {showReferees && <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>SR</th>}
              <th style={{ ...thStyle, width: '60px' }}>Zeit</th>
              {hasGroups && <th style={{ ...thStyle, width: '40px' }}>Gr</th>}
              <th style={thStyle}>Heim</th>
              <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>Ergebnis</th>
              <th style={thStyle}>Gast</th>
              {showFields && <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}>Feld</th>}
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => {
              const isRunning = runningMatchIds?.has(match.id);
              const rowStyle = isRunning ? { backgroundColor: theme.colors.status.liveRowBg } : {};
              return (
              <tr key={match.id} style={rowStyle}>
                <td style={{ ...tdStyle, fontWeight: theme.fontWeights.semibold }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{match.matchNumber}</span>
                    {isRunning && <LiveBadge compact />}
                  </div>
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
                {hasGroups && (
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: theme.fontWeights.semibold }}>
                    {match.group ? getGroupShortCode(match.group, tournament) : '-'}
                  </td>
                )}
                <td style={tdStyle}>{match.homeTeam}</td>
                <td style={resultCellStyle}>
                  <MatchScoreCell
                    matchId={match.id}
                    scoreA={match.scoreA}
                    scoreB={match.scoreB}
                    editable={editable && onScoreChange !== undefined}
                    isFinished={finishedMatches?.has(match.id) ?? false}
                    inCorrectionMode={correctionMatchId === match.id}
                    onScoreChange={(scoreA, scoreB) => onScoreChange?.(match.id, scoreA, scoreB)}
                    onStartCorrection={() => onStartCorrection?.(match.id)}
                  />
                </td>
                <td style={tdStyle}>{match.awayTeam}</td>
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
                            if (!confirmed) {return;}
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
            );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="mobile-view">
        {matches.map((match) => {
          const isRunning = runningMatchIds?.has(match.id);
          return (
          <div key={match.id} style={mobileCardStyle}>
            {/* Header with match number and time */}
            <div style={mobileCardHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={mobileMatchNumberStyle}>Spiel #{match.matchNumber}</span>
                {isRunning && <LiveBadge compact />}
              </div>
              <span style={mobileTimeStyle}>{match.time}</span>
            </div>

            {/* Teams */}
            <div style={mobileTeamsContainerStyle}>
              <div style={mobileTeamStyle}>{match.homeTeam}</div>
              <div style={mobileTeamStyle}>{match.awayTeam}</div>
            </div>

            {/* Score Input */}
            <div style={mobileScoreContainerStyle}>
              <MatchScoreCell
                matchId={match.id}
                scoreA={match.scoreA}
                scoreB={match.scoreB}
                editable={editable && onScoreChange !== undefined}
                isFinished={finishedMatches?.has(match.id) ?? false}
                inCorrectionMode={correctionMatchId === match.id}
                onScoreChange={(scoreA, scoreB) => onScoreChange?.(match.id, scoreA, scoreB)}
                onStartCorrection={() => onStartCorrection?.(match.id)}
              />
            </div>

            {/* Meta information */}
            <div style={mobileMetaStyle}>
              {hasGroups && (
                <div style={mobileMetaItemStyle}>
                  <strong>Gruppe:</strong>
                  <span>{match.group ? getGroupShortCode(match.group, tournament) : '-'}</span>
                </div>
              )}
              {showReferees && (
                <div style={mobileMetaItemStyle}>
                  <strong>SR:</strong>
                  {editable && onRefereeChange ? (
                    <select
                      value={match.referee || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        onRefereeChange(match.id, value ? parseInt(value) : null);
                      }}
                      style={mobileSelectStyle}
                    >
                      <option value="">-</option>
                      {refereeOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{match.referee || '-'}</span>
                  )}
                </div>
              )}
              {showFields && (
                <div style={mobileMetaItemStyle}>
                  <strong>Feld:</strong>
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
                          if (!confirmed) {return;}
                        }
                        onFieldChange(match.id, fieldNum);
                      }}
                      style={mobileSelectStyle}
                    >
                      {fieldOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{match.field || '-'}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>

      <style>{`
        /* Hide mobile view by default */
        .group-stage-schedule .mobile-view {
          display: none;
        }

        /* Mobile: Show cards, hide table */
        @media (max-width: 767px) {
          .group-stage-schedule .desktop-view {
            display: none;
          }
          .group-stage-schedule .mobile-view {
            display: block;
          }
        }

        /* Tablet: Keep table but adjust sizing */
        @media (min-width: 768px) and (max-width: 1024px) {
          .group-stage-schedule table {
            font-size: 12px;
          }
          .group-stage-schedule th,
          .group-stage-schedule td {
            padding: 8px 6px;
          }
        }

        /* Print: Always use table layout */
        @media print {
          .group-stage-schedule {
            break-inside: avoid;
          }
          .group-stage-schedule .mobile-view {
            display: none !important;
          }
          .group-stage-schedule .desktop-view {
            display: block !important;
          }
          .group-stage-schedule table {
            min-width: 100%;
          }
        }
      `}</style>
    </div>
  );
};
