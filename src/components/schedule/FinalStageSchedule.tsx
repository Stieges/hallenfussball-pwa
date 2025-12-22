/**
 * FinalStageSchedule - Displays playoff/final matches in MeinTurnierplan style
 * Fully responsive with table view for desktop and card view for mobile
 */

import { CSSProperties } from 'react';
import { theme } from '../../styles/theme';
import { ScheduledMatch } from '../../lib/scheduleGenerator';
import { RefereeConfig } from '../../types/tournament';
import { MatchScoreCell } from './MatchScoreCell';
import { LiveBadge } from './LiveBadge';

interface FinalStageScheduleProps {
  matches: ScheduledMatch[];
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
  // Note: Permission check is now handled in ScheduleTab
}

export const FinalStageSchedule: React.FC<FinalStageScheduleProps> = ({
  matches,
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

  const getFieldOptions = () => {
    const options = [];
    for (let i = 1; i <= numberOfFields; i++) {
      options.push({ value: i, label: i.toString() });
    }
    return options;
  };

  const findFieldConflict = (matchId: string, fieldNumber: number): ScheduledMatch | null => {
    const targetMatch = matches.find(m => m.id === matchId);
    if (!targetMatch) {return null;}
    const fieldMatches = matches.filter(m => m.field === fieldNumber && m.id !== matchId);
    for (const match of fieldMatches) {
      const targetStart = targetMatch.startTime.getTime();
      const targetEnd = targetMatch.endTime.getTime();
      const matchStart = match.startTime.getTime();
      const matchEnd = match.endTime.getTime();
      if (targetStart < matchEnd && matchStart < targetEnd) {
        return match;
      }
    }
    return null;
  };

  const refereeOptions = getRefereeOptions();
  const fieldOptions = getFieldOptions();

  const containerStyle: CSSProperties = { marginBottom: '24px' };
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
  // Match label column style (compact for "Runde" column)
  const matchLabelCellStyle: CSSProperties = {
    fontSize: '11px',
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.accent,
    whiteSpace: 'nowrap',
  };

  // Team cell style (matching GroupStageSchedule)
  const teamCellStyle: CSSProperties = {
    ...tdStyle,
    fontWeight: theme.fontWeights.medium,
  };

  // Mobile card styles
  const mobileCardStyle: CSSProperties = {
    backgroundColor: theme.colors.background,
    border: `2px solid ${theme.colors.accent}`,
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
  };
  const mobileCardHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: `2px solid ${theme.colors.accent}`,
  };
  const mobileMatchNumberStyle: CSSProperties = {
    fontSize: '16px',
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.accent,
  };
  const mobileTimeStyle: CSSProperties = {
    fontSize: '14px',
    color: theme.colors.text.secondary,
  };
  const mobileLabelStyle: CSSProperties = {
    fontSize: '16px',
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.accent,
    marginBottom: '12px',
    textAlign: 'center',
  };
  const mobileTeamsContainerStyle: CSSProperties = { marginBottom: '12px' };
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
    <div style={containerStyle} className="final-stage-schedule">
      <h2 style={titleStyle}>Finalrunde</h2>

      <div className="desktop-view" style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '40px' }}>Nr.</th>
              {showReferees && <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>SR</th>}
              <th style={{ ...thStyle, width: '60px' }}>Zeit</th>
              <th style={{ ...thStyle, width: '100px' }}>Runde</th>
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
                      <select value={match.referee || ''} onChange={(e) => onRefereeChange(match.id, e.target.value ? parseInt(e.target.value) : null)} style={{ width: '100%', padding: '4px', border: `1px solid ${theme.colors.border}`, borderRadius: '4px', fontSize: '12px', fontWeight: theme.fontWeights.semibold, textAlign: 'center', cursor: 'pointer', backgroundColor: theme.colors.background, color: theme.colors.text.primary }}>
                        <option value="">-</option>
                        {refereeOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                      </select>
                    ) : (<span style={{ fontWeight: theme.fontWeights.semibold }}>{match.referee || '-'}</span>)}
                  </td>
                )}
                <td style={tdStyle}>{match.time}</td>
                <td style={{ ...tdStyle, ...matchLabelCellStyle }}>{getFinalMatchLabel(match)}</td>
                <td style={{
                  ...teamCellStyle,
                  ...(isPlaceholderTeam(match.homeTeam) ? { color: theme.colors.text.placeholder, fontStyle: 'italic' } : {})
                }}>
                  {match.homeTeam}
                </td>
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
                <td style={{
                  ...teamCellStyle,
                  ...(isPlaceholderTeam(match.awayTeam) ? { color: theme.colors.text.placeholder, fontStyle: 'italic' } : {})
                }}>
                  {match.awayTeam}
                </td>
                {showFields && (
                  <td style={{ ...tdStyle, textAlign: 'center', padding: editable ? '4px' : '8px' }}>
                    {editable && onFieldChange ? (
                      <select value={match.field || 1} onChange={(e) => { const fieldNum = parseInt(e.target.value); const conflict = findFieldConflict(match.id, fieldNum); if (conflict && !window.confirm(`⚠️ Zeitkonflikt erkannt!\n\nFeld ${fieldNum} ist bereits für Spiel #${conflict.matchNumber} (${conflict.time}) belegt.\n\nDie Spiele überschneiden sich zeitlich.\n\nMöchtest du die Zuweisung trotzdem vornehmen?`)) {return;} onFieldChange(match.id, fieldNum); }} style={{ width: '100%', padding: '4px', border: `1px solid ${theme.colors.border}`, borderRadius: '4px', fontSize: '12px', fontWeight: theme.fontWeights.semibold, textAlign: 'center', cursor: 'pointer', backgroundColor: theme.colors.background, color: theme.colors.text.primary }}>
                        {fieldOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                      </select>
                    ) : (<span style={{ fontWeight: theme.fontWeights.semibold }}>{match.field || '-'}</span>)}
                  </td>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mobile-view">
        {matches.map((match) => {
          const isRunning = runningMatchIds?.has(match.id);
          return (
          <div key={match.id} style={mobileCardStyle}>
            <div style={mobileCardHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={mobileMatchNumberStyle}>Spiel #{match.matchNumber}</span>
                {isRunning && <LiveBadge compact />}
              </div>
              <span style={mobileTimeStyle}>{match.time}</span>
            </div>
            <div style={mobileLabelStyle}>{getFinalMatchLabel(match)}</div>
            <div style={mobileTeamsContainerStyle}>
              <div style={{
                ...mobileTeamStyle,
                ...(isPlaceholderTeam(match.homeTeam) ? { color: theme.colors.text.placeholder, fontStyle: 'italic' } : {})
              }}>{match.homeTeam}</div>
              <div style={{
                ...mobileTeamStyle,
                ...(isPlaceholderTeam(match.awayTeam) ? { color: theme.colors.text.placeholder, fontStyle: 'italic' } : {})
              }}>{match.awayTeam}</div>
            </div>
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
            <div style={mobileMetaStyle}>
              {showReferees && (
                <div style={mobileMetaItemStyle}>
                  <strong>SR:</strong>
                  {editable && onRefereeChange ? (
                    <select value={match.referee || ''} onChange={(e) => onRefereeChange(match.id, e.target.value ? parseInt(e.target.value) : null)} style={mobileSelectStyle}>
                      <option value="">-</option>
                      {refereeOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                  ) : (<span>{match.referee || '-'}</span>)}
                </div>
              )}
              {showFields && (
                <div style={mobileMetaItemStyle}>
                  <strong>Feld:</strong>
                  {editable && onFieldChange ? (
                    <select value={match.field || 1} onChange={(e) => { const fieldNum = parseInt(e.target.value); const conflict = findFieldConflict(match.id, fieldNum); if (conflict && !window.confirm(`⚠️ Zeitkonflikt erkannt!\n\nFeld ${fieldNum} ist bereits für Spiel #${conflict.matchNumber} (${conflict.time}) belegt.\n\nDie Spiele überschneiden sich zeitlich.\n\nMöchtest du die Zuweisung trotzdem vornehmen?`)) {return;} onFieldChange(match.id, fieldNum); }} style={mobileSelectStyle}>
                      {fieldOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                  ) : (<span>{match.field || '-'}</span>)}
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>

      <style>{`
        .final-stage-schedule .mobile-view { display: none; }
        @media (max-width: 767px) {
          .final-stage-schedule .desktop-view { display: none; }
          .final-stage-schedule .mobile-view { display: block; }
        }
        @media (min-width: 768px) and (max-width: 1024px) {
          .final-stage-schedule table { font-size: 12px; }
          .final-stage-schedule th, .final-stage-schedule td { padding: 8px 6px; }
        }
        @media print {
          .final-stage-schedule { break-inside: avoid; }
          .final-stage-schedule .mobile-view { display: none !important; }
          .final-stage-schedule .desktop-view { display: block !important; }
          .final-stage-schedule table { min-width: 100%; }
        }
      `}</style>
    </div>
  );
};

/**
 * Check if a team name is an unresolved placeholder
 * Examples: "TBD", "1. Gruppe A", "Sieger HF1", "group-a-1st"
 */
function isPlaceholderTeam(teamName: string): boolean {
  if (!teamName) {return false;}
  const placeholderPatterns = [
    /^TBD$/i,
    /^\d+\.\s*(Gruppe|Group)/i,  // "1. Gruppe A"
    /^(Sieger|Verlierer|Winner|Loser)/i,  // "Sieger HF1"
    /group-[a-z]-\d+(st|nd|rd|th)/i,  // "group-a-1st"
    /-winner$/i,  // "semi1-winner"
    /-loser$/i,  // "semi1-loser"
    /^bestSecond$/i,
  ];
  return placeholderPatterns.some(pattern => pattern.test(teamName));
}

function getFinalMatchLabel(match: ScheduledMatch): string {
  if (match.finalType === 'final') {return '🏆 Finale';}
  if (match.finalType === 'thirdPlace') {return '🥉 Spiel um Platz 3';}
  if (match.finalType === 'fifthSixth') {return 'Spiel um Platz 5';}
  if (match.finalType === 'seventhEighth') {return 'Spiel um Platz 7';}
  if (match.phase === 'semifinal') {return 'Halbfinale';}
  if (match.phase === 'quarterfinal') {return 'Viertelfinale';}
  if (match.label?.includes('Halbfinale')) {return match.label;}
  return 'Finalspiel';
}
