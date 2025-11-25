/**
 * ScheduleDisplay - Modern modular tournament schedule display
 *
 * Uses new component structure matching MeinTurnierplan style:
 * - TournamentHeader: Tournament metadata
 * - ParticipantsAndGroups: Team listings by group
 * - GroupStageSchedule: Vorrunde matches
 * - FinalStageSchedule: Playoff/Final matches
 * - GroupTables: Group standings tables
 */

import { CSSProperties } from 'react';
import { theme } from '../styles/theme';
import { GeneratedSchedule } from '../lib/scheduleGenerator';
import { Standing } from '../types/tournament';
import {
  TournamentHeader,
  ParticipantsAndGroups,
  GroupStageSchedule,
  FinalStageSchedule,
  GroupTables,
} from './schedule';

interface ScheduleDisplayProps {
  schedule: GeneratedSchedule;
  /** Optional: Aktualisierte Standings (nach Ergebnissen) */
  currentStandings?: Standing[];
  /** Zeige QR-Code für Live-Tracking */
  showQRCode?: boolean;
  /** QR-Code URL */
  qrCodeUrl?: string;
  /** Logo URL */
  logoUrl?: string;
}

export const ScheduleDisplay: React.FC<ScheduleDisplayProps> = ({
  schedule,
  currentStandings,
  showQRCode = false,
  qrCodeUrl,
  logoUrl,
}) => {
  const standings = currentStandings || schedule.initialStandings;
  const hasGroups = schedule.teams.some(t => t.group);

  // Get phases
  const groupPhase = schedule.phases.find(p => p.name === 'groupStage');
  const finalPhases = schedule.phases.filter(p => p.name !== 'groupStage');
  const finalMatches = finalPhases.flatMap(p => p.matches);

  // Container Style (A4-ähnlich, responsive)
  const containerStyle: CSSProperties = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 20px',
    background: theme.colors.background,
    fontFamily: theme.fonts.body,
    color: theme.colors.text.primary,
  };

  return (
    <div style={containerStyle} className="schedule-display">
      {/* Tournament Header */}
      <TournamentHeader
        schedule={schedule}
        logoUrl={logoUrl}
        qrCodeUrl={showQRCode ? qrCodeUrl : undefined}
      />

      {/* Participants (only for group tournaments) */}
      {hasGroups && (
        <ParticipantsAndGroups
          teams={schedule.teams}
          standings={standings}
        />
      )}

      {/* Group Stage Schedule */}
      {groupPhase && (
        <GroupStageSchedule
          matches={groupPhase.matches}
          hasGroups={hasGroups}
        />
      )}

      {/* Group Tables */}
      {hasGroups && (
        <GroupTables
          standings={standings}
          teams={schedule.teams}
        />
      )}

      {/* Final Stage Schedule */}
      {finalMatches.length > 0 && (
        <FinalStageSchedule matches={finalMatches} />
      )}

      {/* Global styles for responsive design */}
      <style>{`
        @media (max-width: 768px) {
          .schedule-display {
            padding: 20px 12px !important;
          }
        }

        @media print {
          .schedule-display {
            padding: 20px;
            max-width: 100%;
          }

          @page {
            size: A4;
            margin: 15mm;
          }

          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
};

