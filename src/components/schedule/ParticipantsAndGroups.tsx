/**
 * ParticipantsAndGroups - Displays tournament participants organized by groups
 */

import { CSSProperties } from 'react';
import { theme } from '../../styles/theme';
import { Standing } from '../../types/tournament';

interface ParticipantsAndGroupsProps {
  teams: Array<{ id: string; name: string; group?: string }>;
  standings: Standing[];
}

export const ParticipantsAndGroups: React.FC<ParticipantsAndGroupsProps> = ({
  teams,
  standings,
}) => {
  const groupStandings = getGroupStandings(standings, teams);

  if (groupStandings.length === 0) {
    return null; // Only show for group-based tournaments
  }

  const containerStyle: CSSProperties = {
    marginBottom: '24px',
  };

  const titleStyle: CSSProperties = {
    fontSize: '18px',
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.primary,
    marginBottom: '16px',
  };

  const groupsGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '16px',
  };

  const groupBoxStyle: CSSProperties = {
    padding: '16px',
    background: theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
  };

  const groupTitleStyle: CSSProperties = {
    fontSize: '14px',
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.primary,
    marginBottom: '12px',
  };

  const teamListStyle: CSSProperties = {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  };

  const teamItemStyle: CSSProperties = {
    padding: '6px 0',
    fontSize: '13px',
    color: theme.colors.text.primary,
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  return (
    <div style={containerStyle} className="participants-and-groups">
      <h2 style={titleStyle}>Teilnehmer</h2>
      <div style={groupsGridStyle}>
        {groupStandings.map(({ group, groupStandings: groupTeams }) => (
          <div key={group} style={groupBoxStyle}>
            <h3 style={groupTitleStyle}>Gruppe {group}</h3>
            <ul style={teamListStyle}>
              {groupTeams.map((standing, index) => (
                <li key={standing.team.id} style={teamItemStyle}>
                  {index + 1}. {standing.team.name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .participants-and-groups {
            font-size: 12px;
          }
        }

        @media print {
          .participants-and-groups {
            break-inside: avoid;
          }
        }
      `}</style>
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
