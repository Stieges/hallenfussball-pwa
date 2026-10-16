/**
 * Tabellen-Tab der Zuschauer-Seite (B-13d1, aus LiveViewScreen ausgelagert).
 * Texte wörtlich übernommen.
 */
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Card } from '../../../components/ui/Card';
import { GroupTables } from '../../../components/schedule/GroupTables';
import type { Standing, Tournament } from '../../../types/tournament';

export interface PublicStandingsTabProps {
  tournament: Tournament;
  standings: Standing[];
}

export const PublicStandingsTab: React.FC<PublicStandingsTabProps> = ({ tournament, standings }) => {
  const { t } = useTranslation('publicView');
  if (tournament.hideRankingsForPublic) {
    return (
      <Card>
        <div
          style={{
            padding: cssVars.spacing.xl,
            textAlign: 'center',
            color: cssVars.colors.textMuted,
          }}
        >
          <p style={{ fontSize: cssVars.fontSizes.lg, marginBottom: cssVars.spacing.sm }}>
            {t('standings.hidden')}
          </p>
          <p style={{ fontSize: cssVars.fontSizes.sm }}>
            {t('standings.bambini')}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <GroupTables
        standings={standings}
        teams={tournament.teams}
        tournament={tournament}
      />
    </Card>
  );
};
