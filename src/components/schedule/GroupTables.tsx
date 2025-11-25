/**
 * GroupTables - Displays group standings tables in MeinTurnierplan style
 */

import { CSSProperties } from 'react';
import { theme } from '../../styles/theme';
import { Standing } from '../../types/tournament';

interface GroupTablesProps {
  standings: Standing[];
  teams: Array<{ id: string; name: string; group?: string }>;
}

export const GroupTables: React.FC<GroupTablesProps> = ({
  standings,
  teams,
}) => {
  const groupStandings = getGroupStandings(standings, teams);

  if (groupStandings.length === 0) {
    return null; // Only show for group-based tournaments
  }

  const containerStyle: CSSProperties = {
    marginBottom: '24px',
  };

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
  };

  return (
    <div style={containerStyle} className="group-tables">
      <div style={gridStyle}>
        {groupStandings.map(({ group, groupStandings: groupTeams }) => (
          <StandingsTable
            key={group}
            standings={groupTeams}
            title={`Gruppe ${group}`}
          />
        ))}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .group-tables {
            grid-template-columns: 1fr;
          }
        }

        @media print {
          .group-tables {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
};

interface StandingsTableProps {
  standings: Standing[];
  title: string;
}

const StandingsTable: React.FC<StandingsTableProps> = ({ standings, title }) => {
  const containerStyle: CSSProperties = {
    background: theme.colors.background,
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
    padding: '8px 6px',
    textAlign: 'left',
    fontWeight: theme.fontWeights.semibold,
    fontSize: '11px',
  };

  const tdStyle: CSSProperties = {
    padding: '8px 6px',
    borderBottom: `1px solid ${theme.colors.border}`,
    color: theme.colors.text.primary,
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
              <td style={{ ...tdStyle, fontWeight: theme.fontWeights.semibold, textAlign: 'center' }}>
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
