/**
 * TeamsTab - Team-Verwaltung für veröffentlichte Turniere (TOUR-EDIT-TEAMS)
 *
 * Ermöglicht:
 * - Teams umbenennen (mit Warnung bei vorhandenen Ergebnissen)
 * - Teams löschen (intelligent basierend auf Ergebnissen)
 * - Visuelle Kennzeichnung für Teams mit Spielen/Ergebnissen
 *
 * Regeln:
 * - Teams mit Matches OHNE Ergebnisse: Matches werden entfernt
 * - Teams mit Matches MIT Ergebnissen: Team wird als "entfernt" markiert
 */

import { useState, CSSProperties } from 'react';
import { Card, Input, Button } from '../../components/ui';
import { Tournament, Team } from '../../types/tournament';
import { theme } from '../../styles/theme';
import {
  analyzeTeamMatches,
  deleteTeamSafely,
  renameTeam,
  getTeamDeletionWarning,
  getTeamRenameWarning,
  getActiveTeams,
  getRemovedTeams,
  TeamMatchAnalysis,
} from '../../utils/teamHelpers';
import { getGroupDisplayName } from '../../utils/displayNames';

interface TeamsTabProps {
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
}

export const TeamsTab: React.FC<TeamsTabProps> = ({
  tournament,
  onTournamentUpdate,
}) => {
  // State für Bearbeitung
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // State für Lösch-Dialog
  const [deleteConfirmTeam, setDeleteConfirmTeam] = useState<{
    team: Team;
    analysis: TeamMatchAnalysis;
  } | null>(null);

  // Aktive und entfernte Teams
  const activeTeams = getActiveTeams(tournament.teams);
  const removedTeams = getRemovedTeams(tournament.teams);

  // Team-Analyse für alle Teams
  const teamAnalyses: Record<string, TeamMatchAnalysis> = {};
  tournament.teams.forEach(team => {
    teamAnalyses[team.id] = analyzeTeamMatches(team, tournament.matches);
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleStartEdit = (team: Team) => {
    setEditingTeamId(team.id);
    setEditingName(team.name);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingTeamId(null);
    setEditingName('');
    setError(null);
  };

  const handleSaveRename = () => {
    if (!editingTeamId) {return;}

    const analysis = teamAnalyses[editingTeamId];
    const warning = getTeamRenameWarning(analysis.teamName, analysis.matchesWithResults);

    // Wenn Warnung und noch nicht bestätigt
    if (warning) {
      const confirmed = window.confirm(
        `⚠️ Warnung\n\n${warning}\n\nMöchtest du den Namen trotzdem ändern?`
      );
      if (!confirmed) {return;}
    }

    try {
      const result = renameTeam(tournament, editingTeamId, editingName.trim());

      const updatedTournament: Tournament = {
        ...tournament,
        teams: result.updatedTeams,
        updatedAt: new Date().toISOString(),
      };

      onTournamentUpdate(updatedTournament);
      handleCancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Umbenennen');
    }
  };

  const handleDeleteClick = (team: Team) => {
    const analysis = teamAnalyses[team.id];
    setDeleteConfirmTeam({ team, analysis });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmTeam) {return;}

    try {
      const result = deleteTeamSafely(tournament, deleteConfirmTeam.team.id);

      const updatedTournament: Tournament = {
        ...tournament,
        teams: result.updatedTeams,
        matches: result.updatedMatches,
        updatedAt: new Date().toISOString(),
      };

      onTournamentUpdate(updatedTournament);
      setDeleteConfirmTeam(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
      setDeleteConfirmTeam(null);
    }
  };

  const handleRestoreTeam = (teamId: string) => {
    const confirmed = window.confirm(
      'Möchtest du dieses Team wiederherstellen?\n\n' +
      'Das Team wird wieder in der Tabelle und im Spielplan angezeigt.'
    );

    if (!confirmed) {return;}

    const updatedTeams = tournament.teams.map(t =>
      t.id === teamId
        ? { ...t, isRemoved: false, removedAt: undefined }
        : t
    );

    const updatedTournament: Tournament = {
      ...tournament,
      teams: updatedTeams,
      updatedAt: new Date().toISOString(),
    };

    onTournamentUpdate(updatedTournament);
  };

  // ============================================================================
  // STYLES
  // ============================================================================

  const containerStyle: CSSProperties = {
    padding: theme.spacing.lg,
    background: theme.colors.background,
    minHeight: 'calc(100vh - 200px)',
  };

  const titleStyle: CSSProperties = {
    fontSize: theme.fontSizes.xl,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.lg,
  };

  const teamRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
    gap: theme.spacing.md,
  };

  const teamInfoStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary,
  };

  const badgeStyle = (color: string, bgColor: string): CSSProperties => ({
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: theme.borderRadius.sm,
    background: bgColor,
    color: color,
    fontWeight: theme.fontWeights.medium,
  });

  const buttonGroupStyle: CSSProperties = {
    display: 'flex',
    gap: theme.spacing.sm,
  };

  const actionButtonStyle = (variant: 'edit' | 'delete'): CSSProperties => ({
    padding: '6px 12px',
    fontSize: theme.fontSizes.sm,
    borderRadius: theme.borderRadius.sm,
    border: 'none',
    cursor: 'pointer',
    fontWeight: theme.fontWeights.medium,
    background: variant === 'edit' ? theme.colors.surface : 'rgba(244, 67, 54, 0.1)',
    color: variant === 'edit' ? theme.colors.text.primary : '#F44336',
    transition: 'all 0.2s ease',
  });

  const editInputStyle: CSSProperties = {
    flex: 1,
    maxWidth: '300px',
  };

  const removedTeamStyle: CSSProperties = {
    ...teamRowStyle,
    opacity: 0.6,
    background: 'rgba(0,0,0,0.02)',
  };

  const removedTeamNameStyle: CSSProperties = {
    ...teamNameStyle,
    textDecoration: 'line-through',
    color: theme.colors.text.secondary,
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Teams verwalten</h1>

      {/* Error Message */}
      {error && (
        <Card style={{ background: 'rgba(244, 67, 54, 0.1)', marginBottom: theme.spacing.lg }}>
          <div style={{ color: '#F44336', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>❌</span>
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
            >
              ✕
            </button>
          </div>
        </Card>
      )}

      {/* Info Box */}
      <Card style={{ marginBottom: theme.spacing.lg, background: 'rgba(33, 150, 243, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: theme.spacing.md }}>
          <span style={{ fontSize: '24px' }}>ℹ️</span>
          <div>
            <h4 style={{ margin: '0 0 8px 0', color: theme.colors.text.primary }}>
              Team-Bearbeitung
            </h4>
            <ul style={{ margin: 0, paddingLeft: '20px', color: theme.colors.text.secondary, fontSize: theme.fontSizes.sm }}>
              <li><strong>Umbenennen:</strong> Jederzeit möglich (z.B. für Rechtschreibkorrekturen)</li>
              <li><strong>Löschen ohne Ergebnisse:</strong> Team und alle Spiele werden entfernt</li>
              <li><strong>Löschen mit Ergebnissen:</strong> Spiele mit Ergebnissen bleiben erhalten</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Active Teams */}
      <Card>
        <h3 style={{ color: theme.colors.text.primary, margin: '0 0 16px 0' }}>
          Aktive Teams ({activeTeams.length})
        </h3>

        {activeTeams.length === 0 ? (
          <p style={{ color: theme.colors.text.secondary, fontStyle: 'italic' }}>
            Keine aktiven Teams vorhanden.
          </p>
        ) : (
          activeTeams.map(team => {
            const analysis = teamAnalyses[team.id];
            const isEditing = editingTeamId === team.id;

            return (
              <div key={team.id} style={teamRowStyle}>
                {isEditing ? (
                  // Edit Mode
                  <>
                    <div style={editInputStyle}>
                      <Input
                        label=""
                        value={editingName}
                        onChange={setEditingName}
                        placeholder="Teamname"
                      />
                    </div>
                    <div style={buttonGroupStyle}>
                      <Button variant="secondary" onClick={handleCancelEdit}>
                        Abbrechen
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleSaveRename}
                        disabled={!editingName.trim() || editingName.trim() === team.name}
                      >
                        Speichern
                      </Button>
                    </div>
                  </>
                ) : (
                  // View Mode
                  <>
                    <div style={teamInfoStyle}>
                      <span style={teamNameStyle}>{team.name}</span>
                      {team.group && (
                        <span style={badgeStyle(theme.colors.primary, 'rgba(33, 150, 243, 0.15)')}>
                          {getGroupDisplayName(team.group, tournament)}
                        </span>
                      )}
                      {analysis.matchesWithResults > 0 && (
                        <span style={badgeStyle('#4CAF50', 'rgba(76, 175, 80, 0.15)')}>
                          {analysis.matchesWithResults} Ergebnis{analysis.matchesWithResults !== 1 ? 'se' : ''}
                        </span>
                      )}
                      {analysis.matchesWithoutResults > 0 && (
                        <span style={badgeStyle(theme.colors.text.secondary, 'rgba(0,0,0,0.08)')}>
                          {analysis.matchesWithoutResults} geplant
                        </span>
                      )}
                    </div>
                    <div style={buttonGroupStyle}>
                      <button
                        style={actionButtonStyle('edit')}
                        onClick={() => handleStartEdit(team)}
                      >
                        ✏️ Umbenennen
                      </button>
                      <button
                        style={actionButtonStyle('delete')}
                        onClick={() => handleDeleteClick(team)}
                      >
                        🗑️ Löschen
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </Card>

      {/* Removed Teams */}
      {removedTeams.length > 0 && (
        <Card style={{ marginTop: theme.spacing.lg }}>
          <h3 style={{ color: theme.colors.text.secondary, margin: '0 0 16px 0' }}>
            Entfernte Teams ({removedTeams.length})
          </h3>
          <p style={{ color: theme.colors.text.secondary, fontSize: theme.fontSizes.sm, marginBottom: '16px' }}>
            Diese Teams wurden entfernt, aber ihre historischen Ergebnisse sind noch im Spielplan sichtbar.
          </p>

          {removedTeams.map(team => {
            const analysis = teamAnalyses[team.id];

            return (
              <div key={team.id} style={removedTeamStyle}>
                <div style={teamInfoStyle}>
                  <span style={removedTeamNameStyle}>{team.name}</span>
                  {analysis.matchesWithResults > 0 && (
                    <span style={badgeStyle(theme.colors.text.secondary, 'rgba(0,0,0,0.08)')}>
                      {analysis.matchesWithResults} historische Ergebnis{analysis.matchesWithResults !== 1 ? 'se' : ''}
                    </span>
                  )}
                  {team.removedAt && (
                    <span style={{ fontSize: '11px', color: theme.colors.text.secondary }}>
                      Entfernt am {new Date(team.removedAt).toLocaleDateString('de-DE')}
                    </span>
                  )}
                </div>
                <button
                  style={{
                    padding: '6px 12px',
                    fontSize: theme.fontSizes.sm,
                    borderRadius: theme.borderRadius.sm,
                    border: `1px solid ${theme.colors.border}`,
                    cursor: 'pointer',
                    background: 'transparent',
                    color: theme.colors.text.secondary,
                  }}
                  onClick={() => handleRestoreTeam(team.id)}
                >
                  ↩️ Wiederherstellen
                </button>
              </div>
            );
          })}
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmTeam && (
        <div style={overlayStyle}>
          <div style={dialogStyle}>
            <h3 style={{ margin: '0 0 16px 0', color: theme.colors.text.primary }}>
              Team löschen?
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: theme.colors.text.secondary, margin: '0 0 12px 0' }}>
                {getTeamDeletionWarning(deleteConfirmTeam.analysis) ||
                  `Möchtest du "${deleteConfirmTeam.team.name}" wirklich löschen?`}
              </p>

              {deleteConfirmTeam.analysis.matchesWithResults > 0 && (
                <div style={{
                  padding: theme.spacing.md,
                  background: 'rgba(255, 152, 0, 0.1)',
                  borderRadius: theme.borderRadius.sm,
                  marginTop: '12px',
                }}>
                  <p style={{ margin: 0, color: '#FF9800', fontSize: theme.fontSizes.sm }}>
                    ⚠️ Das Team wird als "entfernt" markiert. Die Ergebnisse bleiben für die Fairness der anderen Teams erhalten.
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setDeleteConfirmTeam(null)}>
                Abbrechen
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmDelete}
                style={{ background: '#F44336' }}
              >
                {deleteConfirmTeam.analysis.matchesWithResults > 0
                  ? 'Als entfernt markieren'
                  : 'Löschen'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// DIALOG STYLES
// ============================================================================

const overlayStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const dialogStyle: CSSProperties = {
  background: theme.colors.surface,
  borderRadius: theme.borderRadius.lg,
  padding: theme.spacing.xl,
  maxWidth: '500px',
  width: '90%',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
};
