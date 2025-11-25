/**
 * ScheduleDisplay - Rendert den generierten Spielplan im PDF-Stil
 *
 * Layout-Modi:
 * - Round Robin: Wie Blitzcup PDF (1 Tabelle rechts)
 * - Mit Gruppen: Wie Nittenau PDF (2+ Tabellen pro Gruppe)
 */

import { CSSProperties } from 'react';
import { theme } from '../styles/theme';
import { GeneratedSchedule, ScheduledMatch } from '../lib/scheduleGenerator';
import { Standing } from '../types/tournament';

interface ScheduleDisplayProps {
  schedule: GeneratedSchedule;
  /** Optional: Aktualisierte Standings (nach Ergebnissen) */
  currentStandings?: Standing[];
  /** Zeige QR-Code für Live-Tracking */
  showQRCode?: boolean;
  /** QR-Code URL */
  qrCodeUrl?: string;
}

export const ScheduleDisplay: React.FC<ScheduleDisplayProps> = ({
  schedule,
  currentStandings,
  showQRCode = false,
  qrCodeUrl,
}) => {
  const standings = currentStandings || schedule.initialStandings;
  const hasGroups = schedule.teams.some(t => t.group);

  // Container Style (A4-ähnlich)
  const containerStyle: CSSProperties = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px',
    background: theme.colors.background,
    fontFamily: theme.fonts.body,
    color: theme.colors.text.primary,
  };

  const headerStyle: CSSProperties = {
    textAlign: 'center',
    marginBottom: '32px',
    borderBottom: `2px solid ${theme.colors.primary}`,
    paddingBottom: '24px',
  };

  const titleStyle: CSSProperties = {
    fontSize: '32px',
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.primary,
    margin: '0 0 16px 0',
  };

  const metaBoxStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    padding: '16px',
    background: 'rgba(0,230,118,0.05)',
    borderRadius: theme.borderRadius.md,
    marginTop: '16px',
  };

  const metaItemStyle: CSSProperties = {
    fontSize: '14px',
    color: theme.colors.text.secondary,
  };

  const mainLayoutStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: hasGroups ? '1fr' : '65% 35%',
    gap: '24px',
    marginTop: '32px',
  };

  // Für Gruppen-Modus: Zwei Spalten Layout
  const groupLayoutStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
  };

  // Berechne zusätzliche Meta-Infos
  const groupPhase = schedule.phases.find(p => p.name === 'groupStage');
  const firstMatch = groupPhase?.matches[0];
  const matchDuration = firstMatch?.duration || 10;
  const numberOfTeams = schedule.teams.length;
  const numberOfMatches = schedule.allMatches.length;

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={titleStyle}>{schedule.tournament.title}</h1>

        <div style={{
          fontSize: '14px',
          color: theme.colors.text.secondary,
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          {schedule.tournament.ageClass} • {schedule.tournament.date}
        </div>

        <div style={metaBoxStyle}>
          <div style={metaItemStyle}>
            <strong>Veranstalter:</strong> {schedule.tournament.location}
          </div>
          <div style={metaItemStyle}>
            <strong>Datum:</strong> {schedule.tournament.date}
          </div>
          <div style={metaItemStyle}>
            <strong>Beginn:</strong> {formatTime(schedule.startTime)} Uhr
          </div>
          <div style={metaItemStyle}>
            <strong>Veranstaltungsort:</strong> {schedule.tournament.location}
          </div>
          <div style={metaItemStyle}>
            <strong>Spieldauer:</strong> {matchDuration} Minuten
          </div>
          <div style={metaItemStyle}>
            <strong>Teilnehmer:</strong> {numberOfTeams} Teams
          </div>
          <div style={metaItemStyle}>
            <strong>Spiele gesamt:</strong> {numberOfMatches}
          </div>
          <div style={metaItemStyle}>
            <strong>Ende (ca.):</strong> {formatTime(schedule.endTime)} Uhr
          </div>
        </div>

        {showQRCode && qrCodeUrl && (
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <img src={qrCodeUrl} alt="QR Code" style={{ width: '100px', height: '100px' }} />
            <div style={{ fontSize: '12px', color: theme.colors.text.secondary, marginTop: '8px' }}>
              Ergebnisse live verfolgen
            </div>
          </div>
        )}
      </div>

      {/* Main Layout */}
      <div style={mainLayoutStyle}>
        {/* Spiel-Liste */}
        <div>
          {hasGroups ? (
            // Mit Gruppen: Vorrunde + Finalrunde getrennt
            <>
              <MatchListWithGroups schedule={schedule} />
            </>
          ) : (
            // Round Robin: Eine Liste
            <MatchListRoundRobin matches={schedule.allMatches} />
          )}
        </div>

        {/* Tabelle(n) */}
        {!hasGroups && (
          <div>
            <StandingsTable standings={standings} title="Tabelle" />
          </div>
        )}
      </div>

      {/* Bei Gruppen: Tabellen unten */}
      {hasGroups && (
        <div style={{ ...groupLayoutStyle, marginTop: '32px' }}>
          {getGroupStandings(standings, schedule.teams).map(({ group, groupStandings }) => (
            <StandingsTable
              key={group}
              standings={groupStandings}
              title={`Gruppe ${group}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface MatchListRoundRobinProps {
  matches: ScheduledMatch[];
}

const MatchListRoundRobin: React.FC<MatchListRoundRobinProps> = ({ matches }) => {
  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
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
  };

  const resultCellStyle: CSSProperties = {
    ...tdStyle,
    textAlign: 'center',
    fontWeight: theme.fontWeights.bold,
    minWidth: '60px',
  };

  return (
    <div>
      <h2 style={{ fontSize: '18px', marginBottom: '16px', color: theme.colors.primary }}>
        Spielplan
      </h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '40px' }}>Nr.</th>
            <th style={{ ...thStyle, width: '60px' }}>Beginn</th>
            <th style={thStyle}>Spiel</th>
            <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>Ergebnis</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => (
            <tr key={match.id}>
              <td style={tdStyle}>{match.matchNumber}</td>
              <td style={tdStyle}>{match.time}</td>
              <td style={tdStyle}>
                {match.homeTeam} - {match.awayTeam}
              </td>
              <td style={resultCellStyle}>__ : __</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface MatchListWithGroupsProps {
  schedule: GeneratedSchedule;
}

const MatchListWithGroups: React.FC<MatchListWithGroupsProps> = ({ schedule }) => {
  const groupPhase = schedule.phases.find(p => p.name === 'groupStage');
  const finalPhases = schedule.phases.filter(p => p.name !== 'groupStage');

  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
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
  };

  return (
    <>
      {/* Vorrunde */}
      {groupPhase && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '16px', color: theme.colors.primary }}>
            Vorrunde
          </h2>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: '40px' }}>Nr.</th>
                <th style={{ ...thStyle, width: '60px' }}>Beginn</th>
                <th style={{ ...thStyle, width: '30px' }}>Gr</th>
                <th style={thStyle}>Spiel</th>
                <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>Ergebnis</th>
              </tr>
            </thead>
            <tbody>
              {groupPhase.matches.map((match) => (
                <tr key={match.id}>
                  <td style={tdStyle}>{match.matchNumber}</td>
                  <td style={tdStyle}>{match.time}</td>
                  <td style={tdStyle}>{match.group || '-'}</td>
                  <td style={tdStyle}>
                    {match.homeTeam} - {match.awayTeam}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: theme.fontWeights.bold }}>
                    __ : __
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Finalrunde */}
      {finalPhases.length > 0 && (
        <div>
          <h2 style={{ fontSize: '18px', marginBottom: '16px', color: theme.colors.accent }}>
            Finalrunde
          </h2>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: '40px' }}>Nr.</th>
                <th style={{ ...thStyle, width: '60px' }}>Beginn</th>
                <th style={thStyle}>Spiel</th>
                <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>Ergebnis</th>
              </tr>
            </thead>
            <tbody>
              {finalPhases.flatMap(phase => phase.matches).map((match) => (
                <tr key={match.id}>
                  <td style={tdStyle}>{match.matchNumber}</td>
                  <td style={tdStyle}>{match.time}</td>
                  <td style={tdStyle}>
                    {getFinalMatchLabel(match)} <br/>
                    <span style={{ fontSize: '12px', color: theme.colors.text.secondary }}>
                      {match.homeTeam} - {match.awayTeam}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: theme.fontWeights.bold }}>
                    __ : __
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

interface StandingsTableProps {
  standings: Standing[];
  title: string;
}

const StandingsTable: React.FC<StandingsTableProps> = ({ standings, title }) => {
  const containerStyle: CSSProperties = {
    background: 'rgba(0,230,118,0.05)',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    padding: '16px',
  };

  const titleStyle: CSSProperties = {
    fontSize: '16px',
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.primary,
    marginBottom: '12px',
  };

  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  };

  const thStyle: CSSProperties = {
    background: theme.colors.primary,
    color: theme.colors.background,
    padding: '6px 4px',
    textAlign: 'left',
    fontWeight: theme.fontWeights.semibold,
    fontSize: '11px',
  };

  const tdStyle: CSSProperties = {
    padding: '6px 4px',
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  return (
    <div style={containerStyle}>
      <h3 style={titleStyle}>{title}</h3>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '30px' }}>Pl</th>
            <th style={thStyle}>Team</th>
            <th style={{ ...thStyle, width: '30px', textAlign: 'center' }}>Sp</th>
            <th style={{ ...thStyle, width: '30px', textAlign: 'center' }}>S</th>
            <th style={{ ...thStyle, width: '30px', textAlign: 'center' }}>U</th>
            <th style={{ ...thStyle, width: '30px', textAlign: 'center' }}>N</th>
            <th style={{ ...thStyle, width: '50px', textAlign: 'center' }}>Tore</th>
            <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>TD</th>
            <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>Pkt</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((standing, index) => (
            <tr key={standing.team.id}>
              <td style={{ ...tdStyle, fontWeight: theme.fontWeights.semibold }}>
                {index + 1}
              </td>
              <td style={tdStyle}>{standing.team.name}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{standing.played}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{standing.won}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{standing.drawn}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{standing.lost}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                {standing.goalsFor}:{standing.goalsAgainst}
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                {standing.goalDifference > 0 ? '+' : ''}{standing.goalDifference}
              </td>
              <td style={{ ...tdStyle, textAlign: 'center', fontWeight: theme.fontWeights.bold }}>
                {standing.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function getFinalMatchLabel(match: ScheduledMatch): string {
  if (match.finalType === 'final') return '🏆 Finale';
  if (match.finalType === 'thirdPlace') return '🥉 Spiel um Platz 3';
  if (match.finalType === 'fifthSixth') return 'Spiel um Platz 5';
  if (match.finalType === 'seventhEighth') return 'Spiel um Platz 7';

  if (match.phase === 'semifinal') return 'Halbfinale';
  if (match.phase === 'quarterfinal') return 'Viertelfinale';

  return 'Finalspiel';
}

function getGroupStandings(
  allStandings: Standing[],
  teams: Array<{ id: string; name: string; group?: string }>
): Array<{ group: string; groupStandings: Standing[] }> {
  const groups = new Set(teams.map(t => t.group).filter(Boolean)) as Set<string>;

  return Array.from(groups)
    .sort()
    .map(group => ({
      group,
      groupStandings: allStandings.filter(s =>
        teams.find(t => t.id === s.team.id)?.group === group
      ),
    }));
}
