/**
 * ParticipantsAndGroups - Displays tournament participants organized by groups
 */

import { CSSProperties } from 'react';
import { borderRadius, colors, fontSizes, fontWeights, spacing } from '../../design-tokens';
import { Standing, Tournament } from '../../types/tournament';
import { getGroupDisplayName } from '../../utils/displayNames';

interface ParticipantsAndGroupsProps {
  teams: Array<{ id: string; name: string; group?: string }>;
  standings: Standing[];
  tournament?: Tournament;
}

export const ParticipantsAndGroups: React.FC<ParticipantsAndGroupsProps> = ({
  teams,
  standings,
  tournament,
}) => {
  const groupStandings = getGroupStandings(standings, teams);

  if (groupStandings.length === 0) {
    return null; // Only show for group-based tournaments
  }

  // Calculate continuous team numbers across all groups
  // This matches the PDF export numbering logic
  const teamNumberMap = new Map<string, number>();
  let teamCounter = 1;

  groupStandings.forEach(({ groupStandings: groupTeams }) => {
    groupTeams.forEach((standing) => {
      teamNumberMap.set(standing.team.id, teamCounter);
      teamCounter++;
    });
  });

  const containerStyle: CSSProperties = {
    marginBottom: spacing.lg,
  };

  const titleStyle: CSSProperties = {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.primary,
    marginBottom: spacing.md,
  };

  const groupsGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: spacing.md,
  };

  const groupBoxStyle: CSSProperties = {
    padding: spacing.md,
    background: colors.background,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.md,
  };

  const groupTitleStyle: CSSProperties = {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
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
    color: colors.textPrimary,
    borderBottom: `1px solid ${colors.border}`,
  };

  // Special case: Only 1 group - hide group title
  const showGroupTitles = groupStandings.length > 1;

  return (
    <div style={containerStyle} className="participants-and-groups">
      <h2 style={titleStyle}>Teilnehmer</h2>
      <div style={groupsGridStyle}>
        {groupStandings.map(({ group, groupStandings: groupTeams }) => (
          <div key={group} style={groupBoxStyle}>
            {showGroupTitles && <h3 style={groupTitleStyle}>{getGroupDisplayName(group, tournament)}</h3>}
            <ul style={teamListStyle}>
              {groupTeams.map((standing) => (
                <li key={standing.team.id} style={teamItemStyle}>
                  {teamNumberMap.get(standing.team.id)}. {standing.team.name}
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
      groupStandings: allStandings
        .filter(s =>
          teams.find(t => t.id === s.team.id)?.group === group
        )
        // Sort teams alphabetically within each group (matches PDF export logic)
        .sort((a, b) => a.team.name.localeCompare(b.team.name)),
    }));
}
