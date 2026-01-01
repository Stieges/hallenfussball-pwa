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
import { cssVars, fontFamilies } from '../design-tokens'
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

// Pending changes during edit mode
interface PendingChanges {
  refereeAssignments: Record<string, number | null>;
  fieldAssignments: Record<string, number>;
}

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
  /** Is the schedule currently being edited (edit mode active) */
  editingSchedule?: boolean;
  /** Pending changes during edit mode (not yet saved) */
  pendingChanges?: PendingChanges;
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
  /** US-SCHEDULE-EDITOR: Callback when matches are swapped via DnD */
  onMatchSwap?: (matchId1: string, matchId2: string) => void;
  /** Callback to navigate to cockpit with selected match */
  onNavigateToCockpit?: (matchId: string) => void;
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
  editingSchedule = false,
  pendingChanges,
  onRefereeChange,
  onFieldChange,
  onScoreChange,
  finishedMatches,
  correctionMatchId,
  onStartCorrection,
  runningMatchIds,
  onMatchSwap,
  onNavigateToCockpit,
}) => {
  const standings = currentStandings ?? schedule.initialStandings;
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

  // Merge currentMatches scores into schedule matches (memoized to prevent re-computation)
  const groupPhaseMatches = useMemo(() => {
    if (!groupPhase || !currentMatches) {return groupPhase?.matches ?? [];}

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
          const teamA = schedule.teams.find(t => t.id === currentMatch.teamA);
          if (teamA?.name) {
            updated.homeTeam = teamA.name;
          }
        }

        // Check if teamB was resolved (no longer a placeholder)
        if (currentMatch.teamB && !isPlaceholder(currentMatch.teamB)) {
          const teamB = schedule.teams.find(t => t.id === currentMatch.teamB);
          if (teamB?.name) {
            updated.awayTeam = teamB.name;
          }
        }

        return updated;
      }
      return sm;
    });
  }, [finalMatches, currentMatches, schedule.teams]);

  // Container Style - full width, parent controls maxWidth
  const containerStyle: CSSProperties = {
    width: '100%',
    padding: '40px 20px',
    background: cssVars.colors.background,
    fontFamily: fontFamilies.body,
    color: cssVars.colors.textPrimary,
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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- GeneratedSchedule.tournament has different shape than Tournament; components only use 'groups'
          tournament={{ groups: schedule.tournament.groups } as any}
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
          editingSchedule={editingSchedule}
          pendingChanges={pendingChanges}
          onRefereeChange={onRefereeChange}
          onFieldChange={onFieldChange}
          onScoreChange={onScoreChange}
          finishedMatches={finishedMatches}
          correctionMatchId={correctionMatchId}
          onStartCorrection={onStartCorrection}
          runningMatchIds={runningMatchIds}
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- GeneratedSchedule.tournament has different shape than Tournament; components only use 'groups'
          tournament={{ groups: schedule.tournament.groups } as any}
          onMatchSwap={onMatchSwap}
          onNavigateToCockpit={onNavigateToCockpit}
        />
      )}

      {/* Group Tables */}
      {hasGroups && (
        <GroupTables
          standings={standings}
          teams={schedule.teams}
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- GeneratedSchedule.tournament has different shape than Tournament; components only use 'groups'
          tournament={{ groups: schedule.tournament.groups } as any}
        />
      )}

      {/* Final Stage Schedule */}
      {finalPhaseMatches.length > 0 && (
        <FinalStageSchedule
          matches={finalPhaseMatches}
          refereeConfig={schedule.refereeConfig}
          numberOfFields={schedule.numberOfFields}
          editable={editable}
          editingSchedule={editingSchedule}
          pendingChanges={pendingChanges}
          onRefereeChange={onRefereeChange}
          onFieldChange={onFieldChange}
          onScoreChange={onScoreChange}
          finishedMatches={finishedMatches}
          correctionMatchId={correctionMatchId}
          onStartCorrection={onStartCorrection}
          runningMatchIds={runningMatchIds}
          onMatchSwap={onMatchSwap}
        />
      )}

      {/* Tournament Footer with Organizer and Contact Info */}
      <TournamentFooter
        organizer={schedule.tournament.organizer}
        contactInfo={contactInfo ?? schedule.tournament.contactInfo}
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

