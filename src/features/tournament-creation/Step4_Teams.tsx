import { useState } from 'react';
import { Card, Button, Input, Icons, TeamAvatar, ColorPicker, LogoUploadDialog } from '../../components/ui';
import { Tournament, Team, TeamLogo } from '../../types/tournament';
import { cssVars } from '../../design-tokens'
import { generateGroupLabels } from '../../utils/groupHelpers';
import { getGroupDisplayName } from '../../utils/displayNames';
import styles from './Step4_Teams.module.css';

interface Step4Props {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
  onAddTeam: () => void;
  onRemoveTeam: (id: string) => void;
  onUpdateTeam: (id: string, updates: Partial<Team>) => void;
}

interface GroupWarning {
  type: 'error' | 'warning' | 'info';
  message: string;
  action?: string;
}

/**
 * Analyze group distribution and return warnings
 */
function analyzeGroupDistribution(
  teams: Team[],
  groupLabels: string[]
): GroupWarning[] {
  const warnings: GroupWarning[] = [];

  // Count teams per group
  const groupCounts: Record<string, number> = {};
  groupLabels.forEach(label => { groupCounts[label] = 0; });

  let unassignedCount = 0;
  teams.forEach(team => {
    if (team.group && groupLabels.includes(team.group)) {
      groupCounts[team.group]++;
    } else {
      unassignedCount++;
    }
  });

  const counts = Object.values(groupCounts);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);

  // Warning 1: Teams without group assignment
  if (unassignedCount > 0) {
    warnings.push({
      type: 'warning',
      message: `${unassignedCount} Team${unassignedCount > 1 ? 's' : ''} ohne Gruppenzuordnung`,
      action: 'Gruppen automatisch zuweisen',
    });
  }

  // Warning 2: Empty groups
  const emptyGroups = groupLabels.filter(label => groupCounts[label] === 0);
  if (emptyGroups.length > 0 && teams.length > 0) {
    warnings.push({
      type: 'error',
      message: `Gruppe${emptyGroups.length > 1 ? 'n' : ''} ${emptyGroups.join(', ')} ${emptyGroups.length > 1 ? 'haben' : 'hat'} keine Teams`,
      action: 'Gruppen neu verteilen',
    });
  }

  // Warning 3: Groups with only 1 team (can't play matches)
  const singleTeamGroups = groupLabels.filter(label => groupCounts[label] === 1);
  if (singleTeamGroups.length > 0) {
    warnings.push({
      type: 'error',
      message: `Gruppe${singleTeamGroups.length > 1 ? 'n' : ''} ${singleTeamGroups.join(', ')} ${singleTeamGroups.length > 1 ? 'haben' : 'hat'} nur 1 Team – keine Spiele möglich`,
    });
  }

  // Warning 4: Unbalanced groups (significant difference)
  if (minCount > 0 && maxCount - minCount >= 2) {
    const distribution = groupLabels.map(label => `${label}: ${groupCounts[label]}`).join(', ');
    warnings.push({
      type: 'warning',
      message: `Ungleiche Gruppengrößen (${distribution})`,
      action: 'Für faireren Spielplan gleichmäßig verteilen',
    });
  } else if (minCount > 0 && maxCount - minCount === 1) {
    // Info: slight imbalance is okay but worth noting
    const distribution = groupLabels.map(label => `${label}: ${groupCounts[label]}`).join(', ');
    warnings.push({
      type: 'info',
      message: `Gruppenverteilung: ${distribution}`,
    });
  }

  return warnings;
}

