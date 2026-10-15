/**
 * Team-Auswahl „Mein Team wählen“ der Zuschauer-Seite (B-13d2, aus LiveViewScreen ausgelagert).
 * Klick auf den Hintergrund schließt; Klick in den Inhalt nicht (stopPropagation).
 * Werte und Handler kommen als Props aus usePublicViewFilters; kein Hook hier.
 * Texte wörtlich übernommen.
 */
import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, zIndex } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import type { Team } from '../../../types/tournament';

export interface TeamSelectorDialogProps {
  teams: Team[];
  myTeamId: string | null;
  /** Wählt ein Team (oder null für „Kein Team“); schließt den Dialog über den Controller */
  onSelectTeam: (teamId: string | null) => void;
  onClose: () => void;
}

const teamSelectorStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: cssVars.spacing.md,
  zIndex: zIndex.navigation,
};

const teamSelectorContentStyle: CSSProperties = {
  background: cssVars.colors.background,
  borderRadius: cssVars.borderRadius.xl,
  padding: cssVars.spacing.lg,
  maxWidth: '400px',
  width: '100%',
  maxHeight: '80vh',
  overflow: 'auto',
};

export const TeamSelectorDialog: React.FC<TeamSelectorDialogProps> = ({
  teams,
  myTeamId,
  onSelectTeam,
  onClose,
}) => {
  const { t } = useTranslation('publicView');
  const { t: tSport } = useTranslation('sport');
  return (
  <div style={teamSelectorStyle} onClick={onClose} data-testid="team-selector-dialog">
    <div style={teamSelectorContentStyle} onClick={(e) => e.stopPropagation()}>
      <h3 style={{ marginBottom: cssVars.spacing.md, fontSize: cssVars.fontSizes.lg }}>
        {t('teamSelector.title')}
      </h3>
      <p style={{ marginBottom: cssVars.spacing.md, color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>
        {t('teamSelector.hint')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm }}>
        {/* "Kein Team" option */}
        <Button
          variant={myTeamId === null ? 'primary' : 'secondary'}
          onClick={() => onSelectTeam(null)}
          style={{ justifyContent: 'flex-start' }}
        >
          {t('teamSelector.none')}
        </Button>
        {/* Teams */}
        {teams.map((team) => (
          <Button
            key={team.id}
            variant={myTeamId === team.id ? 'primary' : 'secondary'}
            onClick={() => onSelectTeam(team.id)}
            style={{ justifyContent: 'flex-start' }}
          >
            {team.name}
            {team.group && (
              <span style={{ marginLeft: 'auto', color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>
                {tSport('tournament.groupWithLetter', { letter: team.group })}
              </span>
            )}
          </Button>
        ))}
      </div>
    </div>
  </div>
  );
};
