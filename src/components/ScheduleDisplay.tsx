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
import { cssVars } from '../design-tokens'
import { GeneratedSchedule } from '../core/generators';
import { Standing, Match, Team } from '../types/tournament';
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
  /** US-VIEWER-FILTERS: Set of visible match IDs (for filtering). If undefined, all matches are visible. */
  visibleMatchIds?: Set<string>;
  /** Full tournament teams with logo and colors (for display in match cards) */
  tournamentTeams?: Team[];
  /** MON-LIVE-INDICATOR-02: Set of Team IDs currently playing (for GroupTables) */
  activeMatchTeamIds?: Set<string>;
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
  visibleMatchIds,
  tournamentTeams,
  activeMatchTeamIds,
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
    if (!groupPhase || !currentMatches) { return groupPhase?.matches ?? []; }

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

  // FIX: Merge playoff matches with resolved team names from tournament.matches AND resolve placeholders via standings
  const finalPhaseMatches = useMemo(() => {
    // Helper to resolve a team reference (ID or placeholder) to a name
    const resolveName = (teamRef: string): string | undefined => {
      // 1. Try finding a real team first
      const team = schedule.teams.find(t => t.id === teamRef);
      if (team) {return team.name;}

      // 2. If it's a placeholder, try to resolve it from standings
      if (isPlaceholder(teamRef) && standings.length > 0) {
        // Format: group-<groupId>-<rank>st/nd/rd/th
        // Regex to capture Group ID and Rank Number
        const match = teamRef.match(/^group-(.+)-(\d+)(?:st|nd|rd|th)$/);
        if (match) {
          const groupId = match[1];
          const rank = parseInt(match[2], 10);

          // CRITICAL: Only resolve if the entire group is finished!
          // Use currentMatches (live) if available, otherwise static schedule
          const sourceMatches = currentMatches ?? (groupPhase?.matches ?? []);
          const groupMatches = sourceMatches.filter(m => m.group === groupId && m.phase === 'groupStage');

          if (groupMatches.length > 0) {
            const isGroupFinished = groupMatches.every(m => {
              // Match type has matchStatus, ScheduledMatch doesn't - use type assertion
              const status = (m as Match).matchStatus ?? 'scheduled';
              return status === 'finished' || status === 'skipped';
            });
            if (!isGroupFinished) {
              // Format placeholder to be readable and i18n-ready
              // TODO: Inject 'locale' from context/props in the future
              const getLocalizedGroupPlaceholder = (r: number, g: string, locale: string = 'de') => {
                if (locale === 'en') {return `${r}. Group ${g}`;} // Simplified EN
                return `${r}. Gruppe ${g}`;
              };
              return getLocalizedGroupPlaceholder(rank, groupId);
            }
          }

          // Filter standings for this group (assuming they are already sorted by rank)
          const groupStandings = standings.filter(s => s.team.group === groupId);

          // Get team at the specific rank (1-based index) - Rank 1 = Index 0
          return groupStandings[rank - 1]?.team.name;
        }
      }
      return undefined;
    };

    const matchesToMap = currentMatches ? finalMatches.map(sm => {
      const currentMatch = currentMatches.find(m => m.id === sm.id);
      if (currentMatch) {
        return {
          ...sm,
          scoreA: currentMatch.scoreA,
          scoreB: currentMatch.scoreB,
          // Note: We might want to use currentMatch.teamA if it's resolved in DB, 
          // but if it's still a placeholder, we use our resolver below.
          // However, we must respect the 'currentMatch' struct if it has data.
          // Let's use the schedule match as base for placeholders usually.
        };
      }
      return sm;
    }) : finalMatches;

    return matchesToMap.map(m => {
      let homeTeamName = m.homeTeam;
      let awayTeamName = m.awayTeam;

      // Try to resolve Home Team if it looks like a placeholder
      // logic: m.originalTeamA is the ID/Placeholder. m.homeTeam is the Display Name (which might be "Gruppe A 1. Platz")
      // We check m.originalTeamA (from scheduleMatch)
      const resolvedHome = resolveName(m.originalTeamA);
      if (resolvedHome) {homeTeamName = resolvedHome;}

      const resolvedAway = resolveName(m.originalTeamB);
      if (resolvedAway) {awayTeamName = resolvedAway;}

      return {
        ...m,
        homeTeam: homeTeamName,
        awayTeam: awayTeamName
      };
    });
  }, [finalMatches, currentMatches, schedule.teams, standings, groupPhase?.matches]);

  // US-VIEWER-FILTERS: Filter matches based on visibleMatchIds (if provided)
  const filteredGroupPhaseMatches = useMemo(() => {
    if (!visibleMatchIds) { return groupPhaseMatches; }
    return groupPhaseMatches.filter(m => visibleMatchIds.has(m.id));
  }, [groupPhaseMatches, visibleMatchIds]);

  const filteredFinalPhaseMatches = useMemo(() => {
    if (!visibleMatchIds) { return finalPhaseMatches; }
    return finalPhaseMatches.filter(m => visibleMatchIds.has(m.id));
  }, [finalPhaseMatches, visibleMatchIds]);

  // Container Style - full width, parent controls maxWidth
  const containerStyle: CSSProperties = {
    width: '100%',
    padding: '40px 20px',
    background: cssVars.colors.background,
    fontFamily: cssVars.fontFamilies.body,
    color: cssVars.colors.textPrimary,
  };

  return (
    <div style={containerStyle} className="schedule-display">
      {/* Tournament Header - Hidden on Desktop as info is in Top Nav */}
      <div className="md:hidden">
        <TournamentHeader
          schedule={schedule}
          logoUrl={logoUrl}
          qrCodeUrl={showQRCode ? qrCodeUrl : undefined}
        />
      </div>

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
      {filteredGroupPhaseMatches.length > 0 && (
        <GroupStageSchedule
          matches={filteredGroupPhaseMatches}
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
          tournament={{ groups: schedule.tournament.groups, teams: tournamentTeams } as any}
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
          activeMatchTeamIds={activeMatchTeamIds}
        />
      )}

      {/* Final Stage Schedule */}
      {filteredFinalPhaseMatches.length > 0 && (
        <FinalStageSchedule
          matches={filteredFinalPhaseMatches}
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
        /* Tailwind-like utility: hide on medium screens and above */
        @media (min-width: 769px) {
          .md\\:hidden {
            display: none !important;
          }
        }

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

