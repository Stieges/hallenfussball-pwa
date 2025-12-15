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

import { useState, CSSProperties } from 'react';
import { Card } from '../../components/ui';
import { theme } from '../../styles/theme';
import { Tournament, Standing } from '../../types/tournament';
import { GeneratedSchedule } from '../../lib/scheduleGenerator';
import { ScheduleDisplay } from '../../components/ScheduleDisplay';
import { RefereeAssignmentEditor } from '../../components/RefereeAssignmentEditor';
import { ScheduleActionButtons } from '../../components/ScheduleActionButtons';
import { ConfirmDialog } from '../../components/dialogs';
import { CorrectionBanner } from '../../components/schedule';

interface ScheduleTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  currentStandings: Standing[];
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
}

// Correction state interface
interface CorrectionState {
  matchId: string;
  originalScoreA: number;
  originalScoreB: number;
}

export const ScheduleTab: React.FC<ScheduleTabProps> = ({
  tournament,
  schedule,
  currentStandings,
  onTournamentUpdate,
}) => {
  // Correction mode state
  const [correctionState, setCorrectionState] = useState<CorrectionState | null>(null);
  const [showCorrectionStartDialog, setShowCorrectionStartDialog] = useState(false);
  const [showCorrectionSaveDialog, setShowCorrectionSaveDialog] = useState(false);
  const [pendingMatch, setPendingMatch] = useState<{id: string, scoreA: number, scoreB: number} | null>(null);

  // Helper: Check if match is finished
  const isMatchFinished = (matchId: string): boolean => {
    // 1. Check if scores exist
    const match = tournament.matches.find(m => m.id === matchId);
    if (!match || match.scoreA === undefined || match.scoreB === undefined) {
      return false;
    }

    // 2. Check liveMatches status if available
    try {
      const stored = localStorage.getItem(`liveMatches-${tournament.id}`);
      if (stored) {
        const liveMatches = JSON.parse(stored);
        if (liveMatches[matchId]?.status === 'FINISHED') {
          return true;
        }
      }
    } catch (e) {
      // Ignore parse errors
    }

    // 3. Fallback: implicit detection
    return true;
  };

  // Helper: Check if match is in correction mode
  const isInCorrectionMode = (matchId: string): boolean =>
    correctionState?.matchId === matchId;

  // Correction handlers
  const handleStartCorrection = (matchId: string) => {
    const match = tournament.matches.find(m => m.id === matchId);
    if (!match || match.scoreA === undefined || match.scoreB === undefined) return;

    setCorrectionState({
      matchId,
      originalScoreA: match.scoreA,
      originalScoreB: match.scoreB,
    });
    setShowCorrectionStartDialog(true);
  };

  const handleConfirmStartCorrection = () => {
    setShowCorrectionStartDialog(false);
    // Correction mode is now active (correctionState is set)
  };

  const handleCancelCorrection = () => {
    if (!correctionState) return;

    // Revert to original scores
    const updatedMatches = tournament.matches.map(m =>
      m.id === correctionState.matchId
        ? { ...m, scoreA: correctionState.originalScoreA, scoreB: correctionState.originalScoreB }
        : m
    );

    onTournamentUpdate(
      { ...tournament, matches: updatedMatches, updatedAt: new Date().toISOString() },
      false
    );

    setCorrectionState(null);
  };

  const handleSaveCorrection = (matchId: string, scoreA: number, scoreB: number) => {
    setPendingMatch({ id: matchId, scoreA, scoreB });
    setShowCorrectionSaveDialog(true);
  };

  const handleConfirmSave = () => {
    if (!pendingMatch) return;

    // Update tournament
    const updatedMatches = tournament.matches.map(m =>
      m.id === pendingMatch.id
        ? { ...m, scoreA: pendingMatch.scoreA, scoreB: pendingMatch.scoreB }
        : m
    );

    onTournamentUpdate(
      { ...tournament, matches: updatedMatches, updatedAt: new Date().toISOString() },
      false // Triggers standings recalculation in parent
    );

    setShowCorrectionSaveDialog(false);
    setPendingMatch(null);
    setCorrectionState(null);
  };

  const handleScoreChange = (matchId: string, scoreA: number, scoreB: number) => {
    // NEW: Block editing finished matches unless in correction mode
    if (isMatchFinished(matchId) && !isInCorrectionMode(matchId)) {
      alert('⚠️ Dieses Spiel ist bereits beendet.\n\nVerwenden Sie den Button "Ergebnis korrigieren".');
      return;
    }

    // If in correction mode, handle via save dialog
    if (isInCorrectionMode(matchId)) {
      handleSaveCorrection(matchId, scoreA, scoreB);
      return;
    }

    // Prüfe, ob das Spiel gerade live läuft
    const liveMatchesData = localStorage.getItem(`liveMatches-${tournament.id}`);
    if (liveMatchesData) {
      try {
        const liveMatches = JSON.parse(liveMatchesData);
        const liveMatch = liveMatches[matchId];

        if (liveMatch && liveMatch.status === 'RUNNING') {
          const confirmEdit = window.confirm(
            '⚠️ WARNUNG: Dieses Spiel läuft gerade LIVE in der Turnierleitung!\n\n' +
            'Wenn Sie hier das Ergebnis ändern, wird es die Live-Verwaltung überschreiben.\n\n' +
            'Möchten Sie trotzdem fortfahren?'
          );

          if (!confirmEdit) {
            return; // Abbrechen
          }
        }
      } catch (e) {
        console.error('Error checking live matches:', e);
      }
    }

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
      console.warn('[ScheduleTab] No refereeConfig found');
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

    // Update tournament.matches directly with the new referee assignment
    updatedTournament.matches = updatedTournament.matches.map(match =>
      match.id === matchId ? { ...match, referee: refereeNumber ?? undefined } : match
    );

    // Manual referee changes should NOT regenerate schedule (keeps match IDs stable)
    onTournamentUpdate(updatedTournament, false);
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
    <>
      <div style={containerStyle} className="schedule-tab-container">
      {/* Spielplan-Anzeige - wie in TournamentPreview, aber ohne grünen Header */}
      <Card>
        {/* Action Buttons Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: theme.spacing.lg,
          borderBottom: `1px solid ${theme.colors.border}`,
        }}>
          <ScheduleActionButtons
            tournament={tournament}
            schedule={schedule}
            standings={currentStandings}
            variant="organizer"
          />
        </div>

        {/* Correction Banner */}
        {correctionState && (() => {
          const match = tournament.matches.find(m => m.id === correctionState.matchId);
          if (!match) return null;

          return (
            <div style={{ padding: theme.spacing.lg }}>
              <CorrectionBanner
                matchId={correctionState.matchId}
                matchLabel={`Spiel #${match.round}`}
                teamA={match.teamA}
                teamB={match.teamB}
                originalScoreA={correctionState.originalScoreA}
                originalScoreB={correctionState.originalScoreB}
                onCancel={handleCancelCorrection}
              />
            </div>
          );
        })()}

        <ScheduleDisplay
          schedule={schedule}
          currentStandings={currentStandings}
          currentMatches={tournament.matches}
          editable={true}
          onScoreChange={handleScoreChange}
          onRefereeChange={handleRefereeAssignment}
          onFieldChange={handleFieldChange}
          finishedMatches={new Set(
            tournament.matches
              .filter(m => isMatchFinished(m.id))
              .map(m => m.id)
          )}
          correctionMatchId={correctionState?.matchId ?? null}
          onStartCorrection={handleStartCorrection}
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

    {/* Correction Start Dialog */}
    {correctionState && (() => {
      const match = tournament.matches.find(m => m.id === correctionState.matchId);
      if (!match) return null;

      return (
        <ConfirmDialog
          isOpen={showCorrectionStartDialog}
          onClose={() => {
            setShowCorrectionStartDialog(false);
            setCorrectionState(null);
          }}
          onConfirm={handleConfirmStartCorrection}
          title="⚠️ Ergebnis korrigieren?"
          message={
            <div>
              <p>Sie sind dabei, das Ergebnis eines beendeten Spiels zu ändern.</p>
              <p style={{ marginTop: '12px', fontWeight: 600 }}>
                Spiel: #{match.round}<br />
                {match.teamA} vs {match.teamB}<br />
                Aktuelles Ergebnis: {correctionState.originalScoreA}:{correctionState.originalScoreB}
              </p>
              <p style={{ marginTop: '16px', fontWeight: 600 }}>WICHTIG:</p>
              <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                <li>Die Gruppentabelle wird neu berechnet</li>
                <li>Playoff-Paarungen können sich ändern</li>
                <li>Bereits gespielte Finalspiele bleiben unverändert</li>
              </ul>
              <p style={{ marginTop: '16px' }}>Möchten Sie fortfahren?</p>
            </div>
          }
          confirmText="Ja, korrigieren"
          cancelText="Abbrechen"
          variant="warning"
        />
      );
    })()}

    {/* Correction Save Dialog */}
    {pendingMatch && correctionState && (() => {
      const oldScoreA = correctionState.originalScoreA;
      const oldScoreB = correctionState.originalScoreB;
      const newScoreA = pendingMatch.scoreA;
      const newScoreB = pendingMatch.scoreB;

      return (
        <ConfirmDialog
          isOpen={showCorrectionSaveDialog}
          onClose={() => {
            setShowCorrectionSaveDialog(false);
            setPendingMatch(null);
          }}
          onConfirm={handleConfirmSave}
          title="⚠️ Korrektur speichern?"
          message={
            <div>
              <p style={{ fontWeight: 600, fontSize: '16px' }}>
                Neues Ergebnis: {newScoreA}:{newScoreB}<br />
                <span style={{ color: theme.colors.text.secondary, fontSize: '14px' }}>
                  (vorher: {oldScoreA}:{oldScoreB})
                </span>
              </p>
              <p style={{ marginTop: '16px' }}>
                Die Änderung wird folgende Auswirkungen haben:
              </p>
              <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                <li>Gruppentabelle wird neu berechnet</li>
                <li>Playoff-Paarungen werden aktualisiert</li>
                <li>Bereits gespielte Finalrunden bleiben unverändert</li>
              </ul>
              <p style={{ marginTop: '16px', fontWeight: 600 }}>
                Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
              <p style={{ marginTop: '12px' }}>
                Möchten Sie die Korrektur speichern?
              </p>
            </div>
          }
          confirmText="Speichern"
          cancelText="Abbrechen"
          variant="warning"
        />
      );
    })()}

    {/* Responsive Styles */}
    <style>{`
      /* Mobile adjustments */
      @media (max-width: 767px) {
        .schedule-tab-container {
          padding: 16px 12px !important;
        }
      }

      /* Tablet adjustments */
      @media (min-width: 768px) and (max-width: 1024px) {
        .schedule-tab-container {
          padding: 20px 16px !important;
        }
      }

      /* Ensure cards are responsive on mobile */
      @media (max-width: 767px) {
        .schedule-tab-container .card {
          border-radius: 8px;
          padding: 12px;
        }
      }
    `}</style>
    </>
  );
};
