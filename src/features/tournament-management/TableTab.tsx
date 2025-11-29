/**
 * TableTab - Tabellen-Ansicht für Gruppenturniere
 *
 * Zeigt die aktuellen Tabellenstände aller Gruppen
 */

import { CSSProperties, useState, useEffect } from 'react';
import { theme } from '../../styles/theme';
import { Card } from '../../components/ui';
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
  const [isMobile, setIsMobile] = useState(false);
  const hasGroups = tournament.teams.some(t => t.group);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const containerStyle: CSSProperties = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: isMobile ? '12px' : '24px',
  };

  const noGroupsStyle: CSSProperties = {
    textAlign: 'center',
    padding: isMobile ? '24px 12px' : '48px 24px',
    color: theme.colors.text.secondary,
    fontSize: isMobile ? theme.fontSizes.md : theme.fontSizes.lg,
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
