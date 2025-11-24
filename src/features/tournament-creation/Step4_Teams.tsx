import { Card, Button, Input, Icons } from '../../components/ui';
import { Tournament, Team } from '../../types/tournament';
import { theme } from '../../styles/theme';

interface Step4Props {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
  onAddTeam: () => void;
  onRemoveTeam: (id: string) => void;
  onUpdateTeam: (id: string, updates: Partial<Team>) => void;
}

export const Step4_Teams: React.FC<Step4Props> = ({
  formData,
  onAddTeam,
  onRemoveTeam,
  onUpdateTeam,
}) => {
  const teams = formData.teams || [];
  const canAssignGroups = formData.groupSystem === 'groupsAndFinals';

  return (
    <Card>
      <h2 style={{ color: theme.colors.text.primary, fontSize: theme.fontSizes.xl, margin: '0 0 24px 0' }}>
        👥 Teams
      </h2>

      <div style={{ marginBottom: '16px' }}>
        <Button onClick={onAddTeam} icon={<Icons.Plus />} variant="secondary">
          Team hinzufügen
        </Button>
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
            <div
              key={team.id}
              style={{
                display: 'grid',
                gridTemplateColumns: canAssignGroups ? '60px 1fr 120px 40px' : '60px 1fr 40px',
                gap: '12px',
                alignItems: 'center',
                padding: '12px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: theme.borderRadius.md,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: theme.gradients.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: theme.fontWeights.bold,
                  color: theme.colors.background,
                }}
              >
                {index + 1}
              </div>

              <Input
                value={team.name}
                onChange={(v) => onUpdateTeam(team.id, { name: v })}
                placeholder="Teamname"
              />

              {canAssignGroups && (
                <select
                  value={team.group || ''}
                  onChange={(e) => onUpdateTeam(team.id, { group: (e.target.value as 'A' | 'B' | 'C' | 'D') || undefined })}
                  style={{
                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                    background: 'rgba(0,0,0,0.3)',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.borderRadius.sm,
                    color: theme.colors.text.primary,
                    fontSize: theme.fontSizes.sm,
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Keine Gruppe</option>
                  <option value="A">Gruppe A</option>
                  <option value="B">Gruppe B</option>
                  {(formData.numberOfGroups || 0) >= 3 && <option value="C">Gruppe C</option>}
                  {(formData.numberOfGroups || 0) >= 4 && <option value="D">Gruppe D</option>}
                </select>
              )}

              <button
                onClick={() => onRemoveTeam(team.id)}
                style={{
                  width: '36px',
                  height: '36px',
                  padding: '0',
                  background: 'rgba(255,82,82,0.2)',
                  border: '1px solid rgba(255,82,82,0.3)',
                  borderRadius: theme.borderRadius.sm,
                  color: theme.colors.error,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,82,82,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,82,82,0.2)';
                }}
              >
                <Icons.Trash size={16} />
              </button>
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
            💡 {teams.length} Team{teams.length !== 1 && 's'} hinzugefügt
            {canAssignGroups && ` • Gruppen können jetzt zugewiesen werden`}
          </div>
        </div>
      )}
    </Card>
  );
};