export const Step4_Teams: React.FC<Step4Props> = ({
  formData,
  onUpdate,
  onAddTeam,
  onRemoveTeam,
  onUpdateTeam,
}) => {
  const [logoUploadTeamId, setLogoUploadTeamId] = useState<string | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  const teams = formData.teams ?? [];
  const canAssignGroups = formData.groupSystem === 'groupsAndFinals';
  const numberOfTeams = formData.numberOfTeams ?? 4;
  const numberOfGroups = formData.numberOfGroups ?? 2;
  const needsMoreTeams = teams.length < numberOfTeams;
  const groupLabels = generateGroupLabels(numberOfGroups);

  // Find team for logo upload dialog
  const logoUploadTeam = logoUploadTeamId
    ? teams.find(t => t.id === logoUploadTeamId)
    : null;

  // Handle logo save
  const handleLogoSave = (logo: TeamLogo) => {
    if (logoUploadTeamId) {
      onUpdateTeam(logoUploadTeamId, { logo });
      setLogoUploadTeamId(null);
    }
  };

  // Handle logo remove
  const handleLogoRemove = () => {
    if (logoUploadTeamId) {
      onUpdateTeam(logoUploadTeamId, { logo: undefined });
      setLogoUploadTeamId(null);
    }
  };

  // Handle color change
  const handleColorChange = (teamId: string, color: string) => {
    const team = teams.find(t => t.id === teamId);
    onUpdateTeam(teamId, {
      colors: { ...team?.colors, primary: color },
    });
  };

  // Toggle expanded state
  const toggleExpanded = (teamId: string) => {
    setExpandedTeamId(prev => prev === teamId ? null : teamId);
  };

  // Analyze group distribution for warnings
  const groupWarnings = canAssignGroups && teams.length > 0
    ? analyzeGroupDistribution(teams, groupLabels)
    : [];

  // Prüft ob ein Team ein Duplikat ist (= ein vorheriges Team hat denselben Namen)
  const isTeamDuplicate = (teamId: string, teamName: string | undefined): boolean => {
    if (!teamName?.trim()) {return false;}
    const normalizedName = teamName.trim().toLowerCase();
    const teamIndex = teams.findIndex(t => t.id === teamId);
    return teams.slice(0, teamIndex).some(t =>
      t.name.trim().toLowerCase() === normalizedName
    );
  };

  // Prüft ob ein Team ein Original ist (= ein späteres Team hat denselben Namen)
  const isTeamOriginal = (teamId: string, teamName: string | undefined): boolean => {
    if (!teamName?.trim()) {return false;}
    const normalizedName = teamName.trim().toLowerCase();
    const teamIndex = teams.findIndex(t => t.id === teamId);
    return teams.slice(teamIndex + 1).some(t =>
      t.name.trim().toLowerCase() === normalizedName
    );
  };

  // Auto-Generierung: Teams basierend auf numberOfTeams erstellen
  const handleGenerateTeams = () => {
    const newTeams: Team[] = [];
    for (let i = 1; i <= numberOfTeams; i++) {
      newTeams.push({
        id: `team-${Date.now()}-${i}`,
        name: `Team ${i}`,
      });
    }
    onUpdate('teams', newTeams);
  };

  // Auto-Zuweisung: Teams gleichmäßig auf Gruppen verteilen
  const handleAutoAssignGroups = () => {
    const updatedTeams = teams.map((team, index) => ({
      ...team,
      group: groupLabels[index % numberOfGroups],
    }));

    onUpdate('teams', updatedTeams);
  };

  return (
    <Card>
      <h2 style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.xl, margin: '0 0 24px 0' }}>
        Teams
      </h2>

      <div className={styles.buttonRow}>
        <Button onClick={onAddTeam} icon={<Icons.Plus />} variant="secondary">
          Team hinzufügen
        </Button>

        {needsMoreTeams && (
          <Button
            onClick={handleGenerateTeams}
            icon={<Icons.Plus />}
            variant="primary"
          >
            {numberOfTeams} Teams generieren
          </Button>
        )}

        {canAssignGroups && teams.length > 0 && (formData.numberOfGroups ?? 0) > 1 && (
          <Button
            onClick={handleAutoAssignGroups}
            variant="secondary"
          >
            Gruppen automatisch zuweisen
          </Button>
        )}
      </div>

      {teams.length === 0 ? (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            background: cssVars.colors.surfaceDarkMedium,
            borderRadius: cssVars.borderRadius.md,
            border: `1px dashed ${cssVars.colors.border}`,
          }}
        >
          <p style={{ color: cssVars.colors.textSecondary, margin: 0 }}>
            Noch keine Teams hinzugefügt
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {teams.map((team) => {
            const isDuplicate = isTeamDuplicate(team.id, team.name);
            const isOriginal = isTeamOriginal(team.id, team.name);
            const hasError = isDuplicate || isOriginal;
            const isExpanded = expandedTeamId === team.id;

            return (
              <div key={team.id} className={styles.teamRow}>
                {/* Main row: Avatar + Name + Expand + Delete */}
                <div className={styles.teamRowMain}>
                  {/* TeamAvatar instead of numbered badge */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(team.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    aria-label={`Logo und Farben für ${team.name} ${isExpanded ? 'einklappen' : 'bearbeiten'}`}
                  >
                    <TeamAvatar
                      team={team}
                      size="md"
                      showColorRing={!!team.colors?.primary}
                    />
                  </button>

                  <div className={styles.teamNameInput}>
                    <Input
                      value={team.name}
                      onChange={(v) => onUpdateTeam(team.id, { name: v })}
                      placeholder="Teamname eingeben"
                      error={hasError}
                    />
                    {hasError && (
                      <p style={{
                        margin: `${cssVars.spacing.xs} 0 0 0`,
                        color: cssVars.colors.error,
                        fontSize: cssVars.fontSizes.xs,
                      }}>
                        Dieser Name wird bereits verwendet
                      </p>
                    )}
                  </div>

                  {/* Expand button for logo/color editing */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(team.id)}
                    style={{
                      flexShrink: 0,
                      width: 40,
                      height: 40,
                      padding: 0,
                      background: cssVars.colors.surface,
                      border: `1px solid ${cssVars.colors.border}`,
                      borderRadius: cssVars.borderRadius.md,
                      color: cssVars.colors.textSecondary,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Einklappen' : 'Logo & Farben'}
                  >
                    {isExpanded ? '▲' : '▼'}
                  </button>

                  <button
                    onClick={() => onRemoveTeam(team.id)}
                    className={styles.deleteButton}
                    aria-label={`Team ${team.name} löschen`}
                  >
                    <Icons.Trash size={18} />
                  </button>
                </div>

                {/* Expanded section: Logo & Color editing */}
                {isExpanded && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: cssVars.spacing.md,
                    paddingTop: cssVars.spacing.md,
                    paddingLeft: '52px', // Align with input (40px avatar + 12px gap)
                    borderTop: `1px solid ${cssVars.colors.border}`,
                  }}>
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: cssVars.spacing.lg,
                      alignItems: 'flex-start',
                    }}>
                      {/* Logo Section */}
                      <div style={{ minWidth: 120 }}>
                        <span style={{
                          display: 'block',
                          fontSize: cssVars.fontSizes.sm,
                          color: cssVars.colors.textSecondary,
                          marginBottom: cssVars.spacing.sm,
                        }}>
                          Logo
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setLogoUploadTeamId(team.id)}
                        >
                          {team.logo ? 'Logo ändern' : 'Logo hochladen'}
                        </Button>
                      </div>

                      {/* Color Section */}
                      <ColorPicker
                        label="Trikotfarbe"
                        value={team.colors?.primary || '#666666'}
                        onChange={(color) => handleColorChange(team.id, color)}
                        showCustomPicker={false}
                      />
                    </div>
                  </div>
                )}

                {/* Secondary row: Group selector (only on mobile, inline on desktop via CSS) */}
                {canAssignGroups && (
                  <div className={styles.teamRowSecondary}>
                    <span className={styles.groupLabel}>Gruppe:</span>
                    <div className={styles.groupSelectWrapper}>
                      <select
                        value={team.group ?? ''}
                        onChange={(e) => onUpdateTeam(team.id, { group: e.target.value || undefined })}
                        className={styles.groupSelect}
                        aria-label={`Gruppe für ${team.name}`}
                      >
                        <option value="">Keine Gruppe</option>
                        {(formData.groups ?? groupLabels.map(id => ({ id }))).map(group => (
                          <option key={group.id} value={group.id}>
                            {getGroupDisplayName(group)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Group Distribution Warnings */}
      {groupWarnings.length > 0 && (
        <div
          style={{
            marginTop: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
          role="region"
          aria-label="Gruppenzuordnungs-Hinweise"
        >
          {groupWarnings.map((warning, index) => (
            <div
              key={index}
              style={{
                padding: '12px 16px',
                background: warning.type === 'error'
                  ? cssVars.colors.errorLight
                  : warning.type === 'warning'
                    ? cssVars.colors.warningLight
                    : cssVars.colors.infoLight,
                borderRadius: cssVars.borderRadius.md,
                border: `1px solid ${
                  warning.type === 'error'
                    ? cssVars.colors.errorBorder
                    : warning.type === 'warning'
                      ? cssVars.colors.warningBorder
                      : cssVars.colors.infoBorder
                }`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
              role={warning.type === 'error' ? 'alert' : 'status'}
            >
              <span style={{ fontSize: cssVars.fontSizes.lg, flexShrink: 0 }} aria-hidden="true">
                {warning.type === 'error' ? '❌' : warning.type === 'warning' ? '⚠️' : 'ℹ️'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{
                  color: warning.type === 'error'
                    ? cssVars.colors.error
                    : warning.type === 'warning'
                      ? cssVars.colors.warning
                      : cssVars.colors.textPrimary,
                  fontSize: cssVars.fontSizes.sm,
                  fontWeight: cssVars.fontWeights.medium,
                }}>
                  {warning.message}
                </div>
                {warning.action && (
                  <div style={{
                    color: cssVars.colors.textSecondary,
                    fontSize: cssVars.fontSizes.sm,
                    marginTop: '4px',
                  }}>
                    {warning.action}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {teams.length > 0 && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            background: cssVars.colors.secondaryLight,
            borderRadius: cssVars.borderRadius.md,
            border: `1px solid ${cssVars.colors.secondaryBorderActive}`,
          }}
        >
          <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary }}>
            {teams.length} Team{teams.length !== 1 ? 's' : ''} hinzugefügt
            {canAssignGroups && ` • Gruppen können jetzt zugewiesen werden`}
          </div>
        </div>
      )}

      {/* Logo Upload Dialog */}
      {logoUploadTeam && (
        <LogoUploadDialog
          teamName={logoUploadTeam.name}
          currentLogo={logoUploadTeam.logo}
          onSave={handleLogoSave}
          onCancel={() => setLogoUploadTeamId(null)}
          onRemove={logoUploadTeam.logo ? handleLogoRemove : undefined}
        />
      )}
    </Card>
  );
};
