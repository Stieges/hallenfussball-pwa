/**
 * ScheduleTab - Spielplan-Ansicht mit Ergebniseingabe
 *
 * Features:
 * - Spielplan wie in der Vorschau (ohne grünen Header)
 * - Editable mode für Ergebniseingabe
 * - Schiedsrichter-Zuweisung änderbar
 * - Feld-Zuweisung änderbar
 * - Live-Tabellen-Berechnung
 */

import { CSSProperties } from 'react';
import { Card } from '../../components/ui';
import { Tournament, Standing } from '../../types/tournament';
import { GeneratedSchedule } from '../../lib/scheduleGenerator';
import { ScheduleDisplay } from '../../components/ScheduleDisplay';
import { RefereeAssignmentEditor } from '../../components/RefereeAssignmentEditor';

interface ScheduleTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  currentStandings: Standing[];
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
}

export const ScheduleTab: React.FC<ScheduleTabProps> = ({
  tournament,
  schedule,
  currentStandings,
  onTournamentUpdate,
}) => {
  const handleScoreChange = (matchId: string, scoreA: number, scoreB: number) => {
    // Update tournament matches
    const updatedMatches = tournament.matches.map((match) =>
      match.id === matchId ? { ...match, scoreA, scoreB } : match
    );

    const updatedTournament = {
      ...tournament,
      matches: updatedMatches,
      updatedAt: new Date().toISOString(),
    };

    // Score changes don't need schedule regeneration
    onTournamentUpdate(updatedTournament, false);
  };

  const handleRefereeAssignment = (matchId: string, refereeNumber: number | null) => {
    const updatedTournament = { ...tournament };

    // Update manual assignments
    if (!updatedTournament.refereeConfig) {
      return;
    }

    const manualAssignments = { ...(updatedTournament.refereeConfig.manualAssignments || {}) };

    if (refereeNumber === null) {
      delete manualAssignments[matchId];
    } else {
      manualAssignments[matchId] = refereeNumber;
    }

    updatedTournament.refereeConfig = {
      ...updatedTournament.refereeConfig,
      manualAssignments,
    };

    // Referee changes need schedule regeneration
    onTournamentUpdate(updatedTournament, true);
  };

  const handleResetRefereeAssignments = () => {
    const updatedTournament = { ...tournament };

    if (updatedTournament.refereeConfig) {
      updatedTournament.refereeConfig = {
        ...updatedTournament.refereeConfig,
        manualAssignments: {},
      };

      // Referee reset needs schedule regeneration
      onTournamentUpdate(updatedTournament, true);
    }
  };

  const handleFieldChange = (matchId: string, fieldNumber: number) => {
    const updatedTournament = { ...tournament };

    // Update field assignments
    if (!updatedTournament.fieldAssignments) {
      updatedTournament.fieldAssignments = {};
    }

    updatedTournament.fieldAssignments[matchId] = fieldNumber;

    // Field changes need schedule regeneration
    onTournamentUpdate(updatedTournament, true);
  };

  const containerStyle: CSSProperties = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '24px',
  };

  return (
    <div style={containerStyle}>
      {/* Spielplan-Anzeige - wie in TournamentPreview, aber ohne grünen Header */}
      <Card>
        <ScheduleDisplay
          schedule={schedule}
          currentStandings={currentStandings}
          currentMatches={tournament.matches}
          editable={true}
          onScoreChange={handleScoreChange}
          onRefereeChange={handleRefereeAssignment}
          onFieldChange={handleFieldChange}
        />

        {/* Manuelle SR-Zuweisung (wenn SR aktiv) */}
        {tournament.refereeConfig && tournament.refereeConfig.mode !== 'none' && (
          <RefereeAssignmentEditor
            matches={schedule.allMatches}
            refereeConfig={tournament.refereeConfig}
            onAssignmentChange={handleRefereeAssignment}
            onResetAssignments={handleResetRefereeAssignments}
          />
        )}
      </Card>
    </div>
  );
};
