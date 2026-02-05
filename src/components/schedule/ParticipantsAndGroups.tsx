/**
 * ParticipantsAndGroups - Displays tournament participants organized by groups
 */

import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens'
import { Standing, Tournament } from '../../types/tournament';
import { getGroupDisplayName } from '../../utils/displayNames';
import { TeamAvatar } from '../ui/TeamAvatar';

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
  const { t } = useTranslation('tournament');
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
    marginBottom: cssVars.spacing.lg,
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.primary,
    marginBottom: cssVars.spacing.md,
  };

  const groupsGridStyle: CSSProperties = {
    display: 'grid',
    // Allow groups to sit side-by-side again to save vertical space
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: cssVars.spacing.lg,
    alignItems: 'start',
  };

  const groupBoxStyle: CSSProperties = {
    padding: cssVars.spacing.md,
    background: cssVars.colors.background,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
  };

  const groupTitleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.primary,
    marginBottom: '12px',
    borderBottom: `1px solid ${cssVars.colors.border}`,
    paddingBottom: '8px',
  };

  const teamListStyle: CSSProperties = {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'grid',
    // Internal grid: Allow 2 columns even in narrower group boxes (min 140px is safe for avatar + name)
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '8px 16px',
  };

  const teamItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: '6px 8px',
    borderBottom: `1px solid ${cssVars.colors.border}`,
    minHeight: '40px',
  };

  const numberStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    width: '24px',
    textAlign: 'center',
    flexShrink: 0,
    fontWeight: 500,
  };

  const nameStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textPrimary,
    fontWeight: cssVars.fontWeights.bold,
    // Allow text to wrap so long names are not cut off
    lineHeight: 1.3,
  };

  // Special case: Only 1 group - hide group title
  const showGroupTitles = groupStandings.length > 1;

  return (
    <div style={containerStyle} className="participants-and-groups">
      <h2 style={titleStyle}>{t('participants.title')}</h2>
      <div style={groupsGridStyle}>
        {groupStandings.map(({ group, groupStandings: groupTeams }) => (
          <div key={group || 'default'} style={groupBoxStyle}>
            {showGroupTitles && <h3 style={groupTitleStyle}>{getGroupDisplayName(group, tournament)}</h3>}
            <ul style={teamListStyle}>
              {groupTeams.map((standing) => (
                <li key={standing.team.id} style={teamItemStyle}>
                  <div style={numberStyle}>
                    {teamNumberMap.get(standing.team.id)}.
                  </div>
                  <TeamAvatar
                    team={standing.team}
                    size="sm" // Small avatar (32px)
                    showColorRing={false}
                  />
                  <span style={nameStyle}>{standing.team.name}</span>
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
          /* Reset grid for print to ensure list format if needed, or keep grid if it fits */
          .participants-and-groups ul {
             display: block !important;
          }
          .participants-and-groups li {
             break-inside: avoid;
             border-bottom: 1px solid #ccc;
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

  // If no groups defined but we have teams, handle as single group (or handle empty strings)
  if (groups.size === 0 && teams.length > 0) {
    // Fallback for no groups
    return [{
      group: '',
      groupStandings: allStandings.sort((a, b) => a.team.name.localeCompare(b.team.name))
    }];
  }

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
