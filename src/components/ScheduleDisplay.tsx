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
import type { ScheduleSource } from './schedule/scheduleSource';
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
  /** Optional, Vorgabe true: Gruppentabellen anzeigen. false blendet sie komplett aus (Zuschauer im Kindermodus). */
  showGroupTables?: boolean;
  /** Optional: Quelle für die Teilnehmerliste; Vorgabe ist currentStandings bzw. initialStandings. */
  participantStandings?: Standing[];
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
  showGroupTables = true,
  participantStandings,
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

  // Finalspiele mit den aktuellen Ergebnissen. Die Namen der Seiten entstehen in den Spielplan-Komponenten
  // aus den Slots (slotLabel, A-04a/@TM-015) – nicht aus gespeicherten Anzeigetexten.
  const finalPhaseMatches = useMemo(() => {
    if (!currentMatches) { return finalMatches; }
    return finalMatches.map(sm => {
      const currentMatch = currentMatches.find(m => m.id === sm.id);
      return currentMatch ? { ...sm, scoreA: currentMatch.scoreA, scoreB: currentMatch.scoreB } : sm;
    });
  }, [finalMatches, currentMatches]);

  // Eingaben der Spielplan-Komponenten: schmale Typen (`ScheduleSource`), kein vorgetäuschtes `Tournament`.
  const groupsOnly = useMemo<ScheduleSource>(
    () => ({ groups: schedule.tournament.groups }),
    [schedule.tournament.groups],
  );

  // Anzeige-Daten der Spielseiten: aktuelle Teams, Gruppen und alle Spiele (Vorgänger auch bei aktivem Filter)
  const sideSource = useMemo(() => ({
    teams: tournamentTeams ?? schedule.teams,
    groups: schedule.tournament.groups,
    matches: schedule.allMatches,
  }), [tournamentTeams, schedule.teams, schedule.tournament.groups, schedule.allMatches]);

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
          standings={participantStandings ?? standings}
          tournament={groupsOnly}
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
          tournament={sideSource}
          onMatchSwap={onMatchSwap}
          onNavigateToCockpit={onNavigateToCockpit}
        />
      )}

      {/* Group Tables */}
      {hasGroups && showGroupTables && (
        <GroupTables
          standings={standings}
          teams={schedule.teams}
          tournament={groupsOnly}
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
          tournament={sideSource}
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

