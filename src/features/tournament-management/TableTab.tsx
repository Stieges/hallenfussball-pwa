/**
 * TableTab - Tabellen-Ansicht für Gruppenturniere
 *
 * Zeigt die aktuellen Tabellenstände aller Gruppen
 */

import { CSSProperties } from 'react';
import { colors, fontSizes } from '../../design-tokens';
import { Card } from '../../components/ui';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Tournament, Standing } from '../../types/tournament';
import { GeneratedSchedule } from '../../lib/scheduleGenerator';
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
    color: colors.textSecondary,
    fontSize: isMobile ? fontSizes.md : fontSizes.lg,
  };

  if (!hasGroups) {
    return (
      <div style={containerStyle}>
        <Card>
          <div style={noGroupsStyle}>
            Dieses Turnier hat keine Gruppen.
            <br />
            Die Tabelle ist nur für Gruppenturniere verfügbar.
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
          isMobile={isMobile}
        />
      </Card>
    </div>
  );
};
