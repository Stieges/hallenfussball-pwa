import { Card, Button, Input, Icons } from '../../components/ui';
import { Tournament, Team } from '../../types/tournament';
import { theme } from '../../styles/theme';
import { generateGroupLabels } from '../../utils/groupHelpers';
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
  const teams = formData.teams || [];
  const canAssignGroups = formData.groupSystem === 'groupsAndFinals';
  const numberOfTeams = formData.numberOfTeams || 4;
  const numberOfGroups = formData.numberOfGroups || 2;
  const needsMoreTeams = teams.length < numberOfTeams;
  const groupLabels = generateGroupLabels(numberOfGroups);

  // Analyze group distribution for warnings
  const groupWarnings = canAssignGroups && teams.length > 0
    ? analyzeGroupDistribution(teams, groupLabels)
    : [];

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
      <h2 style={{ color: theme.colors.text.primary, fontSize: theme.fontSizes.xl, margin: '0 0 24px 0' }}>
        👥 Teams
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

        {canAssignGroups && teams.length > 0 && (formData.numberOfGroups || 0) > 1 && (
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
            background: 'rgba(0,0,0,0.2)',
            borderRadius: theme.borderRadius.md,
            border: `1px dashed ${theme.colors.border}`,
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>👥</div>
          <p style={{ color: theme.colors.text.secondary, margin: 0 }}>
            Noch keine Teams hinzugefügt
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {teams.map((team, index) => (
            <div key={team.id} className={styles.teamRow}>
              {/* Main row: Badge + Name + Delete */}
              <div className={styles.teamRowMain}>
                <div className={styles.teamBadge}>
                  {index + 1}
                </div>

                <div className={styles.teamNameInput}>
                  <Input
                    value={team.name}
                    onChange={(v) => onUpdateTeam(team.id, { name: v })}
                    placeholder="Teamname eingeben"
                  />
                </div>

                <button
                  onClick={() => onRemoveTeam(team.id)}
                  className={styles.deleteButton}
                  aria-label={`Team ${team.name} löschen`}
                >
                  <Icons.Trash size={18} />
                </button>
              </div>

              {/* Secondary row: Group selector (only on mobile, inline on desktop via CSS) */}
              {canAssignGroups && (
                <div className={styles.teamRowSecondary}>
                  <span className={styles.groupLabel}>Gruppe:</span>
                  <select
                    value={team.group || ''}
                    onChange={(e) => onUpdateTeam(team.id, { group: e.target.value || undefined })}
                    className={styles.groupSelect}
                    aria-label={`Gruppe für ${team.name}`}
                  >
                    <option value="">Keine Gruppe</option>
                    {groupLabels.map(label => (
                      <option key={label} value={label}>Gruppe {label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
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
                  ? 'rgba(255,82,82,0.1)'
                  : warning.type === 'warning'
                    ? 'rgba(255,145,0,0.1)'
                    : 'rgba(0,176,255,0.08)',
                borderRadius: theme.borderRadius.md,
                border: `1px solid ${
                  warning.type === 'error'
                    ? 'rgba(255,82,82,0.3)'
                    : warning.type === 'warning'
                      ? 'rgba(255,145,0,0.3)'
                      : 'rgba(0,176,255,0.2)'
                }`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
              role={warning.type === 'error' ? 'alert' : 'status'}
            >
              <span style={{ fontSize: '16px', flexShrink: 0 }} aria-hidden="true">
                {warning.type === 'error' ? '❌' : warning.type === 'warning' ? '⚠️' : 'ℹ️'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{
                  color: warning.type === 'error'
                    ? theme.colors.error
                    : warning.type === 'warning'
                      ? theme.colors.warning
                      : theme.colors.text.primary,
                  fontSize: theme.fontSizes.sm,
                  fontWeight: theme.fontWeights.medium,
                }}>
                  {warning.message}
                </div>
                {warning.action && (
                  <div style={{
                    color: theme.colors.text.secondary,
                    fontSize: '12px',
                    marginTop: '4px',
                  }}>
                    💡 {warning.action}
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
            background: 'rgba(0,176,255,0.1)',
            borderRadius: theme.borderRadius.md,
            border: '1px solid rgba(0,176,255,0.3)',
          }}
        >
          <div style={{ fontSize: theme.fontSizes.sm, color: theme.colors.text.secondary }}>
            💡 {teams.length} Team{teams.length !== 1 ? 's' : ''} hinzugefügt
            {canAssignGroups && ` • Gruppen können jetzt zugewiesen werden`}
          </div>
        </div>
      )}
    </Card>
  );
};
