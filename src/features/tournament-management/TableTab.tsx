/**
 * TableTab - Tabellen-Ansicht für Gruppenturniere
 *
 * Zeigt die aktuellen Tabellenstände aller Gruppen
 */

import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens'
import { Card } from '../../components/ui';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Tournament, Standing } from '../../types/tournament';
import { GeneratedSchedule } from '../../core/generators';
import { GroupTables } from '../../components/schedule';

interface TableTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  currentStandings: Standing[];
}

export const TableTab: React.FC<TableTabProps> = ({
  tournament,
  schedule,
  currentStandings,
}) => {
  const { t } = useTranslation('tournament');
  const isMobile = useIsMobile();
  const hasGroups = tournament.teams.some(t => t.group);

  const containerStyle: CSSProperties = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: isMobile ? '12px' : '24px',
  };

  const noGroupsStyle: CSSProperties = {
    textAlign: 'center',
    padding: isMobile ? '24px 12px' : '48px 24px',
    color: cssVars.colors.textSecondary,
    fontSize: isMobile ? cssVars.fontSizes.md : cssVars.fontSizes.lg,
  };

  if (!hasGroups) {
    return (
      <div style={containerStyle}>
        <Card>
          <div style={noGroupsStyle}>
            {t('tables.noGroups')}
            <br />
            {t('tables.tableOnlyInfo')}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <Card>
        <GroupTables
          standings={currentStandings}
          teams={schedule.teams}
          tournament={tournament}
        />
      </Card>
    </div>
  );
};
