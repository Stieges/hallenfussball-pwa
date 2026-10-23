/**
 * Team-Auswahl „Mein Team wählen“ der Zuschauer-Seite (B-13d2, aus LiveViewScreen ausgelagert).
 * Klick auf den Hintergrund schließt; Klick in den Inhalt nicht (stopPropagation).
 * Werte und Handler kommen als Props aus usePublicViewFilters; kein Hook hier.
 * Texte wörtlich übernommen.
 */
import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, dialogWidths } from '../../../design-tokens';
import { DialogSurface } from '../../../components/ui/molecules/DialogSurface';
import { Button } from '../../../components/ui/Button';
import type { Team } from '../../../types/tournament';

export interface TeamSelectorDialogProps {
  teams: Team[];
  myTeamId: string | null;
  /** Wählt ein Team (oder null für „Kein Team“); schließt den Dialog über den Controller */
  onSelectTeam: (teamId: string | null) => void;
  onClose: () => void;
}

const teamSelectorContentStyle: CSSProperties = {
  padding: cssVars.spacing.lg,
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
  <DialogSurface
    isOpen
    onClose={onClose}
    maxWidth={dialogWidths.sm}
    labelledBy="team-selector-title"
    testId="team-selector-dialog"
    scrimTestId="team-selector-backdrop"
  >
    <div style={teamSelectorContentStyle}>
      <h2 id="team-selector-title" style={{ marginBottom: cssVars.spacing.md, fontSize: cssVars.fontSizes.lg }}>
        {t('teamSelector.title')}
      </h2>
      <p style={{ marginBottom: cssVars.spacing.md, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm }}>
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
              <span style={{ marginLeft: 'auto', fontSize: cssVars.fontSizes.sm }}>
                {tSport('tournament.groupWithLetter', { letter: team.group })}
              </span>
            )}
          </Button>
        ))}
      </div>
    </div>
  </DialogSurface>
  );
};
