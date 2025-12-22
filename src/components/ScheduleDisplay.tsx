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

import { CSSProperties, useMemo } from 'react';
import { theme } from '../styles/theme';
import { GeneratedSchedule } from '../lib/scheduleGenerator';
import { Standing, Match } from '../types/tournament';
import {
  TournamentHeader,
  ParticipantsAndGroups,
  GroupStageSchedule,
  FinalStageSchedule,
  GroupTables,
  TournamentFooter,
  ContactInfo,
} from './schedule';

interface ScheduleDisplayProps {
  schedule: GeneratedSchedule;
  /** Optional: Aktualisierte Standings (nach Ergebnissen) */
  currentStandings?: Standing[];
  /** Optional: Current matches with live scores (overrides schedule scores) */
  currentMatches?: Match[];
  /** Zeige QR-Code für Live-Tracking */
  showQRCode?: boolean;
  /** QR-Code URL */
  qrCodeUrl?: string;
  /** Logo URL */
  logoUrl?: string;
  /** Kontaktinformationen (aus User-Profil) */
  contactInfo?: ContactInfo;
  /** Allow editing referees */
  editable?: boolean;
  /** Callback when referee is changed */
  onRefereeChange?: (matchId: string, refereeNumber: number | null) => void;
  /** Callback when field is changed */
  onFieldChange?: (matchId: string, fieldNumber: number) => void;
  /** Callback when score is changed */
  onScoreChange?: (matchId: string, scoreA: number, scoreB: number) => void;
  /** Set of finished match IDs (for correction mode) */
  finishedMatches?: Set<string>;
  /** Match ID currently in correction mode */
  correctionMatchId?: string | null;
  /** Callback when starting correction mode */
  onStartCorrection?: (matchId: string) => void;
  /** MON-LIVE-INDICATOR-01: Set of match IDs that are currently running */
  runningMatchIds?: Set<string>;
  // Note: Permission check is now handled in ScheduleTab
}

export const ScheduleDisplay: React.FC<ScheduleDisplayProps> = ({
  schedule,
  currentStandings,
  currentMatches,
  showQRCode = false,
  qrCodeUrl,
  logoUrl,
  contactInfo,
  editable = false,
  onRefereeChange,
  onFieldChange,
  onScoreChange,
  finishedMatches,
  correctionMatchId,
  onStartCorrection,
  runningMatchIds,
}) => {
  const standings = currentStandings || schedule.initialStandings;
  const hasGroups = schedule.teams.some(t => t.group);

  // Get phases
  const groupPhase = schedule.phases.find(p => p.name === 'groupStage');
  const finalPhases = schedule.phases.filter(p => p.name !== 'groupStage');
  const finalMatches = finalPhases.flatMap(p => p.matches);

  // Helper: Check if a team reference is a placeholder (not a real team ID)
  const isPlaceholder = (teamRef: string): boolean => {
    return (
      teamRef === 'TBD' ||
      teamRef.includes('group-') ||
      teamRef.includes('-1st') ||
      teamRef.includes('-2nd') ||
      teamRef.includes('-3rd') ||
      teamRef.includes('-4th') ||
      teamRef.includes('bestSecond') ||
      teamRef.includes('Sieger') ||
      teamRef.includes('Verlierer')
    );
  };

  // Helper: Get team name from team ID
  const getTeamName = (teamId: string): string | null => {
    const team = schedule.teams.find(t => t.id === teamId);
    return team?.name || null;
  };

  // Merge currentMatches scores into schedule matches (memoized to prevent re-computation)
  const groupPhaseMatches = useMemo(() => {
    if (!groupPhase || !currentMatches) {return groupPhase?.matches || [];}

    return groupPhase.matches.map(sm => {
      const currentMatch = currentMatches.find(m => m.id === sm.id);
      if (currentMatch) {
        return {
          ...sm,
          scoreA: currentMatch.scoreA,
          scoreB: currentMatch.scoreB,
        };
      }
      return sm;
    });
  }, [groupPhase, currentMatches]);

  // FIX: Merge playoff matches with resolved team names from tournament.matches
  const finalPhaseMatches = useMemo(() => {
    if (!currentMatches) {return finalMatches;}

    return finalMatches.map(sm => {
      const currentMatch = currentMatches.find(m => m.id === sm.id);
      if (currentMatch) {
        // Start with score updates
        const updated = {
          ...sm,
          scoreA: currentMatch.scoreA,
          scoreB: currentMatch.scoreB,
        };

        // Check if teamA was resolved (no longer a placeholder)
        if (currentMatch.teamA && !isPlaceholder(currentMatch.teamA)) {
          const teamName = getTeamName(currentMatch.teamA);
          if (teamName) {
            updated.homeTeam = teamName;
          }
        }

        // Check if teamB was resolved (no longer a placeholder)
        if (currentMatch.teamB && !isPlaceholder(currentMatch.teamB)) {
          const teamName = getTeamName(currentMatch.teamB);
          if (teamName) {
            updated.awayTeam = teamName;
          }
        }

        return updated;
      }
      return sm;
    });
  }, [finalMatches, currentMatches, schedule.teams]);

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
      {groupPhaseMatches.length > 0 && (
        <GroupStageSchedule
          matches={groupPhaseMatches}
          hasGroups={hasGroups}
          refereeConfig={schedule.refereeConfig}
          numberOfFields={schedule.numberOfFields}
          editable={editable}
          onRefereeChange={onRefereeChange}
          onFieldChange={onFieldChange}
          onScoreChange={onScoreChange}
          finishedMatches={finishedMatches}
          correctionMatchId={correctionMatchId}
          onStartCorrection={onStartCorrection}
          runningMatchIds={runningMatchIds}
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
      {finalPhaseMatches.length > 0 && (
        <FinalStageSchedule
          matches={finalPhaseMatches}
          refereeConfig={schedule.refereeConfig}
          numberOfFields={schedule.numberOfFields}
          editable={editable}
          onRefereeChange={onRefereeChange}
          onFieldChange={onFieldChange}
          onScoreChange={onScoreChange}
          finishedMatches={finishedMatches}
          correctionMatchId={correctionMatchId}
          onStartCorrection={onStartCorrection}
          runningMatchIds={runningMatchIds}
        />
      )}

      {/* Tournament Footer with Organizer and Contact Info */}
      <TournamentFooter
        organizer={schedule.tournament.organizer}
        contactInfo={contactInfo || schedule.tournament.contactInfo}
      />

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

